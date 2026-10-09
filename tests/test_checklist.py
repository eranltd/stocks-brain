"""Technical checklist (config/checklist.json, market.py, routines_code.py checklist): indicator maths on synthetic bars,
no look-ahead, the published file's shape and licence, the forward record, lint, the routine wiring and the pack."""
import copy
import json
import random
import shutil
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_pack  # noqa: E402
import market as mk  # noqa: E402
import record_run  # noqa: E402
import routines_code  # noqa: E402
from _common import CONFIG, DOCS, ROOT, SAMPLES, Validator, dump_json, load_json, settings, watchlist  # noqa: E402
from lint import Lint  # noqa: E402

CFG = load_json(CONFIG / "checklist.json")
P, HOUSE = routines_code.checklist_params(CFG)


def trading_dates(n: int, end: date = date(2026, 10, 2)) -> list[str]:
    out, d = [], end
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d -= timedelta(days=1)
    return out[::-1]


def bars_from(closes: list[float], spread: float = 0.005, vol: list[float] | None = None) -> dict:
    """Bars that open at the previous close, with a small range around the body."""
    o = [closes[0]] + closes[:-1]
    return {"dates": trading_dates(len(closes)), "o": o, "c": list(closes),
            "h": [max(a, b) * (1 + spread) for a, b in zip(o, closes)],
            "l": [min(a, b) * (1 - spread) for a, b in zip(o, closes)],
            "v": list(vol) if vol else [1e6] * len(closes)}


def walk(n: int, seed: int, drift: float = 0.0004, vol: float = 0.015) -> dict:
    rng = random.Random(seed)
    c, x = [], 100.0
    o, h, lo, v = [], [], [], []
    for _ in range(n):
        op = x * (1 + rng.gauss(0, vol / 3))  # opens away from the close, so real gaps happen
        x = max(1.0, op * (1 + rng.gauss(drift, vol)))
        o.append(op)
        c.append(x)
        h.append(max(op, x) * (1 + abs(rng.gauss(0, vol / 2))))
        lo.append(min(op, x) * (1 - abs(rng.gauss(0, vol / 2))))
        v.append(rng.uniform(5e5, 5e6))
    return {"dates": trading_dates(n), "o": o, "h": h, "l": lo, "c": c, "v": v}


def to_raw(B: dict) -> list[dict]:
    return [{"date": d, "open": o, "high": h, "low": lo, "close": c, "volume": v}
            for d, o, h, lo, c, v in zip(B["dates"], B["o"], B["h"], B["l"], B["c"], B["v"])]


class IndicatorTest(unittest.TestCase):
    def test_rsi_matches_the_published_wilder_example(self):
        # The worked RSI(14) example in StockCharts' ChartSchool: closes and the RSI it publishes for each day.
        c = [44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433, 46.0826, 45.8931, 46.0328,
             45.6140, 46.2820, 46.2820, 46.0028, 46.0328, 46.4116, 46.2222, 45.6439, 46.2122, 46.2521, 45.7137, 46.4515,
             45.7835, 45.3548, 44.0288, 44.1783, 44.2181, 44.5672, 43.4205, 42.6628, 43.1314]
        want = [70.53, 66.32, 66.55, 69.41, 66.36, 57.97, 62.93, 63.26, 56.06, 62.38, 54.71, 50.42, 39.99, 41.46, 41.87,
                45.46, 37.30, 33.08, 37.77]
        got = mk.rsi_series(c, 14)
        self.assertEqual(got[:14], [None] * 14)
        self.assertEqual([round(x, 2) for x in got[14:]], want)

    def test_rsi_extremes(self):
        self.assertEqual(mk.rsi_series(list(range(1, 40)), 14)[-1], 100.0)
        self.assertEqual(mk.rsi_series(list(range(40, 1, -1)), 14)[-1], 0.0)

    def test_sma_and_ma20_distance(self):
        c = [float(k) for k in range(1, 41)]
        s = mk.sma_series(c, 20)
        self.assertIsNone(s[18])
        self.assertAlmostEqual(s[19], 10.5)
        self.assertAlmostEqual(s[-1], 30.5)  # mean of 21..40
        B = bars_from([100.0] * 260 + [100 + k for k in range(1, 41)])
        cl = mk.checklist_at(B, mk.prep_checklist(B, P), len(B["c"]) - 1, P, HOUSE)
        avg = sum(B["c"][-20:]) / 20
        self.assertAlmostEqual(cl["ma20"]["dist_pct"], round((B["c"][-1] / avg - 1) * 100, 2))
        self.assertEqual((cl["ma20"]["side"], cl["ma20"]["lean"]), ("above", "bullish"))
        self.assertEqual(cl["trend"]["direction"], "up")

    def test_atr_is_the_range_on_a_flat_series(self):
        h, lo, c = [11.0] * 30, [9.0] * 30, [10.0] * 30
        a = mk.atr_series(h, lo, c, 14)
        self.assertIsNone(a[12])
        self.assertAlmostEqual(a[13], 2.0)
        self.assertAlmostEqual(a[-1], 2.0)


