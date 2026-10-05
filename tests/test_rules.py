import math
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import portfolio as pf  # noqa: E402
import routines_code  # noqa: E402
import rules  # noqa: E402
from _common import SAMPLES, load_json, settings, watchlist  # noqa: E402


def dates(n):
    out, y, m, d = [], 2014, 1, 1
    while len(out) < n:
        out.append(f"{y:04d}-{m:02d}-{d:02d}")
        d += 1
        if d > 21:
            d, m = 1, m + 1
        if m > 12:
            m, y = 1, y + 1
    return out


def bars(ds, closes, wick=0.012):
    """Bars with a high and low around each close (so true range differs from close-to-close change)."""
    return [{"date": d, "close": c, "high": c * (1 + wick), "low": c * (1 - wick)} for d, c in zip(ds, closes)]


def walk(n, drift, vol, seed, start=100.0):
    r = random.Random(seed)
    out = [start]
    for _ in range(n - 1):
        out.append(out[-1] * (1 + drift + r.gauss(0, vol)))
    return out


def synthetic_market(n=1500, syms=6, core_drift=0.0004, seed=1):
    ds = dates(n)
    sectors = {}
    raw = {"QQQ": bars(ds, walk(n, 0.0005, 0.01, seed)), "SPY": bars(ds, walk(n, core_drift, 0.008, seed + 1)),
           "SGOV": bars(ds, [100 * (1 + 0.00008) ** k for k in range(n)])}
    names = []
    for k in range(syms):
        s = f"T{k}"
        names.append(s)
        sectors[s] = f"Sector{k % 3}"
        raw[s] = bars(ds, walk(n, 0.0003 + 0.0001 * k, 0.014, seed + 10 + k))
    return rules.build_market(raw, names, "SPY", "QQQ", "SGOV", sectors), names


def truncate(M, n2):
    T = dict(M)
    T["n"] = n2
    T["dates"] = M["dates"][:n2]
    T["c"] = {s: c[:n2] for s, c in M["c"].items()}
    T["core"], T["bench"], T["cash"], T["core_on"] = M["core"][:n2], M["bench"][:n2], M["cash"][:n2], M["core_on"][:n2]
    T["tr"] = {s: row[:n2] for s, row in M["tr"].items()}
    return T


SETUP = settings()

CONFIGS = {
    "v1": {"slots": 5, "selection": {"method": "v1"}},
    "filters": {"slots": 4, "selection": {"method": "filters", "rank": "rs_6m", "keep": {"mode": "same_filters"},
                                          "filters": [{"f": "trend50_200"}, {"f": "rs_6m"}, {"f": "not_stretched", "pct": 8}]}},
    "breakout_atr": {"slots": 4, "sizing": "inverse_vol", "exit": {"kind": "atr_trail", "k": 3, "n": 14},
                     "selection": {"method": "filters", "rank": "rs_12_1", "keep": {"mode": "rank_top", "n": 8},
                                   "filters": [{"f": "breakout", "n": 126}, {"f": "rs_12_1"}]}},
    "five_leaders": {"slots": 5, "max_per_sector": 1,
                     "selection": {"method": "filters", "rank": "rs_12_1",
                                   "keep": {"mode": "rank_top", "n": 10, "filters": [{"f": "above_sma", "n": 200}]},
                                   "filters": [{"f": "trend_long", "n": 200, "rising_days": 21}, {"f": "not_stretched", "pct": 8}]}},
    "pullback_trend_break": {"slots": 5, "rebalance": "quarterly", "regime": "core_trend", "exit": {"kind": "trend_break", "n": 100},
                             "selection": {"method": "filters", "rank": "low_vol",
                                           "filters": [{"f": "pullback", "max_pct": 5}, {"f": "low_vol_cap", "pct": 60}]}},
}


class EngineEqualsReferenceTest(unittest.TestCase):
    def test_v1_with_same_close_fills_equals_portfolio_module(self):
        """The new engine must reproduce portfolio.compute_longrun's rule exactly when fills are same-close."""
        st, wl = settings(), watchlist()
        sectors = {s["symbol"]: s["sector"] for s in wl["symbols"]}
        raw = {p.stem: load_json(p)["bars"] for p in (SAMPLES / "prices").glob("*.json")}
        names = [s["symbol"] for s in wl["symbols"]]
        M = rules.build_market(raw, names, wl["core"]["symbol"], st["scoring"]["benchmark"]["symbol"], "SGOV", sectors)
        doc = routines_code.compute_longrun(SAMPLES / "prices", st, wl, sample=True, provider="sample")
        res = rules.run_sleeve({"slots": st["portfolio"]["slots"], "selection": {"method": "v1"}}, M, st, 253, lag=0,
                               cost_bps=st["portfolio"]["cost_bps"])
        ref = doc["stats"]["rule"]
        got = pf.long_stats(res["values"], st["goal"]["annual_return_pct"])
        self.assertEqual(got["cagr_pct"], ref["cagr_pct"])
        self.assertEqual(got["max_dd_pct"], ref["max_dd_pct"])
        self.assertEqual(res["rebalances"][-1]["holdings"], doc["now"]["holdings"])


