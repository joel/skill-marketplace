"""Script-level tests for hooks/vnw_hook.py: hook JSON on stdin, a temp cwd, exit code
and stdout/stderr asserted. Per-session state goes to a temp VNW_HOOK_STATE_DIR.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
HOOK = PLUGIN_ROOT / "hooks" / "vnw_hook.py"
INIT = PLUGIN_ROOT / "skills" / "vendor-neutral-workspace" / "scripts" / "init_workspace.py"


class Hooks(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        base = Path(self._tmp.name)
        self.state = base / "state"
        self.root = base / "workspace"
        created = subprocess.run(
            [sys.executable, str(INIT), "--root", str(self.root), "--project", "Hooks", "--apply"],
            capture_output=True, text=True,
        )
        self.assertEqual(created.returncode, 0, created.stderr)
        self.session_file = next((self.root / "sessions").rglob("*-session.md"))

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def hook(self, event: str, cwd: Path, session: str = "s1", **extra: object) -> subprocess.CompletedProcess[str]:
        payload = {"session_id": session, "cwd": str(cwd), "hook_event_name": event, **extra}
        return subprocess.run(
            [sys.executable, str(HOOK), "session-start" if event == "SessionStart" else "stop"],
            input=json.dumps(payload), capture_output=True, text=True,
            env={**os.environ, "VNW_HOOK_STATE_DIR": str(self.state)},
        )

    def age(self, path: Path, seconds: int = 3600) -> None:
        old = time.time() - seconds
        os.utime(path, (old, old))

    def start_session(self, session: str = "s1") -> None:
        result = self.hook("SessionStart", self.root, session)
        self.assertEqual(result.returncode, 0, result.stderr)

    # Scope guard -----------------------------------------------------------

    def test_outside_a_workspace_both_hooks_are_silent(self) -> None:
        elsewhere = Path(self._tmp.name) / "elsewhere"
        elsewhere.mkdir()
        for event in ("SessionStart", "Stop"):
            result = self.hook(event, elsewhere)
            self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""), event)

    def test_a_workspace_with_hooks_off_is_left_alone(self) -> None:
        config = self.root / "workspace.yaml"
        config.write_text(config.read_text(encoding="utf-8").replace("hooks: on", "hooks: off"), encoding="utf-8")
        for event in ("SessionStart", "Stop"):
            result = self.hook(event, self.root)
            self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""), event)

    def test_a_subdirectory_of_a_git_workspace_is_in_scope(self) -> None:
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        sub = self.root / "src" / "deep"
        sub.mkdir(parents=True)
        result = self.hook("SessionStart", sub)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("AGENTS.md", json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"])

    # SessionStart ----------------------------------------------------------

    def test_session_start_injects_the_boot_reminder_and_records_the_start(self) -> None:
        result = self.hook("SessionStart", self.root, source="startup")
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)
        self.assertEqual(output["hookSpecificOutput"]["hookEventName"], "SessionStart")
        self.assertIn("boot sequence in AGENTS.md", output["hookSpecificOutput"]["additionalContext"])
        self.assertIn("started", json.loads((self.state / "s1.json").read_text(encoding="utf-8")))

    def test_resume_keeps_the_original_start_time(self) -> None:
        self.start_session()
        first = json.loads((self.state / "s1.json").read_text(encoding="utf-8"))["started"]
        time.sleep(0.05)
        self.hook("SessionStart", self.root, source="resume")
        second = json.loads((self.state / "s1.json").read_text(encoding="utf-8"))["started"]
        self.assertEqual(first, second)

    # Stop ------------------------------------------------------------------

    def test_stop_blocks_once_when_no_session_record_was_written(self) -> None:
        self.start_session()
        self.age(self.session_file)  # the init record predates the session
        first = self.hook("Stop", self.root)
        self.assertEqual(first.returncode, 2, first.stdout)
        self.assertIn("no file under sessions/ was created or modified", first.stderr)
        second = self.hook("Stop", self.root)
        self.assertEqual((second.returncode, second.stderr), (0, ""), "must block only once per session")

    def test_stop_never_blocks_when_stop_hook_active(self) -> None:
        self.start_session()
        self.age(self.session_file)
        result = self.hook("Stop", self.root, stop_hook_active=True)
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_stop_passes_with_a_fresh_session_record_and_warns_once_about_the_memory_bank(self) -> None:
        self.start_session()
        for path in (self.root / "memory-bank").iterdir():
            self.age(path)
        (self.session_file.parent / "99-000000Z-session.md").write_text("# Session\n", encoding="utf-8")
        first = self.hook("Stop", self.root)
        self.assertEqual((first.returncode, first.stderr), (0, ""))
        self.assertIn("no memory-bank/ file changed", json.loads(first.stdout)["systemMessage"])
        second = self.hook("Stop", self.root)
        self.assertEqual((second.returncode, second.stdout, second.stderr), (0, "", ""), "warn only once")

    def test_stop_is_silent_when_session_record_and_memory_bank_were_both_touched(self) -> None:
        self.start_session()
        (self.session_file.parent / "99-000000Z-session.md").write_text("# Session\n", encoding="utf-8")
        (self.root / "memory-bank" / "activeContext.md").write_text("# touched\n\n- Updated: 2026-10-18\n", encoding="utf-8")
        result = self.hook("Stop", self.root)
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_stop_without_a_start_marker_does_not_judge(self) -> None:
        self.age(self.session_file)
        result = self.hook("Stop", self.root, session="never-started")
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))


if __name__ == "__main__":
    unittest.main()