class CandleTest(unittest.TestCase):
    p = P["candle"]

    def cls(self, cur, prev=None, prior=None, unit="day"):
        return mk.classify_candle(cur, prev, prior, self.p, unit)

    def test_patterns(self):
        cases = [
            (((10, 12, 9.8, 11.9), (11.5, 11.6, 10.4, 10.5), None), "bullish engulfing", "bullish"),
            (((11, 11.2, 9, 9.1), (10, 11.1, 9.9, 10.8), None), "bearish engulfing", "bearish"),
            (((10, 11, 9, 10.05), None, None), "doji", "neutral"),
            (((10, 10.6, 8, 10.5), None, -3.0), "hammer", "bullish"),
            (((10, 10.6, 8, 10.5), None, 3.0), "hanging man", "bearish"),
            (((10, 12.5, 9.95, 10.4), None, 3.0), "shooting star", "bearish"),
            (((10, 12.5, 9.95, 10.4), None, -3.0), "inverted hammer", "bullish"),
            (((10, 11.02, 9.99, 11.0), None, None), "bullish marubozu", "bullish"),
            (((11, 11.01, 9.98, 10.0), None, None), "bearish marubozu", "bearish"),
            (((10, 11, 9, 10.4), None, None), "spinning top", "neutral"),
            (((10, 11, 9.8, 10.8), None, None), "up day", "bullish"),
            (((10.8, 11, 9.8, 10.1), None, None), "down day", "bearish"),
        ]
        for (cur, prev, prior), pattern, lean in cases:
            got = self.cls(cur, prev, prior)
            self.assertEqual((got["pattern"], got["lean"]), (pattern, lean), cur)
        self.assertEqual(self.cls((10, 11, 9.8, 10.8), unit="week")["pattern"], "up week")

    def test_body_and_close_position(self):
        got = self.cls((10, 12, 8, 11))
        self.assertEqual((got["body_pct"], got["close_in_range_pct"]), (25.0, 75.0))
        flat = self.cls((10, 10, 10, 10))
        self.assertEqual((flat["pattern"], flat["body_pct"], flat["close_in_range_pct"]), ("doji", 0.0, 50.0))

    def test_hammer_needs_a_move_into_it(self):
        self.assertNotIn(self.cls((10, 10.6, 8, 10.5), None, None)["pattern"], ("hammer", "hanging man"))

    def test_combine(self):
        self.assertEqual(mk._combine("bullish", "bullish"), "bullish")
        self.assertEqual(mk._combine("neutral", "bearish"), "bearish")
        self.assertEqual(mk._combine("bullish", "bearish"), "neutral")


class GapTest(unittest.TestCase):
    pg = P["gaps"]

    def test_gap_up_stays_open_shrinks_and_fills(self):
        h = [101, 101, 106, 107, 106, 105]
        lo = [99, 99, 104, 105, 103, 100]
        c = [100, 100, 105, 106, 104, 101]
        # day 2 gaps up over day 1 (low 104 > high 101): a 2.97% gap below the price
        g = mk.open_gaps(h, lo, c[2], 2, self.pg)
        self.assertEqual(len(g), 1)
        self.assertEqual((g[0]["where"], g[0]["days_open"], g[0]["size_pct"]), ("below", 0, round((104 / 101 - 1) * 100, 2)))
        self.assertEqual(g[0]["dist_pct"], round((104 / 105 - 1) * 100, 2))
        # day 4 trades down to 103: the gap is partly filled; its open edge is now 103
        g = mk.open_gaps(h, lo, c[4], 4, self.pg)
        self.assertEqual(g[0]["dist_pct"], round((103 / 104 - 1) * 100, 2))
        self.assertEqual(g[0]["days_open"], 2)
        # day 5 trades down to 100, below the old high of 101: filled
        self.assertEqual(mk.open_gaps(h, lo, c[5], 5, self.pg), [])

    def test_gap_down_sits_above_and_fills_from_below(self):
        h = [101, 101, 97, 98, 102]
        lo = [99, 99, 95, 96, 97]
        g = mk.open_gaps(h, lo, 97.5, 3, self.pg)
        self.assertEqual((g[0]["where"], g[0]["dist_pct"]), ("above", round((98 / 97.5 - 1) * 100, 2)))
        self.assertEqual(mk.open_gaps(h, lo, 101, 4, self.pg), [])  # day 4 reached 102, above the old low of 99

    def test_tiny_gaps_and_old_gaps_are_ignored(self):
        h, lo = [100.0, 100.3], [99.0, 100.2]  # a 0.2% gap is below min_gap_pct
        self.assertEqual(mk.open_gaps(h, lo, 100.25, 1, self.pg), [])
        n = self.pg["lookback_days"] + 5
        h = [101.0] + [106.0] * n
        lo = [99.0] + [104.0] * n
        self.assertEqual(mk.open_gaps(h, lo, 105, n, self.pg), [])  # opened before the lookback


