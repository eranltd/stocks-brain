#!/usr/bin/env python3
"""Cross-check the main price source (Tiingo, in .cache/prices from the same run) against a second one (Polygon).

For every symbol of the main daily fetch it compares daily returns on the dates both sources have, and writes agreement
statistics only (no price ever: both providers' terms forbid redistribution) to data/market/price_check.json:
  days            dates both sources have, within the kept window
  return_corr     correlation of the two sources' daily returns (1.0 = the same series)
  median_diff_bp  median absolute difference of daily returns, in basis points
  big_diff_days   days the two returns differ by more than 0.5 percentage points
  bench_corr      correlation with the benchmark from each source (Tiingo's, Polygon's): the number that raised the
                  question (docs/decisions.md, "Second price source")
  verdict         agree | differ | thin (fewer than MIN_DAYS shared dates)

Runs inside the nasdaq daily job on Fridays (it needs that run's Tiingo cache) and only when POLYGON_API_KEY is set;
without the key it says so and exits 0. The free plan allows five requests a minute, so the run takes a few minutes.

Usage: python3 scripts/price_crosscheck.py [--fixtures DIR] [--dry-run]
  --fixtures DIR  read <DIR>/<SYMBOL>.json (Polygon's raw format) instead of the network
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import MARKET, PRICES, Validator, default_fetch_symbols, dump_json, load_json, settings, watchlist  # noqa: E402
from providers import polygon  # noqa: E402

MIN_DAYS = 60
AGREE_CORR = 0.99
BIG_DIFF = 0.005  # 0.5 percentage points
MAX_BIG_SHARE = 0.02  # at most 2% of shared days may differ by more than BIG_DIFF


def returns(bars: list[dict]) -> dict[str, float]:
    bars = sorted(bars, key=lambda b: b["date"])
    return {bars[i]["date"]: bars[i]["close"] / bars[i - 1]["close"] - 1 for i in range(1, len(bars)) if bars[i - 1]["close"]}


def corr(a: dict[str, float], b: dict[str, float]) -> float | None:
    ks = sorted(set(a) & set(b))
    if len(ks) < 3:
        return None
    x, y = [a[k] for k in ks], [b[k] for k in ks]
    mx, my = sum(x) / len(x), sum(y) / len(y)
    sx, sy = math.sqrt(sum((i - mx) ** 2 for i in x)), math.sqrt(sum((j - my) ** 2 for j in y))
    return None if not sx or not sy else round(sum((i - mx) * (j - my) for i, j in zip(x, y)) / (sx * sy), 4)


def compare(primary: list[dict], second: list[dict], bench_primary: dict[str, float] | None,
            bench_second: dict[str, float] | None) -> dict:
    """Agreement statistics for one symbol. Returns are computed per source over consecutive dates both sources have,
    so a date one source lacks never turns into a two-day return on one side only."""
    shared = {b["date"] for b in primary} & {b["date"] for b in second}
    p = returns([b for b in primary if b["date"] in shared])
    s = returns([b for b in second if b["date"] in shared])
    days = sorted(set(p) & set(s))
    out = {"days": len(days), "verdict": "thin"}
    if len(days) < MIN_DAYS:
        return out
    diffs = sorted(abs(p[d] - s[d]) for d in days)
    big = sum(x > BIG_DIFF for x in diffs)
    rc = corr(p, s)
    out.update({"return_corr": rc, "median_diff_bp": round(diffs[len(diffs) // 2] * 10000, 2), "big_diff_days": big,
                "bench_corr": [corr(p, bench_primary) if bench_primary else None, corr(s, bench_second) if bench_second else None],
                "verdict": "agree" if rc is not None and rc >= AGREE_CORR and big <= MAX_BIG_SHARE * len(days) else "differ"})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixtures")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not args.fixtures and not os.environ.get(polygon.SECRET_ENV):
        print(f"price_crosscheck: skipped, {polygon.SECRET_ENV} is not set (the second source is not connected yet)")
        return 0
    st = settings()
    bench = st["scoring"]["benchmark"]["symbol"]
    keep = st["prices"]["keep_days"]
    syms = default_fetch_symbols(st, watchlist())
    second: dict[str, list[dict]] = {}
    errors = []
    for i, sym in enumerate(syms):
        try:
            if args.fixtures:
                second[sym] = polygon.parse((Path(args.fixtures) / f"{sym}.json").read_text(), sym)
            else:
                if i:
                    time.sleep(polygon.MIN_INTERVAL_S)
                second[sym] = polygon.fetch_daily(sym, keep_days=keep)
        except Exception as exc:  # noqa: BLE001  (a symbol the second source cannot give is reported, not fatal)
            errors.append(str(exc))
    primary = {s: load_json(PRICES / f"{s}.json")["bars"] for s in syms if (PRICES / f"{s}.json").exists()}
    if bench not in primary or bench not in second:
        print(f"price_crosscheck: FAILED, the benchmark {bench} is missing from a source; nothing written", *errors, sep="\n  ", file=sys.stderr)
        return 1
    bp, bs = returns(primary[bench]), returns(second[bench])
    rows = []
    for s in syms:
        if s in primary and s in second:
            rows.append({"symbol": s, **compare(primary[s][-keep:], second[s][-keep:], None if s == bench else bp, None if s == bench else bs)})
        else:
            rows.append({"symbol": s, "days": 0, "verdict": "missing"})
    counts = {v: sum(r["verdict"] == v for r in rows) for v in ("agree", "differ", "thin", "missing")}
    doc = {"as_of": date.today().isoformat(), "sample": False, "primary": st["prices"]["provider"], "second": polygon.NAME,
           "benchmark": bench, "thresholds": {"min_days": MIN_DAYS, "agree_corr": AGREE_CORR, "big_diff_pct": BIG_DIFF * 100,
                                              "max_big_share_pct": MAX_BIG_SHARE * 100},
           "counts": counts, "symbols": rows, "errors": [e[:200] for e in errors][:20]}
    bad = Validator().validate(doc, "price_check.schema.json")
    if bad:
        print("price_crosscheck: FAILED schema, nothing written:", *bad[:10], sep="\n  ", file=sys.stderr)
        return 1
    for r in rows:  # statistics only: no price reaches the public log
        print(f"  {r['symbol']:6} {r['verdict']:7} days {r['days']:4} corr {r.get('return_corr')} median {r.get('median_diff_bp')}bp "
              f"big {r.get('big_diff_days')} bench corr {r.get('bench_corr')}")
    print(f"price_crosscheck: {counts}" + (" (dry run)" if args.dry_run else ""))
    if not args.dry_run:
        dump_json(MARKET / "price_check.json", doc)
    return 0


if __name__ == "__main__":
    sys.exit(main())
