import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import scoring  # noqa: E402
from _common import SAMPLES, Validator, load_json, parse_front_matter  # noqa: E402
from lint import MODEL_PORTFOLIO_FILES, SECRET_PATTERNS  # noqa: E402

RUN = sorted((SAMPLES / "runs").glob("run.*.json"))[-1]


class ValidatorTest(unittest.TestCase):
    def setUp(self):
        self.v = Validator()
        self.run = load_json(RUN)

    def test_sample_run_is_valid(self):
        self.assertEqual(self.v.validate(self.run, "run.schema.json"), [])

    def test_pick_rejects_numbers_and_extra_keys(self):
        bad = copy.deepcopy(self.run["picks"][0]["pick"])
        bad["target_price"] = 123
        errs = self.v.validate(bad, "pick.schema.json")
        self.assertTrue(any("unexpected key 'target_price'" in e for e in errs))

    def test_pick_enum_and_lengths(self):
        bad = copy.deepcopy(self.run["picks"][0]["pick"])
        bad["stance"] = "moon"
        bad["thesis"] = "short"
        errs = self.v.validate(bad, "pick.schema.json")
        self.assertTrue(any("not in" in e for e in errs))
        self.assertTrue(any("shorter than" in e for e in errs))

    def test_bad_date_format(self):
        bad = copy.deepcopy(self.run)
        bad["date"] = "2026-13-40"
        self.assertTrue(self.v.validate(bad, "run.schema.json"))

    def test_unsupported_keyword_fails_closed(self):
        from _common import SchemaError
        self.v._cache["x.json"] = {"type": "object", "oneOf": []}
        with self.assertRaises(SchemaError):
            self.v.validate({}, "x.json")


class ScoringTest(unittest.TestCase):
    def test_verdicts(self):
        self.assertEqual(scoring.verdict("bullish", 2.0, 1.0), "hit")
        self.assertEqual(scoring.verdict("bullish", -2.0, 1.0), "miss")
        self.assertEqual(scoring.verdict("bullish", 0.5, 1.0), "flat")
        self.assertEqual(scoring.verdict("bearish", -2.0, 1.0), "hit")
        self.assertEqual(scoring.verdict("neutral", 0.5, 1.0), "hit")
        self.assertEqual(scoring.verdict("neutral", 3.0, 1.0), "miss")

    def test_score(self):
        s = scoring.score("bullish", 100, 110, 100, 105, 1.0)
        self.assertAlmostEqual(s["excess_pct"], 5.0)
        self.assertEqual(s["verdict"], "hit")


class PersonalHoldingsGuardTest(unittest.TestCase):
    """The guard is key-based. Public model portfolios may say `holdings`; nothing else may, and no other forbidden key may."""

    def test_only_the_machine_written_model_portfolios_may_use_holdings(self):
        self.assertEqual(MODEL_PORTFOLIO_FILES, {"data/market/longrun.json", "data/market/rules.json",
                                                 "data/portfolio/paper.json", "data/portfolio/paper_rules.json"})

    def test_model_portfolio_files_have_closed_schemas_without_personal_keys(self):
        guard = set(load_json(Path(__file__).resolve().parent.parent / "docs" / "guardrails.json")["forbidden_keys"]) - {"holdings"}
        for name in ("longrun.schema.json", "paper.schema.json", "paper_rules.schema.json", "rules_result.schema.json"):
            schema = load_json(Path(__file__).resolve().parent.parent / "schemas" / name)

            def walk(node):
                if isinstance(node, dict):
                    props = node.get("properties", {})
                    self.assertFalse(guard & set(props), f"{name} defines a personal key {guard & set(props)}")
                    for v in node.values():
                        walk(v)
                elif isinstance(node, list):
                    for v in node:
                        walk(v)
            walk(schema)


class HygieneTest(unittest.TestCase):
    def test_secret_patterns_catch_keys(self):
        fake = "sk-" + "ant-" + "a" * 30  # assembled so this file never holds a literal key
        self.assertTrue(any(rx.search(fake) for _, rx in SECRET_PATTERNS))
        fake_gh = "ghp_" + "b" * 36
        self.assertTrue(any(rx.search(fake_gh) for _, rx in SECRET_PATTERNS))

    def test_front_matter(self):
        meta, body = parse_front_matter("---\nversion: 1.0.0\nupdated_at: 2026-01-01\nchange_note: x\n---\n# Hi\n")
        self.assertEqual(meta["version"], "1.0.0")
        self.assertTrue(body.startswith("# Hi"))


if __name__ == "__main__":
    unittest.main()