def perturb_after(M, cut, seed=3):
    """A copy of the market whose prices after day `cut` are replaced by a wild different future."""
    r = random.Random(seed)
    N = {k: v for k, v in M.items() if k != "_corr"}  # never share the correlation cache with the real future
    N["c"] = {}
    for s, c in M["c"].items():
        f, out = 1.0, list(c)
        for k in range(cut + 1, M["n"]):
            f *= math.exp(r.gauss(0, 0.06))
            out[k] = c[k] * f
        N["c"][s] = out
    for key in ("core", "bench"):
        f, out = 1.0, list(M[key])
        for k in range(cut + 1, M["n"]):
            f *= math.exp(r.gauss(0, 0.06))
            out[k] = M[key][k] * f
        N[key] = out
    N["core_on"] = rules.trend_flags(N["core"])
    N["tr"] = {}
    for s, row in M["tr"].items():
        out = list(row)
        for k in range(cut + 1, M["n"]):
            out[k] = None if row[k] is None else row[k] * r.uniform(0.2, 5.0)
        N["tr"][s] = out
    return N


class NoLookaheadTest(unittest.TestCase):
    def test_decisions_do_not_depend_on_future_data(self):
        """Replace everything after a decision day with a different future: every decision made on or before
        that day, and every value up to it, must be identical."""
        M, _ = synthetic_market(1500)
        month_starts = [k for k in range(300, 1300) if M["dates"][k][:7] != M["dates"][k - 1][:7]]
        cuts = [month_starts[i] for i in (2, 7, 12, 17)]
        for name, cfg in CONFIGS.items():
            for lag in (0, 1):
                base = rules.run_sleeve(cfg, M, SETUP, 260, lag=lag)
                for cut in cuts:
                    alt = rules.run_sleeve(cfg, perturb_after(M, cut), SETUP, 260, lag=lag)
                    fill = M["dates"][cut + lag]
                    # What was decided: names and core share. (traded_pct also reflects the move between decision and fill.)
                    same = lambda res, key: [{k: x[k] for k in x if k != "traded_pct"} for x in res[key] if x["date"] <= fill]  # noqa: E731
                    self.assertEqual(same(base, "rebalances"), same(alt, "rebalances"), f"{name} lag={lag} cut={cut}: decision used the future")
                    self.assertEqual(same(base, "stops"), same(alt, "stops"), f"{name} lag={lag} cut={cut}: stop used the future")
                    self.assertEqual(base["values"][: cut - 260 + 1], alt["values"][: cut - 260 + 1])

    def test_the_test_can_fail(self):
        """Mutation check: a filter that peeks one day ahead must be caught by the perturbation."""
        M, _ = synthetic_market(1500)
        orig = rules.FILTERS["rs_6m"]
        rules.FILTERS["rs_6m"] = lambda c, b, i, p: c[min(i + 1, len(c) - 1)] > c[i]
        try:
            cfg = CONFIGS["filters"]
            month_starts = [k for k in range(300, 1300) if M["dates"][k][:7] != M["dates"][k - 1][:7]]
            caught = False
            for cut in month_starts[2:20:3]:
                a = rules.run_sleeve(cfg, M, SETUP, 260, lag=1)["rebalances"]
                b = rules.run_sleeve(cfg, perturb_after(M, cut), SETUP, 260, lag=1)["rebalances"]
                fill = M["dates"][cut + 1]
                pick = lambda rs: [(x["date"], x["holdings"]) for x in rs if x["date"] <= fill]  # noqa: E731
                caught |= pick(a) != pick(b)
        finally:
            rules.FILTERS["rs_6m"] = orig
        self.assertTrue(caught)

    def test_trend_gate_uses_only_the_past(self):
        M, _ = synthetic_market(1500)
        cut = 900
        self.assertEqual(M["core_on"][: cut + 1], perturb_after(M, cut)["core_on"][: cut + 1])

    def test_savings_gate_and_cadence_ignore_the_future(self):
        M, _ = synthetic_market(1500)
        start, h = 300, 52
        end = start + h * rules.WEEK
        for gate in (False, True):
            a = rules.run_savings(M, start, h, 4, gate=gate)
            b = rules.run_savings(perturb_after(M, end + 1), start, h, 4, gate=gate)
            self.assertEqual(a, b)


