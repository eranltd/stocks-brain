"""People we learn from: scoring of public calls, the people.json lint rules, the pack block and the routine wiring."""
import copy
import json
import shutil
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import build_pack  # noqa: E402
import people  # noqa: E402
import record_run  # noqa: E402
import routines_code  # noqa: E402
from _common import CONFIG, DOCS, ROOT, SAMPLES, Validator, dump_json, load_json, settings, watchlist  # noqa: E402
from lint import Lint  # noqa: E402

def _weekdays(start: date, n: int) -> list[str]:
    out, d = [], start
    while len(out) < n:
        if d.weekday() < 5:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


N = 300  # trading days
DATES = _weekdays(date(2025, 1, 6), N)
SERIES = {
    "dates": DATES,
    "core": [100 * 1.001 ** k for k in range(N)],
    "members": {"UPP": [100 * 1.002 ** k for k in range(N)], "FLAT": [100.0] * N,
                "LATE": [None] * 100 + [50 * 1.003 ** k for k in range(N - 100)]},
}
ON_LIST = {"UPP", "FLAT", "LATE", "NOHIST"}


def call(**kw):
    c = {"id": "2025-01-06-fund-upp", "person": "someone", "via": "Some Fund LP", "date": DATES[0], "ticker": "UPP",
         "stance": "bullish", "what": "A new position in the name.", "source_kind": "13f", "source_url": "https://example.org/a"}
    c.update(kw)
    return c


def score(c, series=SERIES):
    return people.score_call(c, series, ON_LIST)


def drop_last(series, k=1):
    return {"dates": series["dates"][:-k], "core": series["core"][:-k], "members": {t: v[:-k] for t, v in series["members"].items()}}


class ScoreCallTest(unittest.TestCase):
    def test_bullish_excess_is_relative_growth(self):
        r = score(call())
        self.assertTrue(r["scored"])
        self.assertEqual(r["start_date"], DATES[1])  # the date itself is a trading day: start strictly after it
        w = r["w13"]
        self.assertEqual((w["weeks"], w["end_date"]), (13, DATES[1 + 65]))
        self.assertAlmostEqual(w["excess_pct"], ((1.002 / 1.001) ** 65 - 1) * 100, places=2)
        self.assertAlmostEqual(w["name_pct"], (1.002 ** 65 - 1) * 100, places=2)
        self.assertEqual(w["signed_excess_pct"], w["excess_pct"])
        self.assertTrue(w["right"])
        self.assertEqual(r["w26"]["end_date"], DATES[1 + 130])
        self.assertEqual(r["w52"]["end_date"], DATES[1 + 260])
        self.assertIsNone(score(call(date=DATES[60]))["w52"])  # 260 trading days after that start is past the end

    def test_bearish_is_right_when_the_name_lagged(self):
        r = score(call(ticker="FLAT", stance="bearish"))
        w = r["w26"]
        self.assertLess(w["excess_pct"], 0)
        self.assertEqual(w["signed_excess_pct"], -w["excess_pct"])
        self.assertTrue(w["right"])
        self.assertFalse(score(call(ticker="FLAT"))["w26"]["right"])

    def test_start_is_the_first_trading_day_after_the_public_date(self):
        friday = next(d for d in DATES[5:] if date.fromisoformat(d).weekday() == 4)
        saturday = (date.fromisoformat(friday) + timedelta(days=1)).isoformat()
        monday = DATES[DATES.index(friday) + 1]
        self.assertEqual(score(call(date=friday))["start_date"], monday)
        self.assertEqual(score(call(date=saturday))["start_date"], monday)

    def test_a_new_close_never_moves_the_start_or_a_finished_horizon(self):
        c = call(date=DATES[20])
        full, shorter = score(c), score(c, drop_last(SERIES))
        self.assertEqual(full["start_date"], shorter["start_date"])
        for h in ("w13", "w26"):
            self.assertEqual(full[h], shorter[h])
        self.assertNotEqual(full["so_far"], shorter["so_far"])  # only "so far" moves with the latest close
        five = score(c, drop_last(SERIES, 5))
        self.assertEqual((five["start_date"], five["w13"], five["w26"]), (full["start_date"], full["w13"], full["w26"]))

    def test_maturity(self):
        r = score(call(date=DATES[N - 101]))  # starts at N-100: 99 trading days of data after it
        self.assertEqual(r["weeks_since"], 19)
        self.assertIsNotNone(r["w13"])
        self.assertIsNone(r["w26"])
        self.assertIsNone(r["w52"])
        self.assertEqual(r["so_far"]["weeks"], 19)
        self.assertEqual(r["so_far"]["end_date"], DATES[-1])

    def test_unscored_calls_are_kept_with_a_reason(self):
        off = score(call(ticker="ZZZ"))
        self.assertEqual((off["scored"], off["note"]), (False, "not on our list"))
        self.assertIsNone(off["so_far"])
        self.assertEqual(score(call(ticker="NOHIST"))["note"], people.NOTES["no_history"])
        self.assertEqual(score(call(date=DATES[-1]))["note"], people.NOTES["too_new"])
        last_but_one = score(call(date=DATES[-2]))
        self.assertTrue(last_but_one["scored"])
        self.assertIsNone(last_but_one["so_far"])  # starts on the last day: nothing to measure yet

    def test_a_call_before_the_history_is_not_scored(self):
        before = (date.fromisoformat(DATES[0]) - timedelta(days=400)).isoformat()
        r = score(call(date=before))
        self.assertEqual((r["scored"], r["note"], r["start_date"]), (False, people.NOTES["before_history"], None))
        # the day before the first close: we cannot know there was no trading day in between, so not scored either
        self.assertEqual(score(call(date="2025-01-05"))["note"], people.NOTES["before_history"])
        # a name whose own history starts after the public date
        self.assertEqual(score(call(ticker="LATE", date=DATES[50]))["note"], people.NOTES["before_history"])
        self.assertTrue(score(call(ticker="LATE", date=DATES[120]))["scored"])
        # a hole in the history right after the public date
        gap = {**SERIES, "dates": DATES[:10] + [(date.fromisoformat(d) + timedelta(days=30)).isoformat() for d in DATES[10:]]}
        self.assertEqual(score(call(date=DATES[9]), gap)["note"], people.NOTES["before_history"])

    def test_the_firms_own_call_is_flagged(self):
        self.assertTrue(score(call())["credit_person"])
        self.assertFalse(score(call(credit_person=False))["credit_person"])


