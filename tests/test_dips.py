"""The big-drop study (scripts/dips.py): which days count as a drop, the next-close entry, the benchmark-relative
result, the base rate, one event per crash week, late listings, and the published file's schema."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import dips  # noqa: E402
from _common import Validator  # noqa: E402


def flat(n, v=100.0):
    return [v] * n


class DropDays(unittest.TestCase):
    def test_a_drop_of_eight_percent_or_more_counts_once_per_window(self):
        c = flat(5) + [91.0, 91.0, 83.0] + flat(30, 83.0) + [75.0] + flat(5, 75.0)
        # 100 -> 91 is -9% (day 5); 91 -> 83 two days later is the same event; 83 -> 75 on day 38 is a new one.
        self.assertEqual(dips.drop_days(c, drop=8.0, cooldown=20), [5, 38])

    def test_a_smaller_fall_is_not_a_drop(self):
        self.assertEqual(dips.drop_days([100.0, 93.0, 92.0], drop=8.0), [])


class Excess(unittest.TestCase):
    def test_entry_is_the_next_close_and_the_benchmark_is_taken_off(self):
        c = [100.0, 90.0, 90.0, 95.0, 99.0]
        b = [100.0, 100.0, 100.0, 102.0, 105.0]
        # Bought at 90 (the close after the drop day 1), two days later 99: +10%; the benchmark +5% -> +5 points.
        self.assertAlmostEqual(dips.excess_after(c, b, 1, 2), 5.0)
        self.assertIsNone(dips.excess_after(c, b, 1, 3), "not there yet")


class Study(unittest.TestCase):
    def test_events_against_the_base_rate(self):
        n = 40
        dates = [f"2026-01-{d:02d}" if d <= 31 else f"2026-02-{d - 31:02d}" for d in range(1, n + 1)]
        bench = flat(n)
        a = flat(10) + [90.0] + [90.0 + k for k in range(1, n - 10)]  # drops on day 10, then climbs a point a day
        b = flat(n)
        doc = dips.study({"AAA": a, "BBB": b}, bench, dates, horizons=(5,), cooldown=20)
        self.assertEqual(doc["events_total"], 1)
        e = doc["events"][0]
        self.assertEqual((e["symbol"], e["date"], e["drop_pct"]), ("AAA", dates[10], -10.0))
        # From the next close (91) five days later (96): +5.49%.
        self.assertAlmostEqual(e["excess"]["5"], round((96 / 91 - 1) * 100, 2))
        self.assertEqual(doc["summary"]["5"]["n"], 1)
        self.assertEqual(doc["summary"]["5"]["beat_pct"], 100.0)
        self.assertGreater(doc["base"]["5"]["n"], 1)
        self.assertEqual(e["days_since"], n - 1 - 10)

    def test_a_late_listing_lines_up_with_the_end(self):
        n = 30
        dates = [f"2026-03-{d:02d}" for d in range(1, n + 1)]
        late = flat(10) + [80.0] + flat(9, 80.0)  # 20 days, listed on dates[10]
        doc = dips.study({"LATE": late}, flat(n), dates, horizons=(5,))
        self.assertEqual(doc["events"][0]["date"], dates[10 + 10])

    def test_the_published_file_fits_its_schema(self):
        n = 90
        dates = [f"2026-{(d // 28) + 1:02d}-{(d % 28) + 1:02d}" for d in range(n)]
        a = flat(30) + [88.0] + flat(n - 31, 88.0)
        body = dips.study({"AAA": a}, flat(n), dates)
        doc = {"as_of": dates[-1], "sample": False, "benchmark": "QQQ", "drop_pct": dips.DROP_PCT, "horizons": list(dips.HORIZONS),
               "cooldown_days": dips.COOLDOWN, "from": dates[0], "names": 1, **body}
        self.assertEqual(Validator().validate(doc, "dips.schema.json"), [])


if __name__ == "__main__":
    unittest.main()
