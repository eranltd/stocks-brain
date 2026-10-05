import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import market as mk  # noqa: E402
import portfolio as pf  # noqa: E402
import routines_code  # noqa: E402
from _common import SAMPLES, Validator, settings, watchlist  # noqa: E402

SETUP = {"stretch_pct": 8, "rs_short_days": 60, "rs_long_days": 120, "trend_long_days": 200, "veto_stretched": True}
RULE = {"slots": 5, "target_min_names": 4, "entry_min_checks": 3, "keep_min_checks": 2, "max_per_sector": 2,
        "max_pair_corr": 0.85, "corr_days": 252, "cost_bps": 10, "weekly_step_days": 5}


def grow(n, daily, start=100.0, wiggle=0.0, phase=0.0):
    """Smooth trend with a small deterministic wiggle (keeps correlations defined)."""
    return [start * (1 + daily) ** k * (1 + wiggle * math.sin(k / 3 + phase)) for k in range(n)]


def dates(n):
    out, y, m, d = [], 2016, 1, 1
    while len(out) < n:
        out.append(f"{y:04d}-{m:02d}-{d:02d}")
        d += 1
        if d > 20:
            d, m = 1, m + 1
        if m > 12:
            m, y = 1, y + 1
    return out


class MarketTest(unittest.TestCase):
    def test_align_tail_keeps_late_listings(self):
        ds = ["2026-01-01", "2026-01-02", "2026-01-05"]
        series = {"OLD": [{"date": d, "close": 1.0} for d in ds], "NEW": [{"date": d, "close": 2.0} for d in ds[1:]],
                  "GONE": [{"date": ds[0], "close": 3.0}]}
        out = mk.align_tail(series, ds)
        self.assertEqual(len(out["OLD"]), 3)
        self.assertEqual(len(out["NEW"]), 2)
        self.assertNotIn("GONE", out)

    def test_setup_state_trend_and_stretch(self):
        b = grow(400, 0.0003, wiggle=0.002)
        c = grow(400, 0.001, wiggle=0.002, phase=1)
        st = mk.setup_state(c, b, SETUP)
        self.assertTrue(st["checks"]["trend"] and st["checks"]["rs_3m"] and st["checks"]["rs_6m"])
        self.assertFalse(st["stretched"])
        jumped = c[:-1] + [c[-1] * 1.15]
        self.assertTrue(mk.setup_state(jumped, b, SETUP)["stretched"])

    def test_participation_states(self):
        cap = grow(100, 0.002)
        self.assertEqual(mk.participation(cap, grow(100, 0.0))["state"], "narrow")
        self.assertEqual(mk.participation(cap, grow(100, 0.004))["state"], "broad")

    def test_trend_filter(self):
        up, cash = grow(400, 0.001), grow(400, 0.0001)
        self.assertTrue(mk.trend_filter(up, cash)["on"])
        self.assertFalse(mk.trend_filter(grow(400, -0.001), cash)["on"])

    def test_base_rates_shape(self):
        n = 700
        closes = {"B": grow(n, 0.0004, wiggle=0.01), "X": grow(n, 0.0008, wiggle=0.01, phase=2), "Y": grow(n, 0.0, wiggle=0.01, phase=4)}
        r = mk.base_rates(closes, "B", dates(n), SETUP, {"horizon_days": 20, "step_days": 20, "min_history_days": 250})
        self.assertEqual(r["names"], 2)
        self.assertEqual(r["all"]["n"], sum(row["n"] for row in r["by_score"]))
        self.assertEqual(r["all"]["n"], r["gate"]["pass"]["n"] + r["gate"]["fail"]["n"])


