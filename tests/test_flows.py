"""scripts/flows.py: the FINRA short-sale file, the usual level, analysts and insiders in plain views."""
import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import flows  # noqa: E402


class FlowsTest(unittest.TestCase):
    def test_finra_file_to_percent(self):
        text = "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market\n20261113|AAA|25|1|100|B,Q,N\n20261113|ZZZ|5|0|0|Q\n20261113|BBB|x|0|10|Q\n"
        self.assertEqual(flows.parse_finra(text, {"AAA", "ZZZ", "BBB"}), {"AAA": 25.0})

    def test_short_view_against_the_usual_level(self):
        hist = [{"d": f"2026-10-{i:02d}", "p": 30.0} for i in range(1, 21)] + [{"d": "2026-10-21", "p": 45.0}]
        v = flows.short_view(hist)
        self.assertEqual((v["date"], v["pct"], v["base_pct"], v["diff"], v["level"]), ("2026-10-21", 45.0, 30.0, 15.0, "high"))
        self.assertEqual(flows.short_view(hist[:3])["level"], None)  # too few days to know what is usual
        self.assertIsNone(flows.short_view([]))
        self.assertEqual(len(flows.short_view([{"d": f"2026-0{1 + i // 28}-{1 + i % 28:02d}", "p": 1.0} for i in range(40)])["history"]), flows.HISTORY_DAYS)

    def test_analysts_latest_month(self):
        rows = [{"period": "2026-10-01", "strongBuy": 1, "buy": 1, "hold": 1, "sell": 1, "strongSell": 0},
                {"period": "2026-11-01", "strongBuy": 25, "buy": 41, "hold": 2, "sell": 1, "strongSell": 0}]
        v = flows.analysts_view(rows)
        self.assertEqual((v["period"], v["n"], v["buy_pct"]), ("2026-11-01", 69, 96))
        self.assertIsNone(flows.analysts_view([]))

    def test_insiders_net_side(self):
        doc = {"data": [{"year": 2026, "month": 9, "change": -500, "mspr": -100}, {"year": 2026, "month": 10, "change": 200, "mspr": 20}]}
        v = flows.insiders_view(doc, date(2026, 11, 14))
        self.assertEqual((v["net_shares"], v["side"], v["mspr"], v["last_month"]), (-300, "sold", -40.0, "2026-10"))
        self.assertIsNone(flows.insiders_view({"data": []}, date(2026, 11, 14)))
        old = {"data": [{"year": 2026, "month": 7, "change": 900, "mspr": 50}]}
        self.assertIsNone(flows.insiders_view(old, date(2026, 11, 14)))  # older than the last three months


if __name__ == "__main__":
    unittest.main()
