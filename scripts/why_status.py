#!/usr/bin/env python3
"""Where the why-it-moved notes stand (routine why_notes, prompts/why_routine.md). Read-only.

Run after `bash scripts/data_branch.sh restore`. Prints one JSON line:

  {"market_date": "<the main list's last close>", "recorded": <bool>}

`recorded` is true when data/market/why.json already holds a note for that market day, so a later wake of the routine
stops without researching again (this also skips weekends and holidays: no new close, the day is already recorded).
A day with no unusual move gets no note and stays unrecorded; the routine then stops at scripts/why_candidates.py,
which finds nothing to research. Sample files never count.

Usage: python3 scripts/why_status.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import MARKET, load_json  # noqa: E402

DERIVED = MARKET / "derived.json"
WHY = MARKET / "why.json"


def recorded_days(why: Path = WHY) -> set[str]:
    """Market days with at least one live note; an unreadable or sample file counts as none."""
    try:
        doc = load_json(why)
    except (OSError, ValueError):
        return set()
    if not isinstance(doc, dict) or doc.get("sample") is not False or not isinstance(doc.get("notes"), list):
        return set()
    return {n["market_date"] for n in doc["notes"] if isinstance(n, dict) and isinstance(n.get("market_date"), str)}


def status(derived: Path = DERIVED, why: Path = WHY) -> dict:
    if not derived.exists():
        raise SystemExit(f"why_status: no market data at {derived}; run `bash scripts/data_branch.sh restore` first")
    try:
        day = load_json(derived)["as_of"]
    except (KeyError, TypeError, ValueError) as exc:
        raise SystemExit(f"why_status: {derived} is not derived market data ({exc!r})")
    return {"market_date": day, "recorded": day in recorded_days(why)}


def main() -> None:
    print(json.dumps(status()))


if __name__ == "__main__":
    main()
