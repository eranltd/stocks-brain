"""The hourly market pulse (scripts/live.py): quotes as moves only, the fear gauge, the mood, news items, a whole
document against its schema with a stand-in feed, and a quiet exit without a key. Nothing touches the network."""
import os
import subprocess
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import live  # noqa: E402
from _common import ROOT, Validator, settings  # noqa: E402


class Pieces(unittest.TestCase):
    def test_a_quote_becomes_moves_and_never_a_price(self):
        v = live.quote_view({"c": 110.0, "pc": 100.0, "o": 105.0, "h": 112.0, "l": 102.0, "t": 5})
        self.assertEqual(v, {"move_pct": 10.0, "from_open_pct": 4.76, "range_pos": 80, "at": 5})
        self.assertIsNone(live.quote_view({"c": 0, "pc": 0}), "an unknown symbol answers zeros")
        self.assertIsNone(live.quote_view(None))

    def test_fear_gauge_and_mood(self):
        self.assertEqual([live.fear_level(x) for x in (30, 8, 0, -9)], ["panic", "nervous", "normal", "calm"])
        self.assertIsNone(live.fear_level(None))
        self.assertEqual(live.mood(2, 19, -4.4), "selloff")
        self.assertEqual(live.mood(15, 6, 2.0), "rally")
        self.assertEqual(live.mood(10, 11, 0.1), "flat")
        self.assertEqual(live.mood(0, 0, None), "mixed")

    def test_news_items_keep_https_links_only(self):
        self.assertIsNone(live.news_item({"headline": "x", "url": "http://a"}))
        it = live.news_item({"headline": " Big day ", "url": "https://a/b", "source": "Wire", "datetime": 9}, "AAA")
        self.assertEqual(it, {"headline": "Big day", "source": "Wire", "url": "https://a/b", "at": 9, "symbol": "AAA"})


class Whole(unittest.TestCase):
    def test_a_built_document_fits_its_schema(self):
        def fake(path, params, key):
            if path == "quote":
                return {"c": 99.0, "pc": 100.0, "o": 100.0, "h": 101.0, "l": 98.0, "t": 1793912400}
            if path == "company-news":
                return [{"headline": "Company news", "url": "https://n/1", "source": "Wire", "datetime": 1}]
            return [{"headline": "Market news", "url": "https://n/2", "source": "Wire", "datetime": 2}]
        with mock.patch.object(live, "_get", side_effect=fake), mock.patch.object(live.time, "sleep"):
            doc = live.build("k", settings(), datetime(2026, 11, 6, 15, tzinfo=timezone.utc))
        self.assertEqual(Validator().validate(doc, "live.schema.json"), [])
        self.assertGreater(len(doc["symbols"]), 10)
        self.assertEqual(doc["fear"]["level"], "normal")
        self.assertTrue(all("c" not in r and "price" not in r for r in doc["symbols"]))

    def test_without_a_key_it_does_nothing(self):
        env = {k: v for k, v in os.environ.items() if k != "FINNHUB_API_KEY"}
        out = subprocess.run([sys.executable, str(ROOT / "scripts" / "live.py"), "--dry-run"], env=env, capture_output=True, text=True)
        self.assertEqual(out.returncode, 0)
        self.assertIn("nothing to do", out.stdout)


if __name__ == "__main__":
    unittest.main()
