"""'When could we buy it?' (scripts/buy_window.py, routines_code.compute_buy_window, us_market_calendar.py).

Made-up tickers only (AAA, BBB, ...). The card must call each rule's own engine, never re-implement it: the names it says
a rule would hold are checked against rules.pick_names and against what the forward ledger records on review days, for
the weekly game's rules (five_leaders_weekly, weekly_swing) and for Five Leaders monthly and quarterly."""
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
RULE = {r["id"]: r for r in RC["rules"]}
FIVE = RULE["five_leaders"]
CFG = {k: v for k, v in FIVE["engine"].items() if k != "kind"}
CFGS = {rid: {k: v for k, v in RULE[rid]["engine"].items() if k != "kind"} for rid in bw.RULE_ORDER}
SWING = CFGS["weekly_swing"]
# Each rule's record in the published ledger (data/portfolio/paper_rules.json, 2026-10-16) carries this hash. If one
# changes, the ledger freezes that rule's record and starts a new one: the card must never cause that.
LEDGER_HASH = {"five_leaders_weekly": "de0d6a086e64adc0", "weekly_swing": "8a780db09625ae4c",
               "five_leaders": "5e8536cf438bfae1", "five_leaders_quarterly": "cf2668536ddeded4"}


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
        self.assertEqual(cal.next_review("2026-10-15", "quarterly"), "2027-01-04")
        self.assertEqual(cal.next_review("2026-10-01"), "2026-11-02")  # on a review day, the next one
        self.assertEqual(cal.next_review("2026-12-31"), "2027-01-04")
        self.assertEqual(cal.next_review("2027-01-04", "quarterly"), "2027-04-01")
        self.assertEqual(cal.next_review("2026-08-20"), "2026-09-01")
        with self.assertRaises(ValueError):
            cal.next_review("2026-10-15", "daily")

    def test_next_weekly_review_is_the_first_trading_day_of_next_week(self):
        self.assertEqual(cal.next_review("2026-10-16", "weekly"), "2026-10-19")  # a Friday: next Monday
        self.assertEqual(cal.next_review("2026-10-17", "weekly"), "2026-10-19")  # a Saturday
        self.assertEqual(cal.next_review("2026-10-19", "weekly"), "2026-10-26")  # on a review day, the next one
        self.assertEqual(cal.next_review("2026-02-13", "weekly"), "2026-02-17")  # Washington's Birthday: Tuesday
        self.assertEqual(cal.next_review("2026-01-14", "weekly"), "2026-01-20")  # Martin Luther King Jr. Day
        self.assertEqual(cal.next_review("2026-08-31", "weekly"), "2026-09-08")  # Labor Day
        self.assertEqual(cal.next_review("2026-12-31", "weekly"), "2027-01-04")  # across the year (ISO week 53)
        self.assertEqual(cal.next_review("2025-11-26", "weekly"), "2025-12-01")
        self.assertEqual(cal.next_review("2026-11-20", "weekly"), "2026-11-23")  # Thanksgiving week opens on Monday
        self.assertEqual(cal.next_review("2026-11-25", "weekly"), "2026-11-30")  # ... and from inside it
        self.assertEqual(cal.next_review("2026-12-24", "weekly"), "2026-12-28")  # Christmas 2026 on a Friday
        self.assertEqual(cal.next_review("2026-12-28", "weekly"), "2027-01-04")  # New Year's Day 2027 on a Friday
        self.assertEqual(cal.next_review("2027-01-15", "weekly"), "2027-01-19")  # Martin Luther King Jr. Day 2027
        self.assertEqual(cal.next_review("2027-03-22", "weekly"), "2027-03-29")  # Good Friday 2027 (26 March)
        self.assertEqual(cal.next_review("2027-03-25", "monthly"), "2027-04-01")
        self.assertEqual(cal.next_review("2027-06-14", "weekly"), "2027-06-21")  # Juneteenth 2027 observed on the 18th
        self.assertEqual(cal.next_review("2027-07-02", "weekly"), "2027-07-06")  # Independence Day 2027 observed Monday
        self.assertNotIn(date(2026, 11, 27), cal.holidays(2026))  # the day after Thanksgiving is a (short) trading day
        self.assertIn(date(2027, 3, 26), cal.holidays(2027))
        self.assertIn(date(2027, 1, 18), cal.holidays(2027))
        for d in ("2026-03-02", "2026-10-02", "2027-06-30"):  # always a trading day, always a later ISO week
            nxt = date.fromisoformat(cal.next_review(d, "weekly"))
            self.assertTrue(cal.is_trading_day(nxt))
            self.assertTrue(rules.new_period(d, nxt.isoformat(), "weekly"))


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

    def test_weekly_swing_reasons(self):
        """Weekly Swing: last month's strongest, above the 50-day line, not stretched, one per sector, no keep buffer (a
        held name is judged like a newcomer, so it never gets rank_too_low)."""
        ex = bw.explain(SWING, self.M, ST, self.i, ["AAA", "KKK"])
        n = ex["names"]
        self.assertEqual(ex["would_hold"], rules.pick_names(SWING, self.M, ST, self.i, ["AAA", "KKK"], random.Random(0)))
        self.assertEqual(set(ex["would_hold"]), {"AAA", "EEE", "FFF", "GGG", "HHH"})
        self.assertEqual(n["CCC"]["rank"], 1)  # the strongest month, but stretched
        self.assertEqual(n["CCC"]["blockers"], ["stretched"])
        self.assertEqual(n["DDD"]["blockers"], ["below_50"])
        self.assertIs(n["DDD"]["above_50"], False)
        self.assertEqual(n["BBB"]["blockers"], ["sector_taken"])
        self.assertEqual(n["BBB"]["sector_leader"], "AAA")
        self.assertEqual(n["KKK"]["blockers"], ["no_slot"])
        self.assertEqual(n["JJJ"]["blockers"], ["not_eligible"])
        self.assertFalse(any({"rank_too_low", "below_200", "falling_200"} & set(r["blockers"]) for r in n.values()))

    def test_engine_and_card_never_disagree(self):
        M, names, _ = walk_market()
        for rid, cfg in CFGS.items():
            held: list[str] = []
            for i in range(400, M["n"], 7):
                ex = bw.explain(cfg, M, ST, i, held)
                self.assertEqual(ex["would_hold"], rules.pick_names(cfg, M, ST, i, held, random.Random(0)), rid)
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
        odd_line = copy.deepcopy(SWING)
        odd_line["selection"]["filters"][0]["n"] = 100  # the card words the 50- and 200-day lines only
        with self.assertRaises(ValueError):
            bw.explain(odd_line, self.M, ST, self.i, [])
        odd_rank = copy.deepcopy(SWING)
        odd_rank["selection"]["rank"] = "low_vol"
        with self.assertRaises(ValueError):
            bw.explain(odd_rank, self.M, ST, self.i, [])


