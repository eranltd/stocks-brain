"""Indexed candles for the Stock page's chart (market.candles, routines_code checklist, data/market/candles/<SYMBOL>.json):
indexing to the last close, weekly aggregation, the volume ratio, the average and RSI against the checklist, overlays that
are the checklist's own numbers, no look-ahead, the published files, lint and the site export."""
import copy
import json
import shutil
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import market as mk  # noqa: E402
import routines_code  # noqa: E402
from _common import CONFIG, ROOT, SAMPLES, Validator, load_json, settings, watchlist  # noqa: E402
from lint import Lint  # noqa: E402
from test_checklist import CFG, HOUSE, P, walk  # noqa: E402


def build(B: dict, i: int | None = None, **kw) -> tuple[dict, dict]:
    """(candles, checklist reading) for B cut after index i (the whole of B by default)."""
    if i is not None:
        B = {k: v[:i + 1] for k, v in B.items()}
    pre = mk.prep_checklist(B, P)
    cl = mk.checklist_at(B, pre, len(B["c"]) - 1, P, HOUSE)
    return mk.candles(B, pre, P, cl, **kw), cl


class IndexingTest(unittest.TestCase):
    def setUp(self):
        self.B = walk(700, 21)
        self.ch, self.cl = build(self.B)

    def test_every_price_is_percent_from_the_last_close(self):
        x = self.B["c"][-1]
        d = self.ch["daily"]
        self.assertEqual(len(d["dates"]), mk.CANDLE_DAYS)
        self.assertEqual(d["dates"], self.B["dates"][-mk.CANDLE_DAYS:])
        self.assertEqual(d["c"][-1], 0)
        self.assertEqual(self.ch["weekly"]["c"][-1], 0)
        for q in "oc":
            self.assertEqual(d[q], [round(mk.pct(x, v), 2) + 0.0 for v in self.B[q][-mk.CANDLE_DAYS:]])
        for part in ("daily", "weekly"):
            S = self.ch[part]
            for k in range(len(S["dates"])):
                self.assertGreaterEqual(S["h"][k], max(S["o"][k], S["c"][k]))
                self.assertGreaterEqual(min(S["o"][k], S["c"][k]), S["l"][k])
        self.assertNotRegex(json.dumps(self.ch), r"-0\.0[,\]]")  # a flat day reads 0.0, not -0.0
        self.assertEqual(json.dumps(mk._indexed(100.0, {k: [99.9999, 100.0] if k != "dates" else ["a", "b"] for k in "ohlc"} | {"dates": ["a", "b"]},
                                                [None, None], [None, None], [None, None], 2)["c"]), "[0.0, 0.0]")
        self.assertEqual(mk.candle_problems({"as_of": self.B["dates"][-1], **self.ch}), [])

    def test_a_body_outside_its_wick_is_widened(self):
        B = copy.deepcopy(self.B)
        B["h"][-3] = min(B["o"][-3], B["c"][-3]) * 0.999  # a provider slip: high below the body
        ch, _ = build(B)
        d = ch["daily"]
        self.assertEqual(d["h"][-3], max(d["o"][-3], d["c"][-3]))
        self.assertEqual(mk.candle_problems({"as_of": B["dates"][-1], **ch}), [])

    def test_two_decimals_and_rsi_one(self):
        for part in ("daily", "weekly"):
            S = self.ch[part]
            for key in ("o", "h", "l", "c", "ma20", "vol_rel"):
                self.assertTrue(all(v is None or round(v, 2) == v for v in S[key]), key)
            self.assertTrue(all(v is None or round(v, 1) == v for v in S["rsi"]))