class LevelsTest(unittest.TestCase):
    def test_pivots_cluster_into_support_and_resistance(self):
        # Two swing highs near 120 and two swing lows near 100, then the price sits at 110.
        c = [110.0] * 20
        for peak in (30, 70):
            c += [110 + k for k in range(1, 11)] + [120 - k for k in range(1, 11)]
            c += [110 - k for k in range(1, 11)] + [100 + k for k in range(1, 11)]
        c += [110.0] * 10
        B = bars_from(c, spread=0.0)
        pre = mk.prep_checklist(B, P)
        i = len(c) - 1
        sup, res = mk.sr_zones(B["h"], B["l"], c[i], i, pre, P["levels"])
        self.assertEqual(len(res), 1)
        self.assertEqual(res[0]["touches"], 2)
        self.assertAlmostEqual(res[0]["level"], 120.0)
        self.assertAlmostEqual(sup[0]["level"], 100.0)
        self.assertEqual(sup[0]["touches"], 2)

    def test_a_pivot_is_used_only_once_confirmed(self):
        c = [100.0 + k for k in range(30)] + [128.0, 127.0]  # the high at index 29 has only two days after it
        B = bars_from(c, spread=0.0)
        pre = mk.prep_checklist(B, P)
        sup, res = mk.sr_zones(B["h"], B["l"], 127.0, len(c) - 1, pre, P["levels"])
        self.assertEqual(res, [])