class LedgerAgreementTest(unittest.TestCase):
    """The card equals each rule's own ledger decision on its review days, and does not change the ledger."""

    def setUp(self):
        self.M, self.names, self.sectors = walk_market()
        self.rc = {"acceptance": RC["acceptance"], "rules": [RULE[rid] for rid in bw.RULE_ORDER]}

    def card(self, T, ledger):
        rows = ledger["rules"]
        return bw.build([(rid, rid, CFGS[rid], rows.get(rid)) for rid in bw.RULE_ORDER], T, ST, self.names, self.sectors,
                        sample=True)

    def test_would_hold_equals_the_ledger_decision(self):
        prev = None
        checked = {rid: 0 for rid in bw.RULE_ORDER}
        for n in range(900, 1040, 3):
            T = truncate(self.M, n)
            prev = routines_code.update_ledger(prev, T, ST, self.rc, sample=True)
            doc = self.card(T, prev)
            self.assertEqual(bw.problems(doc, set(self.names)), [])
            for rid in bw.RULE_ORDER:
                row, rd = prev["rules"][rid], doc["rules"][rid]
                last = row["rebalances"][-1]
                self.assertEqual(rd["held_now"], last["holdings"])
                self.assertEqual(rd["cadence"], CFGS[rid].get("rebalance", "monthly"))
                if last["date"] == T["dates"][-1]:  # a review day: the card shows exactly what the ledger recorded
                    self.assertEqual(rd["would_hold_if_today"], last["holdings"], rid)
                    checked[rid] += 1
                else:
                    self.assertEqual(rd["would_hold_if_today"],
                                     rules.pick_names(CFGS[rid], T, ST, n - 1, last["holdings"], random.Random(0)), rid)
        self.assertGreater(checked["weekly_swing"], 20)
        self.assertGreater(checked["five_leaders_weekly"], 20)
        self.assertGreater(checked["five_leaders"], 3)
        self.assertGreater(checked["five_leaders_quarterly"], 0)

    def test_the_card_does_not_change_the_ledger(self):
        def run(with_card):
            prev = None
            for n in range(900, 1060, 5):
                T = truncate(self.M, n)
                prev = routines_code.update_ledger(prev, T, ST, self.rc, sample=True)
                if with_card:
                    before = copy.deepcopy(prev)
                    self.card(T, prev)
                    self.assertEqual(before, prev)
            return prev
        self.assertEqual(run(False), run(True))

    def test_engine_hashes_are_unchanged(self):
        for rid, cfg in CFGS.items():
            h = routines_code._engine_hash(cfg, ST["portfolio"]["cost_bps"], RC["acceptance"]["fill_lag_days"], ST)
            self.assertEqual(h, LEDGER_HASH[rid], rid)
        self.assertEqual({rid: h for rid, _, _, h in routines_code.buy_window_rules(RC, ST)}, LEDGER_HASH)

    def test_the_card_reads_every_rule_in_order(self):
        self.assertEqual([r[0] for r in routines_code.buy_window_rules(RC, ST)], list(bw.RULE_ORDER))
        rc = copy.deepcopy(RC)
        rc["rules"] = [r for r in rc["rules"] if r["id"] != "weekly_swing"]  # a rule taken out of the registry
        self.assertNotIn("weekly_swing", [r[0] for r in routines_code.buy_window_rules(rc, ST)])

    def test_a_record_under_another_hash_is_not_read(self):
        M, names, sectors = scenario()
        rows = {"rules": {rid: {"engine_hash": "0" * 16, "rebalances": [{"date": M["dates"][-3], "holdings": ["KKK"]}]}
                          for rid in bw.RULE_ORDER}}
        rc = copy.deepcopy(RC)
        wl = {"symbols": [{"symbol": s, "name": s, "sector": sectors[s]} for s in names]}
        orig = routines_code._rule_market
        routines_code._rule_market = lambda *_a: M
        try:
            doc = routines_code.compute_buy_window(Path("."), ST, wl, rc, rows, sample=True)
        finally:
            routines_code._rule_market = orig
        self.assertTrue(all(r["held_now"] == [] for r in doc["rules"].values()))

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
        self.doc = bw.build([("five_leaders_weekly", "Five Leaders: reviewed every week", CFGS["five_leaders_weekly"], row),
                             ("weekly_swing", "Weekly Swing", SWING, None),
                             ("five_leaders", "Five Leaders", CFG, row)], M, ST, names, sectors, sample=False)

    def test_valid_derived_only_and_consistent(self):
        d = self.doc
        self.assertEqual(Validator().validate(d, "buy_window.schema.json"), [])
        self.assertEqual(bw.problems(d, self.on_list), [])
        self.assertEqual(d["version"], 2)
        self.assertEqual(list(d["rules"]), ["five_leaders_weekly", "weekly_swing", "five_leaders"])
        self.assertEqual(d["next_weekly_buy"], cal.next_review(d["as_of"], "weekly"))
        self.assertEqual(d["rules"]["weekly_swing"]["next_review"], d["next_weekly_buy"])
        self.assertEqual(d["rules"]["five_leaders"]["next_review"], cal.next_review(d["as_of"], "monthly"))
        self.assertEqual(d["rules"]["five_leaders"]["held_now"], ["AAA", "KKK"])
        self.assertEqual(d["rules"]["weekly_swing"]["held_now"], [])
        self.assertIsNone(d["rules"]["weekly_swing"]["keep_rank"])
        self.assertEqual(d["rules"]["weekly_swing"]["rank_by"], "rs_1m")
        self.assertEqual(d["rules"]["weekly_swing"]["entry_checks"], ["above_50", "not_stretched"])
        self.assertEqual(d["rules"]["five_leaders"]["entry_checks"], ["above_rising_200", "not_stretched"])
        self.assertEqual(d["rules"]["five_leaders"]["keep_checks"], ["above_200"])
        self.assertTrue(d["rules"]["five_leaders"]["names"]["KKK"]["held_now"])
        for rd in d["rules"].values():
            for r in rd["names"].values():
                self.assertFalse({"close", "price", "volume", "high", "low", "open"} & set(r))

    def test_problems_catch_tampering(self):
        def bad(edit):
            x = copy.deepcopy(self.doc)
            edit(x)
            return bw.problems(x, self.on_list)
        self.assertTrue(bad(lambda d: d["rules"]["five_leaders"]["names"]["BBB"].update(blockers=[])))
        self.assertTrue(bad(lambda d: d["rules"]["five_leaders"].update(next_review=d["as_of"])))
        self.assertTrue(bad(lambda d: d["rules"]["weekly_swing"].update(next_review=cal.next_review(d["as_of"], "monthly"))))
        self.assertTrue(bad(lambda d: d.update(next_weekly_buy=d["as_of"])))
        self.assertTrue(bad(lambda d: d.update(version=1)))
        # a reason this rule has no check for: Five Leaders has no 50-day check, Weekly Swing no keep buffer
        self.assertTrue(bad(lambda d: d["rules"]["five_leaders"]["names"]["DDD"]["blockers"].append("below_50")))
        self.assertTrue(bad(lambda d: d["rules"]["weekly_swing"]["names"]["DDD"]["blockers"].append("rank_too_low")))
        self.assertTrue(bad(lambda d: d.update(rules={k: d["rules"][k] for k in reversed(list(d["rules"]))})))
        self.assertTrue(bad(lambda d: d["rules"]["weekly_swing"]["names"].pop("AAA")))
        self.assertTrue(bw.problems(self.doc, self.on_list - {"AAA"}))

    def test_schema_refuses_a_price(self):
        bad = copy.deepcopy(self.doc)
        bad["rules"]["five_leaders"]["names"]["AAA"]["dist_sma50_pct"] = 4123.5  # a raw price must never pass for a percent
        self.assertTrue(Validator().validate(bad, "buy_window.schema.json"))
        bad = copy.deepcopy(self.doc)
        bad["rules"]["weekly_swing"]["names"]["AAA"]["close"] = 101.2
        self.assertTrue(Validator().validate(bad, "buy_window.schema.json"))
        bad = copy.deepcopy(self.doc)
        bad["rules"]["another_rule"] = bad["rules"]["weekly_swing"]
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
        lt = Lint()
        lt.check_buy_window_data(Path("data/market/buy_window.json"), {**self.doc, "version": 1}, on_list=self.on_list,
                                 as_of=self.doc["as_of"])
        self.assertTrue(any("contract version" in e for e in lt.errors))


class SampleTest(unittest.TestCase):
    def test_sample_file_builds_and_is_flagged(self):
        import make_sample_data
        from _common import watchlist
        doc = make_sample_data.sample_buy_window(ST, watchlist(), RC)
        self.assertIsNotNone(doc)
        self.assertTrue(doc["sample"])
        self.assertEqual(Validator().validate(doc, "buy_window.schema.json"), [])
        self.assertEqual(bw.problems(doc, {s["symbol"] for s in watchlist()["symbols"]}), [])
        self.assertEqual(list(doc["rules"]), list(bw.RULE_ORDER))
        for rd in doc["rules"].values():
            self.assertEqual(set(rd["names"]), {s["symbol"] for s in watchlist()["symbols"]})
            self.assertTrue(rd["held_now"])  # the stand-in ledger's first record


if __name__ == "__main__":
    unittest.main()