class WeeklyTest(unittest.TestCase):
    def setUp(self):
        self.B = walk(700, 5)  # trading_dates ends on Friday 2026-10-02

    def test_weeks_end_on_friday_and_match_the_checklists_weekly_candle(self):
        ch, cl = build(self.B)
        W = ch["weekly"]
        self.assertEqual(len(W["dates"]), mk.CANDLE_WEEKS)
        self.assertTrue(all(date.fromisoformat(d).weekday() == 4 for d in W["dates"]))  # no holidays in the synthetic dates
        self.assertFalse(W["partial"])
        self.assertEqual(W["partial"], cl["candle"]["weekly"]["partial"])
        pre = mk.prep_checklist(self.B, P)
        x = self.B["c"][-1]
        want = mk._weeks(self.B, pre, len(self.B["c"]) - 1, mk.CANDLE_WEEKS)
        self.assertEqual(len(want), mk.CANDLE_WEEKS)
        for k, (o, h, lo, c) in enumerate(want):
            self.assertEqual((W["o"][k], W["h"][k], W["l"][k], W["c"][k]),
                             tuple(round(mk.pct(x, v), 2) + 0.0 for v in (o, h, lo, c)))

    def test_the_week_in_progress_is_partial(self):
        n = len(self.B["c"])
        ch, cl = build(self.B, n - 3)  # cut on Wednesday
        W = ch["weekly"]
        self.assertTrue(W["partial"])
        self.assertEqual(W["partial"], cl["candle"]["weekly"]["partial"])
        self.assertEqual(W["dates"][-1], self.B["dates"][n - 3])
        self.assertEqual(date.fromisoformat(W["dates"][-1]).weekday(), 2)
        self.assertEqual(date.fromisoformat(W["dates"][-2]).weekday(), 4)
        mon = n - 5
        o = round(mk.pct(self.B["c"][n - 3], self.B["o"][mon]), 2)
        self.assertEqual(W["o"][-1], o)  # the week's open is Monday's
        self.assertEqual(W["c"][-1], 0)

    def test_a_holiday_friday_ends_its_week_on_thursday(self):
        B = copy.deepcopy(self.B)
        k = len(B["c"]) - 6  # last week's Friday
        self.assertEqual(date.fromisoformat(B["dates"][k]).weekday(), 4)
        B = {key: v[:k] + v[k + 1:] for key, v in B.items()}
        W = mk.weekly_bars(B, mk.prep_checklist(B, P))
        self.assertIn(self.B["dates"][k - 1], W["dates"])  # Thursday closes that week
        self.assertEqual(W["dates"][-1], self.B["dates"][-1])
        self.assertEqual(len(W["dates"]), len(set(W["dates"])))

    def test_weekly_average_rsi_and_volume(self):
        pre = mk.prep_checklist(self.B, P)
        W = mk.weekly_bars(self.B, pre)
        ch, _ = build(self.B)
        x = self.B["c"][-1]
        self.assertEqual(ch["weekly"]["ma20"][-1], round(mk.pct(x, sum(W["c"][-20:]) / 20), 2))
        self.assertEqual(ch["weekly"]["rsi"][-1], round(mk.rsi_series(W["c"], 14)[-1], 1))
        self.assertEqual(ch["weekly"]["vol_rel"][-1], round(W["vday"][-1] / (sum(W["vday"][-21:-1]) / 20), 2))
        self.assertAlmostEqual(W["vday"][-1], sum(self.B["v"][-5:]) / 5)


