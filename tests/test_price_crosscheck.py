"""Second-source price cross-check: agreement statistics, never a price."""
import json
import random
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import price_crosscheck as pc  # noqa: E402
from _common import Validator  # noqa: E402
from providers import polygon  # noqa: E402


def series(n=120, seed=1, start=100.0):
    rnd, d, px, out = random.Random(seed), date(2026, 1, 2), start, []
    while len(out) < n:
        if d.weekday() < 5:
            px *= 1 + rnd.gauss(0, 0.015)
            out.append({"date": d.isoformat(), "open": px, "high": px, "low": px, "close": round(px, 4), "volume": 1})
        d += timedelta(days=1)
    return out


class CompareTest(unittest.TestCase):
    def test_same_series_agrees_even_scaled_and_with_a_missing_day(self):
        a = series()
        b = [dict(x, close=x["close"] * 0.97) for i, x in enumerate(a) if i != 50]  # adjusted on another base, one day short
        r = pc.compare(a, b, None, None)
        self.assertEqual(r["verdict"], "agree")
        self.assertEqual(r["return_corr"], 1.0)
        self.assertEqual(r["big_diff_days"], 0)
        self.assertEqual(r["days"], len(a) - 2)

    def test_different_series_differ_and_short_ones_are_thin(self):
        self.assertEqual(pc.compare(series(seed=1), series(seed=2), None, None)["verdict"], "differ")
        self.assertEqual(pc.compare(series(30), series(30), None, None)["verdict"], "thin")

    def test_benchmark_correlation_from_each_source(self):
        a, bench = series(seed=1), series(seed=3)
        r = pc.compare(a, a, pc.returns(bench), pc.returns(bench))
        self.assertEqual(r["bench_corr"][0], r["bench_corr"][1])

    def test_document_schema_carries_no_price(self):
        row = {"symbol": "AAA", **pc.compare(series(), series(), None, None)}
        doc = {"as_of": "2026-10-16", "sample": False, "primary": "tiingo", "second": "polygon", "benchmark": "QQQ",
               "thresholds": {"min_days": 60, "agree_corr": 0.99, "big_diff_pct": 0.5, "max_big_share_pct": 2.0},
               "counts": {"agree": 1, "differ": 0, "thin": 0, "missing": 0}, "symbols": [row], "errors": []}
        self.assertEqual(Validator().validate(doc, "price_check.schema.json"), [])
        self.assertNotIn("close", json.dumps(doc))


class PolygonParseTest(unittest.TestCase):
    def test_parses_dates_in_new_york_and_rejects_errors(self):
        payload = {"status": "OK", "results": [{"t": 1760328000000, "o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 10}]}  # 2025-10-13 04:00 UTC
        self.assertEqual(polygon.parse(payload, "AAA")[0]["date"], "2025-10-13")
        with self.assertRaises(polygon.ProviderError):
            polygon.parse({"status": "ERROR"}, "AAA")
        with self.assertRaises(polygon.ProviderError):
            polygon.parse({"status": "OK", "results": []}, "AAA")


if __name__ == "__main__":
    unittest.main()
