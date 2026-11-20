"""Swing setup (config/swing.json, market.py swing_*, routines_code.py swing_*): the setup's checks on synthetic bars, no
look-ahead, the trade simulation's exits and costs, the history, the append-only forward record, the published shape and
lint."""
import copy
import json
import shutil
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import market as mk  # noqa: E402
import routines_code  # noqa: E402
from _common import CONFIG, SAMPLES, Validator, load_json, settings, watchlist  # noqa: E402
from lint import Lint  # noqa: E402

SCFG = load_json(CONFIG / "swing.json")
S = SCFG["params"]
CFG = load_json(CONFIG / "checklist.json")


def trading_dates(n: int, end: date = date(2026, 10, 2)) -> list[str]:
    out, d = [], end
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d -= timedelta(days=1)
    return out[::-1]


def bars(closes: list[float], spread: float = 0.004) -> dict:
    """Bars that open at the previous close, with a small range around the body."""
    o = [closes[0]] + closes[:-1]
    return {"dates": trading_dates(len(closes)), "o": o, "c": list(closes),
            "h": [max(a, b) * (1 + spread) for a, b in zip(o, closes)],
            "l": [min(a, b) * (1 - spread) for a, b in zip(o, closes)], "v": [1e6] * len(closes)}


def uptrend_then_pullback(bounce: bool = True) -> dict:
    """Eighty days rising half a percent a day, four days falling to the twenty-day average, then (optionally) a day that
    closes above the previous day's high."""
    c = [100 * 1.005 ** k for k in range(80)]
    for _ in range(4):
        c.append(c[-1] * 0.985)
    if bounce:
        c.append(c[-1] * 1.02)
    return bars(c)


class SwingSetupTest(unittest.TestCase):
    def test_config_matches_code(self):
        self.assertEqual(sorted(S), sorted(mk.SWING_PARAMS))
        self.assertEqual([s["id"] for s in SCFG["steps"]], list(mk.SWING_CHECKS))
        self.assertEqual(Validator().validate(SCFG, "swing_config.schema.json"), [])

    def test_bounce_after_pullback_in_uptrend_is_a_setup(self):
        B = uptrend_then_pullback()
        pre = mk.prep_swing(B, S)
        i = len(B["c"]) - 1
        sw = mk.swing_at(B, pre, i, S)
        self.assertEqual(sw["checks"], {"uptrend": True, "pullback": True, "trigger": True, "risk_ok": True})
        self.assertEqual(sw["state"], "setup")
        low = min(B["l"][i - S["pullback_days"] + 1:i + 1])
        stop = low * (1 - S["stop_buffer_pct"] / 100)
        self.assertAlmostEqual(sw["stop_pct"], round((B["c"][i] - stop) / B["c"][i] * 100, 2), places=6)
        self.assertAlmostEqual(sw["target_pct"], round(S["target_r"] * (B["c"][i] - stop) / B["c"][i] * 100, 2), places=6)
        self.assertGreater(sw["depth_pct"], S["min_depth_pct"])
        self.assertLessEqual(sw["days_since_low"], 1)  # the bounce day's low ties the day before's here

    def test_no_bounce_is_watch(self):
        B = uptrend_then_pullback(bounce=False)
        sw = mk.swing_at(B, mk.prep_swing(B, S), len(B["c"]) - 1, S)
        self.assertFalse(sw["checks"]["trigger"])
        self.assertEqual(sw["state"], "watch")

    def test_downtrend_is_none(self):
        c = [100 * 0.995 ** k for k in range(85)]
        c[-1] = c[-2] * 1.02
        B = bars(c)
        sw = mk.swing_at(B, mk.prep_swing(B, S), len(c) - 1, S)
        self.assertFalse(sw["checks"]["uptrend"])
        self.assertEqual(sw["state"], "none")

    def test_wide_stop_is_watch(self):
        B = uptrend_then_pullback()
        tight = {**S, "max_stop_pct": 0.5}
        sw = mk.swing_at(B, mk.prep_swing(B, tight), len(B["c"]) - 1, tight)
        self.assertFalse(sw["checks"]["risk_ok"])
        self.assertEqual(sw["state"], "watch")

    def test_no_look_ahead(self):
        B = uptrend_then_pullback()
        n = len(B["c"])
        for i in range(mk.swing_warmup(S), n):
            cut = {k: v[:i + 1] for k, v in B.items()}
            a = mk.swing_at(B, mk.prep_swing(B, S), i, S)
            b = mk.swing_at(cut, mk.prep_swing(cut, S), i, S)
            self.assertEqual(a, b, i)

    def test_public_fields_are_percents_not_prices(self):
        B = uptrend_then_pullback()
        sw = mk.public(mk.swing_at(B, mk.prep_swing(B, S), len(B["c"]) - 1, S))
        self.assertNotIn("_stop", sw)
        for k in ("stop_pct", "target_pct", "high_pct", "depth_pct"):
            self.assertLess(abs(sw[k]), 100)