class VolumeAverageRsiTest(unittest.TestCase):
    def setUp(self):
        self.B = walk(700, 8)
        self.ch, self.cl = build(self.B)

    def test_volume_ratio(self):
        v = self.B["v"]
        d = self.ch["daily"]
        self.assertEqual(d["vol_rel"][-1], self.cl["volume"]["vs_avg20"])
        self.assertEqual(d["vol_rel"][-10], round(v[-10] / (sum(v[-30:-10]) / 20), 2))
        self.assertTrue(all(r >= 0 for r in d["vol_rel"]))
        self.assertEqual(mk.vol_rel_series([1.0] * 20 + [3.0], 20)[:20], [None] * 20)
        self.assertEqual(mk.vol_rel_series([1.0] * 20 + [3.0], 20)[-1], 3.0)
        self.assertIsNone(mk.vol_rel_series([0.0] * 21, 20)[-1])

    def test_average_and_rsi_are_the_checklists(self):
        d = self.ch["daily"]
        self.assertEqual(d["rsi"][-1], self.cl["rsi"]["value"])
        # the chart's average is where it sits from the close; the checklist gives the close's distance from it
        m = d["ma20"][-1]
        self.assertAlmostEqual((100 / (1 + m / 100) - 100), self.cl["ma20"]["dist_pct"], delta=0.02)
        self.assertEqual(m, round(mk.pct(self.B["c"][-1], sum(self.B["c"][-20:]) / 20), 2))

    def test_warm_up_is_null(self):
        B = walk(140, 9)
        pre = mk.prep_checklist(B, P)
        cl = {"levels": {"support": [], "resistance": []}, "gaps": {"_listed": []},
              "risk_plan": {"stop_pct": 1.0, "tp1_pct": 2.0, "tp2_pct": 3.0, "rr_tp1": 2.0, "fits_house_rule": True}}
        ch = mk.candles(B, pre, P, cl)
        d = ch["daily"]
        self.assertEqual(len(d["dates"]), mk.CANDLE_DAYS)
        self.assertIsNone(d["ma20"][0])  # bar 10 of 140: no 20-day average yet
        self.assertIsNone(d["rsi"][0])
        self.assertIsNone(d["vol_rel"][0])
        self.assertIsNotNone(d["ma20"][-1])
        self.assertLess(len(ch["weekly"]["dates"]), mk.CANDLE_WEEKS)  # short history: fewer weeks, not padded
        self.assertIsNone(ch["weekly"]["ma20"][0])


class OverlayTest(unittest.TestCase):
    def test_overlays_are_the_checklists_numbers(self):
        seen_gap = False
        for seed in range(12):
            B = walk(700, seed, vol=0.02)
            ch, cl = build(B)
            pub = mk.public(cl)
            ov = ch["overlays"]
            self.assertEqual(ov["support"], [{"pct": z["dist_pct"], "touches": z["touches"]} for z in pub["levels"]["support"]])
            self.assertEqual(ov["resistance"], [{"pct": z["dist_pct"], "touches": z["touches"]} for z in pub["levels"]["resistance"]])
            for key in ("stop_pct", "tp1_pct", "tp2_pct", "rr_tp1", "fits_house_rule"):
                self.assertEqual(ov[key], pub["risk_plan"][key], key)
            self.assertEqual(len(ov["gaps"]), len(pub["gaps"]["unfilled"]))
            n = len(B["c"])
            for band, g in zip(ov["gaps"], pub["gaps"]["unfilled"]):
                seen_gap = True
                self.assertEqual(band["where"], g["where"])
                self.assertLess(band["from_pct"], band["to_pct"])
                near = band["to_pct"] if g["where"] == "below" else band["from_pct"]
                self.assertEqual(near, g["dist_pct"])
                self.assertEqual(band["since_date"], B["dates"][n - 1 - g["days_open"]])
                if g["where"] == "below":
                    self.assertLess(band["to_pct"], 0)
                else:
                    self.assertGreater(band["from_pct"], 0)
            self.assertEqual(mk.overlay_mismatch(ov, {"as_of": B["dates"][-1], **pub}), [])
        self.assertTrue(seen_gap, "no seed produced an open gap; the gap band test did not run")

    def test_mismatch_is_named(self):
        B = walk(700, 3)
        ch, cl = build(B)
        row = mk.public(cl)
        ov = copy.deepcopy(ch["overlays"])
        ov["stop_pct"] += 0.01
        ov["support"] = ov["support"][:-1] if ov["support"] else [{"pct": -1.0, "touches": 1}]
        self.assertEqual(sorted(mk.overlay_mismatch(ov, row)), ["stop_pct", "support"])