class VolumeAndRiskTest(unittest.TestCase):
    def cl(self, B):
        return mk.checklist_at(B, mk.prep_checklist(B, P), len(B["c"]) - 1, P, HOUSE)

    def test_rising_price_on_falling_volume_is_weakening(self):
        c = [100.0 + 0.3 * k for k in range(300)]
        v = [2e6] * 290 + [1e6] * 10  # the last ten days trade half the volume of the ten before
        got = self.cl(bars_from(c, vol=v))["volume"]
        self.assertEqual((got["move"], got["verdict"], got["lean"], got["rising_on_falling_volume"]), ("rising", "weakening", "bearish", True))
        self.assertAlmostEqual(got["trend_pct"], -50.0)

    def test_rising_price_on_up_day_volume_confirms(self):
        c = [100.0]
        for k in range(1, 300):
            c.append(c[-1] * (1.006 if k % 3 else 0.995))
        v = [3e6 if k % 3 else 1e6 for k in range(300)]
        got = self.cl(bars_from(c, vol=v))["volume"]
        self.assertEqual((got["move"], got["verdict"], got["lean"]), ("rising", "confirms", "bullish"))
        self.assertGreater(got["up_down_ratio_20d"], 1.2)

    def test_risk_plan_relations(self):
        for seed in range(12):
            B = walk(420, seed)
            cl = self.cl(B)
            rp = cl["risk_plan"]
            self.assertGreaterEqual(rp["stop_pct"] + 0.011, rp["atr_pct"] * P["risk_plan"]["stop_atr_min"])
            self.assertLessEqual(rp["stop_pct"], rp["atr_pct"] * P["risk_plan"]["stop_atr_max"] + 0.011)
            self.assertAlmostEqual(rp["rr_tp1"], rp["tp1_pct"] / rp["stop_pct"], delta=0.02)
            self.assertGreater(rp["tp2_pct"], rp["tp1_pct"])
            self.assertEqual(rp["fits_house_rule"], rp["rr_tp1"] >= HOUSE["min_reward_to_risk"])
            if not cl["levels"]["resistance"]:
                self.assertEqual((rp["tp1_basis"], rp["rr_tp1"]), ("risk_multiple", P["risk_plan"]["risk_multiple"]))
            else:
                self.assertEqual(rp["tp1_pct"], cl["levels"]["resistance"][0]["dist_pct"])

    @staticmethod
    def ranged(c):
        """Bars with a fixed range of one point either side of the close (so ATR is about two points)."""
        B = bars_from(c, spread=0.0)
        B["h"] = [x + 1 for x in c]
        B["l"] = [x - 1 for x in c]
        return B

    def test_risk_plan_on_a_known_chart(self):
        # A slow ramp (no pivots), a dip (a high before it, a low at its bottom), a peak, then a slide to the last close.
        c = [90 + 0.02 * k for k in range(260)]
        for j in range(11):
            c[200 + j] -= 5 - abs(j - 5)
        for j in range(1, 11):
            c[235 + j] = c[235] + j
        for j in range(1, 15):
            c[245 + j] = c[245] - 0.35 * j
        cl = self.cl(self.ranged(c))
        x = c[-1]
        d = lambda lvl: round((lvl / x - 1) * 100, 2)  # noqa: E731
        self.assertEqual(cl["levels"]["support"], [{"dist_pct": d(c[200] + 1), "touches": 1, "days_ago": 59},
                                                   {"dist_pct": d(c[205] - 1), "touches": 1, "days_ago": 54}])
        self.assertEqual(cl["levels"]["resistance"], [{"dist_pct": d(c[245] + 1), "touches": 1, "days_ago": 14}])
        rp = cl["risk_plan"]
        self.assertAlmostEqual(rp["atr_pct"], 2 / x * 100, delta=0.03)
        self.assertEqual(rp["stop_basis"], "atr")  # a quarter ATR under the support is further than two ATRs
        self.assertAlmostEqual(rp["stop_pct"], 2 * rp["atr_pct"], delta=0.02)
        self.assertEqual((rp["tp1_basis"], rp["tp1_pct"]), ("resistance", d(c[245] + 1)))
        self.assertEqual(rp["tp2_basis"], "risk_multiple")  # no second resistance: TP1 plus one risk
        self.assertAlmostEqual(rp["tp2_pct"], rp["tp1_pct"] + rp["stop_pct"], delta=0.02)
        self.assertAlmostEqual(rp["rr_tp1"], rp["tp1_pct"] / rp["stop_pct"], delta=0.01)
        self.assertLess(rp["rr_tp1"], 2)
        self.assertFalse(rp["fits_house_rule"])
        self.assertEqual(cl["levels"]["lean"], "neutral")  # resistance is not twice as far as support, nor the reverse

    def test_stop_below_a_close_support_and_the_one_atr_floor(self):
        def chart(tail_step):
            c = [100 - (240 - k) * 0.01 for k in range(240)]  # a slow ramp up to 100
            c += [101, 102, 103, 104, 103, 102, 101, 100.5]  # a high at index 243, a low at 247 (bar low 99.5)
            c += [100.5 + tail_step * k for k in range(1, 13)]
            return c
        c = chart(0.15)
        cl = self.cl(self.ranged(c))
        rp, x = cl["risk_plan"], c[-1]
        self.assertEqual(cl["levels"]["support"][0]["dist_pct"], round((99.5 / x - 1) * 100, 2))
        self.assertEqual(rp["stop_basis"], "support")  # a quarter ATR under 99.5 is closer than two ATRs
        a = rp["atr_pct"] / 100 * x
        self.assertAlmostEqual(rp["stop_pct"], (x - (99.5 - 0.25 * a)) / x * 100, delta=0.02)
        c = chart(0.02)  # the close sits just above the support: the stop is floored at one ATR
        rp = self.cl(self.ranged(c))["risk_plan"]
        self.assertEqual(rp["stop_basis"], "min_atr")
        self.assertAlmostEqual(rp["stop_pct"], rp["atr_pct"], delta=0.02)


