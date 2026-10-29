#!/usr/bin/env python3
"""Today's action, in one line, for the household's morning push (routine close_run, prompts/daily_brain_routine.md).

The household asked for the system to be proactive: each market morning, say what to do today. This is computed by
code from published data, never by the model, and it is real-money guidance only in the one way the house rules allow
(docs/household.md): the weekly whole-market buy, and "do not sell in a drop". Single stocks stay pretend money.

The line, at most PUSH_MAX characters, in this order:
  1. Real money today:
     - the week's first trading day (holidays skipped, us_market_calendar)  -> the weekly buy
     - the whole market fell DROP_DAY_PCT or more on the last close, or sits
       CORRECTION_PCT or more below its high                                 -> no action, do not sell
     - otherwise                                                             -> no action, and the next buy day
  2. Pretend money: a new weekly bet (first run of the week), or a brain call that is no longer neutral or changed
     since the run before; otherwise "all neutral".

Usage: python3 scripts/today_action.py --picks .cache/brain/picks.json [--today YYYY-MM-DD] [--runs DIR] [--derived F]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import MARKET, RUNS, load_json  # noqa: E402
import us_market_calendar as cal  # noqa: E402

PUSH_MAX = 200
DROP_DAY_PCT = -2.0  # a day this bad is when people sell in fear; the reminder matters most then
CORRECTION_PCT = -10.0  # the usual line for a correction


def buy_day(today: date) -> date | None:
    """This week's buy day: the first trading day of today's ISO week."""
    return cal.first_trading_day_of_week(today - timedelta(days=today.weekday()))


def next_buy_day(today: date) -> date:
    d = buy_day(today)
    if d and d > today:
        return d
    monday = today - timedelta(days=today.weekday()) + timedelta(days=7)
    for k in range(6):  # a fully closed week is not real, but never loop forever
        d = cal.first_trading_day_of_week(monday + timedelta(days=7 * k))
        if d:
            return d
    return monday


def whole_market(derived: dict | None) -> dict:
    """The whole-market fund's last day and distance from its high, from the derived file's context (role spx)."""
    for i in ((derived or {}).get("context") or {}).get("instruments") or []:
        if i.get("role") == "spx":
            return {"day": i.get("change_1d_pct"), "from_high": i.get("from_high_pct")}
    return {"day": None, "from_high": None}


def real_money(today: date, market: dict) -> str:
    if buy_day(today) == today:
        return "TODAY: weekly buy day. Put this week's amount into the whole-market fund."
    day, high = market.get("day"), market.get("from_high")
    nxt = next_buy_day(today).strftime("%a %-d %b")
    if isinstance(day, (int, float)) and day <= DROP_DAY_PCT:
        return f"TODAY: no action. Market fell {abs(day):.1f}% - don't sell; the {nxt} buy gets more for the money."
    if isinstance(high, (int, float)) and high <= CORRECTION_PCT:
        return f"TODAY: no action. Market is {abs(high):.0f}% off its high - normal; keep the {nxt} buy."
    return f"TODAY: no action needed. Next buy {nxt}."


def _week(d: str) -> tuple[int, int]:
    return date.fromisoformat(d).isocalendar()[:2]


def pretend(picks: dict, as_of: str, earlier: list[dict]) -> str:
    """The paper side: a new bet this week, a call that moved, or all neutral."""
    prior = sorted((r for r in earlier if r.get("status") == "ok" and r.get("date", "") < as_of), key=lambda r: r["date"])
    bets = picks.get("bets")
    if bets and not any(r.get("bets") and _week(r["date"]) == _week(as_of) for r in prior):
        return f"Paper: new weekly bet {'/'.join(bets['best'])} over {'/'.join(bets['worst'])}."
    before = {p["pick"]["ticker"]: p["pick"]["stance"] for p in (prior[-1]["picks"] if prior else [])}
    moved = [p for p in picks.get("picks", []) if p["stance"] != "neutral" or before.get(p["ticker"], "neutral") != p["stance"]]
    if moved:
        return "Paper: " + ", ".join(f"{p['ticker']} {p['stance']}" for p in moved[:3]) + "."
    return "Paper: all calls neutral."


def line(today: date, as_of: str, picks: dict, earlier: list[dict], derived: dict | None) -> str:
    out = f"{real_money(today, whole_market(derived))} {pretend(picks, as_of, earlier)}"
    return out if len(out) <= PUSH_MAX else out[: PUSH_MAX - 1] + "…"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--picks", required=True)
    ap.add_argument("--today")
    ap.add_argument("--runs", default=str(RUNS))
    ap.add_argument("--derived", default=str(MARKET / "derived.json"))
    args = ap.parse_args()
    picks = load_json(Path(args.picks))
    derived = load_json(Path(args.derived)) if Path(args.derived).exists() else None
    as_of = (derived or {}).get("as_of") or date.today().isoformat()
    earlier = [load_json(p) for p in sorted(Path(args.runs).glob("run.*.json"))[-10:]]
    today = date.fromisoformat(args.today) if args.today else date.today()
    print(line(today, as_of, picks, earlier, derived))
    return 0


if __name__ == "__main__":
    sys.exit(main())
