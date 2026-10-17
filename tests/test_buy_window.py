"""'When could we buy it?' (scripts/buy_window.py, routines_code.compute_buy_window, us_market_calendar.py).

Made-up tickers only (AAA, BBB, ...). The card must call the rule's own engine, never re-implement it: the names it says
the rule would hold are checked against rules.pick_names and against what the forward ledger records on review days."""
import copy
import random
import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import buy_window as bw  # noqa: E402
import routines_code  # noqa: E402
import rules  # noqa: E402
import us_market_calendar as cal  # noqa: E402
from _common import CONFIG, Validator, load_json, settings  # noqa: E402

ST = settings()
RC = load_json(CONFIG / "rules.json")
FIVE = next(r for r in RC["rules"] if r["id"] == "five_leaders")
CFG = {k: v for k, v in FIVE["engine"].items() if k != "kind"}
# The five_leaders record in the published ledger (data/portfolio/paper_rules.json, 2026-10-14) carries this hash. If it
# changes, the ledger freezes the rule's record and starts a new one: the card must never cause that.
LEDGER_HASH = "5e8536cf438bfae1"


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


def bars(ds, closes):
    return [{"date": d, "close": c, "high": c * 1.01, "low": c * 0.99} for d, c in zip(ds, closes)]


def expo(n, drift, start=100.0):
    return [start * (1 + drift) ** k for k in range(n)]


def scenario(n=600):
    """Hand-made names, each built to show one reason (sectors in brackets):
    AAA strongest steady rise (Tech) -> held; BBB second, same sector -> sector_taken; CCC spiked in the last two weeks
    (Health) -> stretched; DDD falling (Energy) -> below and falling 200-day; EEE..III gentle rises in five more sectors ->
    four slots left for five of them, so the weakest (III) gets no_slot; JJJ listed 200 days ago -> not_eligible;
    KKK (Discretionary) a held name that ranks too low to keep its place."""
    ds = dates(n)
    spec = {"AAA": ("Tech", 0.0020), "BBB": ("Tech", 0.0015), "CCC": ("Health", 0.0010), "DDD": ("Energy", -0.0010),
            "EEE": ("Fin", 0.0007), "FFF": ("Ind", 0.0006), "GGG": ("Util", 0.0005), "HHH": ("Mat", 0.0004),
            "III": ("Staples", 0.0003), "KKK": ("Disc", 0.0001)}
    raw = {"XBM": bars(ds, expo(n, 0.0003)), "XCR": bars(ds, expo(n, 0.0003))}
    sectors = {}
    for s, (sec, d) in spec.items():
        c = expo(n, d)
        if s == "CCC":
            for k in range(n - 10, n):
                c[k] = c[k - 1] * 1.015
        raw[s] = bars(ds, c)
        sectors[s] = sec
    raw["JJJ"] = bars(ds[-200:], expo(200, 0.002))
    sectors["JJJ"] = "Comm"
    names = [*spec, "JJJ"]
    return rules.build_market(raw, names, "XCR", "XBM", None, sectors), names, sectors


def walk_market(n=1300, syms=12, seed=3):
    ds = dates(n)
    r = random.Random(seed)

    def w(drift, vol):
        out = [100.0]
        for _ in range(n - 1):
            out.append(out[-1] * (1 + drift + r.gauss(0, vol)))
        return out
    raw = {"XBM": bars(ds, w(0.0004, 0.01)), "XCR": bars(ds, w(0.0004, 0.008))}
    names = [f"Q{chr(65 + k)}{chr(65 + k)}" for k in range(syms)]
    sectors = {s: f"S{k % 5}" for k, s in enumerate(names)}
    for k, s in enumerate(names):
        raw[s] = bars(ds, w(0.0002 + 0.0001 * k, 0.016))
    return rules.build_market(raw, names, "XCR", "XBM", None, sectors), names, sectors


def truncate(M, n2):
    T = dict(M)
    T["n"] = n2
    T["dates"] = M["dates"][:n2]
    T["c"] = {s: c[:n2] for s, c in M["c"].items()}
    T["core"], T["bench"], T["cash"], T["core_on"] = M["core"][:n2], M["bench"][:n2], M["cash"][:n2], M["core_on"][:n2]
    T["tr"] = {s: row[:n2] for s, row in M["tr"].items()}
    T.pop("_corr", None)
    return T