class NoLookAheadTest(unittest.TestCase):
    def test_truncating_the_future_changes_nothing(self):
        B = walk(700, 7)
        pre = mk.prep_checklist(B, P)
        for i in (300, 420, 555, 698):
            full = mk.checklist_at(B, pre, i, P, HOUSE)
            T = {k: v[:i + 1] for k, v in B.items()}
            cut = mk.checklist_at(T, mk.prep_checklist(T, P), i, P, HOUSE)
            self.assertEqual(json.dumps(mk.public(full), sort_keys=True), json.dumps(mk.public(cut), sort_keys=True), i)

    def test_mutation_after_the_day_is_invisible(self):
        """A different future (bars after i replaced) leaves the checklist at i unchanged; the test would catch a leak."""
        B = walk(600, 11)
        i = 450
        alt = copy.deepcopy(B)
        for k in range(i + 1, len(B["c"])):
            for key in ("o", "h", "l", "c"):
                alt[key][k] *= 1.5
            alt["v"][k] *= 3
        a = mk.checklist_at(B, mk.prep_checklist(B, P), i, P, HOUSE)
        b = mk.checklist_at(alt, mk.prep_checklist(alt, P), i, P, HOUSE)
        self.assertEqual(mk.public(a), mk.public(b))
        self.assertNotEqual(mk.public(mk.checklist_at(alt, mk.prep_checklist(alt, P), i + 3, P, HOUSE)),
                            mk.public(mk.checklist_at(B, mk.prep_checklist(B, P), i + 3, P, HOUSE)))


class ChangesTest(unittest.TestCase):
    def test_flips_are_named_in_words(self):
        B = walk(400, 3)
        pre = mk.prep_checklist(B, P)
        prev = mk.checklist_at(B, pre, 398, P, HOUSE)
        cur = copy.deepcopy(prev)
        cur["score"]["verdict"], prev["score"]["verdict"] = "lean_down", "mixed"
        cur["rsi"]["zone"], prev["rsi"]["zone"] = "overbought", "neutral"
        prev["ma20"]["side"], cur["ma20"]["side"] = "above", "below"
        prev["gaps"]["_ks"], cur["gaps"]["_ks"] = {("above", 390)}, {("below", 398)}
        texts = {c["text"]: c["tone"] for c in mk.checklist_changes(prev, cur)}
        self.assertEqual(texts["Verdict moved from mixed to lean down"], "bearish")
        self.assertEqual(texts["RSI moved into overbought"], "bearish")
        self.assertEqual(texts["Closed below the twenty-day average"], "bearish")
        self.assertIn("Gap above filled", texts)
        self.assertIn("Gapped up, leaving an open gap below", texts)
        same = [c for c in mk.checklist_changes(prev, prev) if c["check"] != "candle"]  # a notable candle is news, not a flip
        self.assertEqual([c for c in same if c["check"] != "levels"], [])

    def test_summary_has_no_digits(self):
        for seed in range(8):
            B = walk(400, seed)
            cl = mk.checklist_at(B, mk.prep_checklist(B, P), 399, P, HOUSE)
            self.assertNotRegex(cl["score"]["summary"], r"\d")
            self.assertEqual(cl["score"]["bullish"] + cl["score"]["bearish"] + cl["score"]["neutral"], 7)


class PublishedFileTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.st, cls.wl = settings(), watchlist()
        cls.doc = routines_code.compute_checklist(SAMPLES / "prices", cls.st, cls.wl, CFG, sample=True, provider="sample")

    def test_valid_and_covers_the_list_and_the_benchmark(self):
        self.assertEqual(Validator().validate(self.doc, "checklist.schema.json"), [])
        want = [s["symbol"] for s in self.wl["symbols"]] + [self.st["scoring"]["benchmark"]["symbol"]]
        self.assertEqual([r["symbol"] for r in self.doc["symbols"]], want)
        self.assertEqual(self.doc["skipped"], [])
        for r in self.doc["symbols"]:
            self.assertEqual(len(r["history"]), CFG["measure"]["history_days"])
            self.assertEqual(r["history"][-1]["date"], r["as_of"])
            self.assertEqual(r["history"][-1]["changes"], r["changes"])

    def test_no_prices_or_raw_volume(self):
        text = json.dumps(self.doc)
        for key in ('"close"', '"open"', '"high"', '"low"', '"level"', '"price"', '"_'):
            self.assertNotIn(key, text)

        def numbers(node):
            if isinstance(node, dict):
                for v in node.values():
                    yield from numbers(v)
            elif isinstance(node, list):
                for v in node:
                    yield from numbers(v)
            elif isinstance(node, (int, float)) and not isinstance(node, bool):
                yield node
        bench = self.st["scoring"]["benchmark"]["symbol"]
        bars = load_json(SAMPLES / "prices" / f"{bench}.json")["bars"]
        for r in self.doc["symbols"]:
            B = routines_code.align_bars_tail({r["symbol"]: load_json(SAMPLES / "prices" / f"{r['symbol']}.json")["bars"]},
                                              [b["date"] for b in bars])[r["symbol"]]
            cl = mk.checklist_at(B, mk.prep_checklist(B, P), len(B["c"]) - 1, P, HOUSE)
            raw = {round(x, 2) for x in [cl["_close"], *cl["levels"]["_sup"], *cl["levels"]["_res"]]}
            raw |= {round(B[k][j], 2) for k in "ohlc" for j in range(-5, 0)} | set(B["v"][-25:])
            self.assertEqual(raw & set(numbers(r)), set(), r["symbol"])

    def test_base_rates_are_measured_and_labelled(self):
        br = self.doc["base_rates"]
        self.assertGreaterEqual(br["from"], CFG["measure"]["from"])
        self.assertEqual(sum(r["n"] for r in br["by_verdict"]), br["all"]["n"])
        self.assertEqual(sum(r["n"] for r in br["by_score"]), br["all"]["n"])
        self.assertEqual(br["house_rule"]["fits"]["n"] + br["house_rule"]["fails"]["n"], br["all"]["n"])
        self.assertIn("survivors", br["note"])
        self.assertNotIn("step_days", br["note"])  # numbers, not parameter names
        self.assertIn("wider", br["note"])  # names move together: the ranges understate the uncertainty

    def test_base_rates_use_only_the_horizon_ahead(self):
        """Changing prices after the last measured day plus the horizon leaves the base rates unchanged."""
        bench = self.st["scoring"]["benchmark"]["symbol"]
        series = {"AAA": walk(800, 1), bench: walk(800, 2, drift=0.0003, vol=0.01)}
        br = {**CFG["measure"], "from": "2000-01-01"}
        a = mk.checklist_base_rates(series, bench, P, HOUSE, br)
        alt = copy.deepcopy(series)
        last = a["to"]
        k = series["AAA"]["dates"].index(last) + br["horizon_days"]
        for s in alt.values():
            for j in range(k + 1, 800):
                s["c"][j] *= 2
        self.assertEqual(a, mk.checklist_base_rates(alt, bench, P, HOUSE, br))


class ForwardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.st, self.wl = settings(), watchlist()
        self.bench = self.st["scoring"]["benchmark"]["symbol"]
        self.full = {p.stem: load_json(p) for p in (SAMPLES / "prices").glob("*.json")}

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def prices_until(self, n_cut: int) -> Path:
        d = self.tmp / f"p{n_cut}"
        for sym, doc in self.full.items():
            dump_json(d / f"{sym}.json", {**doc, "bars": doc["bars"][:len(doc["bars"]) - n_cut]})
        return d

    def test_append_only_every_step_days_and_scored_later(self):
        step = CFG["measure"]["step_days"]
        first = routines_code.compute_checklist(self.prices_until(60), self.st, self.wl, CFG, False, "tiingo")
        fw = first["forward"]
        self.assertEqual((len(fw["records"]), fw["scored_records"]), (1, 0))
        nxt = routines_code.compute_checklist(self.prices_until(60 - (step - 1)), self.st, self.wl, CFG, False, "tiingo", prev=fw)
        self.assertEqual(len(nxt["forward"]["records"]), 1)  # not due yet
        due = routines_code.compute_checklist(self.prices_until(60 - step), self.st, self.wl, CFG, False, "tiingo", prev=fw)
        self.assertEqual(len(due["forward"]["records"]), 2)
        self.assertEqual(due["forward"]["records"][0], fw["records"][0])  # never edited
        later = routines_code.compute_checklist(self.prices_until(0), self.st, self.wl, CFG, False, "tiingo", prev=due["forward"])
        self.assertEqual(later["forward"]["records"][:2], due["forward"]["records"])
        self.assertGreaterEqual(later["forward"]["scored_records"], 2)
        n = sum(r["n"] for r in later["forward"]["by_verdict"])
        self.assertEqual(n, later["forward"]["house_rule"]["fits"]["n"] + later["forward"]["house_rule"]["fails"]["n"])
        self.assertEqual(n, len(self.wl["symbols"]) * later["forward"]["scored_records"])
        self.assertEqual(Validator().validate(later, "checklist.schema.json"), [])
        rec = later["forward"]["records"][0]
        self.assertNotIn(self.bench, rec["names"])
        self.assertEqual(routines_code.forward_problems(later["forward"]), [])
        broken = copy.deepcopy(later["forward"])
        broken["records"].reverse()
        broken["records"][0]["names"][next(iter(rec["names"]))]["verdict"] = "buy"
        self.assertEqual(len(routines_code.forward_problems(broken)), len(broken["records"]))  # each step down, and the verdict
        self.assertTrue(routines_code.forward_problems(None))