class SavingsMathTest(unittest.TestCase):
    def market(self, daily):
        n = 1500
        ds = dates(n)
        core = [100 * (1 + daily) ** k for k in range(n)]
        raw = {"QQQ": bars(ds, core), "SPY": bars(ds, core)}
        return rules.build_market(raw, [], "SPY", "QQQ", None, {})

    def test_steady_growth_irr_and_lump_sum(self):
        g = 0.0005
        M = self.market(g)
        weekly = rules.run_savings(M, 300, 104, 1)
        self.assertAlmostEqual(weekly["irr_pct"], ((1 + g) ** 252 - 1) * 100, delta=0.1)  # 252-day year; the gap is the one-day fill lag
        lump = rules.run_savings(M, 300, 104, mode="windfall", spread_weeks=1)
        self.assertAlmostEqual(lump["multiple"], (1 + g) ** (104 * 5 - 1), places=6)
        spread = rules.run_savings(M, 300, 104, mode="windfall", spread_weeks=26)
        self.assertLess(spread["multiple"], lump["multiple"])  # a rising market punishes waiting (cash earns 0 here)
        self.assertEqual(lump["trades"], 1)
        self.assertEqual(spread["trades"], 26)

    def test_less_frequent_buying_waits_and_holds_cash(self):
        M = self.market(0.0005)
        weekly, quarterly = rules.run_savings(M, 300, 104, 1), rules.run_savings(M, 300, 104, 13)
        self.assertGreater(weekly["terminal_units"], quarterly["terminal_units"])
        self.assertGreater(quarterly["cash_share_pct"], weekly["cash_share_pct"])
        self.assertLess(quarterly["trades"], weekly["trades"])

    def test_trend_gate_stays_in_cash_in_a_downtrend(self):
        M = self.market(-0.0005)
        gated, plain = rules.run_savings(M, 300, 104, 4, gate=True), rules.run_savings(M, 300, 104, 4)
        self.assertEqual(gated["trades"], 0)
        self.assertGreater(gated["terminal_units"], plain["terminal_units"])  # cash beats a falling market
        self.assertGreater(gated["worst_vs_paid_pct"], plain["worst_vs_paid_pct"])

    def test_study_pairs_against_baseline(self):
        M, _ = synthetic_market(1700)
        specs = [{"id": "w1", "every_weeks": 1}, {"id": "w4", "every_weeks": 4}, {"id": "q", "every_weeks": 13},
                 {"id": "gate", "every_weeks": 4, "gate": "core_trend"}]
        specs[0]["baseline"] = True
        specs += [{"id": "lump", "mode": "windfall", "spread_weeks": 1, "baseline": True}, {"id": "spread", "mode": "windfall", "spread_weeks": 26}]
        out = rules.savings_study(M, specs, [104], step_weeks=8)
        self.assertEqual(out["baselines"], {"stream": "w1", "windfall": "lump"})
        h = out["horizons"][0]
        self.assertEqual({r["id"] for r in h["rows"]}, {"w1", "w4", "q", "gate", "lump", "spread"})
        self.assertEqual(next(r for r in h["rows"] if r["id"] == "spread")["baseline"], "lump")  # windfalls compare with windfalls
        w4 = next(r for r in h["rows"] if r["id"] == "w4")
        self.assertIn("vs_baseline_irr_bps_median", w4)
        self.assertNotIn("vs_baseline_irr_bps_median", next(r for r in h["rows"] if r["id"] == "w1"))
        self.assertNotIn("breakeven_fee_pct_of_weekly", next(r for r in h["rows"] if r["id"] == "gate"))
        self.assertLessEqual(h["independent"], h["windows"])


class TrendFilterTest(unittest.TestCase):
    """The long-average filters and the keep-side filter used by the 'Five Leaders' registry rules."""

    @staticmethod
    def sma(c, n, i):
        return sum(c[i - n + 1:i + 1]) / n

    def test_trend_long_needs_price_above_a_rising_average(self):
        f, above = rules.FILTERS["trend_long"], rules.FILTERS["above_sma"]
        p = {"n": 200, "rising_days": 21}
        up = [100 + k for k in range(400)]
        self.assertTrue(f(up, None, 399, p))
        # A long decline, a flat spell, then a late bounce: price is above its average but the average is still falling.
        down = [300 - 0.67 * k for k in range(300)] + [100.0] * 60 + [150.0] * 5
        i = len(down) - 1
        self.assertGreater(down[i], self.sma(down, 200, i))                   # premise: above the average ...
        self.assertLess(self.sma(down, 200, i), self.sma(down, 200, i - 21))  # ... which is falling
        self.assertFalse(f(down, None, i, p))   # entry needs a rising line
        self.assertTrue(above(down, None, i, p))  # the keep-side test is only 'above'
        broke = up[:350] + [up[349] * 0.5] * 50
        self.assertFalse(above(broke, None, 399, p))
        self.assertFalse(f(broke, None, 399, p))

    def test_keep_side_filter_drops_a_held_leader_that_broke_its_average(self):
        import random
        M, names = synthetic_market(1500)
        s, i = names[0], 1450
        c = M["c"][s]
        for k in range(i - 260, i - 20):  # a strong year, so it still ranks first on 12-1 strength
            c[k] = c[i - 261] * (1.004 ** (k - (i - 261)))
        for k in range(i - 20, i + 1):    # then a collapse inside the month that 12-1 strength skips
            c[k] = c[i - 21] * 0.5
        self.assertLess(c[i], self.sma(c, 200, i))  # premise
        entry = [{"f": "trend_long", "n": 200, "rising_days": 21}]
        mk_cfg = lambda keep: {"slots": 5, "max_per_sector": 5, "selection": {"method": "filters", "rank": "rs_12_1", "filters": entry, "keep": keep}}  # noqa: E731
        plain = rules.pick_names(mk_cfg({"mode": "rank_top", "n": 10}), M, SETUP, i, [s], random.Random(0))
        guard = rules.pick_names(mk_cfg({"mode": "rank_top", "n": 10, "filters": [{"f": "above_sma", "n": 200}]}), M, SETUP, i, [s], random.Random(0))
        self.assertIn(s, plain)      # rank alone cannot see the collapse, and held names skip the entry filters
        self.assertNotIn(s, guard)   # the keep-side filter sells it at the review; the entry filter keeps it out


