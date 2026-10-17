#!/usr/bin/env python3
"""Record the why-it-moved notes of one market day (routine why_notes). Fails closed: nothing is written unless every
check passes.

The routine's workflow (.claude/workflows/why.js) writes `{"market_date", "notes": [...]}` (schemas/why_notes.schema.json)
and the session dispatches .github/workflows/why.yml with it. That Action restores the data branch and runs this script,
which checks
  - the shape (schema), and that market_date is a market day in our published series, not in the future
  - every note's key is one of the candidates code recomputes for that day (scripts/why_candidates.py, uncapped), with
    the same kind and market, each key once, and the day not recorded yet
  - the words: headline at most 90 characters, why at most 320, no digits, no quotation marks, no prices, price targets,
    ratings or advice, no links, no first person; an "unclear" note says plainly that no clear cause was found
  - the sources: at most four (at least one unless the note is "unclear"), https links on a host of the allow-list
    (config/news_sources.json, subdomains included), each published on or before the market day plus one day
then fills move_pct and symbols FROM OUR DATA (never from the model), stamps researched_at and merges the notes into
data/market/why.json, keeping the newest thirty days.

Usage: python3 scripts/record_why.py [--check] NOTES_JSON [--today YYYY-MM-DD]
  --check  validate only (the routine runs this before it dispatches); writes nothing
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import CONFIG, DOCS, MARKET, Validator, dump_json, load_json  # noqa: E402
from lint import (FIRST_PERSON, OUTLOOK_BANNED, PRICE_LIKE, PRICE_TARGET_PT, QUOTE_MARKS, SINGLE_QUOTED, STOCK_MOVE,  # noqa: E402
                  STOCK_PRICE)
import why_candidates  # noqa: E402

WHY = MARKET / "why.json"
NEWS_SOURCES = CONFIG / "news_sources.json"
KEEP_DAYS = 30  # calendar days of notes kept, counted back from the newest market day
SOURCE_LAG_DAYS = 1  # a source may be dated the day after the move (news after the close, a next-morning write-up)
MAX_INPUT_CHARS = 60000  # GitHub caps a workflow_dispatch's inputs at 65,535 characters in all
# Advice and market opinions: a note explains a move, it never says what to do about it.
ADVICE = re.compile(r"\b(you|we|investors|one)\s+(should|might want to|ought to)\b|\bshould\s+(buy|sell|hold)\b"
                    r"|\btime to (buy|sell)\b|\bbuy(ing)? the dip\b|\bbuying opportunit(y|ies)\b|\bbargain\b"
                    r"|\b(under|over)valued\b|\brecommend\w*\b|\bload up\b|\bworth (buying|owning)\b|\bmust[- ]own\b"
                    r"|\bstrong (buy|sell)\b|\bprice objective\b|\b(top|best) pick\b|\bnot financial advice\b", re.I)
LINK = re.compile(r"https?://|\bwww\.", re.I)
# Every double-quote-like mark a model might use to quote a source (lint's QUOTE_MARKS plus guillemets, low-9, prime and
# fullwidth forms, and the Hebrew gershayim), and single-quote-like marks that only ever open or close a quote.
NOTE_QUOTES = (*QUOTE_MARKS, "«", "»", "‹", "›", "„", "‟", "″", "‶", "〝", "〞", "＂", "״", "‚", "‛", "＇")
# Sizes and money in words or symbols ("eight billion", "a hundred percent", "$"): code shows the move, and a note
# never states an amount.
AMOUNT = re.compile(r"[$€£¥₪%]|\b(per ?cent|percent(age)?|(hundred|thousand|million|billion|trillion)s?|bn|mln)\b", re.I)
HOST_CHARS = re.compile(r"^[a-z0-9.-]+$")  # a plain DNS name: no backslash or other characters browsers read differently
# What an honest "unclear" note says (any of these): we looked and found no clear, sourced cause.
UNCLEAR_WORDS = re.compile(r"\b(unclear|not clear|no clear|could not|couldn't|did not find|didn't find|found no|no sign"
                           r"|no (\w+ ){0,2}(cause|reason|news|explanation|report|announcement|source)s?)\b", re.I)


def allow_list(path: Path = NEWS_SOURCES) -> dict[str, str]:
    """{host: publisher} of config/news_sources.json."""
    return {s["host"]: s["publisher"] for s in load_json(path)["sources"]}


def allowed_host(url: str, hosts) -> str | None:
    """The allow-list host a URL belongs to (itself or a subdomain), or None. https only, no user, password or port."""
    try:
        u = urlsplit(url)
        port = u.port
    except ValueError:
        return None
    host = (u.hostname or "").lower().rstrip(".")
    if u.scheme != "https" or u.username or u.password or port or not host or not HOST_CHARS.match(host):
        return None
    if "\\" in url or "@" in u.netloc:  # browsers read a backslash as a slash: https://evil.example\.sec.gov is evil.example
        return None
    return next((h for h in hosts if host == h or host.endswith("." + h)), None)


def text_problems(text: str) -> list[str]:
    """Why a note's headline or why is not in our own plain words (empty when it is fine)."""
    errs = []
    low = text.lower()
    if any(unicodedata.category(ch) in ("Cc", "Cf", "Co", "Cs") for ch in text):
        errs.append("hidden or control characters (plain text only)")
    if any(ch.isalpha() and "LATIN" not in unicodedata.name(ch, "") for ch in text):
        errs.append("letters outside the Latin alphabet (English only; look-alike letters can hide words)")
    if re.search(r"\d", text):
        errs.append("digits (say it in words; code shows the move)")
    if any(q in text for q in NOTE_QUOTES) or SINGLE_QUOTED.search(text):
        errs.append("quotation marks (paraphrase in our own words)")
    if PRICE_LIKE.search(text) or STOCK_PRICE.search(text):
        errs.append("a price or market value")
    if AMOUNT.search(text):
        errs.append("an amount, a percent or a money figure (say it plainly: a large deal; code shows the move)")
    if STOCK_MOVE.search(text):
        errs.append("a share-price move (the site shows the move from our data)")
    if any(b in low for b in OUTLOOK_BANNED) or PRICE_TARGET_PT.search(text):
        errs.append("a price target or a rating")
    if ADVICE.search(text):
        errs.append("advice words (a note explains a move; it never says what to do)")
    if LINK.search(text):
        errs.append("a link in the text (links go in sources)")
    if FIRST_PERSON.search(text):
        errs.append("first person (say what happened, not how it was found)")
    return errs


