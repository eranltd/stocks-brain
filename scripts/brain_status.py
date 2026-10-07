#!/usr/bin/env python3
"""Where the daily brain stands (routine close_run, prompts/daily_brain_routine.md). Read-only.

Run after `bash scripts/data_branch.sh restore` and `python3 scripts/build_pack.py`. Prints one JSON line:

  {"as_of": "<pack market date>", "recorded": <bool>, "run_file": "runs/run.<as_of>.json", "hold": [...]}

`recorded` is true when the run for that market day is already published (one run per market day), so the scheduled
session stops without calling the model; this is also what skips holidays (no new close, so the day is already
recorded). `hold` is what portfolio rule v1 holds today (data/market/longrun.json `now.holdings`) followed by the
forward paper record's latest holdings (data/portfolio/paper.json), without duplicates; [] when neither can be read.
The brain gives these names a small extra vote so the skeptics review them.

Usage: python3 scripts/brain_status.py [--pack .cache/pack.json]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import MARKET, ROOT, RUNS, load_json  # noqa: E402

PACK = ROOT / ".cache" / "pack.json"
LONGRUN = MARKET / "longrun.json"
PAPER = ROOT / "data" / "portfolio" / "paper.json"


def _tickers(xs) -> list[str]:
    return [x.strip().upper() for x in xs if isinstance(x, str) and x.strip()] if isinstance(xs, list) else []


def held(longrun: Path = LONGRUN, paper: Path = PAPER) -> list[str]:
    """Rule v1's current holdings, then the paper record's latest; unreadable or sample files count as empty."""
    out: list[str] = []
    for path, pick in ((longrun, lambda o: (o.get("now") or {}).get("holdings")),
                       (paper, lambda o: ((o.get("rebalances") or [{}])[-1] or {}).get("holdings"))):
        try:
            obj = load_json(path)
        except (OSError, ValueError):
            continue
        if not isinstance(obj, dict) or obj.get("sample"):
            continue
        try:
            names = _tickers(pick(obj))
        except (AttributeError, TypeError):
            continue
        out += [t for t in names if t not in out]
    return out


def status(pack_path: Path = PACK, runs: Path = RUNS, longrun: Path = LONGRUN, paper: Path = PAPER) -> dict:
    if not pack_path.exists():
        raise SystemExit(f"brain_status: no pack at {pack_path}; run `bash scripts/data_branch.sh restore` and "
                         "`python3 scripts/build_pack.py` first")
    try:
        as_of = load_json(pack_path)["pack"]["meta"]["as_of"]
    except (KeyError, TypeError, ValueError) as exc:
        raise SystemExit(f"brain_status: {pack_path} is not a pack ({exc!r}); rebuild it with scripts/build_pack.py")
    run_file = runs / f"run.{as_of}.json"
    try:
        rel = run_file.relative_to(ROOT).as_posix()
    except ValueError:
        rel = str(run_file)
    return {"as_of": as_of, "recorded": run_file.exists(), "run_file": rel, "hold": held(longrun, paper)}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--pack", type=Path, default=PACK)
    a = ap.parse_args()
    print(json.dumps(status(a.pack)))


if __name__ == "__main__":
    main()
