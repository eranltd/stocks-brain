#!/usr/bin/env python3
"""Which moves of one market day deserve a "why it moved" note (routine why_notes). Code only, read-only.

Run after `bash scripts/data_branch.sh restore`. Reads the published derived numbers (data/market/derived.json and
data/markets/<id>/derived.json, percent moves only) and prints one JSON object:

  {"market_date": "YYYY-MM-DD",
   "candidates": [{"key", "kind": "stock"|"fund"|"sector", "market", "symbols": [...], "move_pct", "why_flagged",
                   "name"}]}

A candidate is
  - a name on any list (a company, or a fund on a fund list that is not a sector fund) whose day move is at least
    three percent and at least three standard deviations of its daily moves over the sixty days before (at least
    twenty of them): the "unusual move" test of the site's feed (site/src/lib/feed.js UNUSUAL);
  - a context fund of the main list, a market's benchmark or a sector fund that moved one and a half percent or more;
  - a sector average of the main list (the plain mean of its names' day moves, as site/src/lib/marketday.js computes
    it) of two and a half percent or more, when the sector has at least two names.
Then duplicates are folded together, so one story gets one note:
  - a sector average driven mostly by flagged names (without them it would not be flagged) merges into the biggest of
    them (on 2026-10-09 the Communication average of minus four only echoed T-Mobile's fall);
  - when the S&P 500 fund itself (or else the main benchmark) is flagged, a fund or sector average that moved the same
    way and within one and a half points of it is the market's story and merges into it.
A symbol on several lists counts once, in the first market of config/markets.json that has it (the main list first).
At most five candidates, biggest move first. `key` is the ticker, or `sector:<GICS sector>` for a sector average.

Usage: python3 scripts/why_candidates.py [--date YYYY-MM-DD] [--all]
  --date  another market day still inside the published series (default: the main list's last close)
  --all   do not cap at five (scripts/record_why.py checks note keys against this full list)
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import ROOT, load_json  # noqa: E402

UNUSUAL = {"lookback": 60, "min_sd": 3, "min_pct": 3, "min_history": 20}  # site/src/lib/feed.js UNUSUAL (tests compare)
FUND_MIN_PCT = 1.5  # a context fund, a benchmark or a sector fund
SECTOR_MIN_PCT = 2.5  # a sector average of the main list
SECTOR_MIN_NAMES = 2  # a one-name "sector" is that name, judged by the name test
MARKET_MERGE_PCT = 1.5  # a fund this close to the market's own move (same direction) is the market's story
MAX_CANDIDATES = 5


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def day_moves(row: dict) -> dict[str, float]:
    """{date: percent} from a derived row's indexed series (v[k] / v[k-1] - 1), the last close taken from the published
    change_1d_pct when the series ends on the row's last date. Mirrors dayMoves in site/src/lib/feed.js."""
    s = row.get("series") or row.get("spark") or []
    out: dict[str, float] = {}
    for k in range(1, len(s)):
        a, b = s[k - 1].get("v"), s[k].get("v")
        if _num(a) and a and _num(b):
            out[s[k]["date"]] = (b / a - 1) * 100
    last = s[-1]["date"] if s else None
    if last and _num(row.get("change_1d_pct")) and (not row.get("last_date") or row["last_date"] == last):
        out[last] = row["change_1d_pct"]
    return out


def instrument_moves(inst: dict, as_of: str | None) -> dict[str, float]:
    """A context instrument's day moves: its recent_days, plus the last close when it is missing there."""
    out = {d["date"]: d["change_pct"] for d in inst.get("recent_days") or [] if _num(d.get("change_pct"))}
    if as_of and _num(inst.get("change_1d_pct")) and as_of not in out:
        out[as_of] = inst["change_1d_pct"]
    return out