class VerdictCapTest(unittest.TestCase):
    def test_reference_baseline_cannot_pass_on_a_history_it_was_built_on(self):
        why = ["beat 100% of random draws"]
        self.assertEqual(routines_code.cap_verdict("reference_baseline", "passes_history", why)[0], "candidate")
        self.assertIn("capped", routines_code.cap_verdict("reference_baseline", "passes_history", why)[1][-1])
        self.assertEqual(routines_code.cap_verdict("testable_now", "passes_history", why), ("passes_history", why))
        self.assertEqual(routines_code.cap_verdict("reference_baseline", "inconclusive", why), ("inconclusive", why))


class FrozenVerdictTest(unittest.TestCase):
    RC = {"version": "1.0.0", "tries_counted": 17,
          "rules": [{"id": "r1", "status": "testable_now", "engine": {"kind": "satellite_select", "slots": 3}}],
          "acceptance": {"fill_lag_days": 1, "null_runs": 2000, "text": {"adopt": []}}}
    ST, WL = settings(), watchlist()

    def doc(self, as_of, verdict):
        return {"as_of": as_of, "sample": False,
                "satellite": {"rules": [{"id": "r1", "verdict": verdict, "percentile": 99.0, "p_adjusted": 0.01, "reasons": ["x"]}]},
                "savings": {"horizons": [{"weeks": 52, "rows": [{"id": "s1", "verdict": "better"}]}]}}

    def freeze(self, prev, doc, rc=None, st=None, wl=None):
        return routines_code.freeze_verdicts(prev, doc, rc or self.RC, 10, st or self.ST, wl or self.WL)

    def test_the_first_verdict_is_kept_when_later_data_flips_it(self):
        first = self.doc("2026-10-05", "inconclusive")
        first["frozen"] = self.freeze(None, first)
        later = self.doc("2026-11-03", "passes_history")  # a lucky day
        later["frozen"] = self.freeze(first, later)
        self.assertEqual(later["frozen"]["as_of"], "2026-10-05")
        self.assertEqual(later["frozen"]["satellite"]["r1"]["verdict"], "inconclusive")
        self.assertEqual(later["satellite"]["rules"][0]["verdict"], "passes_history")  # the display number still updates
        self.assertEqual(later["frozen"]["savings"]["52:s1"]["verdict"], "better")
        self.assertNotIn("superseded", later["frozen"])

    def test_a_change_that_decides_a_verdict_is_a_new_try_or_the_run_fails_closed(self):
        import copy
        first = self.doc("2026-10-05", "inconclusive")
        first["frozen"] = self.freeze(None, first)
        nxt = self.doc("2026-11-03", "passes_history")
        engine = {**self.RC, "rules": [{**self.RC["rules"][0], "engine": {"kind": "satellite_select", "slots": 4}}]}
        accept = {**self.RC, "acceptance": {**self.RC["acceptance"], "null_runs": 5000}}
        st2 = copy.deepcopy(self.ST)
        st2["setup"]["stretch_pct"] = self.ST["setup"].get("stretch_pct", 8) + 1  # a number rule v1 reads
        st3 = copy.deepcopy(self.ST)
        st3["portfolio"]["entry_min_checks"] = self.ST["portfolio"]["entry_min_checks"] - 1
        wl2 = copy.deepcopy(self.WL)
        wl2["symbols"][0]["sector"] = "Somewhere else"
        wl3 = copy.deepcopy(self.WL)
        wl3["symbols"] = wl3["symbols"][:-1]
        for label, kw in {"engine": {"rc": engine}, "acceptance": {"rc": accept}, "v1 setup": {"st": st2}, "v1 portfolio": {"st": st3},
                          "sector label": {"wl": wl2}, "watchlist": {"wl": wl3}}.items():
            with self.assertRaises(SystemExit, msg=label):  # same tries: not allowed
                self.freeze(first, nxt, **kw)
        bumped = {**engine, "tries_counted": 18}
        new = self.freeze(first, nxt, rc=bumped)
        self.assertEqual(new["satellite"]["r1"]["verdict"], "passes_history")
        self.assertEqual(new["tries_counted"], 18)
        self.assertEqual(new["superseded"][0]["as_of"], "2026-10-05")  # the earlier verdict is not lost
        self.assertEqual(new["superseded"][0]["satellite"]["r1"]["verdict"], "inconclusive")
        third = self.freeze({"frozen": new}, self.doc("2026-12-01", "rejected"), rc={**bumped, "tries_counted": 19, "acceptance": {**bumped["acceptance"], "null_runs": 6000}})
        self.assertEqual(len(third["superseded"]), 2)

    def test_prose_changes_are_not_a_new_pre_registration(self):
        first = self.doc("2026-10-05", "inconclusive")
        first["frozen"] = self.freeze(None, first)
        text_only = {**self.RC, "acceptance": {**self.RC["acceptance"], "text": {"adopt": ["reworded"]}}}
        self.assertEqual(self.freeze(first, self.doc("2026-11-03", "passes_history"), rc=text_only)["as_of"], "2026-10-05")


