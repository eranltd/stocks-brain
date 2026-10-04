import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import fetch_prices  # noqa: E402
import routines_code  # noqa: E402
from _common import SAMPLES, Validator, dump_json, load_json, settings  # noqa: E402
from providers import stooq, tiingo  # noqa: E402

CSV = "Date,Open,High,Low,Close,Volume\n2026-10-01,10,11,9.5,10.5,1000\n2026-10-02,10.5,12,10,11.75,1500.0\n"


class StooqTest(unittest.TestCase):
    def test_parse(self):
        bars = stooq.parse(CSV, "TEST")
        self.assertEqual(bars[-1], {"date": "2026-10-02", "open": 10.5, "high": 12.0, "low": 10.0, "close": 11.75, "volume": 1500})

    def test_rejects_non_csv(self):
        for body in ("No data", "Exceeded the daily hits limit", "<html>blocked</html>", ""):
            with self.assertRaises(stooq.ProviderError):
                stooq.parse(body, "TEST")

    def test_code(self):
        self.assertEqual(stooq.code_for("BRK.B"), "brk-b.us")


class TiingoTest(unittest.TestCase):
    ROW = {"date": "2026-10-02T00:00:00.000Z", "close": 12, "open": 11, "high": 13, "low": 10, "volume": 900,
           "adjClose": 6, "adjOpen": 5.5, "adjHigh": 6.5, "adjLow": 5, "adjVolume": 1800}

    def test_parse_uses_adjusted(self):
        bars = tiingo.parse([self.ROW], "TEST")
        self.assertEqual(bars, [{"date": "2026-10-02", "open": 5.5, "high": 6.5, "low": 5.0, "close": 6.0, "volume": 1800}])

    def test_error_object_and_empty(self):
        with self.assertRaises(tiingo.ProviderError):
            tiingo.parse('{"detail": "Not found."}', "TEST")
        with self.assertRaises(tiingo.ProviderError):
            tiingo.parse("[]", "TEST")

    def test_missing_key_fails_closed(self):
        import os
        old = os.environ.pop(tiingo.SECRET_ENV, None)
        try:
            with self.assertRaises(tiingo.ProviderError):
                tiingo.fetch_daily("TEST")
        finally:
            if old is not None:
                os.environ[tiingo.SECRET_ENV] = old


class FetchTest(unittest.TestCase):
    def test_merge_prefers_new_and_trims(self):
        old = [{"date": f"2026-01-0{i}", "close": i} for i in range(1, 6)]
        new = [{"date": "2026-01-05", "close": 99}, {"date": "2026-01-06", "close": 6}]
        out = fetch_prices.merge(old, new, keep=3)
        self.assertEqual([b["close"] for b in out], [4, 99, 6])

    def test_sanity_flags_bad_ohlc(self):
        bad = [{"date": "2026-10-02", "open": 10, "high": 9, "low": 8, "close": 10, "volume": 1}]
        self.assertTrue(any("OHLC" in e for e in fetch_prices.sanity("TEST", bad)))


class RoutinesTest(unittest.TestCase):
    def setUp(self):
        self.st = settings()
        self.bench = self.st["scoring"]["benchmark"]["symbol"]

    def test_regime_on_samples_is_valid(self):
        bars = load_json(SAMPLES / "prices" / f"{self.bench}.json")["bars"]
        doc = routines_code.compute_regime(bars, self.st, sample=True)
        self.assertEqual(Validator().validate(doc, "regime.schema.json"), [])

    def test_regime_needs_history(self):
        with self.assertRaises(SystemExit):
            routines_code.compute_regime([{"date": "2026-10-01", "close": 1}] * 5, self.st, sample=False)

    def test_score_matches_sample_outcomes(self):
        """Scoring live-style from sample runs + prices reproduces the generator's outcomes."""
        runs = [load_json(p) for p in sorted((SAMPLES / "runs").glob("run.*.json"))]
        items, waiting = routines_code.score_outcomes([r for r in runs if r["status"] == "ok"],
                                                      SAMPLES / "prices", [], self.st, "0.0.0")
        expected = {o["pick_id"]: o["excess_pct"] for o in load_json(SAMPLES / "kb" / "outcomes.json")["items"]}
        self.assertEqual({o["pick_id"]: o["excess_pct"] for o in items}, expected)
        self.assertGreater(waiting, 0)

    def test_score_is_idempotent(self):
        runs = [load_json(p) for p in sorted((SAMPLES / "runs").glob("run.*.json"))]
        ok = [r for r in runs if r["status"] == "ok"]
        first, _ = routines_code.score_outcomes(ok, SAMPLES / "prices", [], self.st, "0.0.0")
        again, _ = routines_code.score_outcomes(ok, SAMPLES / "prices", first, self.st, "0.0.0")
        self.assertEqual(first, again)

    def test_calibration(self):
        outcomes = load_json(SAMPLES / "kb" / "outcomes.json")["items"]
        doc = routines_code.compute_calibration(outcomes, "2026-10-02", True, 10)
        self.assertEqual(Validator().validate(doc, "calibration.schema.json"), [])
        self.assertEqual(doc["n"], len(outcomes))


if __name__ == "__main__":
    unittest.main()