def note_problems(n: dict, market_date: str, hosts, today: str, banned: list[str] = ()) -> list[str]:
    """The word and source checks of one note (shape is the schema's job). Used here and by lint on the published file."""
    errs = []
    for field in ("headline", "why"):
        errs += [f"{field}: {e}" for e in text_problems(n[field])]
        low = n[field].lower()
        errs += [f"{field}: banned phrase {b!r}" for b in banned if b.lower() in low]
    if n["confidence"] == "unclear" and not UNCLEAR_WORDS.search(n["why"]):
        errs.append("an unclear note must say plainly that no clear cause was found")
    srcs = n["sources"]
    if n["confidence"] != "unclear" and not srcs:
        errs.append(f"a {n['confidence']} note needs at least one source")
    urls = [s["url"] for s in srcs]
    if len(urls) != len(set(urls)):
        errs.append("the same source twice")
    latest = (date.fromisoformat(market_date) + timedelta(days=SOURCE_LAG_DAYS)).isoformat()
    for s in srcs:
        try:
            date.fromisoformat(s["published"])
        except ValueError:
            errs.append(f"source date {s['published']!r} is not a real date")
        if not allowed_host(s["url"], hosts):
            errs.append(f"source {urlsplit(s['url']).hostname or s['url']!r} is not on the allow-list (config/news_sources.json)")
        if s["published"] > latest:
            errs.append(f"source dated {s['published']}, after the market day plus one ({latest})")
        if s["published"] > today:
            errs.append(f"source dated {s['published']}, in the future")
        if any(q in s["publisher"] for q in NOTE_QUOTES):
            errs.append("publisher: quotation marks")
    return errs