class GapGuardTest(unittest.TestCase):
    def test_one_missing_bar_is_reported_not_silently_absorbed(self):
        M, names = synthetic_market(1500)
        self.assertEqual(rules.gap_report(M), [])
        ds = dates(1500)
        raw = {"QQQ": bars(ds, walk(1500, 0.0005, 0.01, 1)), "SPY": bars(ds, walk(1500, 0.0004, 0.008, 2)),
               "SGOV": bars(ds, [100 * (1 + 0.00008) ** k for k in range(1500)])}
        sectors = {}
        for k in range(3):
            s = f"T{k}"
            raw[s] = bars(ds, walk(1500, 0.0003, 0.014, 10 + k))
            sectors[s] = f"S{k}"
        del raw["T1"][700]  # one missing day in the middle of its history
        M2 = rules.build_market(raw, ["T0", "T1", "T2"], "SPY", "QQQ", "SGOV", sectors)
        report = rules.gap_report(M2)
        self.assertEqual(len(report), 1)
        self.assertIn("T1", report[0])
        self.assertEqual(M2["first"]["T1"], 701)  # the clock restarted on the day after the gap
        self.assertEqual(M2["first"]["T0"], 0)


class V1LedgerIdentityTest(unittest.TestCase):
    def test_rule_v1_record_is_tied_to_the_settings_it_reads(self):
        import copy
        st = settings()
        cfg = {"slots": 5, "selection": {"method": "v1"}}
        base = routines_code._engine_hash(cfg, 10, 1, st)
        st2 = copy.deepcopy(st)
        st2["portfolio"]["entry_min_checks"] = st["portfolio"]["entry_min_checks"] - 1
        self.assertNotEqual(base, routines_code._engine_hash(cfg, 10, 1, st2))
        other = {"slots": 5, "selection": {"method": "filters", "rank": "rs_12_1", "filters": []}}
        self.assertEqual(routines_code._engine_hash(other, 10, 1, st), routines_code._engine_hash(other, 10, 1, st2))  # others do not read those settings


