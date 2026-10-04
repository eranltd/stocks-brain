#!/usr/bin/env python3
"""Fetch daily bars for the watchlist + benchmark into data/prices/<SYMBOL>.json.

All-or-nothing: every symbol is fetched, merged with what is on disk, trimmed to
prices.keep_days, sanity-checked and schema-validated in memory. Only if all pass is
anything written (fail closed).

Usage: python3 scripts/fetch_prices.py [--dry-run] [--fixtures DIR]
  --fixtures DIR  read <DIR>/<SYMBOL>.csv instead of the network (tests / offline)
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import CONFIG, PRICES, Validator, dump_json, load_json, settings, watchlist  # noqa: E402
import providers  # noqa: E402


def symbols() -> list[str]:
    st = settings()
    out = [s["symbol"] for s in watchlist()["symbols"]]
    bench = st["scoring"]["benchmark"]["symbol"]
    return out + ([bench] if bench not in out else [])


def check_provider(name: str | None) -> None:
    src = {s["id"]: s for s in load_json(CONFIG / "sources.json")["sources"]}.get("prices")
    if not src or src["status"] != "active" or src["provider"] != name:
        raise SystemExit(f"sources.json 'prices' must be active with provider {name!r} (fail closed)")


def merge(old: list[dict], new: list[dict], keep: int) -> list[dict]:
    by_date = {b["date"]: b for b in old}
    by_date.update({b["date"]: b for b in new})  # provider wins on overlap (corrections)
    return [by_date[d] for d in sorted(by_date)][-keep:]


def sanity(sym: str, bars: list[dict]) -> list[str]:
    errs = []
    today = datetime.now(timezone.utc).date()
    for b in bars:
        if not b["low"] <= min(b["open"], b["close"]) <= max(b["open"], b["close"]) <= b["high"]:
            errs.append(f"{sym} {b['date']}: OHLC out of order")
        if date.fromisoformat(b["date"]) > today:
            errs.append(f"{sym} {b['date']}: date in the future")
    if bars and (today - date.fromisoformat(bars[-1]["date"])) > timedelta(days=10):
        errs.append(f"{sym}: last bar {bars[-1]['date']} is more than 10 days old")
    return errs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fixtures")
    args = ap.parse_args()

    st = settings()
    name = st["prices"]["provider"]
    check_provider(name)
    provider = providers.get(name)
    keep = st["prices"]["keep_days"]
    v = Validator()
    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    staged: dict[str, dict] = {}
    errors: list[str] = []
    for sym in symbols():
        try:
            if args.fixtures:
                new = provider.parse((Path(args.fixtures) / f"{sym}.csv").read_text(), sym)
            else:
                new = provider.fetch_daily(sym)
        except Exception as exc:  # noqa: BLE001  (any provider failure fails the run)
            errors.append(str(exc))
            continue
        path = PRICES / f"{sym}.json"
        old = load_json(path)["bars"] if path.exists() else []
        doc = {"symbol": sym, "provider": name, "currency": "USD", "fetched_at": fetched_at,
               "sample": False, "bars": merge(old, new, keep)}
        errors += sanity(sym, doc["bars"]) if not args.fixtures else []
        errors += [f"{sym}: {e}" for e in v.validate(doc, "prices.schema.json")]
        staged[sym] = doc
        print(f"  {sym:6} {len(new):5} bars from {name}, last {doc['bars'][-1]['date']} close {doc['bars'][-1]['close']}")

    if errors:
        print("fetch_prices: FAILED, nothing written:", *errors, sep="\n  ", file=sys.stderr)
        return 1
    if args.dry_run:
        print(f"fetch_prices: dry run OK for {len(staged)} symbols")
        return 0
    for sym, doc in staged.items():
        dump_json(PRICES / f"{sym}.json", doc)
    print(f"fetch_prices: wrote {len(staged)} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