class NoLookAheadTest(unittest.TestCase):
    def test_a_different_future_leaves_the_past_unchanged(self):
        B = walk(700, 13)
        i = 600
        alt = copy.deepcopy(B)
        for k in range(i + 1, len(B["c"])):
            for key in ("o", "h", "l", "c"):
                alt[key][k] *= 1.4
            alt["v"][k] *= 3
        a, _ = build(B, days=700, weeks=200)
        b, _ = build(alt, days=700, weeks=200)
        cut = a["daily"]["dates"].index(B["dates"][i]) + 1
        for key in ("rsi", "vol_rel"):
            self.assertEqual(a["daily"][key][:cut], b["daily"][key][:cut])
        self.assertNotEqual(a["daily"]["rsi"][cut:], b["daily"]["rsi"][cut:])

    def test_the_chart_on_a_past_day_is_the_full_chart_rebased(self):
        """Cut after day i, the chart is the full chart up to i re-based to day i's close: nothing after i is read."""
        B = walk(700, 17)
        i = 640
        full, _ = build(B, days=700, weeks=200)
        cut, cl = build(B, i)
        d0 = full["daily"]
        off = d0["dates"].index(cut["daily"]["dates"][0])
        base = 1 + d0["c"][d0["dates"].index(B["dates"][i])] / 100
        for k, dt in enumerate(cut["daily"]["dates"]):
            self.assertEqual(d0["dates"][off + k], dt)
            self.assertEqual(cut["daily"]["rsi"][k], d0["rsi"][off + k])
            self.assertEqual(cut["daily"]["vol_rel"][k], d0["vol_rel"][off + k])
            for q in ("o", "h", "l", "c", "ma20"):
                want = ((1 + d0[q][off + k] / 100) / base - 1) * 100
                self.assertAlmostEqual(cut["daily"][q][k], want, delta=0.03)
        self.assertEqual(cut["daily"]["dates"][-1], B["dates"][i])
        self.assertEqual(cut["daily"]["rsi"][-1], cl["rsi"]["value"])


class PublishedFilesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.st, cls.wl = settings(), watchlist()
        cls.doc, cls.charts = routines_code.checklist_and_candles(SAMPLES / "prices", cls.st, cls.wl, CFG, sample=False,
                                                                  provider="tiingo")
        cls.files, cls.refused = routines_code.candle_files(cls.charts)

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_one_valid_file_per_checklist_row(self):
        self.assertEqual(self.refused, [])
        self.assertEqual(list(self.files), [r["symbol"] for r in self.doc["symbols"]])
        bench = self.st["scoring"]["benchmark"]["symbol"]
        self.assertIn(bench, self.files)
        rows = {r["symbol"]: r for r in self.doc["symbols"]}
        for sym, c in self.files.items():
            self.assertEqual(Validator().validate(c, "candles.schema.json"), [])
            self.assertEqual(mk.candle_problems(c), [])
            self.assertEqual((c["symbol"], c["as_of"], c["sample"], c["basis"]), (sym, rows[sym]["as_of"], False, mk.CANDLES_BASIS))
            self.assertEqual(mk.overlay_mismatch(c["overlays"], rows[sym]), [], sym)
            self.assertEqual(c["daily"]["rsi"][-1], rows[sym]["rsi"]["value"])
            self.assertEqual(c["daily"]["vol_rel"][-1], rows[sym]["volume"]["vs_avg20"])
            self.assertEqual(c["weekly"]["partial"], rows[sym]["candle"]["weekly"]["partial"])
        # the doc is the same as compute_checklist's
        self.assertEqual(self.doc, routines_code.compute_checklist(SAMPLES / "prices", self.st, self.wl, CFG, sample=False,
                                                                   provider="tiingo"))

    def test_no_prices_or_raw_volume(self):
        for sym, c in self.files.items():
            text = json.dumps(c)
            for key in ('"open"', '"high"', '"low"', '"close"', '"volume"', '"bars"', '"level"', '"price"', '"_'):
                self.assertNotIn(key, text)
            bars = load_json(SAMPLES / "prices" / f"{sym}.json")["bars"]
            x = bars[-1]["close"]
            self.assertEqual(c["daily"]["c"], [round(mk.pct(x, b["close"]), 2) + 0.0 for b in bars[-mk.CANDLE_DAYS:]])
            self.assertNotIn(x, c["daily"]["c"] + c["daily"]["o"])

    def test_small(self):
        for c in self.files.values():
            self.assertLess(len(json.dumps(c, separators=(",", ":"))), 16_000)

    def test_bad_documents_are_refused_not_fatal(self):
        sym = next(iter(self.charts))
        bad = copy.deepcopy(self.charts)
        bad[sym]["daily"]["o"][0] = 1234.5  # looks like a raw price
        ok, refused = routines_code.candle_files(bad)
        self.assertNotIn(sym, ok)
        self.assertEqual(len(refused), 1)
        self.assertEqual(len(ok), len(self.charts) - 1)

    def test_write_removes_files_of_symbols_not_charted_today(self):
        out = self.tmp / "candles"
        out.mkdir()
        (out / "ZZZZ.json").write_text("{}")
        some = dict(list(self.files.items())[:3])
        routines_code.write_candles(out, some)
        self.assertEqual(sorted(p.stem for p in out.glob("*.json")), sorted(some))
        self.assertEqual(load_json(out / f"{next(iter(some))}.json"), next(iter(some.values())))

    def test_run_checklist_writes_both(self):
        prices = self.tmp / "prices"
        shutil.copytree(SAMPLES / "prices", prices)
        market = self.tmp / "market"
        with mock.patch.object(routines_code, "PRICES", prices), mock.patch.object(routines_code, "MARKET", market):
            routines_code.run_checklist()
        cl = load_json(market / "checklist.json")
        files = sorted(p.stem for p in (market / "candles").glob("*.json"))
        self.assertEqual(files, sorted(r["symbol"] for r in cl["symbols"]))
        lint = Lint()
        for p in (market / "candles").glob("*.json"):
            lint.check_candles_data(p, load_json(p), cl)
        self.assertEqual(lint.errors, [])


class CandlesLintTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc, charts = routines_code.checklist_and_candles(SAMPLES / "prices", settings(), watchlist(), CFG, sample=False,
                                                              provider="tiingo")
        cls.sym = watchlist()["symbols"][0]["symbol"]
        cls.good = charts[cls.sym]

    def lint(self, c, cl=None, name=None):
        lint = Lint()
        lint.check_candles_data(Path(f"data/market/candles/{name or c['symbol']}.json"), c, self.doc if cl is None else cl)
        return lint

    def test_good_file_passes(self):
        lint = self.lint(self.good)
        self.assertEqual((lint.errors, lint.warnings), ([], []))
        self.assertEqual(Validator().validate(self.good, "candles.schema.json"), [])

    def test_lint_catches(self):
        def at(part, key, k, v):
            return lambda c: c[part][key].__setitem__(k, v)
        cases = {
            "sample": lambda c: c.__setitem__("sample", True),
            "last close": at("daily", "c", -1, 0.5),
            "weekly last close": at("weekly", "c", -1, -0.2),
            "raw price": lambda c: [c["daily"][q].__setitem__(5, 612.3) for q in "ohlc"],
            "below range": lambda c: [c["weekly"][q].__setitem__(0, -97.0) for q in "ohlc"],
            "length": lambda c: c["daily"]["vol_rel"].pop(),
            "negative volume": at("daily", "vol_rel", 3, -0.1),
            "wick": lambda c: c["daily"]["h"].__setitem__(10, min(c["daily"]["o"][10], c["daily"]["c"][10]) - 1),
            "order": lambda c: c["daily"]["dates"].reverse(),
            "overlay": lambda c: c["overlays"].__setitem__("tp1_pct", c["overlays"]["tp1_pct"] + 1),
            "as_of": lambda c: c.__setitem__("as_of", "2026-01-02"),
        }
        for name, mutate in cases.items():
            c = copy.deepcopy(self.good)
            mutate(c)
            self.assertTrue(self.lint(c).errors, f"{name} was not caught")

    def test_a_whole_file_of_raw_prices_or_raw_volume_is_refused(self):
        """The guards that keep the licence: a file built from raw bars (prices in o/h/l/c, which no range check alone can
        tell from percents for a cheap stock, or shares in vol_rel) fails lint and the routine, and the routine's log
        names the field, never the value."""
        bars = load_json(SAMPLES / "prices" / f"{self.sym}.json")["bars"]
        raw = copy.deepcopy(self.good)
        n = len(raw["daily"]["dates"])
        for q, key in zip("ohlc", ("open", "high", "low", "close")):
            raw["daily"][q] = [b[key] for b in bars[-n:]]
        self.assertTrue(all(-95 <= v <= 500 for q in "ohlc" for v in raw["daily"][q]))  # in range: only the 0 rule catches it
        self.assertTrue(any("last close must be 0" in e for e in self.lint(raw).errors))
        vol = copy.deepcopy(self.good)
        vol["daily"]["vol_rel"] = [float(b["volume"]) for b in bars[-n:]]
        self.assertTrue(self.lint(vol).errors)
        self.assertTrue(Validator().validate(vol, "candles.schema.json"))
        ok, refused = routines_code.candle_files({self.sym: raw, "VOL": {**vol, "symbol": self.sym}})
        self.assertEqual(ok, {})
        log = " ".join(refused)
        for v in (raw["daily"]["c"][-1], raw["daily"]["o"][0], vol["daily"]["vol_rel"][-1]):
            self.assertNotIn(str(v), log)
            self.assertNotIn(f"{v:g}", log)

    def test_schema_refuses_a_raw_price(self):
        c = copy.deepcopy(self.good)
        c["daily"]["h"][0] = 900.0
        self.assertTrue(Validator().validate(c, "candles.schema.json"))

    def test_file_name_off_list_and_missing_row(self):
        self.assertTrue(self.lint(self.good, name="ZZZZ").errors)
        off = {**copy.deepcopy(self.good), "symbol": "ZZZZ"}
        lint = self.lint(off)
        self.assertEqual(len(lint.warnings), 1)  # off the list: a warning (stale after a watchlist change)
        self.assertTrue(any("no row" in e for e in lint.errors))
        self.assertTrue(self.lint(self.good, cl={**self.doc, "symbols": []}).errors)