class SleeveTest(unittest.TestCase):
    def test_core_only_matches_the_core_after_one_entry_cost(self):
        M, _ = synthetic_market(1500)
        res = rules.run_sleeve({"slots": 5, "selection": {"method": "core"}}, M, SETUP, 300, lag=1, cost_bps=10)
        core = M["core"]
        self.assertAlmostEqual(res["values"][-1], 100 * 0.999 * core[-1] / core[301], places=6)

    def test_true_range_atr_is_wider_than_close_to_close(self):
        M, names = synthetic_market(1500)
        s, i = names[0], 900
        tr = rules._atr(M, s, i, 14)
        close_only = sum(abs(M["c"][s][k] - M["c"][s][k - 1]) for k in range(i - 13, i + 1)) / 14
        self.assertGreater(tr, close_only)  # the 1.2% wicks add range the closes do not show
        M2 = dict(M)
        M2["tr"] = {}
        self.assertAlmostEqual(rules._atr(M2, s, i, 14), close_only, places=9)  # falls back without high/low

    def test_atr_stop_moves_a_collapsing_name_to_the_core(self):
        M, names = synthetic_market(1500)
        s = names[0]
        n = M["n"]
        # Make T0 an excellent pick, then collapse it at day 900.
        M["c"][s] = [None if x is None else x for x in M["c"][s]]
        c = M["c"][s]
        for k in range(900, n):
            c[k] = c[899] * (0.97 ** (k - 899)) if k < 930 else c[929]
        cfg = {"slots": 1, "selection": {"method": "all"}, "exit": {"kind": "atr_trail", "k": 3, "n": 14}}
        # Only T0 eligible: restrict the universe by padding others out of history.
        for o in names[1:]:
            M["first"][o] = n
        res = rules.run_sleeve(cfg, M, SETUP, 300, lag=1)
        self.assertTrue(any(x["symbol"] == s for x in res["stops"]))
        self.assertGreater(res["values"][-1], 100 * (c[-1] / c[300]) * 0.0 + 1)  # sanity: finite, positive

    def test_period_simulation_equals_the_daily_engine(self):
        """The closed-form period simulator behind the null must equal run_sleeve exactly (no stops, equal weights)."""
        M, names = synthetic_market(1500, syms=8)
        rng = random.Random(5)
        for lag in (0, 1):
            for quarterly in (False, True):
                dec, fills = rules.decision_days(M, 300, lag, quarterly)
                picks = [rng.sample(names, rng.choice([0, 2, 3, 5])) for _ in dec]
                cfg = {"slots": 5, "rebalance": "quarterly" if quarterly else "monthly",
                       "selection": {"method": "scripted", "picks": {d: p for d, p in zip(dec, picks)}}}
                res = rules.run_sleeve(cfg, M, SETUP, 300, lag=lag, cost_bps=10)
                mid = 300 + (M["n"] - 300) // 2
                v_end, v_mid = rules.sim_periods(M, fills, picks, 5, 10, mid)
                self.assertAlmostEqual(v_end, res["values"][-1], places=9, msg=f"lag={lag} quarterly={quarterly}")
                self.assertAlmostEqual(v_mid, res["values"][mid - 300], places=9)

    def test_matched_null_is_reproducible_and_matches_exposure(self):
        M, names = synthetic_market(1500, syms=8)
        cfg = {"slots": 4, "max_per_sector": 2, "selection": {"method": "filters", "rank": "rs_6m", "keep": {"mode": "same_filters"},
                                                              "filters": [{"f": "trend50_200"}, {"f": "rs_6m"}]}}
        res = rules.run_sleeve(cfg, M, SETUP, 300, lag=1)
        a = rules.matched_null(M, SETUP, 300, res["rebalances"], cfg, 20, 7, 1, 10)
        b = rules.matched_null(M, SETUP, 300, res["rebalances"], cfg, 20, 7, 1, 10)
        self.assertEqual(a, b)
        self.assertAlmostEqual(a["avg_names"], sum(len(r["holdings"]) for r in res["rebalances"]) / len(res["rebalances"]), places=9)
        self.assertGreaterEqual(a["q"], 0.0)
        self.assertLessEqual(a["q"], 1.0)

    def test_rule_holding_no_names_has_a_degenerate_null_equal_to_itself(self):
        """Exposure is matched: a rule that never leaves the core has a null that never leaves the core either."""
        M, _ = synthetic_market(1500, syms=6)
        cfg = {"slots": 5, "selection": {"method": "core"}}
        res = rules.run_sleeve(cfg, M, SETUP, 300, lag=1)
        nul = rules.matched_null(M, SETUP, 300, res["rebalances"], cfg, 10, 1, 1, 10)
        self.assertEqual(len({round(x[0], 9) for x in nul["runs"]}), 1)
        self.assertAlmostEqual(nul["runs"][0][0], rules.cagr(res["values"]), places=6)

    def test_rule_that_picks_randomly_is_not_flagged_as_skilled(self):
        """Calibration: a rule that is itself a random picker with the null's own stickiness should land mid-distribution
        far more often than in the extreme tails."""
        M, _ = synthetic_market(1500, syms=10)
        tails = 0
        trials = 12
        for seed in range(trials):
            cfg = {"slots": 4, "max_per_sector": 2, "selection": {"method": "random"}}
            res = rules.run_sleeve(cfg, M, SETUP, 300, lag=1, seed=100 + seed)
            nul = rules.matched_null(M, SETUP, 300, res["rebalances"], cfg, 80, 9, 1, 10)
            pct = rules.percentile_of(rules.cagr(res["values"]), [x[0] for x in nul["runs"]])
            tails += pct > 95 or pct < 5
        self.assertLessEqual(tails, 3)

    def test_percentile_and_quantile(self):
        self.assertEqual(rules.percentile_of(5, [1, 2, 3, 4]), 100.0)
        self.assertEqual(rules.percentile_of(0, [1, 2, 3, 4]), 0.0)
        self.assertEqual(rules.quantile([1, 2, 3, 4, 5], 0.5), 3)

    def test_late_listing_joins_only_after_a_year(self):
        M, names = synthetic_market(1500)
        late = names[0]
        pad = 700
        M["c"][late] = [None] * pad + M["c"][late][pad:]
        M["first"][late] = pad
        self.assertNotIn(late, rules.eligible(M, pad + 100))
        self.assertIn(late, rules.eligible(M, pad + rules.WARM))
        res = rules.run_sleeve({"slots": 6, "selection": {"method": "all"}}, M, SETUP, 300, lag=1)
        self.assertTrue(all(late not in r["holdings"] for r in res["rebalances"] if r["date"] < M["dates"][pad + rules.WARM]))