class RecordTest(unittest.TestCase):
    def cfg(self, n_calls, start=0):
        return {"version": "1.0.0", "people": [{"id": "someone", "name": "Some One"}, {"id": "other", "name": "Other One"}],
                "calls": [call(id=f"{DATES[start + k]}-fund-upp", date=DATES[start + k]) for k in range(n_calls)]
                + [call(id=f"{DATES[0]}-fund-zzz", ticker="ZZZ")]}

    def doc(self, cfg, series=SERIES):
        return people.compute_scores(cfg, series, ON_LIST, core="SPY", sample=False)

    def test_enough_needs_ten_matured_calls(self):
        nine = self.doc(self.cfg(9))
        p = nine["people"][0]
        self.assertEqual((p["n"], p["scored"], p["matured_26w"], p["enough"]), (10, 9, 9, False))
        self.assertEqual(p["right_26w_pct"], 100.0)
        ten = self.doc(self.cfg(10))["people"][0]
        self.assertEqual((ten["matured_26w"], ten["enough"]), (10, True))
        young = self.doc(self.cfg(12, start=N - 101))["people"][0]  # scored but none half a year old
        self.assertEqual((young["scored"], young["matured_26w"], young["enough"]), (12, 0, False))
        self.assertIsNone(young["right_26w_pct"])
        self.assertIsNone(young["median_signed_excess_26w"])

    def test_output_matches_its_schema_and_groups_by_fund(self):
        d = self.doc(self.cfg(3))
        self.assertEqual(Validator().validate(d, "people_scores.schema.json"), [])
        self.assertEqual([v["via"] for v in d["vias"]], ["Some Fund LP"])
        self.assertEqual(d["as_of"], DATES[-1])
        self.assertNotIn("weekly", d["series"])

    def test_the_firms_own_calls_count_for_the_fund_only(self):
        cfg = self.cfg(3)
        cfg["calls"].append(call(id=f"{DATES[4]}-firm-upp", person="other", via="Big Firm Inc", date=DATES[4], credit_person=False))
        d = self.doc(cfg)
        self.assertEqual([p["person"] for p in d["people"]], ["someone"])
        firm = {v["via"]: v for v in d["vias"]}["Big Firm Inc"]
        self.assertEqual((firm["n"], firm["scored"], firm["persons"]), (1, 1, []))
        self.assertEqual(Validator().validate(d, "people_scores.schema.json"), [])

    def test_unknown_person_fails_closed(self):
        cfg = self.cfg(1)
        cfg["calls"][0]["person"] = "nobody"
        with self.assertRaises(SystemExit):
            self.doc(cfg)


