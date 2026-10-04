#!/usr/bin/env python3
"""Data-integrity diagnostic for the price provider. Prints statistics only (no raw prices:
GitHub Action logs are public and the provider forbids redistribution).

For every watchlist symbol + benchmark it fetches the raw provider rows and reports:
row count, date span, correlation of daily returns with the benchmark using adjusted closes
AND unadjusted closes, the largest adjusted/unadjusted ratio jump, and date mismatches.
Usage: python3 scripts/diag_prices.py   (needs TIINGO_API_KEY)
"""
from __future__ import annotations

import json
import math
import os
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import settings, watchlist  # noqa: E402
from providers import tiingo  # noqa: E402


def raw(symbol: str, days: int) -> list[dict]:
    start = date.today() - timedelta(days=days)
    q = urllib.parse.urlencode({"startDate": start.isoformat(), "resampleFreq": "daily"})
    req = urllib.request.Request(tiingo.URL.format(code=tiingo.code_for(symbol), query=q),
                                 headers={"Authorization": f"Token {os.environ['TIINGO_API_KEY']}", "User-Agent": "stocks-brain-diag"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def corr(a: dict, b: dict) -> tuple[float, int]:
    ks = sorted(set(a) & set(b))
    x, y = [a[k] for k in ks], [b[k] for k in ks]
    mx, my = sum(x) / len(x), sum(y) / len(y)
    cov = sum((i - mx) * (j - my) for i, j in zip(x, y))
    return cov / math.sqrt(sum((i - mx) ** 2 for i in x) * sum((j - my) ** 2 for j in y)), len(ks)


def rets(rows: list[dict], field: str) -> dict:
    rows = sorted(rows, key=lambda r: r["date"])
    return {rows[i]["date"][:10]: rows[i][field] / rows[i - 1][field] - 1 for i in range(1, len(rows))}


def main() -> int:
    st = settings()
    bench = st["scoring"]["benchmark"]["symbol"]
    syms = [s["symbol"] for s in watchlist()["symbols"]]
    data = {s: raw(s, 400) for s in [bench, *syms]}
    b_adj, b_raw = rets(data[bench], "adjClose"), rets(data[bench], "close")
    print(f"{'sym':6} {'rows':>5} {'first':>10} {'last':>10} {'corr_adj':>8} {'corr_raw':>8} {'max_ratio_jump%':>15}")
    for s in [bench, *syms]:
        rows = sorted(data[s], key=lambda r: r["date"])
        ratios = [r["adjClose"] / r["close"] for r in rows if r["close"]]
        jump = max(abs(ratios[i] / ratios[i - 1] - 1) * 100 for i in range(1, len(ratios)))
        ca, n = corr(rets(rows, "adjClose"), b_adj)
        cr, _ = corr(rets(rows, "close"), b_raw)
        print(f"{s:6} {len(rows):5d} {rows[0]['date'][:10]:>10} {rows[-1]['date'][:10]:>10} {ca:8.2f} {cr:8.2f} {jump:15.2f}")
    dates = {s: {r["date"][:10] for r in data[s]} for s in data}
    for s in syms:
        miss = sorted(dates[bench] ^ dates[s])
        if miss:
            print(f"date mismatch {s} vs {bench}: {len(miss)} dates, e.g. {miss[:3]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