class LedgerTest(unittest.TestCase):
    RC = {"acceptance": {"fill_lag_days": 1, "null_runs": 30, "null_seed": 5},
          "rules": [
              {"id": "v1", "status": "reference_baseline", "engine": {"kind": "satellite_select", "slots": 3, "selection": {"method": "v1"}}},
              {"id": "mom", "status": "testable_now", "engine": {"kind": "satellite_select", "slots": 3, "max_per_sector": 2, "selection": {
                  "method": "filters", "rank": "rs_6m", "filters": [{"f": "rs_6m"}], "keep": {"mode": "none"}}}},
              {"id": "needs", "status": "needs_data", "engine": None},
              {"id": "dca", "status": "testable_now", "engine": {"kind": "savings_contribute", "every_weeks": 4}},
          ]}

    def test_records_once_per_month_never_edits_and_validates(self):
        from _common import Validator
        M, _ = synthetic_market(1500, syms=8)
        st = dict(SETUP)
        st["portfolio"] = {**SETUP["portfolio"], "slots": 3}
        prev = None
        first_seen = {}
        for n in range(1000, 1130, 3):  # a run every 3 trading days, months roll over
            T = truncate(M, n)
            prev = routines_code.update_ledger(prev, T, st, self.RC, sample=True)
            for rid, row in prev["rules"].items():
                for x in row["rebalances"]:
                    self.assertEqual(first_seen.setdefault((rid, x["date"]), x["holdings"]), x["holdings"], "a recorded decision changed")
        self.assertEqual(set(prev["rules"]), {"v1", "mom"})  # only testable satellite rules
        for row in prev["rules"].values():
            months = [x["date"][:7] for x in row["rebalances"]]
            self.assertEqual(len(months), len(set(months)), "more than one decision in a month")
            self.assertEqual(len(row["values"]), len(M["dates"][:1129]) - M["dates"][:1129].index(row["started"]))
        self.assertEqual(Validator().validate(prev, "paper_rules.schema.json"), [])

    def test_later_data_does_not_rewrite_the_past(self):
        M, _ = synthetic_market(1500, syms=8)
        st = dict(SETUP)
        st["portfolio"] = {**SETUP["portfolio"], "slots": 3}
        prev = None
        for n in range(1000, 1100, 5):
            prev = routines_code.update_ledger(prev, truncate(M, n), st, self.RC, sample=True)
        recorded = {k: [dict(x) for x in v["rebalances"]] for k, v in prev["rules"].items()}
        after = routines_code.update_ledger(prev, perturb_after(truncate(M, 1100), 1099), st, self.RC, sample=True)
        for k, rebs in recorded.items():
            self.assertEqual(after["rules"][k]["rebalances"][: len(rebs)], rebs)


class ReviewFixesTest(unittest.TestCase):
    """One test per confirmed finding of the adversarial engine review."""

    def test_correlation_cap_cannot_leak_the_future(self):
        M, _ = synthetic_market(1500, syms=8)
        cfg = {"slots": 4, "max_pair_corr": 0.3, "selection": {"method": "filters", "rank": "rs_6m", "filters": [{"f": "rs_6m"}]}}
        rules.run_sleeve(cfg, M, SETUP, 260, lag=1)  # fills M's cache
        self.assertNotIn("_corr", perturb_after(M, 900))

    def test_savings_decisions_inside_the_window_ignore_later_data(self):
        M, _ = synthetic_market(1500)
        start, h = 300, 104
        cut = start + 40 * rules.WEEK
        for gate in (False, True):
            a, b = [], []
            rules.run_savings(M, start, h, 4, gate=gate, trace=a)
            rules.run_savings(perturb_after(M, cut), start, h, 4, gate=gate, trace=b)
            self.assertEqual(a[: cut - start + 1], b[: cut - start + 1])

    def test_scripted_replay_decides_on_recorded_days_not_month_starts(self):
        M, names = synthetic_market(1500, syms=6)
        day = next(k for k in range(400, 600) if M["dates"][k][:7] == M["dates"][k - 2][:7] != M["dates"][k - 3][:7])  # 3rd trading day
        cfg = {"slots": 3, "selection": {"method": "scripted", "picks": {day: names[:2]}}}
        res = rules.run_sleeve(cfg, M, SETUP, day, lag=1)
        self.assertEqual(res["rebalances"][0]["holdings"], names[:2])

    def test_stop_exits_count_as_trading(self):
        M, _ = synthetic_market(1500, syms=6)
        cfg = {"slots": 4, "exit": {"kind": "atr_trail", "k": 0.5, "n": 14},
               "selection": {"method": "filters", "rank": "rs_6m", "filters": [{"f": "rs_6m"}]}}
        res = rules.run_sleeve(cfg, M, SETUP, 300, lag=1)
        self.assertTrue(res["stops"])
        years = (len(res["values"]) - 1) / rules.Y
        self.assertGreater(rules.turnover_per_year(res["rebalances"], years, res["stops"]), rules.turnover_per_year(res["rebalances"], years))

    def test_null_replays_the_rules_own_exits(self):
        """A random picker with a stop is not called skilled against a null that also stops out."""
        M, _ = synthetic_market(1500, syms=10)
        tails = 0
        for seed in range(8):
            cfg = {"slots": 4, "exit": {"kind": "atr_trail", "k": 2, "n": 14}, "sizing": "inverse_vol", "selection": {"method": "random"}}
            res = rules.run_sleeve(cfg, M, SETUP, 300, lag=1, seed=200 + seed)
            nul = rules.matched_null(M, SETUP, 300, res["rebalances"], cfg, 30, 11, 1, 10)
            pct = rules.percentile_of(rules.cagr(res["values"]), [x[0] for x in nul["runs"]])
            tails += pct > 95 or pct < 5
        self.assertLessEqual(tails, 2)

    def test_every_name_control_is_never_levered(self):
        M, _ = synthetic_market(1500, syms=8)
        w = rules.target_weights({"slots": 3, "selection": {"method": "all"}}, M, rules.eligible(M, 800), 800)
        self.assertAlmostEqual(sum(w.values()), 1.0)
        self.assertNotIn(rules.CORE, w)

    def test_core_with_a_missing_day_still_builds(self):
        ds = dates(900)
        raw = {"QQQ": bars(ds, walk(900, 0.0005, 0.01, 1)), "SPY": bars(ds[:400] + ds[401:], walk(899, 0.0004, 0.008, 2)),
               "T0": bars(ds, walk(900, 0.0004, 0.01, 3))}
        M = rules.build_market(raw, ["T0"], "SPY", "QQQ", None, {"T0": "X"})
        self.assertIsNotNone(M)
        self.assertEqual(M["n"], 899)

    def test_verdict_needs_reachable_significance(self):
        acc = {"null_percentile_min": 95, "halves_percentile_min": 50, "reject_below_percentile": 50,
               "max_dd_worse_than_core_pts": 10, "max_turnover_pct_year": 300}
        row = {"percentile": 100.0, "percentile_halves": [99.0, 99.0], "p_value": 1 / 101, "p_adjusted": 20 / 101,
               "max_dd_vs_core_pts": 0.0, "turnover_pct_year": 50.0}
        self.assertNotEqual(routines_code.judge_satellite(row, acc, 20, 100)[0], "passes_history")  # 100 runs cannot reach 0.05/20
        row |= {"p_value": 1 / 1001, "p_adjusted": 20 / 1001}
        self.assertEqual(routines_code.judge_satellite(row, acc, 20, 1000)[0], "passes_history")