def check(obj, views: list[dict], hosts, today: str, recorded: set[str], banned: list[str] = ()) -> tuple[list[str], dict]:
    """All checks of the routine's output. Returns (errors, {key: candidate}) for the notes' day."""
    errs = Validator().validate(obj, "why_notes.schema.json")
    if errs:
        return errs, {}
    day = obj["market_date"]
    days = why_candidates.market_dates(views)
    if day > today:
        return [f"market_date {day} is in the future"], {}
    if day not in days:
        return [f"market_date {day} is not a market day in our published series (last close {days[-1] if days else 'none'})"], {}
    if day in recorded:
        return [f"notes for {day} are already recorded (one set per market day)"], {}
    cands = {c["key"]: c for c in why_candidates.candidates(views, day, cap=None)["candidates"]}
    keys = [n["key"] for n in obj["notes"]]
    if len(keys) != len(set(keys)):
        errs.append("a key appears twice")
    for i, n in enumerate(obj["notes"]):
        c = cands.get(n["key"])
        where = f"note {i} ({n['key']})"
        if not c:
            errs.append(f"{where}: not a candidate for {day} (code flags {sorted(cands) or 'nothing'})")
        elif (n["kind"], n["market"]) != (c["kind"], c["market"]):
            errs.append(f"{where}: kind/market {n['kind']}/{n['market']} differ from the candidate's {c['kind']}/{c['market']}")
        errs += [f"{where}: {e}" for e in note_problems(n, day, hosts, today, banned)]
    size = len(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
    if size > MAX_INPUT_CHARS:
        errs.append(f"the notes are {size} characters, over the dispatch limit of {MAX_INPUT_CHARS}")
    return errs, cands


def _sources(srcs: list[dict], hosts: dict | None) -> list[dict]:
    """The sources as published: each publisher's name taken from the allow-list (config/news_sources.json), never from
    the model, so no free text reaches the site through it."""
    if not hosts:
        return srcs
    return [{**s, "publisher": hosts.get(allowed_host(s["url"], hosts), s["publisher"])} for s in srcs]


def merge(existing: dict | None, obj: dict, cands: dict, researched_at: str, keep_days: int = KEEP_DAYS,
          hosts: dict | None = None) -> dict:
    """data/market/why.json with this day's notes added (move_pct, symbols and name from our data, publishers from the
    allow-list `hosts` when given) and notes older than keep_days before the newest market day dropped. Newest day first,
    biggest move first within a day."""
    old = [n for n in (existing or {}).get("notes", []) if not (existing or {}).get("sample")]
    new = [{"market_date": obj["market_date"], **{k: n[k] for k in ("key", "kind", "market", "headline", "why", "confidence")},
            "sources": _sources(n["sources"], hosts),
            "move_pct": cands[n["key"]]["move_pct"], "symbols": list(cands[n["key"]]["symbols"]),
            **({"name": str(cands[n["key"]]["name"])[:80]} if cands[n["key"]].get("name") else {}), "researched_at": researched_at}
           for n in obj["notes"]]
    notes = [n for n in old if n["market_date"] != obj["market_date"]] + new
    as_of = max(n["market_date"] for n in notes)
    cutoff = (date.fromisoformat(as_of) - timedelta(days=keep_days)).isoformat()
    notes = sorted((n for n in notes if n["market_date"] > cutoff), key=lambda n: (n["market_date"], abs(n["move_pct"])), reverse=True)
    return {"version": 1, "as_of": as_of, "sample": False, "notes": notes}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("notes", type=Path)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--today")
    ap.add_argument("--why", type=Path, default=WHY)
    a = ap.parse_args()
    now = datetime.now(timezone.utc).replace(microsecond=0)
    today = a.today or now.date().isoformat()
    try:
        raw = a.notes.read_text(encoding="utf-8")
        if len(raw) > MAX_INPUT_CHARS:
            raise ValueError(f"{len(raw)} characters, over the dispatch limit of {MAX_INPUT_CHARS}")
        obj = json.loads(raw)
    except (OSError, ValueError) as exc:
        print(f"record_why: FAILED closed, nothing written: cannot read {a.notes}: {exc}", file=sys.stderr)
        return 1
    import why_status
    existing = load_json(a.why) if a.why.exists() else None
    banned = load_json(DOCS / "guardrails.json")["banned_phrases"]
    hosts = allow_list()
    errs, cands = check(obj, why_candidates.load_views(), hosts, today, why_status.recorded_days(a.why), banned)
    doc = None
    if not errs:
        doc = merge(existing, obj, cands, now.isoformat().replace("+00:00", "Z"), hosts=hosts)
        errs = Validator().validate(doc, "why.schema.json")
    if errs:
        print("record_why: FAILED closed, nothing written:", *errs, sep="\n  ", file=sys.stderr)
        return 1
    day = obj["market_date"]
    if a.check:
        print(f"record_why: check OK: {len(obj['notes'])} note(s) for {day}")
        return 0
    dump_json(a.why, doc, compact=True)
    print(f"record_why: {len(obj['notes'])} note(s) for {day} -> {a.why} ({len(doc['notes'])} kept)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
