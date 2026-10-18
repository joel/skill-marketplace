"""The Beads backend end to end, run only when `bd` is on PATH.

Each test builds a throwaway git repository, initialises the workspace with
--tasks beads, and checks the files, the JSONL mirror, the validator, and the
recovery path (fresh `bd init` + `bd import` of the committed JSONL).
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = PLUGIN_ROOT / "skills" / "vendor-neutral-workspace" / "scripts"
BD = shutil.which("bd")
ENV = {**os.environ, "BD_NON_INTERACTIVE": "1", "DO_NOT_TRACK": "1"}
INITIAL_TASK_TITLE = "Confirm and complete project foundation"


def sh(*cmd: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, env=ENV)


def git_repo(path: Path) -> None:
    path.mkdir(parents=True)
    for cmd in (
        ("git", "init", "-q"),
        ("git", "-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "--allow-empty", "-m", "seed"),
    ):
        result = sh(*cmd, cwd=path)
        assert result.returncode == 0, result.stderr


@unittest.skipUnless(BD, "bd is not on PATH")
class BeadsBackend(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / "workspace"
        git_repo(self.root)
        result = sh(sys.executable, str(SCRIPTS / "init_workspace.py"), "--root", str(self.root),
                    "--project", "Beads Spike", "--tasks", "beads", "--apply", cwd=self.root)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.init_output = result.stdout

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_workspace_declares_and_renders_the_beads_backend(self) -> None:
        self.assertIn("tasks: beads", (self.root / "workspace.yaml").read_text(encoding="utf-8"))
        self.assertTrue((self.root / ".beads").is_dir())
        self.assertFalse((self.root / "TASKS.md").exists())
        self.assertIn('Chosen option: "Beads"', (self.root / "docs/decisions/0002-task-backend.md").read_text(encoding="utf-8"))
        self.assertIn("## Tasks\n\nTasks live in Beads", (self.root / "AGENTS.md").read_text(encoding="utf-8"))

    def test_initial_task_is_in_beads_and_in_the_session_record(self) -> None:
        jsonl = (self.root / ".beads" / "issues.jsonl").read_text(encoding="utf-8")
        self.assertIn(INITIAL_TASK_TITLE, jsonl)
        session = next((self.root / "sessions").rglob("*-session.md")).read_text(encoding="utf-8")
        task_id = re.search(r"^- Tasks: (\S+)$", session, re.MULTILINE)
        self.assertIsNotNone(task_id, session)
        self.assertRegex(task_id.group(1), r"^beadsspike-[a-z0-9.]+$")
        self.assertNotIn("SETUP-0001", session)
        self.assertNotIn("{{", session)

    def test_validator_accepts_the_beads_workspace_and_demands_the_mirror(self) -> None:
        validate = lambda: sh(sys.executable, str(SCRIPTS / "validate_workspace.py"), "--root", str(self.root), cwd=self.root).stdout
        self.assertIn("errors=0", validate())
        (self.root / ".beads" / "issues.jsonl").unlink()
        self.assertIn("ERROR missing .beads/issues.jsonl (tasks: beads); run `bd export -o .beads/issues.jsonl`", validate())

    def test_recovery_from_the_committed_jsonl(self) -> None:
        mirror = self.root / ".beads" / "issues.jsonl"
        recovery = Path(self._tmp.name) / "recovery"
        git_repo(recovery)
        for cmd in (
            ("bd", "init", "--prefix", "rec", "--skip-agents", "--skip-hooks", "--non-interactive", "--quiet"),
            ("bd", "import", str(mirror)),
        ):
            result = sh(*cmd, cwd=recovery)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        listed = sh("bd", "list", cwd=recovery)
        self.assertIn(INITIAL_TASK_TITLE, listed.stdout)

    def test_second_apply_skips_bd_init_and_creates_nothing(self) -> None:
        result = sh(sys.executable, str(SCRIPTS / "init_workspace.py"), "--root", str(self.root),
                    "--project", "Beads Spike", "--tasks", "beads", "--apply", cwd=self.root)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("KEEP .beads (bd init skipped)", result.stdout)
        self.assertNotIn("RUN bd create", result.stdout)
        self.assertIn("would-create/created=0", result.stdout)


if __name__ == "__main__":
    unittest.main()
