"""scripts/brain_status.py: what the scheduled brain routine reads before it calls the model."""
import io
import json
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import brain_status  # noqa: E402
from _common import dump_json  # noqa: E402

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "brain_status.py"


class BrainStatusTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.pack = self.tmp / "pack.json"
        self.runs = self.tmp / "runs"
        self.runs.mkdir()
        self.longrun = self.tmp / "longrun.json"
        self.paper = self.tmp / "paper.json"
        dump_json(self.pack, {"hash": "a", "tokens": 1, "cap_tokens": 2, "pack": {"meta": {"as_of": "2026-10-05"}}})

    def status(self):
        return brain_status.status(self.pack, self.runs, self.longrun, self.paper)

    def test_not_recorded_and_nothing_held(self):
        s = self.status()
        self.assertEqual(s["as_of"], "2026-10-05")
        self.assertFalse(s["recorded"])
        self.assertTrue(s["run_file"].endswith("run.2026-10-05.json"))
        self.assertEqual(s["hold"], [])

    def test_recorded_when_the_days_run_exists(self):
        (self.runs / "run.2026-10-05.json").write_text("{}")
        self.assertTrue(self.status()["recorded"])
        (self.runs / "run.2026-10-05.json").unlink()
        (self.runs / "run.2026-10-02.json").write_text("{}")
        self.assertFalse(self.status()["recorded"], "an older run does not count")

    def test_hold_merges_rule_and_paper_without_duplicates(self):
        dump_json(self.longrun, {"sample": False, "now": {"holdings": ["AAA", "BBB", "CCC"]}})
        dump_json(self.paper, {"sample": False, "rebalances": [
            {"date": "2026-09-01", "holdings": ["ZZZ"]}, {"date": "2026-10-02", "holdings": ["bbb", "DDD"]}]})
        self.assertEqual(self.status()["hold"], ["AAA", "BBB", "CCC", "DDD"])

    def test_hold_ignores_samples_and_bad_shapes(self):
        dump_json(self.longrun, {"sample": True, "now": {"holdings": ["AAA"]}})
        dump_json(self.paper, {"sample": False, "rebalances": []})
        self.assertEqual(self.status()["hold"], [])
        dump_json(self.longrun, {"sample": False, "now": None})
        self.paper.write_text("not json")
        self.assertEqual(self.status()["hold"], [])
        dump_json(self.longrun, {"sample": False, "now": {"holdings": "AAA"}})
        dump_json(self.paper, ["not", "an", "object"])
        self.assertEqual(self.status()["hold"], [])

    def test_missing_pack_fails_with_a_clear_message(self):
        with self.assertRaises(SystemExit) as cm:
            brain_status.status(self.tmp / "missing.json", self.runs, self.longrun, self.paper)
        self.assertIn("build_pack.py", str(cm.exception.code))
        self.pack.write_text(json.dumps({"pack": {}}))
        with self.assertRaises(SystemExit) as cm:
            self.status()
        self.assertIn("not a pack", str(cm.exception.code))

    def test_cli_prints_one_json_line(self):
        out = subprocess.run([sys.executable, str(SCRIPT), "--pack", str(self.pack)], capture_output=True, text=True, check=True).stdout
        lines = out.strip().splitlines()
        self.assertEqual(len(lines), 1)
        self.assertEqual(set(json.loads(lines[0])), {"as_of", "recorded", "run_file", "hold"})
        bad = subprocess.run([sys.executable, str(SCRIPT), "--pack", str(self.tmp / "missing.json")], capture_output=True, text=True)
        self.assertNotEqual(bad.returncode, 0)
        self.assertIn("no pack", bad.stderr)


if __name__ == "__main__":
    unittest.main()
