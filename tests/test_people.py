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

N = 60
DATES = [(date(2025, 1, 6) + timedelta(days=7 * k)).isoformat() for k in range(N)]
WEEKLY = {
    "dates": DATES,
    "core": [100 * 1.01 ** k for k in range(N)],
    "members": {"UPP": [100 * 1.02 ** k for k in range(N)], "FLAT": [100.0] * N},
}
ON_LIST = {"UPP", "FLAT", "NOHIST"}


def call(**kw):
    c = {"id": "2025-01-06-fund-upp", "person": "someone", "via": "Some Fund LP", "date": DATES[0], "ticker": "UPP",
         "stance": "bullish", "what": "A new position in the name.", "source_kind": "13f", "source_url": "https://example.org/a"}
    c.update(kw)
    return c


class ScoreCallTest(unittest.TestCase):
    def test_bullish_excess_is_relative_growth(self):
        r = people.score_call(call(), WEEKLY, ON_LIST)
        self.assertTrue(r["scored"])
        self.assertEqual(r["start_date"], DATES[1])  # the date itself is a weekly point: start strictly after it
        w = r["w13"]
        self.assertEqual((w["weeks"], w["end_date"]), (13, DATES[14]))
        self.assertAlmostEqual(w["excess_pct"], ((1.02 / 1.01) ** 13 - 1) * 100, places=2)
        self.assertAlmostEqual(w["name_pct"], (1.02 ** 13 - 1) * 100, places=2)
        self.assertEqual(w["signed_excess_pct"], w["excess_pct"])
        self.assertTrue(w["right"])

    def test_bearish_is_right_when_the_name_lagged(self):
        r = people.score_call(call(ticker="FLAT", stance="bearish"), WEEKLY, ON_LIST)
        w = r["w26"]
        self.assertLess(w["excess_pct"], 0)
        self.assertEqual(w["signed_excess_pct"], -w["excess_pct"])
        self.assertTrue(w["right"])
        bull = people.score_call(call(ticker="FLAT"), WEEKLY, ON_LIST)["w26"]
        self.assertFalse(bull["right"])

    def test_start_is_strictly_after_the_public_date(self):
        between = (date.fromisoformat(DATES[3]) + timedelta(days=2)).isoformat()
        self.assertEqual(people.score_call(call(date=between), WEEKLY, ON_LIST)["start_date"], DATES[4])
        self.assertEqual(people.score_call(call(date=DATES[3]), WEEKLY, ON_LIST)["start_date"], DATES[4])

    def test_maturity(self):
        r = people.score_call(call(date=DATES[N - 20]), WEEKLY, ON_LIST)  # starts at N-19: 18 weeks of data after it
        self.assertEqual(r["weeks_since"], 18)
        self.assertIsNotNone(r["w13"])
        self.assertIsNone(r["w26"])
        self.assertIsNone(r["w52"])
        self.assertEqual(r["so_far"]["weeks"], 18)
        self.assertEqual(r["so_far"]["end_date"], DATES[-1])

    def test_unscored_calls_are_kept_with_a_reason(self):
        off = people.score_call(call(ticker="ZZZ"), WEEKLY, ON_LIST)
        self.assertEqual((off["scored"], off["note"]), (False, "not on our list"))
        self.assertIsNone(off["so_far"])
        self.assertEqual(people.score_call(call(ticker="NOHIST"), WEEKLY, ON_LIST)["note"], people.NOTES["no_history"])
        self.assertEqual(people.score_call(call(date=DATES[-1]), WEEKLY, ON_LIST)["note"], people.NOTES["too_new"])
        last_but_one = people.score_call(call(date=DATES[-2]), WEEKLY, ON_LIST)
        self.assertTrue(last_but_one["scored"])
        self.assertIsNone(last_but_one["so_far"])  # starts on the last point: nothing to measure yet


class RecordTest(unittest.TestCase):
    def cfg(self, n_calls, start=0):
        return {"version": "1.0.0", "people": [{"id": "someone", "name": "Some One"}],
                "calls": [call(id=f"{DATES[start + k]}-fund-upp", date=DATES[start + k]) for k in range(n_calls)]
                + [call(id=f"{DATES[0]}-fund-zzz", ticker="ZZZ")]}

    def doc(self, cfg):
        return people.compute_scores(cfg, {"weekly": WEEKLY, "sample": False, "core": "COREX"}, ON_LIST)

    def test_enough_needs_ten_matured_calls(self):
        nine = self.doc(self.cfg(9))
        p = nine["people"][0]
        self.assertEqual((p["n"], p["scored"], p["matured_26w"], p["enough"]), (10, 9, 9, False))
        self.assertEqual(p["right_26w_pct"], 100.0)
        ten = self.doc(self.cfg(10))["people"][0]
        self.assertEqual((ten["matured_26w"], ten["enough"]), (10, True))
        young = self.doc(self.cfg(12, start=N - 20))["people"][0]  # scored but none half a year old
        self.assertEqual((young["scored"], young["matured_26w"], young["enough"]), (12, 0, False))
        self.assertIsNone(young["right_26w_pct"])
        self.assertIsNone(young["median_signed_excess_26w"])

    def test_output_matches_its_schema_and_groups_by_fund(self):
        d = self.doc(self.cfg(3))
        d["config_version"] = "1.0.0"
        d["core"] = "SPY"
        self.assertEqual(Validator().validate(d, "people_scores.schema.json"), [])
        self.assertEqual([v["via"] for v in d["vias"]], ["Some Fund LP"])
        self.assertEqual(d["as_of"], DATES[-1])

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
        cls.scores = people.compute_scores(cls.cfg, longrun, cls.on_list)
        (cls.tmp / "runs").mkdir()
        cls.data = data
        cls.guard = load_json(DOCS / "guardrails.json")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_empty_block_without_scores(self):
        pack = build_pack.build(self.data, self.tmp / "runs", today="2026-10-05")
        self.assertEqual(pack["people"], {"note": build_pack.PEOPLE_NOTE, "record": {}, "calls": {}})

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
                          "evidence": [f"people.calls.{ticker}", f"people.record.{person}", "people"]}]}
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
