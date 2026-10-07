import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import scoring  # noqa: E402
from _common import SAMPLES, Validator, load_json, parse_front_matter  # noqa: E402
from lint import BRAIN_WORKFLOW, MODEL_PORTFOLIO_FILES, SECRET_PATTERNS, Lint  # noqa: E402

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


class RoutineRunnerTest(unittest.TestCase):
    """github_actions routines need their cron in a workflow; an active claude_routine needs its prompt and the saved
    brain workflow instead."""

    ST = {"cost": {"hard_cap_usd": 2.5}}

    def routine(self, **kw):
        r = {"id": "x", "cadence": "daily", "cron": "47 4 * * 2-6", "runner": "github_actions", "status": "active",
             "uses_llm": False, "max_cost_usd": 0}
        r.update(kw)
        return r

    def errors(self, *routines, workflows="", root=None):
        lint = Lint()
        lint.check_routines({"routines": list(routines)}, self.ST, workflows,
                            **({"root": root} if root else {}))
        return lint.errors

    def tree(self, prompt=True, brain=True):
        import tempfile
        root = Path(tempfile.mkdtemp())
        if prompt:
            (root / "prompts").mkdir()
            (root / "prompts" / "daily.md").write_text("x")
        if brain:
            (root / BRAIN_WORKFLOW).parent.mkdir(parents=True)
            (root / BRAIN_WORKFLOW).write_text("x")
        return root

    def test_github_actions_routine_needs_its_cron_in_a_workflow(self):
        self.assertTrue(any("is in no workflow" in e for e in self.errors(self.routine())))
        self.assertEqual(self.errors(self.routine(), workflows='- cron: "47 4 * * 2-6"'), [])

    def test_active_claude_routine_needs_prompt_and_brain_workflow_not_a_cron(self):
        r = self.routine(runner="claude_routine", uses_llm=True, max_cost_usd=1.0, prompt="prompts/daily.md")
        self.assertEqual(self.errors(r, root=self.tree()), [])
        self.assertTrue(any("prompt prompts/daily.md does not exist" in e for e in self.errors(r, root=self.tree(prompt=False))))
        self.assertTrue(any(BRAIN_WORKFLOW in e for e in self.errors(r, root=self.tree(brain=False))))

    def test_claude_routine_rules(self):
        no_prompt = self.routine(runner="claude_routine", uses_llm=True, max_cost_usd=1.0)
        self.assertTrue(any("needs a prompt" in e for e in self.errors(no_prompt, root=self.tree())))
        no_llm = self.routine(runner="claude_routine", prompt="prompts/daily.md")
        self.assertTrue(any("uses_llm must be true" in e for e in self.errors(no_llm, root=self.tree())))
        stray = self.routine(prompt="prompts/daily.md")
        self.assertTrue(any("only a claude_routine" in e for e in self.errors(stray, workflows="47 4 * * 2-6")))
        planned = self.routine(runner="claude_routine", uses_llm=True, max_cost_usd=1.0, prompt="prompts/daily.md", status="planned")
        self.assertEqual(self.errors(planned, root=self.tree(prompt=False, brain=False)), [])

    def test_repo_close_run_is_a_scheduled_claude_routine(self):
        rt = load_json(Path(__file__).resolve().parent.parent / "config" / "routines.json")
        runners = {r["id"]: r["runner"] for r in rt["routines"]}
        self.assertEqual(runners.pop("close_run"), "claude_routine")
        self.assertEqual(set(runners.values()), {"github_actions"})
        self.assertEqual(Validator().validate(rt, "routines.schema.json"), [])


class HygieneTest(unittest.TestCase):
    def test_site_urls_are_compared_by_exact_host(self):
        import lint
        for url in ("https://x.com", "//github.com", "https://www.sec.gov", "http://www.w3.org"):
            self.assertTrue(lint.site_url_allowed(url), url)
        for url in ("https://x.co", "https://www.sec.go", "https://github.co", "https://x.com.evil.io", "https://cdn.example.com"):
            self.assertFalse(lint.site_url_allowed(url), url)

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
