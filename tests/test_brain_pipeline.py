"""build_pack and record_run on a live-like data directory made from the synthetic samples."""
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import build_pack  # noqa: E402
import record_run  # noqa: E402
import routines_code  # noqa: E402
from _common import DOCS, KB, SAMPLES, Validator, dump_json, load_json, settings, watchlist  # noqa: E402


def live_like_data(root: Path) -> Path:
    st, wl = settings(), watchlist()
    data = root / "data"
    dump_json(data / "market" / "derived.json", routines_code.compute_derived(SAMPLES / "prices", st, wl, sample=False, provider="tiingo"))
    dump_json(data / "market" / "longrun.json", routines_code.compute_longrun(SAMPLES / "prices", st, wl, sample=False, provider="tiingo"))
    regime = load_json(SAMPLES / "kb" / "regime.json")
    regime["sample"] = False
    dump_json(data / "kb" / "regime.json", regime)
    for name in ("library.json", "observations.json"):
        if (KB / name).exists():
            shutil.copy(KB / name, data / "kb" / name)
    (root / "runs").mkdir()
    return data


class BrainPipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.data = live_like_data(cls.tmp)
        cls.pack = build_pack.build(cls.data, cls.tmp / "runs", today="2026-10-05")
        text = json.dumps(cls.pack, sort_keys=True, separators=(",", ":"))
        cls.packfile = {"hash": "a" * 64, "tokens": build_pack.estimate_tokens(text), "cap_tokens": settings()["pack"]["token_cap"], "pack": cls.pack}
        cls.guard = load_json(DOCS / "guardrails.json")
        cls.on_list = {s["symbol"] for s in watchlist()["symbols"]}

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def good(self):
        sym = sorted(self.on_list)[0]
        return {"summary": "One name shows leadership with a calm trend; the rest are mixed.",
                "picks": [{"ticker": sym, "stance": "bullish", "conviction": "low",
                           "thesis": "Leads the benchmark over both strength windows while the trend is intact and it is not stretched.",
                           "risks": ["A broad pullback would hit it too", "Earnings could reset the story"],
                           "invalidation": "A close back below its long average.",
                           "evidence": [f"market.{sym.lower()}", f"market.{sym.lower()}.setup", "regime"]}]}

    def test_pack_fits_the_cap_and_has_no_prices(self):
        self.assertLessEqual(self.packfile["tokens"], self.packfile["cap_tokens"])
        self.assertEqual(set(self.pack["market"]), {s.lower() for s in self.on_list})
        text = json.dumps(self.pack)
        for banned in ('"close"', '"open"', '"high"', '"low"', "ref_price", "exit_price"):
            self.assertNotIn(banned, text)
        self.assertTrue(all(k == k.lower() for k in build_pack.evidence_keys(self.pack)))
        self.assertLessEqual(len(self.pack["library"]), settings()["pack"]["library_principles_max"])

    def test_pack_carries_the_frozen_rule_verdicts_when_they_exist(self):
        self.assertEqual(self.pack["rules_history"], {})  # no real-data result in this fixture
        d = self.tmp / "with_rules"
        shutil.copytree(self.data, d)
        res = {"sample": False, "tries_counted": 17, "frozen": {"as_of": "2026-10-02", "satellite": {"five_leaders": {"verdict": "rejected", "percentile": 15.2}}},
               "satellite": {"controls": {"core": {"cagr_pct": 14.87}, "equal_weight": {"cagr_pct": 21.62}},
                             "rules": [{"id": "five_leaders", "stats": {"cagr_pct": 15.8}, "turnover_pct_year": 237.0}]}}
        dump_json(d / "market" / "rules.json", res)
        pack = build_pack.build(d, self.tmp / "runs", today="2026-10-05")
        self.assertEqual(pack["rules_history"]["verdicts"]["five_leaders"], {"verdict": "rejected", "beat_random_pct": 15.2, "cagr": 15.8, "turnover_pct_year": 237.0})
        self.assertEqual(pack["rules_history"]["yardsticks"], {"core_cagr": 14.9, "all_names_equal_cagr": 21.6})
        self.assertIn("rules_history.verdicts.five_leaders", build_pack.evidence_keys(pack))

    def test_refuses_sample_data(self):
        d = self.tmp / "sample_only"
        dump_json(d / "market" / "derived.json", {"sample": True})
        with self.assertRaises(SystemExit):
            build_pack.build(d, self.tmp / "runs")

    def test_good_picks_make_a_valid_run_without_prices(self):
        out = self.good()
        self.assertEqual(record_run.check_picks(out, self.pack, self.guard, self.on_list), [])
        run = record_run.make_run(out, self.packfile, "Claude Code session", 5, 0.0, None, None)
        self.assertEqual(Validator().validate(run, "run.schema.json"), [])
        self.assertNotIn("ref_price", run["picks"][0])
        self.assertEqual(run["picks"][0]["ref_date"], self.pack["meta"]["as_of"])

    def test_every_rule_is_enforced(self):
        cases = {
            "digits": lambda o: o["picks"][0].__setitem__("thesis", "Up twelve percent, call it 12 percent, over the window."),
            "off list": lambda o: o["picks"][0].__setitem__("ticker", "ZZZZ"),
            "bad evidence": lambda o: o["picks"][0]["evidence"].append("market.nvda.secret_signal"),
            "banned": lambda o: o["picks"][0].__setitem__("invalidation", "This is a sure thing for the holder."),
            "too many": lambda o: o["picks"].extend([o["picks"][0]] * self.guard["max_picks"]),
            "extra key": lambda o: o.__setitem__("portfolio", []),
        }
        for name, mutate in cases.items():
            out = self.good()
            mutate(out)
            self.assertTrue(record_run.check_picks(out, self.pack, self.guard, self.on_list), f"{name} was not caught")

    def test_eli5_is_optional_and_checked_like_the_rest(self):
        out = self.good()
        out["eli5"] = "The brain likes this one a little, like a sunny morning, but it is only playing pretend money."
        out["picks"][0]["eli5"] = "This company is doing well and is not running too fast, so the brain keeps an eye on it."
        self.assertEqual(record_run.check_picks(out, self.pack, self.guard, self.on_list), [])
        run = record_run.make_run(out, self.packfile, "Claude Code session", 5, 0.0, None, None)
        self.assertEqual(run["eli5"], out["eli5"])
        self.assertEqual(Validator().validate(run, "run.schema.json"), [])
        for bad in ({"eli5": "It went up 12 times, so buy."}, {"eli5": "short"}):
            o = self.good()
            o.update(bad)
            self.assertTrue(record_run.check_picks(o, self.pack, self.guard, self.on_list), bad)
        o = self.good()
        o["picks"][0]["eli5"] = "A sure thing for anyone, like candy, really really nice."
        self.assertTrue(record_run.check_picks(o, self.pack, self.guard, self.on_list))
        self.assertNotIn("eli5", record_run.make_run(self.good(), self.packfile, "m", 1, 0.0, None, None))

    def test_letter_is_optional_and_checked_like_the_rest(self):
        letter = ("Dear family, this week we do the same quiet thing we always do: the weekly buy of the fund that holds "
                  "the whole market, and money we need soon stays safe. The pretend-money game is still young and has shown "
                  "no edge over picking from a hat. The lesson: a tree grows while you sleep, not while you dig it up. We "
                  "would change our minds only if a tested rule beat chance for many months.")
        out = self.good()
        out["letter"] = letter
        self.assertEqual(record_run.check_picks(out, self.pack, self.guard, self.on_list), [])
        run = record_run.make_run(out, self.packfile, "Claude Code session", 5, 0.0, None, None)
        self.assertEqual(run["letter"], letter)
        self.assertEqual(Validator().validate(run, "run.schema.json"), [])
        for bad in ({"letter": letter + " It rose 12 times."}, {"letter": "Too short."}, {"letter": letter + " A sure thing for anyone."}):
            o = self.good()
            o.update(bad)
            self.assertTrue(record_run.check_picks(o, self.pack, self.guard, self.on_list), bad)
        self.assertNotIn("letter", record_run.make_run(self.good(), self.packfile, "m", 1, 0.0, None, None))

    def test_weekly_bet_takes_sides_and_is_checked(self):
        names = sorted(self.on_list)[:7]
        bets = {"best": names[:3], "worst": names[3:6], "why": "Steady leaders against names that slipped below their trend."}
        out = self.good()
        out["bets"] = bets
        self.assertEqual(record_run.check_picks(out, self.pack, self.guard, self.on_list), [])
        run = record_run.make_run(out, self.packfile, "m", 1, 0.0, None, None)
        self.assertEqual(run["bets"], bets)
        self.assertEqual(Validator().validate(run, "run.schema.json"), [])
        for bad in ({**bets, "best": names[:2]}, {**bets, "worst": [names[0], *names[4:6]]}, {**bets, "best": ["ZZZZ", *names[1:3]]},
                    {**bets, "why": "Too short."}, {**bets, "why": "A sure thing, written plainly enough."}, {"best": names[:3]}):
            o = self.good()
            o["bets"] = bad
            self.assertTrue(record_run.check_picks(o, self.pack, self.guard, self.on_list), bad)
        self.assertNotIn("bets", record_run.make_run(self.good(), self.packfile, "m", 1, 0.0, None, None))

    def test_bets_block_scores_each_week_to_the_next_bet(self):
        series = lambda vals: {"series": [{"date": d, "v": v} for d, v in vals]}
        d1, d2, d3 = "2026-10-14", "2026-10-19", "2026-10-21"
        rows = {t: series([(d1, 100), (d2, 110), (d3, 110)]) for t in "ABC"} | {t: series([(d1, 100), (d2, 100), (d3, 100)]) for t in "DEFX"}
        bet = lambda b, w: {"best": list(b), "worst": list(w), "why": "a plain reason"}
        runs = [{"date": d1, "status": "ok", "bets": bet("ABC", "DEF")}, {"date": "2026-10-15", "status": "ok", "bets": bet("DEF", "ABC")},
                {"date": d2, "status": "ok", "bets": bet("DEF", "ABC")}, {"date": d3, "status": "ok", "bets": bet("ABC", "DEF")}]
        b = build_pack.bets_block(runs, rows, "X", d3)
        self.assertEqual((b["weeks_scored"], b["weeks_won"]), (1, 1))
        self.assertEqual(b["recent"][1]["spread"], 10.0)
        self.assertEqual(b["recent"][1]["best_vs_benchmark"], 10.0)
        self.assertTrue(b["recent"][0]["open"])
        self.assertEqual(b["this_week"], {"best": list("DEF"), "worst": list("ABC")})  # the d3 run itself is not before as_of

    def test_zero_picks_is_valid(self):
        out = {"summary": "Nothing clears the bar today; holding back is a valid answer.", "picks": []}
        self.assertEqual(record_run.check_picks(out, self.pack, self.guard, self.on_list), [])