class CalendarTest(unittest.TestCase):
    def test_published_exchange_holidays(self):
        self.assertEqual(sorted(d.isoformat() for d in cal.holidays(2025)), [
            "2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26", "2025-06-19", "2025-07-04",
            "2025-09-01", "2025-11-27", "2025-12-25"])
        self.assertEqual(sorted(d.isoformat() for d in cal.holidays(2026)), [
            "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03",
            "2026-09-07", "2026-11-26", "2026-12-25"])
        h27 = cal.holidays(2027)
        self.assertIn(date(2027, 6, 18), h27)   # Juneteenth on a Saturday: the Friday before
        self.assertIn(date(2027, 12, 24), h27)  # Christmas on a Saturday: the Friday before
        self.assertIn(date(2027, 7, 5), h27)    # Independence Day on a Sunday: the Monday after

    def test_new_years_day_weekend_rules(self):
        self.assertIn(date(2023, 1, 2), cal.holidays(2023))       # a Sunday New Year's Day moves to Monday
        self.assertFalse(any(d.month == 1 and d.day <= 3 for d in cal.holidays(2022)))  # a Saturday one is not observed
        self.assertNotIn(date(2021, 12, 31), cal.holidays(2021))  # ... and not on the Friday before
        self.assertTrue(cal.is_trading_day(date(2021, 12, 31)))
        self.assertNotIn(date(2021, 6, 18), cal.holidays(2021))   # Juneteenth only from 2022

    def test_easter_and_good_friday(self):
        self.assertEqual(cal.easter(2024), date(2024, 3, 31))
        self.assertEqual(cal.easter(2026), date(2026, 4, 5))
        self.assertEqual(cal.easter(2005), date(2005, 3, 27))
        self.assertEqual(cal.easter(2038), date(2038, 4, 25))

    def test_first_trading_day_skips_weekends_and_holidays(self):
        self.assertEqual(cal.first_trading_day(2026, 11), date(2026, 11, 2))  # 1 November 2026 is a Sunday
        self.assertEqual(cal.first_trading_day(2027, 1), date(2027, 1, 4))   # Friday holiday, then the weekend
        self.assertEqual(cal.first_trading_day(2025, 9), date(2025, 9, 2))   # Labor Day on the 1st
        self.assertEqual(cal.first_trading_day(2010, 4), date(2010, 4, 1))
        self.assertEqual(cal.first_trading_day(2021, 4), date(2021, 4, 1))   # Good Friday was the 2nd

    def test_next_review(self):
        self.assertEqual(cal.next_review("2026-10-15"), "2026-11-02")
        self.assertEqual(cal.next_review("2026-10-15", quarterly=True), "2027-01-04")
        self.assertEqual(cal.next_review("2026-10-01"), "2026-11-02")  # on a review day, the next one
        self.assertEqual(cal.next_review("2026-12-31"), "2027-01-04")
        self.assertEqual(cal.next_review("2027-01-04", quarterly=True), "2027-04-01")
        self.assertEqual(cal.next_review("2026-08-20"), "2026-09-01")