class PortfolioTest(unittest.TestCase):
    def test_long_stats_goal(self):
        c = [100 * 1.25 ** (k / 252) for k in range(252 * 3 + 1)]  # exactly +25%/yr
        s = pf.long_stats(c, 20)
        self.assertAlmostEqual(s["cagr_pct"], 25.0, places=1)
        self.assertEqual(s["hit_goal_12m_pct"], 100.0)
        self.assertEqual(s["loss_12m_pct"], 0.0)
        self.assertEqual(pf.goal_math(20)["years_to_double"], 3.8)

    def test_select_sector_cap_and_stretch_rules(self):
        n = 400
        b = grow(n, 0.0002, wiggle=0.003)
        members = {f"T{k}": grow(n, 0.0008 + k * 0.0001, wiggle=0.003, phase=k) for k in range(4)}
        sectors = {s: "Information Technology" for s in members}
        picked, status, _ = pf.select(members, b, sectors, n - 1, SETUP, {**RULE, "max_pair_corr": 1.0}, [])
        self.assertEqual(len(picked), 2)  # max 2 per sector
        self.assertEqual(sorted(status.values()).count("sector_cap"), 2)
        # A stretched name cannot enter, but a held stretched name is kept.
        hot = members["T0"][:-1] + [members["T0"][-1] * 1.2]
        m2 = {"HOT": hot}
        self.assertEqual(pf.select(m2, b, {"HOT": "Energy"}, n - 1, SETUP, RULE, [])[1]["HOT"], "stretched")
        self.assertEqual(pf.select(m2, b, {"HOT": "Energy"}, n - 1, SETUP, RULE, ["HOT"])[0], ["HOT"])

    def test_simulate_all_core_matches_core_minus_cost(self):
        n = 300
        core = grow(n, 0.0005)
        ds = dates(n)
        vals, rebs = pf.simulate({}, core, ds, 10, lambda k, held: [], 5, 10)
        self.assertAlmostEqual(vals[-1], 100 * (1 - 0.001) * core[-1] / core[10], places=6)  # one entry cost, no trades after
        self.assertTrue(all(r["core_pct"] == 100.0 for r in rebs))

    def test_compute_longrun_on_samples_is_valid(self):
        st, wl = settings(), watchlist()
        doc = routines_code.compute_longrun(SAMPLES / "prices", st, wl, sample=True, provider="sample")
        self.assertEqual(Validator().validate(doc, "longrun.schema.json"), [])
        self.assertLessEqual(len(doc["now"]["holdings"]), st["portfolio"]["slots"])
        self.assertEqual(len(doc["weekly"]["dates"]), len(doc["weekly"]["rule"]))
        for h in doc["now"]["holdings"]:
            self.assertIn(h, {s["symbol"] for s in wl["symbols"]})

    def test_paper_is_forward_only(self):
        st, wl = settings(), watchlist()
        m, cc, bc, ds, sec, *_ = routines_code._portfolio_inputs(SAMPLES / "prices", st, wl)
        cut = len(ds) - 40
        p = routines_code.update_paper(None, {k: v[:cut] for k, v in m.items()}, cc[:cut], bc[:cut], ds[:cut], sec, st, True)
        first = p["rebalances"][0]
        # Same month again: no new rebalance.
        same = routines_code.update_paper(p, {k: v[:cut + 1] for k, v in m.items()}, cc[:cut + 1], bc[:cut + 1], ds[:cut + 1], sec, st, True)
        if ds[cut][:7] == ds[cut - 1][:7]:
            self.assertEqual(len(same["rebalances"]), 1)
        # Later runs never rewrite a recorded rebalance, even with different data after it.
        later = routines_code.update_paper(p, m, cc, bc, ds, sec, st, True)
        self.assertEqual(later["rebalances"][0], first)
        self.assertEqual(Validator().validate(later, "paper.schema.json"), [])
        div = later["diversification"]  # risk of what the record holds now, not of the history test's path
        self.assertEqual(div["names"], len(later["rebalances"][-1]["holdings"]))
        self.assertEqual(div["core_pct"], later["rebalances"][-1]["core_pct"])
        self.assertLessEqual(len(later["if_rebalanced_today"]), st["portfolio"]["slots"])
        self.assertEqual(later["track"][0]["v"], round(100 * (1 - st["portfolio"]["cost_bps"] / 1e4), 3))


class SignedExcessTest(unittest.TestCase):
    def test_signs(self):
        self.assertEqual(routines_code.signed_excess({"stance": "bullish", "excess_pct": 2.0}), 2.0)
        self.assertEqual(routines_code.signed_excess({"stance": "bearish", "excess_pct": 2.0}), -2.0)
        self.assertEqual(routines_code.signed_excess({"stance": "neutral", "excess_pct": -3.0}), -3.0)


if __name__ == "__main__":
    unittest.main()
