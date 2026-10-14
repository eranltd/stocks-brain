"""Official company news from SEC filings (scripts/sec_news.py): fixed plain titles per 8-K item code, point in time,
fail closed when too many companies cannot be read. No network: fixtures only."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import sec_news  # noqa: E402
from _common import Validator  # noqa: E402


def sub(rows):
    keys = ["form", "filingDate", "items", "accessionNumber", "primaryDocument"]
    return {"name": "ALPHA INC", "filings": {"recent": {k: [r[i] for r in rows] for i, k in enumerate(keys)}}}


ROWS = [
    ("4", "2026-10-10", "", "0001-26-000009", "x.xml"),
    ("8-K", "2026-10-12", "7.01,2.02,9.01", "0001-26-000008", "a8k.htm"),
    ("10-Q", "2026-10-12", "", "0001-26-000007", "q.htm"),
    ("8-K/A", "2026-09-01", "5.02", "0001-26-000006", "b.htm"),
    ("6-K", "2026-08-01", "", "0001-26-000005", "c.htm"),
    ("8-K", "2026-10-20", "8.01", "0001-26-000004", "late.htm"),  # after as_of: not yet public
    ("8-K", "2026-01-01", "8.01", "0001-26-000003", "old.htm"),   # outside the window
]


class DescribeTest(unittest.TestCase):
    def test_item_codes_become_fixed_titles_most_newsworthy_first(self):
        codes, titles, kind = sec_news.describe("8-K", "7.01,2.02,9.01")
        self.assertEqual(codes, ["2.02", "7.01"])
        self.assertEqual(titles, ["Quarterly results", "Shared an update with investors"])
        self.assertEqual(kind, "results")

    def test_forms_and_amendments(self):
        self.assertEqual(sec_news.describe("6-K", "")[1:], (["Company update (a foreign company's report)"], "update"))
        self.assertEqual(sec_news.describe("10-K", "")[2], "report")
        self.assertTrue(sec_news.describe("8-K/A", "5.02")[1][0].startswith("Correction to an earlier filing: a leadership change"))
        self.assertEqual(sec_news.describe("8-K", "")[1], ["Company news"])


class FilingsTest(unittest.TestCase):
    def test_point_in_time_window_and_order(self):
        out = sec_news.company_filings(sub(ROWS), 1234, "2026-10-14")
        self.assertEqual([f["date"] for f in out], ["2026-10-12", "2026-10-12", "2026-09-01", "2026-08-01"])
        self.assertTrue(all(f["url"].startswith("https://www.sec.gov/Archives/edgar/data/1234/000126") for f in out))

    def test_build_validates_and_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            fx = Path(d)
            (fx / "company_tickers.json").write_text(json.dumps({"0": {"ticker": "AAA", "cik_str": 1234}, "1": {"ticker": "BBB", "cik_str": 5678}}))
            (fx / "sub_AAA.json").write_text(json.dumps(sub(ROWS)))
            (fx / "sub_BBB.json").write_text(json.dumps(sub(ROWS[:2])))
            doc = sec_news.build(["AAA", "BBB"], "2026-10-14", fx)
            self.assertEqual(Validator().validate(doc, "sec_news.schema.json"), [])
            self.assertEqual(doc["missing"], [])
            with self.assertRaises(sec_news.SecError):  # two of three unreadable: over the quarter allowed
                sec_news.build(["AAA", "CCC", "DDD"], "2026-10-14", fx)


if __name__ == "__main__":
    unittest.main()