class ExplainTest(unittest.TestCase):
    def setUp(self):
        self.M, self.names, self.sectors = scenario()
        self.i = self.M["n"] - 1

    def test_each_reason_is_named(self):
        cfg = copy.deepcopy(CFG)
        cfg["selection"]["keep"]["n"] = 3  # small list: a held name can fall out of the top n
        ex = bw.explain(cfg, self.M, ST, self.i, ["AAA", "KKK"])
        n = ex["names"]
        self.assertEqual(ex["would_hold"], rules.pick_names(cfg, self.M, ST, self.i, ["AAA", "KKK"], random.Random(0)))
        self.assertEqual(set(ex["would_hold"]), {"AAA", "EEE", "FFF", "GGG", "HHH"})
        self.assertEqual(n["AAA"]["blockers"], [])
        self.assertEqual(n["AAA"]["rank"], 1)
        self.assertEqual(n["BBB"]["blockers"], ["sector_taken"])
        self.assertEqual(n["BBB"]["sector_leader"], "AAA")
        self.assertEqual(n["CCC"]["blockers"], ["stretched"])
        self.assertTrue(n["CCC"]["stretched"])
        self.assertGreater(n["CCC"]["dist_sma50_pct"], 8)
        self.assertEqual(n["DDD"]["blockers"], ["below_200", "falling_200"])
        self.assertIs(n["DDD"]["above_200"], False)
        self.assertIs(n["DDD"]["rising_200"], False)
        self.assertEqual(n["III"]["blockers"], ["no_slot"])
        self.assertEqual(n["JJJ"]["blockers"], ["not_eligible"])
        self.assertIsNone(n["JJJ"]["rank"])
        self.assertEqual(n["KKK"]["blockers"], ["rank_too_low", "no_slot"])
        self.assertEqual(n["AAA"]["of"], 10)

    def test_distance_is_the_engines_own(self):
        ex = bw.explain(CFG, self.M, ST, self.i, [])
        for s, r in ex["names"].items():
            if r["dist_sma50_pct"] is not None:
                self.assertAlmostEqual(r["dist_sma50_pct"], rules._dist50(self.M["c"][s], self.i), places=2)
                self.assertEqual(r["stretched"], not rules._dist50(self.M["c"][s], self.i) < CFG["selection"]["filters"][1]["pct"])

    def test_a_held_name_that_broke_its_line_says_so(self):
        M = self.M
        c = M["c"]["AAA"]
        for k in range(self.i - 15, self.i + 1):  # a collapse inside the month the past-year rise skips
            c[k] = c[self.i - 16] * 0.5
        ex = bw.explain(CFG, M, ST, self.i, ["AAA"])
        self.assertNotIn("AAA", ex["would_hold"])
        self.assertIn("below_200", ex["names"]["AAA"]["blockers"])
        self.assertEqual(ex["names"]["AAA"]["rank"], 1)  # still first by rank: the line, not the rank, sends it out

    def test_engine_and_card_never_disagree(self):
        M, names, _ = walk_market()
        held: list[str] = []
        for i in range(400, M["n"], 7):
            ex = bw.explain(CFG, M, ST, i, held)
            self.assertEqual(ex["would_hold"], rules.pick_names(CFG, M, ST, i, held, random.Random(0)))
            for s, r in ex["names"].items():
                self.assertEqual(r["blockers"] == [], s in ex["would_hold"])
                self.assertTrue(set(r["blockers"]) <= set(bw.BLOCKERS))
            held = ex["would_hold"]

    def test_unsupported_rule_is_refused(self):
        with self.assertRaises(ValueError):
            bw.explain({"slots": 5, "selection": {"method": "v1"}}, self.M, ST, self.i, [])
        breakout = copy.deepcopy(CFG)
        breakout["selection"]["filters"].append({"f": "breakout", "n": 126})
        with self.assertRaises(ValueError):
            bw.explain(breakout, self.M, ST, self.i, [])


class LedgerAgreementTest(unittest.TestCase):
    """The card equals the ledger's own decision on review days, and does not change the ledger."""

    def setUp(self):
        self.M, self.names, self.sectors = walk_market()
        self.rc = {"acceptance": RC["acceptance"], "rules": [FIVE]}

    def test_would_hold_equals_the_ledger_decision(self):
        prev = None
        checked = 0
        for n in range(900, 1100, 4):
            T = truncate(self.M, n)
            prev = routines_code.update_ledger(prev, T, ST, self.rc, sample=True)
            row = prev["rules"]["five_leaders"]
            doc = bw.build(CFG, T, ST, row, self.names, self.sectors, "five_leaders", "Five Leaders", sample=True)
            last = row["rebalances"][-1]
            self.assertEqual(doc["held_now"], last["holdings"])
            if last["date"] == T["dates"][-1]:  # a review day: the card shows exactly what the ledger recorded
                self.assertEqual(doc["would_hold_if_today"], last["holdings"])
                checked += 1
            else:
                self.assertEqual(doc["would_hold_if_today"],
                                 rules.pick_names(CFG, T, ST, n - 1, last["holdings"], random.Random(0)))
        self.assertGreater(checked, 3)

    def test_the_card_does_not_change_the_ledger(self):
        def run(with_card):
            prev = None
            for n in range(900, 1060, 5):
                T = truncate(self.M, n)
                prev = routines_code.update_ledger(prev, T, ST, self.rc, sample=True)
                if with_card:
                    row = copy.deepcopy(prev["rules"]["five_leaders"])
                    bw.build(CFG, T, ST, row, self.names, self.sectors, "five_leaders", "Five Leaders", sample=True)
                    self.assertEqual(row, prev["rules"]["five_leaders"])
            return prev
        self.assertEqual(run(False), run(True))

    def test_engine_hash_is_unchanged(self):
        h = routines_code._engine_hash(CFG, ST["portfolio"]["cost_bps"], RC["acceptance"]["fill_lag_days"], ST)
        self.assertEqual(h, LEDGER_HASH)

    def test_review_day_uses_the_holdings_before_it(self):
        row = {"rebalances": [{"date": "2026-09-01", "holdings": ["AAA", "BBB"]}, {"date": "2026-10-01", "holdings": ["CCC"]}]}
        self.assertEqual(bw.held_for_decision(row, "2026-10-01"), (["CCC"], ["AAA", "BBB"]))
        self.assertEqual(bw.held_for_decision(row, "2026-10-02"), (["CCC"], ["CCC"]))
        self.assertEqual(bw.held_for_decision(None, "2026-10-02"), ([], []))
        self.assertEqual(bw.held_for_decision({"rebalances": [{"date": "2026-10-01", "holdings": ["CCC"]}]}, "2026-10-01"), (["CCC"], []))