class LedgerRobustnessTest(unittest.TestCase):
    def setUp(self):
        self.M, _ = synthetic_market(1500, syms=8)
        self.st = dict(SETUP)
        self.st["portfolio"] = {**SETUP["portfolio"], "slots": 3}
        self.rc = {"acceptance": {"fill_lag_days": 1, "null_runs": 20, "null_seed": 5},
                   "rules": [{"id": "mom", "status": "testable_now", "engine": {"kind": "satellite_select", "slots": 3, "selection": {
                       "method": "filters", "rank": "rs_6m", "filters": [{"f": "rs_6m"}], "keep": {"mode": "none"}}}}]}

    def run_months(self, rc, upto=1100, prev=None):
        for n in range(1000, upto, 5):
            prev = routines_code.update_ledger(prev, truncate(self.M, n), self.st, rc, sample=True)
        return prev

    def test_changed_rule_settings_freeze_the_old_record(self):
        prev = self.run_months(self.rc)
        changed = {**self.rc, "rules": [{**self.rc["rules"][0], "engine": {**self.rc["rules"][0]["engine"], "slots": 2}}]}
        after = routines_code.update_ledger(prev, truncate(self.M, 1110), self.st, changed, sample=True)
        frozen = [k for k in after["retired"] if k.startswith("mom@")]
        self.assertEqual(len(frozen), 1)
        self.assertEqual(after["retired"][frozen[0]]["values"], prev["rules"]["mom"]["values"])  # not recomputed
        self.assertEqual(after["rules"]["mom"]["decisions"], 1)  # a fresh record

    def test_removed_rule_keeps_its_record(self):
        prev = self.run_months(self.rc)
        after = routines_code.update_ledger(prev, truncate(self.M, 1110), self.st, {**self.rc, "rules": []}, sample=True)
        self.assertNotIn("mom", after["rules"])
        self.assertTrue(any(k.startswith("mom@") for k in after["retired"]))

    def test_missing_name_keeps_the_last_good_track(self):
        prev = self.run_months(self.rc)
        held = {s for x in prev["rules"]["mom"]["rebalances"] for s in x["holdings"]}
        self.assertTrue(held)
        M2 = truncate(self.M, 1110)
        M2["c"] = {s: c for s, c in M2["c"].items() if s not in held}
        after = routines_code.update_ledger(prev, M2, self.st, self.rc, sample=True)
        self.assertTrue(after["rules"]["mom"]["stale"])
        self.assertEqual(after["rules"]["mom"]["values"], prev["rules"]["mom"]["values"])


if __name__ == "__main__":
    unittest.main()