def _sd(xs: list[float]) -> float | None:
    if len(xs) < 2:
        return None
    m = sum(xs) / len(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def unusual(moves: dict[str, float], day: str, opts: dict = UNUSUAL) -> dict | None:
    """The feed's unusual-move test for one day: {"pct", "sd", "times", "n"} when it passes, else None."""
    if day not in moves:
        return None
    dates = sorted(moves)
    k = dates.index(day)
    prev = [moves[d] for d in dates[max(0, k - opts["lookback"]):k]]
    if len(prev) < opts["min_history"]:
        return None
    s, v = _sd(prev), moves[day]
    if not s or abs(v) < opts["min_pct"] or abs(v) < opts["min_sd"] * s:
        return None
    return {"pct": v, "sd": s, "times": abs(v) / s, "n": len(prev)}


def _pct(v: float) -> str:
    return f"{v:+.1f}%"


def _verb(v: float) -> str:
    return "rose" if v > 0 else "fell"


def raw_candidates(views: list[dict], day: str) -> list[dict]:
    """Every flagged item of one market day, before folding duplicates. `views` are the markets in config order, the
    default first: {"id", "kind", "default", "benchmark", "watchlist", "derived"} (derived None when not published)."""
    seen: set[str] = set()
    out: list[dict] = []

    def add(item: dict) -> None:
        out.append(item)

    for v in views:
        der = v.get("derived")
        if not der:
            continue
        rows = {r["symbol"]: r for r in der.get("symbols", [])}
        for s in v["watchlist"].get("symbols", []):
            sym, row = s["symbol"], rows.get(s["symbol"])
            if sym in seen or not row:
                continue
            moves = day_moves(row)
            if day not in moves:
                continue
            seen.add(sym)  # judged once, in the first market that has it for this day
            pct = moves[day]
            if v["kind"] == "funds" and s.get("category") == "Sector":
                if abs(pct) >= FUND_MIN_PCT:
                    add({"key": sym, "kind": "fund", "market": v["id"], "symbols": [sym], "move_pct": pct, "name": s["name"],
                         "why_flagged": f"a sector fund on the {v['label']} list {_verb(pct)} {abs(pct):.1f}% in a day"})
                continue
            u = unusual(moves, day)
            if u:
                times = f"{u['times']:.0f}" if u["times"] >= 10 else f"{u['times']:.1f}"
                add({"key": sym, "kind": "fund" if v["kind"] == "funds" else "stock", "market": v["id"], "symbols": [sym],
                     "move_pct": pct, "name": s["name"],
                     "why_flagged": f"{_verb(pct)} {abs(pct):.1f}% in a day, about {times} times its usual daily swing "
                                    f"({u['sd']:.1f}% over the {u['n']} days before)"})
        bench = v["benchmark"]
        if bench not in seen and bench in rows:
            moves = day_moves(rows[bench])
            if day in moves:
                seen.add(bench)
            if day in moves and abs(moves[day]) >= FUND_MIN_PCT:
                add({"key": bench, "kind": "fund", "market": v["id"], "symbols": [bench], "move_pct": moves[day],
                     "name": v.get("benchmark_label") or bench,
                     "why_flagged": f"the benchmark of the {v['label']} list {_verb(moves[day])} {abs(moves[day]):.1f}% in a day"})
        if v.get("default"):
            for inst in (der.get("context") or {}).get("instruments", []):
                sym = inst["symbol"]
                moves = instrument_moves(inst, der.get("as_of"))
                if sym in seen or day not in moves:
                    continue
                seen.add(sym)
                if abs(moves[day]) < FUND_MIN_PCT:
                    continue
                add({"key": sym, "kind": "fund", "market": v["id"], "symbols": [sym], "move_pct": moves[day],
                     "name": inst.get("name") or sym,
                     "why_flagged": f"a market-context fund of the main list {_verb(moves[day])} {abs(moves[day]):.1f}% in a day"})
            out += sector_candidates(v, rows, day)
    return out


def sector_moves(v: dict, rows: dict, day: str) -> dict[str, list[tuple[str, float]]]:
    """{sector: [(symbol, day move)]} for the main list's names, as site/src/lib/marketday.js groups them."""
    by: dict[str, list[tuple[str, float]]] = {}
    for s in v["watchlist"].get("symbols", []):
        row = rows.get(s["symbol"])
        moves = day_moves(row) if row else {}
        if day in moves:
            by.setdefault(s.get("sector") or "Other", []).append((s["symbol"], moves[day]))
    return by


def sector_candidates(v: dict, rows: dict, day: str) -> list[dict]:
    out = []
    for sector, xs in sorted(sector_moves(v, rows, day).items()):
        if len(xs) < SECTOR_MIN_NAMES:
            continue
        avg = sum(p for _, p in xs) / len(xs)
        if abs(avg) < SECTOR_MIN_PCT:
            continue
        xs = sorted(xs, key=lambda t: (-abs(t[1]), t[0]))
        out.append({"key": f"sector:{sector}", "kind": "sector", "market": v["id"], "symbols": [s for s, _ in xs],
                    "move_pct": avg, "name": sector, "members": xs,
                    "why_flagged": f"the {len(xs)} {sector} names on the {v['label']} list moved {_pct(avg)} on average"})
    return out


def fold(items: list[dict], spx: str | None, bench: str | None) -> list[dict]:
    """Fold duplicate stories together (see the module doc). Returns new dicts; the input is not changed."""
    items = [dict(c, symbols=list(c["symbols"])) for c in items]
    stocks = {c["key"]: c for c in items if c["kind"] == "stock"}
    keep = []
    for c in items:
        if c["kind"] == "sector":
            flagged = [(s, p) for s, p in c["members"] if s in stocks]
            rest = [p for s, p in c["members"] if s not in stocks]
            if flagged and (not rest or abs(sum(rest) / len(rest)) < SECTOR_MIN_PCT):
                lead = stocks[max(flagged, key=lambda t: (abs(t[1]), t[0]))[0]]
                lead["why_flagged"] += f"; it also moved the {c['name']} average of the main list to {_pct(c['move_pct'])}"
                continue
        keep.append(c)
    anchor = next((c for c in keep if c["key"] == spx), None) or next((c for c in keep if c["key"] == bench), None)
    if anchor:
        out = []
        for c in keep:
            same = c is not anchor and c["kind"] in ("fund", "sector") and (c["move_pct"] > 0) == (anchor["move_pct"] > 0) \
                and abs(c["move_pct"] - anchor["move_pct"]) < MARKET_MERGE_PCT
            if same:
                anchor["symbols"] += [s for s in (c["symbols"] if c["kind"] == "fund" else []) if s not in anchor["symbols"]]
                anchor.setdefault("_with", []).append(f"{c['name'] if c['kind'] == 'sector' else c['key']} {_pct(c['move_pct'])}")
                continue
            out.append(c)
        if anchor.get("_with"):
            anchor["why_flagged"] += "; moved with it: " + ", ".join(anchor.pop("_with"))
        keep = out
    for c in keep:
        c.pop("members", None)
        c["move_pct"] = round(c["move_pct"], 2)
    return sorted(keep, key=lambda c: (-abs(c["move_pct"]), c["key"]))


def candidates(views: list[dict], day: str | None = None, cap: int | None = MAX_CANDIDATES) -> dict:
    """{"market_date", "candidates"} for one market day (default: the main list's last close)."""
    main = next((v for v in views if v.get("default")), None)
    if not main or not main.get("derived"):
        raise SystemExit("why_candidates: no main market data (data/market/derived.json); restore the data branch first")
    day = day or main["derived"]["as_of"]
    spx = next((i["symbol"] for i in (main["derived"].get("context") or {}).get("instruments", []) if i.get("role") == "spx"), None)
    out = fold(raw_candidates(views, day), spx, main["benchmark"])
    return {"market_date": day, "candidates": out[:cap] if cap else out}


def market_dates(views: list[dict]) -> list[str]:
    """The market days the main list's published series covers (oldest first)."""
    main = next((v for v in views if v.get("default")), None)
    der = (main or {}).get("derived") or {}
    rows = {r["symbol"]: r for r in der.get("symbols", [])}
    row = rows.get(main["benchmark"]) if main else None
    return sorted(day_moves(row)) if row else []


def load_views(root: Path = ROOT) -> list[dict]:
    """The markets of config/markets.json in config order (default first), each with its list and published derived
    numbers (None when the file is not there)."""
    mc = load_json(root / "config" / "markets.json")
    views = []
    for m in sorted(mc["markets"], key=lambda m: m["id"] != mc["default"]):
        der_path = root / m["data"] / "derived.json"
        views.append({"id": m["id"], "label": m["label"], "kind": m["kind"], "default": m["id"] == mc["default"],
                      "benchmark": m["benchmark"], "benchmark_label": m.get("benchmark_label"),
                      "watchlist": load_json(root / m["watchlist"]),
                      "derived": load_json(der_path) if der_path.exists() else None})
    return views


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--date")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    views = load_views()
    if a.date and a.date not in market_dates(views):
        raise SystemExit(f"why_candidates: {a.date} is not a market day in the published series")
    print(json.dumps(candidates(views, a.date, cap=None if a.all else MAX_CANDIDATES), ensure_ascii=False))


if __name__ == "__main__":
    main()