class DocumentTest(unittest.TestCase):
    def setUp(self):
        M, names, sectors = scenario()
        self.on_list = set(names)
        row = {"rebalances": [{"date": M["dates"][-30], "holdings": ["AAA", "KKK"]}]}
        self.doc = bw.build(CFG, M, ST, row, names, sectors, "five_leaders", "Five Leaders", sample=False)

    def test_valid_derived_only_and_consistent(self):
        self.assertEqual(Validator().validate(self.doc, "buy_window.schema.json"), [])
        self.assertEqual(bw.problems(self.doc, self.on_list), [])
        self.assertEqual(self.doc["held_now"], ["AAA", "KKK"])
        self.assertTrue(self.doc["names"]["KKK"]["held_now"])
        for r in self.doc["names"].values():
            self.assertFalse({"close", "price", "volume", "high", "low", "open"} & set(r))

    def test_problems_catch_tampering(self):
        bad = copy.deepcopy(self.doc)
        bad["names"]["BBB"]["blockers"] = []
        self.assertTrue(bw.problems(bad, self.on_list))
        bad = copy.deepcopy(self.doc)
        bad["next_review"] = bad["as_of"]
        self.assertTrue(bw.problems(bad, self.on_list))
        self.assertTrue(bw.problems(self.doc, self.on_list - {"AAA"}))

    def test_schema_refuses_a_price(self):
        bad = copy.deepcopy(self.doc)
        bad["names"]["AAA"]["dist_sma50_pct"] = 4123.5  # a raw price must never pass for a percent
        self.assertTrue(Validator().validate(bad, "buy_window.schema.json"))
        bad = copy.deepcopy(self.doc)
        bad["names"]["AAA"]["close"] = 101.2
        self.assertTrue(Validator().validate(bad, "buy_window.schema.json"))

    def test_lint_refuses_a_sample_in_data_and_warns_on_a_stale_name(self):
        from lint import Lint
        lt = Lint()
        lt.check_buy_window_data(Path("data/market/buy_window.json"), {**self.doc, "sample": True}, on_list=self.on_list,
                                 as_of=self.doc["as_of"])
        self.assertTrue(any("live data only" in e for e in lt.errors))
        lt = Lint()
        lt.check_buy_window_data(Path("data/market/buy_window.json"), self.doc, on_list=self.on_list - {"JJJ"}, as_of=self.doc["as_of"])
        self.assertEqual(lt.errors, [])
        self.assertTrue(any("not on the main list" in w for w in lt.warnings))


class SampleTest(unittest.TestCase):
    def test_sample_file_builds_and_is_flagged(self):
        import make_sample_data
        from _common import watchlist
        doc = make_sample_data.sample_buy_window(ST, watchlist(), RC)
        self.assertIsNotNone(doc)
        self.assertTrue(doc["sample"])
        self.assertEqual(Validator().validate(doc, "buy_window.schema.json"), [])
        self.assertEqual(bw.problems(doc, {s["symbol"] for s in watchlist()["symbols"]}), [])
        self.assertEqual(set(doc["names"]), {s["symbol"] for s in watchlist()["symbols"]})


if __name__ == "__main__":
    unittest.main()