class ChecklistLintTest(unittest.TestCase):
    def lint_cfg(self, cfg):
        lint = Lint()
        lint.check_checklist(CONFIG / "checklist.json", cfg, today="2026-10-09")
        return lint.errors

    def test_config_is_valid(self):
        self.assertEqual(Validator().validate(CFG, "checklist_config.schema.json"), [])
        self.assertEqual(self.lint_cfg(CFG), [])
        self.assertEqual([s["id"] for s in CFG["steps"]], list(mk.STEPS))
        self.assertEqual(CFG["house_rule"]["min_reward_to_risk"], 2)
        rsi = P["rsi"]
        self.assertEqual((rsi["period"], rsi["overbought"], rsi["oversold"]), (14, 70, 30))
        self.assertEqual((P["ma20"]["days"], P["volume"]["avg_days"], P["gaps"]["lookback_days"]), (20, 20, 60))
        self.assertIsNone(CFG["source"]["url"])
        self.assertEqual(CFG["status"], "unproven")

    def test_lint_catches_bad_configs(self):
        cases = {
            "order": lambda c: c["steps"].reverse(),
            "missing param": lambda c: c["steps"][6]["params"].pop("oversold"),
            "unknown param": lambda c: c["steps"][0]["params"].__setitem__("five_minute", 1),
            "rsi bounds": lambda c: c["steps"][6]["params"].__setitem__("oversold", 80),
            "stops": lambda c: c["steps"][7]["params"].__setitem__("stop_atr_min", 3),
            "directional": lambda c: c["steps"][7].__setitem__("directional", True),
            "quote": lambda c: c["steps"][1].__setitem__("checks", 'He said "the trend is your friend" twice.'),
            "overlap": lambda c: c["measure"].__setitem__("step_days", 5),
            "future": lambda c: c.__setitem__("updated_at", "2027-01-01"),
        }
        for name, mutate in cases.items():
            cfg = copy.deepcopy(CFG)
            mutate(cfg)
            self.assertTrue(self.lint_cfg(cfg), f"{name} was not caught")

    def test_published_file_checks(self):
        doc = routines_code.compute_checklist(SAMPLES / "prices", settings(), watchlist(), CFG, sample=False, provider="tiingo")
        lint = Lint()
        lint.check_checklist_data(Path("data/market/checklist.json"), doc)
        self.assertEqual(lint.errors, [])
        bad = copy.deepcopy(doc)
        bad["symbols"][0]["symbol"] = "ZZZZ"
        bad["sample"] = True
        bad["forward"]["records"] = bad["forward"]["records"] * 2
        lint = Lint()
        lint.check_checklist_data(Path("data/market/checklist.json"), bad)
        self.assertEqual(len(lint.errors), 2)  # sample flag and repeated forward records
        # an off-list name is a warning: a stale file after a watchlist change must not discard the day's data
        self.assertEqual(len(lint.warnings), 1)


class WiringTest(unittest.TestCase):
    def test_routine_is_registered_and_runs_daily(self):
        rt = load_json(CONFIG / "routines.json")
        r = {x["id"]: x for x in rt["routines"]}["technical_checklist"]
        self.assertEqual((r["status"], r["runner"], r["uses_llm"], r["max_cost_usd"], r["cadence"], r["cron"]),
                         ("active", "github_actions", False, 0, "daily", "40 23 * * 1-5"))
        self.assertIn("data/market/checklist.json", r["outputs"])
        daily = (ROOT / ".github" / "workflows" / "daily.yml").read_text()
        self.assertIn("id: technical_checklist", daily)
        self.assertIn("routines_code.py checklist", daily)
        self.assertIn("ROUTINE_TECHNICAL_CHECKLIST: ${{ steps.technical_checklist.outcome }}", daily)
        step = daily[daily.index("id: technical_checklist"):daily.index("routines_code.py checklist")]
        self.assertIn("continue-on-error: true", step)
        self.assertIn("checklist", routines_code.STEPS)
        self.assertEqual(Validator().validate(rt, "routines.schema.json"), [])

    def test_registry_and_rule_settings_are_untouched(self):
        """The checklist must not start a new freeze: nothing it reads is part of the registry hash."""
        import subprocess
        out = subprocess.run(["git", "diff", "--name-only", "origin/main", "--", "config/rules.json"], cwd=ROOT,
                             capture_output=True, text=True)
        if out.returncode == 0:
            self.assertEqual(out.stdout.strip(), "")
        self.assertNotIn("checklist", json.dumps(settings()))


