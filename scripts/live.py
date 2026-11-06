"""The hourly market pulse (routine live_pulse): while the US market is open, every hour, what each name on the chosen
lists is doing today, the two index funds, a fear gauge, and the latest market and company news.

The owner opens the app at any hour and wants to know what is happening now: the nightly data lands the next morning,
which is too late for a day like 29 Oct 2026 (Alphabet -12% after its results) or 5 Nov 2026 (the Nasdaq-100 -6.5%).
Source: Finnhub's free plan (quotes and news; key FINNHUB_API_KEY, an Actions secret). Published as moves only: today's
move from yesterday's close, the move since the open and where the price sits in today's range, never a price. The VIX
index itself needs a paid plan, so the fear gauge is a fund that follows it (settings live.fear_proxy), shown as its
own move today. News: headline, source, time and link, as the feed gives them.

Writes data/market/live.json. With no key it does nothing and exits 0, so the workflow stays green until the key exists.
Usage: python3 scripts/live.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import MARKET, Validator, dump_json, load_json, market_watchlist, markets_config, settings  # noqa: E402

API = "https://finnhub.io/api/v1"
GAP_S = 1.1  # the free plan allows 60 calls a minute
NY = timezone(timedelta(hours=-5))  # the US Eastern offset in winter; the session window below allows for summer


def _get(path: str, params: dict, key: str) -> dict | list | None:
    url = f"{API}/{path}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"X-Finnhub-Token": key, "User-Agent": "stocks-brain-live/1"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"live: {path} {params.get('symbol', params.get('category', ''))} failed: {exc}", file=sys.stderr)
        return None


def _num(v) -> float | None:
    return float(v) if isinstance(v, (int, float)) and v == v else None


def quote_view(q: dict | None) -> dict | None:
    """A quote as moves only: {move_pct (vs yesterday's close), from_open_pct, range_pos (0 = today's low, 100 = high),
    at (unix seconds)}. None for an empty quote (the feed answers zeros for an unknown symbol)."""
    if not q:
        return None
    c, pc, o, h, lo = (_num(q.get(k)) for k in ("c", "pc", "o", "h", "l"))
    if not c or not pc:
        return None
    rng = (h - lo) if h is not None and lo is not None else None
    return {
        "move_pct": round((c / pc - 1) * 100, 2),
        "from_open_pct": round((c / o - 1) * 100, 2) if o else None,
        "range_pos": round((c - lo) / rng * 100) if rng and rng > 0 else None,
        "at": int(q.get("t") or 0),
    }


FEAR_STEPS = [(15, "panic"), (5, "nervous"), (-5, "normal")]


def fear_level(move: float | None) -> str | None:
    """The fear gauge in words, from the VIX-tracking fund's move today: up 15%+ panic, 5%+ nervous, down 5%+ calm."""
    if move is None:
        return None
    for bar, word in FEAR_STEPS:
        if move >= bar:
            return word
    return "calm"


def mood(up: int, down: int, index_move: float | None) -> str:
    """The market's mood in one word, from the main index fund's move and the share of names up."""
    n = up + down
    share = up / n if n else 0.5
    if index_move is None:
        return "mixed"
    if index_move <= -2 or (index_move <= -1 and share < 0.3):
        return "selloff"
    if index_move < -0.3:
        return "down"
    if index_move >= 1.5 and share > 0.6:
        return "rally"
    if index_move > 0.3:
        return "up"
    return "flat"


def news_item(n: dict, related: str | None = None) -> dict | None:
    head, url = (n.get("headline") or "").strip(), (n.get("url") or "").strip()
    if not head or not url.startswith("https://"):
        return None
    return {"headline": head[:220], "source": (n.get("source") or "")[:40], "url": url[:500],
            "at": int(n.get("datetime") or 0), **({"symbol": related} if related else {})}


def build(key: str, st: dict, now: datetime) -> dict:
    cfg = st["live"]
    lists = {m["id"]: m for m in markets_config()["markets"]}
    names: dict[str, dict] = {}
    for lid in cfg["lists"]:
        m = lists.get(lid)
        if not m:
            continue
        wl = market_watchlist(m)
        for s in wl["symbols"]:
            names.setdefault(s["symbol"], {"name": s.get("name", s["symbol"]), "list": lid})
    special = [*cfg["indexes"], cfg["fear_proxy"]]
    quotes: dict[str, dict] = {}
    for sym in [*special, *names]:
        v = quote_view(_get("quote", {"symbol": sym}, key))
        if v:
            quotes[sym] = v
        time.sleep(GAP_S)
    rows = [{"symbol": s, "list": names[s]["list"], **quotes[s]} for s in names if s in quotes]
    main = [r for r in rows if r["list"] == cfg["lists"][0]]
    up = sum(1 for r in main if r["move_pct"] > 0)
    down = sum(1 for r in main if r["move_pct"] < 0)
    idx = {s: quotes.get(s) for s in cfg["indexes"]}
    lead = idx.get(cfg["indexes"][0]) or {}
    fear = quotes.get(cfg["fear_proxy"])
    # Headlines for the biggest movers among the companies (the sector funds move with the market and need none).
    movers = sorted((r for r in rows if r["list"] != "sectors"), key=lambda r: -abs(r["move_pct"]))[: cfg["company_news_names"]]
    day_from = (now - timedelta(days=2)).date().isoformat()
    company: list[dict] = []
    for r in movers:
        got = _get("company-news", {"symbol": r["symbol"], "from": day_from, "to": now.date().isoformat()}, key) or []
        for n in sorted(got, key=lambda x: -(x.get("datetime") or 0))[:3]:
            if (it := news_item(n, r["symbol"])):
                company.append(it)
        time.sleep(GAP_S)
    general = [it for n in (_get("news", {"category": "general"}, key) or [])[: cfg["market_news_max"]] if (it := news_item(n))]
    stamp = max((q["at"] for q in quotes.values()), default=0)
    return {
        "as_of": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "quotes_at": stamp,
        "sample": False,
        "provider": "finnhub",
        "big_move_pct": cfg["big_move_pct"],
        "indexes": {s: v for s, v in idx.items() if v},
        "fear": {"symbol": cfg["fear_proxy"], **fear, "level": fear_level(fear["move_pct"])} if fear else None,
        "breadth": {"up": up, "down": down, "flat": len(main) - up - down},
        "mood": mood(up, down, lead.get("move_pct")),
        "symbols": rows,
        "company_news": company,
        "market_news": general,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    key = os.environ.get("FINNHUB_API_KEY", "").strip()
    if not key:
        print("live: no FINNHUB_API_KEY, nothing to do")
        return
    doc = build(key, settings(), datetime.now(timezone.utc))
    if not doc["symbols"]:
        raise SystemExit("live: no quotes came back (nothing written)")
    errs = Validator().validate(doc, "live.schema.json")
    if errs:
        raise SystemExit(f"live.json: schema check failed (nothing written): {errs[:5]}")
    print(f"live: {len(doc['symbols'])} names, mood {doc['mood']}, fear {doc['fear'] and doc['fear']['level']}, "
          f"{len(doc['company_news'])} company and {len(doc['market_news'])} market headlines")
    if not args.dry_run:
        dump_json(MARKET / "live.json", doc, compact=True)


if __name__ == "__main__":
    main()