if __name__ == "__main__":
    unittest.main()


class TrackRecordAndPointInTimeTest(unittest.TestCase):
    """The brain's memory (track_record) and the point-in-time guard: nothing dated after the close reaches the pack."""

    @staticmethod
    def run_doc(day, *calls):
        return {"date": day, "status": "ok",
                "picks": [{"id": f"{day}:{t}", "pick": {"ticker": t, "stance": s, "conviction": c}} for t, s, c in calls]}

    @staticmethod
    def outcome(day, t, stance, verdict, excess, scored):
        return {"pick_id": f"{day}:{t}", "run_date": day, "ticker": t, "stance": stance, "conviction": "low",
                "verdict": verdict, "excess_pct": excess, "scored_date": scored}

    def test_memory_is_newest_first_and_counts_pending(self):
        runs = [self.run_doc("2026-09-01", ("AAA", "bullish", "medium")), self.run_doc("2026-10-01", ("AAA", "neutral", "low"), ("BBB", "bearish", "low"))]
        outs = [self.outcome("2026-09-01", "AAA", "bullish", "miss", -3.21, "2026-09-29")]
        tr = build_pack.track_record_block(runs, outs, None, "2026-10-02")
        aaa = tr["names"]["aaa"]
        self.assertEqual(aaa["recent"], ["2026-10-01 neutral/low", "2026-09-01 bullish/medium"])
        self.assertEqual(aaa["settled"], [{"run_date": "2026-09-01", "call": "bullish/low", "verdict": "miss", "signed_excess": -3.2}])
        self.assertEqual((aaa["pending"], tr["names"]["bbb"]["pending"]), (1, 1))
        self.assertEqual(tr["settled_total"], 1)
        self.assertNotIn("calibration", tr)

    def test_memory_ignores_anything_after_the_close(self):
        runs = [self.run_doc("2026-10-02", ("AAA", "bullish", "high"))]  # a run on the pack's own day (a rerun) is not memory
        outs = [self.outcome("2026-09-01", "AAA", "bearish", "hit", -2.0, "2026-10-03")]  # scored after the close
        tr = build_pack.track_record_block(runs, outs, None, "2026-10-02")
        self.assertEqual(tr["names"], {})
        self.assertEqual(tr["settled_total"], 0)

    def test_settled_calls_are_capped_per_name_and_signed(self):
        outs = [self.outcome(f"2026-0{m}-01", "AAA", "bearish", "hit", -1.0, f"2026-0{m}-28") for m in range(1, 7)]
        tr = build_pack.track_record_block([], outs, None, "2026-10-02")
        settled = tr["names"]["aaa"]["settled"]
        self.assertEqual(len(settled), build_pack.TRACK_SETTLED_PER_NAME)
        self.assertEqual(settled[0]["run_date"], "2026-06-01")
        self.assertEqual(settled[0]["signed_excess"], 1.0)  # a bearish call on a laggard was right

    def test_calibration_shows_only_on_live_data(self):
        cal = routines_code.compute_calibration([self.outcome("2026-09-01", "AAA", "bullish", "hit", 2.0, "2026-09-29")], "2026-10-02", False, 10)
        tr = build_pack.track_record_block([], [], cal, "2026-10-02")
        self.assertEqual(tr["calibration"]["conviction_verdict"], "insufficient_data")
        self.assertEqual(tr["calibration"]["by_stance"], {"bullish": {"n": 1, "hit_pct": 100.0, "signed_excess": 2.0}})
        self.assertNotIn("calibration", build_pack.track_record_block([], [], {**cal, "sample": True}, "2026-10-02"))

    def test_people_calls_made_public_after_the_close_are_left_out(self):
        call = {"id": "c1", "ticker": "AAA", "via": "Some Fund LLC", "person": "p", "stance": "bullish", "weeks_since": 0, "so_far": None}
        scores = {"sample": False, "as_of": "2026-10-03", "min_matured": 3, "people": [], "vias": [],
                  "calls": [{**call, "date": "2026-10-02"}, {**call, "id": "c2", "date": "2026-10-03"}]}
        calls = build_pack.people_block(scores, {"AAA"}, None, "2026-10-02")["calls"]["aaa"]
        self.assertEqual([c["date"] for c in calls], ["2026-10-02"])

    def test_pack_holds_track_record_and_no_claim_after_the_close(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            data = live_like_data(tmp)
            as_of = load_json(data / "market" / "derived.json")["as_of"]
            sym = sorted(s["symbol"] for s in watchlist()["symbols"])[0]
            dump_json(data / "kb" / "observations.json", {"version": "0.1.0", "updated_at": as_of, "change_note": "test", "items": [
                {"id": "O-1", "text": "before the close", "tickers": [sym], "as_of": as_of, "expires": "2099-06-01"},
                {"id": "O-2", "text": "after the close", "tickers": [sym], "as_of": "2099-01-01", "expires": "2099-12-31"}]})
            pack = build_pack.build(data, tmp / "runs", today="2099-01-02")
            self.assertEqual(sorted(pack["claims"]), ["o-1"])
            self.assertIn("track_record", pack)
            self.assertNotIn("recent_runs", pack)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