class FeedHelpersTest(unittest.TestCase):
    """What the Today feed needs for past market days: context funds carry their recent day moves; watchlist names and the
    benchmark carry `series`, whose consecutive points give the day moves."""

    def test_past_market_days(self):
        st, wl = settings(), watchlist()
        doc = routines_code.compute_derived(SAMPLES / "prices", st, wl, sample=True, provider="sample")
        self.assertEqual(Validator().validate(doc, "derived.schema.json"), [])
        for x in doc["context"]["instruments"]:
            rd = x["recent_days"]
            self.assertEqual(len(rd), routines_code.RECENT_DAYS)
            self.assertEqual((rd[-1]["date"], rd[-1]["change_pct"]), (doc["as_of"], x["change_1d_pct"]))
            self.assertEqual([d["date"] for d in rd], sorted({d["date"] for d in rd}))
        for r in doc["symbols"]:
            s = r["series"]
            self.assertAlmostEqual((s[-1]["v"] / s[-2]["v"] - 1) * 100, r["change_1d_pct"], delta=0.05)


class PackTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from test_brain_pipeline import live_like_data
        cls.tmp = Path(tempfile.mkdtemp())
        cls.data = live_like_data(cls.tmp)
        doc = routines_code.compute_checklist(SAMPLES / "prices", settings(), watchlist(), CFG, sample=False, provider="tiingo")
        dump_json(cls.data / "market" / "checklist.json", doc, compact=True)
        cls.pack = build_pack.build(cls.data, cls.tmp / "runs", today="2026-10-05")
        cls.on_list = {s["symbol"] for s in watchlist()["symbols"]}

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_block_keys_and_cap(self):
        ck = self.pack["checklist"]
        self.assertEqual(set(ck["names"]), {s.lower() for s in self.on_list})
        row = next(iter(ck["names"].values()))
        self.assertEqual(set(row), {"verdict", "net", "rsi", "trend", "ma20", "volume", "rr_tp1", "fits"})
        self.assertNotIn("forward", ck)  # nothing scored yet in this fixture
        self.assertEqual(set(ck["base_rates"]["by_verdict"]), {"lean_up", "mixed", "lean_down"})
        self.assertIn("unproven", ck["note"])
        self.assertIn("never the only reason", ck["note"])
        self.assertEqual(ck["as_of"], load_json(self.data / "market" / "checklist.json")["as_of"])  # a stale reading shows its date
        text = json.dumps(self.pack, sort_keys=True, separators=(",", ":"))
        self.assertLessEqual(build_pack.estimate_tokens(text), settings()["pack"]["token_cap"])
        for banned in ('"close"', '"open"', '"high"', '"low"'):
            self.assertNotIn(banned, text)

    def test_checklist_evidence_keys_are_accepted(self):
        keys = build_pack.evidence_keys(self.pack)
        sym = sorted(self.on_list)[0]
        for k in (f"checklist.names.{sym.lower()}", f"checklist.names.{sym.lower()}.fits", "checklist.base_rates",
                  "checklist.base_rates.by_verdict"):
            self.assertIn(k, keys)
        guard = load_json(DOCS / "guardrails.json")
        out = {"summary": "One name leads with a calm trend; the checklist agrees but proves nothing yet.",
               "picks": [{"ticker": sym, "stance": "bullish", "conviction": "low",
                          "thesis": "Leads the benchmark while its trend holds; the chart checklist leans the same way.",
                          "risks": ["A broad pullback would hit it too"], "invalidation": "A close back below its long average.",
                          "evidence": [f"market.{sym.lower()}", f"checklist.names.{sym.lower()}", "checklist.base_rates"]}]}
        self.assertEqual(record_run.check_picks(out, self.pack, guard, self.on_list), [])
        out["picks"][0]["evidence"].append("checklist.names.zzzz")
        self.assertTrue(record_run.check_picks(out, self.pack, guard, self.on_list))

    def test_block_is_empty_without_live_data(self):
        self.assertEqual(build_pack.checklist_block(None, self.on_list), {})
        doc = load_json(self.data / "market" / "checklist.json")
        self.assertEqual(build_pack.checklist_block({**doc, "sample": True}, self.on_list), {})

    def test_block_is_capped(self):
        doc = load_json(self.data / "market" / "checklist.json")
        many = {**doc, "symbols": [{**doc["symbols"][0], "symbol": f"Z{k:02d}"} for k in range(60)]}
        on = {f"Z{k:02d}" for k in range(60)}
        self.assertEqual(len(build_pack.checklist_block(many, on)["names"]), build_pack.CHECKLIST_NAMES_MAX)


if __name__ == "__main__":
    unittest.main()