def trade_bars(path: list[tuple[float, float, float, float]]) -> dict:
    """Bars from (open, high, low, close) tuples; the signal day is index 0."""
    return {"dates": trading_dates(len(path)), "o": [p[0] for p in path], "h": [p[1] for p in path],
            "l": [p[2] for p in path], "c": [p[3] for p in path], "v": [1e6] * len(path)}


NOCOST = {**S, "cost_bps": 0}


class SwingTradeTest(unittest.TestCase):
    def test_target(self):
        # in at 100, stop 95 (risk 5), target 110
        B = trade_bars([(99, 100, 98, 100), (100, 103, 99, 102), (102, 111, 101, 109)])
        t = mk.swing_trade(B, 0, 95, NOCOST)
        self.assertEqual((t["exit"], t["days"]), ("target", 2))
        self.assertAlmostEqual(t["r"], 2.0)

    def test_stop(self):
        B = trade_bars([(99, 100, 98, 100), (100, 101, 96, 97), (97, 98, 94, 95)])
        t = mk.swing_trade(B, 0, 95, NOCOST)
        self.assertEqual((t["exit"], t["days"]), ("stop", 2))
        self.assertAlmostEqual(t["r"], -1.0)

    def test_both_on_one_day_counts_the_stop(self):
        B = trade_bars([(99, 100, 98, 100), (100, 101, 99, 100), (100, 112, 94, 105)])
        self.assertEqual(mk.swing_trade(B, 0, 95, NOCOST)["exit"], "stop")

    def test_gap_through_the_stop_exits_at_the_open(self):
        B = trade_bars([(99, 100, 98, 100), (100, 101, 99, 100), (90, 91, 89, 90)])
        t = mk.swing_trade(B, 0, 95, NOCOST)
        self.assertEqual(t["exit"], "stop")
        self.assertAlmostEqual(t["r"], -2.0)

    def test_gap_over_the_target_exits_at_the_open(self):
        B = trade_bars([(99, 100, 98, 100), (100, 101, 99, 100), (115, 116, 114, 115)])
        t = mk.swing_trade(B, 0, 95, NOCOST)
        self.assertEqual(t["exit"], "target")
        self.assertAlmostEqual(t["r"], 3.0)

    def test_time_stop_at_the_tenth_close(self):
        days = S["time_stop_days"]
        B = trade_bars([(99, 100, 98, 100)] + [(100, 101, 99, 101)] * days + [(101, 102, 100, 101)])
        t = mk.swing_trade(B, 0, 95, NOCOST)
        self.assertEqual((t["exit"], t["days"]), ("time", days))
        self.assertAlmostEqual(t["r"], 0.2)

    def test_open_trade_is_none_and_next_open_under_the_stop_is_skipped(self):
        B = trade_bars([(99, 100, 98, 100), (100, 101, 99, 100)])
        self.assertIsNone(mk.swing_trade(B, 0, 95, NOCOST))
        self.assertIsNone(mk.swing_trade(B, 1, 95, NOCOST))  # no next day yet
        B = trade_bars([(99, 100, 98, 100), (94, 95, 93, 94)])
        self.assertEqual(mk.swing_trade(B, 0, 95, NOCOST)["exit"], "skipped")

    def test_costs_come_off_in_r(self):
        B = trade_bars([(99, 100, 98, 100), (100, 103, 99, 102), (102, 111, 101, 109)])
        t = mk.swing_trade(B, 0, 95, {**S, "cost_bps": 10})
        self.assertAlmostEqual(t["r"], round(2.0 - 2 * 10 / 10000 * 100 / 5, 3))


class SwingDocTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.st, cls.wl = settings(), watchlist()
        cls.doc = routines_code.compute_checklist(SAMPLES / "prices", cls.st, cls.wl, CFG, sample=False, provider="tiingo")

    def test_rows_and_section_pass_the_schema(self):
        self.assertEqual(Validator().validate(self.doc, "checklist.schema.json"), [])
        self.assertTrue(all(r["swing"]["state"] in mk.SWING_STATES for r in self.doc["symbols"]))
        sw = self.doc["swing"]
        self.assertEqual(sw["params"], S)
        self.assertEqual(sw["config_version"], SCFG["version"])
        br = sw["base_rates"]
        self.assertGreater(br["setup"]["n"], 0)
        self.assertEqual(sum(br["setup"]["exits"].values()), br["setup"]["n"])
        self.assertGreaterEqual(br["uptrend"]["n"], br["setup"]["n"])

    def test_forward_records_todays_setups(self):
        fw = self.doc["swing"]["forward"]
        setups = [r["symbol"] for r in self.doc["symbols"]
                  if r["swing"]["state"] == "setup" and r["symbol"] != self.doc["benchmark"]]
        self.assertEqual([s["symbol"] for s in fw["signals"]], setups)
        self.assertTrue(all(s["date"] == self.doc["as_of"] and s["status"] == "running" for s in fw["signals"]))
        self.assertEqual(fw["started"], self.doc["as_of"])

    def test_forward_is_append_only_and_scored_later(self):
        st, wl = self.st, self.wl
        with tempfile.TemporaryDirectory() as tmp:
            src = SAMPLES / "prices"
            early = Path(tmp) / "early"
            early.mkdir()
            cut = 40
            for p in src.glob("*.json"):
                doc = load_json(p)
                doc["bars"] = doc["bars"][:-cut]
                (early / p.name).write_text(json.dumps(doc))
            first = routines_code.compute_checklist(early, st, wl, CFG, sample=False, provider="tiingo")
            fw = first["swing"]["forward"]
            # a forged extra signal from an earlier day stays in the record, untouched
            old_day = first["symbols"][0]["history"][0]["date"]
            prev = {**fw, "signals": [{"date": old_day, "symbol": first["symbols"][0]["symbol"], "stop_pct": 3.0,
                                       "target_pct": 6.0, "status": "running"}, *fw["signals"]]}
            again = routines_code.compute_checklist(early, st, wl, CFG, sample=False, provider="tiingo", prev_swing=prev)
            self.assertEqual(len(again["swing"]["forward"]["signals"]), len(prev["signals"]))  # same day: no duplicates
            later = routines_code.compute_checklist(src, st, wl, CFG, sample=False, provider="tiingo",
                                                    prev_swing=again["swing"]["forward"])
        lf = later["swing"]["forward"]
        self.assertEqual(lf["started"], fw["started"])
        kept = [(s["date"], s["symbol"], s["stop_pct"]) for s in lf["signals"][:len(prev["signals"])]]
        self.assertEqual(kept, [(s["date"], s["symbol"], s["stop_pct"]) for s in prev["signals"]])
        self.assertTrue(all(s["status"] != "running" for s in lf["signals"][:len(prev["signals"])]))  # 40 days on: all done
        self.assertEqual(sum(lf["stats"]["exits"].values()), lf["stats"]["n"])

    def test_unreadable_published_record_stops_the_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "checklist.json"
            bad = copy.deepcopy(self.doc)
            bad["swing"]["forward"]["signals"] = [{"date": "2026-01-01"}]
            path.write_text(json.dumps(bad))
            with self.assertRaises(SystemExit):
                routines_code.published_swing(path)
            path.write_text(json.dumps(self.doc))
            self.assertEqual(routines_code.published_swing(path), self.doc["swing"]["forward"])
            old = {k: v for k, v in self.doc.items() if k != "swing"}
            path.write_text(json.dumps(old))
            self.assertIsNone(routines_code.published_swing(path))

    def test_old_rows_without_swing_still_pass(self):
        old = copy.deepcopy(self.doc)
        old.pop("swing")
        for r in old["symbols"]:
            r.pop("swing")
        self.assertEqual(Validator().validate(old, "checklist.schema.json"), [])

    def test_no_swing_config_no_swing(self):
        with tempfile.TemporaryDirectory() as tmp:
            orig = routines_code.CONFIG
            shutil.copytree(CONFIG, Path(tmp) / "config")
            (Path(tmp) / "config" / "swing.json").unlink()
            routines_code.CONFIG = Path(tmp) / "config"
            try:
                doc = routines_code.compute_checklist(SAMPLES / "prices", self.st, self.wl, CFG, sample=False, provider="tiingo")
            finally:
                routines_code.CONFIG = orig
        self.assertNotIn("swing", doc)
        self.assertTrue(all("swing" not in r for r in doc["symbols"]))


class SwingLintTest(unittest.TestCase):
    def lint(self, sc: dict) -> list[str]:
        lt = Lint()
        lt.check_swing(CONFIG / "swing.json", sc)
        return lt.errors

    def test_config_is_clean(self):
        self.assertEqual(self.lint(SCFG), [])

    def test_catches_order_params_prices_and_dates(self):
        bad = copy.deepcopy(SCFG)
        bad["steps"] = bad["steps"][::-1]
        self.assertTrue(any("steps must be" in e for e in self.lint(bad)))
        bad = copy.deepcopy(SCFG)
        bad["params"].pop("cost_bps")
        self.assertTrue(any("params must be" in e for e in self.lint(bad)))
        bad = copy.deepcopy(SCFG)
        bad["exits"] = "Sell when it reaches $250 a share, or at the stop."
        self.assertTrue(any("looks like a price" in e for e in self.lint(bad)))
        bad = copy.deepcopy(SCFG)
        bad["params"]["pullback_sma_days"] = 60
        self.assertTrue(any("shorter than" in e for e in self.lint(bad)))
        bad = copy.deepcopy(SCFG)
        bad["updated_at"] = "2999-01-01"
        self.assertTrue(any("future" in e for e in self.lint(bad)))

    def test_published_signals_must_stay_in_order(self):
        doc = routines_code.compute_checklist(SAMPLES / "prices", settings(), watchlist(), CFG, sample=False, provider="tiingo")
        sig = {"date": doc["as_of"], "symbol": doc["symbols"][0]["symbol"], "stop_pct": 3.0, "target_pct": 6.0, "status": "running"}
        doc["swing"]["forward"]["signals"] = [sig, {**sig, "date": "2026-01-02"}]
        lt = Lint()
        lt.check_checklist_data(Path("data/market/checklist.json"), doc)
        self.assertTrue(any("date order" in e for e in lt.errors))


if __name__ == "__main__":
    unittest.main()