class PeopleLintTest(unittest.TestCase):
    def setUp(self):
        self.cfg = load_json(CONFIG / "people.json")
        self.v = Validator()

    def lint_errors(self, cfg, today="2026-10-07"):
        lint = Lint()
        lint.check_people(CONFIG / "people.json", cfg, load_json(CONFIG / "sources.json"), today=today)
        return lint.errors, lint.warnings

    def test_repo_file_is_valid_and_clean(self):
        self.assertEqual(self.v.validate(self.cfg, "people.schema.json"), [])
        self.assertEqual(self.lint_errors(self.cfg), ([], []))
        self.assertTrue(all(c["person"] in {p["id"] for p in self.cfg["people"]} for c in self.cfg["calls"]))

    def test_schema_rules(self):
        cases = {
            "handle with @": lambda c: c["people"][0].__setitem__("x_handle", "@someone"),
            "cik not ten digits": lambda c: c["people"][0].__setitem__("holdings_13f", {"filer": "A Fund", "cik": "123"}),
            "plain http": lambda c: c["people"][0]["links"][0].__setitem__("url", "http://example.org"),
            "lowercase ticker": lambda c: c["calls"][0].__setitem__("ticker", "aapl"),
            "bad status": lambda c: c["people"][0].__setitem__("status", "fan"),
            "bad kind": lambda c: c["people"][0].__setitem__("kind", "guru"),
            "bad date": lambda c: c["calls"][0].__setitem__("date", "2026-02-30"),
            "neutral stance": lambda c: c["calls"][0].__setitem__("stance", "neutral"),
        }
        for name, mutate in cases.items():
            c = copy.deepcopy(self.cfg)
            mutate(c)
            self.assertTrue(self.v.validate(c, "people.schema.json"), f"{name} was not caught")

    def test_lint_rules(self):
        first = self.cfg["calls"][0]
        cases = {
            "duplicate person": (lambda c: c["people"].append(copy.deepcopy(c["people"][0])), "duplicate person ids"),
            "duplicate call": (lambda c: c["calls"].append(copy.deepcopy(first)), "duplicate call ids"),
            "unknown person": (lambda c: c["calls"][0].__setitem__("person", "nobody"), "unknown person"),
            "future date": (lambda c: c["calls"][0].update(date="2026-12-01", id="2026-12-01-x"), "in the future"),
            "id not dated": (lambda c: c["calls"][0].__setitem__("id", "2020-01-01-x"), "must start with its date"),
            "principles only": (lambda c: c["calls"][0].__setitem__("person", "john-bogle"), "principles_only"),
            "quotation": (lambda c: c["calls"][0].__setitem__("what", 'He said "buy it all" on air.'), "quotation"),
            "price in what": (lambda c: c["calls"][0].__setitem__("what", "Bought the name at $187 a share."), "looks like a price"),
            "price in note": (lambda c: c["calls"][0].__setitem__("note", "Paid about 187 dollars a share."), "looks like a price"),
            "quote in note": (lambda c: c["calls"][0].__setitem__("note", 'He called it "a bargain" on air.'), "quotation"),
        }
        for name, (mutate, msg) in cases.items():
            c = copy.deepcopy(self.cfg)
            mutate(c)
            errors, _ = self.lint_errors(c)
            self.assertTrue(any(msg in e for e in errors), f"{name}: {errors}")

    def test_handles_must_be_followed(self):
        c = copy.deepcopy(self.cfg)
        c["people"][0]["x_handle"] = "someoneelse"
        self.assertTrue(any("x_accounts.follow" in w for w in self.lint_errors(c)[1]))


class PackPeopleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        st, wl = settings(), watchlist()
        data = cls.tmp / "data"
        dump_json(data / "market" / "derived.json", routines_code.compute_derived(SAMPLES / "prices", st, wl, sample=False, provider="tiingo"))
        longrun = routines_code.compute_longrun(SAMPLES / "prices", st, wl, sample=False, provider="tiingo")
        dump_json(data / "market" / "longrun.json", longrun)
        cls.on_list = {s["symbol"] for s in wl["symbols"]}
        cls.cfg = load_json(CONFIG / "people.json")
        cls.scores = routines_code.compute_people(SAMPLES / "prices", cls.cfg, wl, sample=False)
        (cls.tmp / "runs").mkdir()
        cls.data = data
        cls.guard = load_json(DOCS / "guardrails.json")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_empty_block_without_scores(self):
        pack = build_pack.build(self.data, self.tmp / "runs", today="2026-10-05")
        self.assertEqual(pack["people"], {"note": build_pack.PEOPLE_NOTE, "record": {}, "fund": {}, "calls": {}})

    def test_block_keys_are_citable(self):
        self.assertEqual(Validator().validate(self.scores, "people_scores.schema.json"), [])
        d = self.tmp / "with_people"
        shutil.copytree(self.data, d)
        dump_json(d / "people" / "scores.json", self.scores)
        pack = build_pack.build(d, self.tmp / "runs", today="2026-10-05")
        block = pack["people"]
        self.assertIn("never the only evidence", block["note"])
        self.assertEqual(set(block["record"]), {p["person"] for p in self.scores["people"]})
        for row in block["record"].values():
            self.assertEqual(set(row), {"name", "via", "scored", "matured_26w", "right_26w_pct", "median_signed_excess_26w", "enough"})
        self.assertIn("name the fund", block["note"])
        # Berkshire's 13F moves are the firm's: no record for Buffett, a fund record for Berkshire, and no person on its calls
        self.assertNotIn("warren-buffett", block["record"])
        self.assertIn("berkshire-hathaway", block["fund"])
        self.assertEqual(block["fund"]["berkshire-hathaway"]["persons"], [])
        amzn = {c["fund"]: c for c in block["calls"]["amzn"]}
        self.assertNotIn("person", amzn["berkshire-hathaway"])
        self.assertIn("not Buffett's own", amzn["berkshire-hathaway"]["note"])
        self.assertEqual(amzn["pershing-square-capital-management"]["person"], "bill-ackman")
        self.assertTrue(all(c["source_kind"] == "13f" for v in block["calls"].values() for c in v))
        self.assertTrue(block["calls"])
        self.assertTrue(all(t == t.lower() and t.upper() in self.on_list for t in block["calls"]))
        self.assertTrue(all(len(v) <= build_pack.PEOPLE_CALLS_PER_NAME for v in block["calls"].values()))
        text = json.dumps(pack, sort_keys=True, separators=(",", ":"))
        self.assertLessEqual(build_pack.estimate_tokens(text), settings()["pack"]["token_cap"])
        ticker = sorted(block["calls"])[0]
        person = sorted(block["record"])[0]
        out = {"summary": "One name is mixed; a person we follow made a public call on it, which is context only.",
               "picks": [{"ticker": ticker.upper(), "stance": "neutral", "conviction": "low",
                          "thesis": "A fund we follow made a public call on this name; on its own that proves nothing, so we stay neutral.",
                          "risks": ["Their record is too short to judge"], "invalidation": "A clear break of its long average.",
                          "evidence": [f"people.calls.{ticker}", f"people.record.{person}", "people.fund.berkshire-hathaway", "people"]}]}
        self.assertEqual(record_run.check_picks(out, pack, self.guard, self.on_list), [])
        out["picks"][0]["evidence"].append("people.record.nobody")
        self.assertTrue(record_run.check_picks(out, pack, self.guard, self.on_list))

    def test_sample_scores_are_not_packed(self):
        d = self.tmp / "sample_people"
        shutil.copytree(self.data, d)
        dump_json(d / "people" / "scores.json", {**self.scores, "sample": True})
        self.assertEqual(build_pack.build(d, self.tmp / "runs", today="2026-10-05")["people"]["record"], {})


class RoutineWiringTest(unittest.TestCase):
    def test_score_people_is_registered_and_runs_daily(self):
        rt = load_json(CONFIG / "routines.json")
        r = {x["id"]: x for x in rt["routines"]}
        sp = r["score_people"]
        self.assertEqual((sp["status"], sp["runner"], sp["uses_llm"], sp["max_cost_usd"], sp["cadence"]),
                         ("active", "github_actions", False, 0, "daily"))
        self.assertIn("data/people/scores.json", sp["outputs"])
        daily = (ROOT / ".github" / "workflows" / "daily.yml").read_text()
        self.assertIn(sp["cron"], daily)
        self.assertIn("id: score_people", daily)
        self.assertIn("routines_code.py people", daily)
        self.assertIn("ROUTINE_SCORE_PEOPLE: ${{ steps.score_people.outcome }}", daily)
        self.assertIn("people", routines_code.STEPS)

    def test_brain_fires_twice_to_catch_a_late_data_run(self):
        rt = load_json(CONFIG / "routines.json")
        cron = {x["id"]: x for x in rt["routines"]}["close_run"]["cron"]
        self.assertEqual(cron, "47 5,11 * * 2-6")
        self.assertEqual(Validator().validate(rt, "routines.schema.json"), [])

    def test_people_source_is_registered_and_13f_is_not_connected(self):
        src = {s["id"]: s for s in load_json(CONFIG / "sources.json")["sources"]}
        self.assertEqual((src["people"]["status"], src["people"]["provider"]), ("active", "manual"))
        self.assertEqual((src["holdings_13f"]["status"], src["holdings_13f"]["provider"]), ("planned", None))
        self.assertEqual(src["x_accounts"]["status"], "planned")
        handles = {p["x_handle"] for p in load_json(CONFIG / "people.json")["people"] if p["x_handle"]}
        self.assertEqual(set(src["x_accounts"]["follow"]), handles)


if __name__ == "__main__":
    unittest.main()
