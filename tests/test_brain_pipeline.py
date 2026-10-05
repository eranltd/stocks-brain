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

    def test_zero_picks_is_valid(self):
        out = {"summary": "Nothing clears the bar today; holding back is a valid answer.", "picks": []}
        self.assertEqual(record_run.check_picks(out, self.pack, self.guard, self.on_list), [])


if __name__ == "__main__":
    unittest.main()
