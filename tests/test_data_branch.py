"""scripts/data_branch.sh against a throwaway bare repository (no network)."""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "data_branch.sh"
ENV = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}


def sh(cwd, *args):
    return subprocess.run(args, cwd=cwd, env=ENV, check=True, capture_output=True, text=True).stdout.strip()


@unittest.skipUnless(shutil.which("git") and shutil.which("bash"), "needs git and bash")
class DataBranchTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.origin = self.tmp / "origin.git"
        sh(self.tmp, "git", "init", "-q", "--bare", "-b", "main", str(self.origin))
        self.work = self.tmp / "work"
        sh(self.tmp, "git", "clone", "-q", str(self.origin), "work")
        (self.work / "data").mkdir()
        (self.work / "data" / "seed.json").write_text('{"seed": true}\n')
        (self.work / "code.py").write_text("print('code')\n")
        sh(self.work, "git", "add", ".")
        sh(self.work, "git", "commit", "-q", "-m", "main")
        sh(self.work, "git", "push", "-q", "origin", "HEAD:main")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_script(self, cwd, *args):
        return sh(cwd, "bash", str(SCRIPT), *args)

    def fresh_checkout(self, name):
        sh(self.tmp, "git", "clone", "-q", "--depth=1", f"file://{self.origin}", name)
        return self.tmp / name

    def test_first_publish_creates_a_data_only_branch_and_main_is_untouched(self):
        w = self.fresh_checkout("a")
        self.assertEqual(self.run_script(w, "restore"), "")  # no data branch yet
        (w / "data" / "market.json").write_text('{"day": 1}\n')
        (w / "runs").mkdir()
        (w / "runs" / "run.2026-10-05.json").write_text('{"run": 1}\n')
        self.assertEqual(self.run_script(w, "publish", "", "data: day 1"), "published")
        files = sh(self.tmp, "git", "--git-dir", str(self.origin), "ls-tree", "-r", "--name-only", "data").splitlines()
        self.assertEqual(sorted(files), ["data/market.json", "data/seed.json", "runs/run.2026-10-05.json"])  # no code
        main_files = sh(self.tmp, "git", "--git-dir", str(self.origin), "ls-tree", "-r", "--name-only", "main").splitlines()
        self.assertEqual(sorted(main_files), ["code.py", "data/seed.json"])

    def test_restore_overlays_and_publish_appends_history(self):
        w = self.fresh_checkout("a")
        (w / "data" / "market.json").write_text('{"day": 1}\n')
        self.run_script(w, "publish", "", "data: day 1")
        w2 = self.fresh_checkout("b")  # a new run starts from main's code...
        base = self.run_script(w2, "restore")  # ...and the published data
        self.assertEqual((w2 / "data" / "market.json").read_text(), '{"day": 1}\n')
        self.assertEqual(self.run_script(w2, "publish", base, "data: no change"), "unchanged")
        (w2 / "data" / "market.json").write_text('{"day": 2}\n')
        self.assertEqual(self.run_script(w2, "publish", base, "data: day 2"), "published")
        log = sh(self.tmp, "git", "--git-dir", str(self.origin), "log", "--format=%s", "data").splitlines()
        self.assertEqual(log, ["data: day 2", "data: day 1"])  # history kept, nothing force-pushed

    def test_reset_discards_what_a_failed_run_wrote(self):
        w = self.fresh_checkout("a")
        (w / "data" / "market.json").write_text('{"day": 1}\n')
        self.run_script(w, "publish", "", "data: day 1")
        w2 = self.fresh_checkout("b")
        base = self.run_script(w2, "restore")
        (w2 / "data" / "market.json").write_text('{"bad": true}\n')
        self.run_script(w2, "reset", base)
        self.assertEqual((w2 / "data" / "market.json").read_text(), '{"day": 1}\n')


if __name__ == "__main__":
    unittest.main()