class SiteExportTest(unittest.TestCase):
    def test_sample_build_lists_one_candles_file_per_symbol(self):
        import build_site
        out = Path(tempfile.mkdtemp())
        try:
            with mock.patch.object(build_site, "OUT", out), mock.patch.object(sys, "argv", ["build_site.py", "--source", "sample", "--skip-lint"]):
                self.assertEqual(build_site.main(), 0)
            man = load_json(out / "manifest.json")
            cl = load_json(out / man["checklist"])
            self.assertEqual(sorted(man["candles"]), sorted(r["symbol"] for r in cl["symbols"]))
            for sym, path in man["candles"].items():
                self.assertEqual(path, f"market/candles/{sym}.json")
                c = load_json(out / path)
                self.assertTrue(c["sample"])
                self.assertEqual(Validator().validate(c, "candles.schema.json"), [])
        finally:
            shutil.rmtree(out, ignore_errors=True)

    def test_loader_is_on_demand(self):
        js = (ROOT / "site" / "src" / "lib" / "data.js").read_text()
        self.assertIn("export function loadCandles", js)
        load_all = js[js.index("export async function loadAll"):js.index("export function derive")]
        self.assertNotIn("candles", load_all)


class WiringTest(unittest.TestCase):
    def test_routine_lists_the_output(self):
        rt = load_json(CONFIG / "routines.json")
        r = {x["id"]: x for x in rt["routines"]}["technical_checklist"]
        self.assertIn("data/market/candles/<SYMBOL>.json", r["outputs"])
        self.assertEqual(Validator().validate(rt, "routines.schema.json"), [])


if __name__ == "__main__":
    unittest.main()
