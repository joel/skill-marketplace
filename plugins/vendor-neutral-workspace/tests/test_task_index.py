"""build_task_index.py: generates TASKS.md from tasks/*.md, flags malformed tasks and stale indexes."""

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "skills" / "vendor-neutral-workspace" / "scripts" / "build_task_index.py"


def task(tid: str, status: str = "ready", due: str = "none", extra: str = "") -> str:
    return (
        f"# {tid} — Do the thing\n\n- Status: {status}\n- Priority: normal\n- Owner: main\n- Area: home\n"
        f"- Due: {due}\n- Depends-on: none\n- Approval: not-required\n- Approval-packet: none\n- Evidence: none-yet\n{extra}"
        "\n#### Next action\n\nCall the plumber.\n"
    )


def run(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(SCRIPT), "--root", str(root), "--today", "2026-11-15", *args],
                          capture_output=True, text=True)


class TaskIndex(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "tasks").mkdir()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write(self, tid: str, body: str) -> None:
        (self.root / "tasks" / f"{tid}.md").write_text(body, encoding="utf-8")

    def test_builds_index_overdue_first_and_check_passes(self) -> None:
        self.write("T-0001", task("T-0001"))
        self.write("T-0002", task("T-0002", due="2026-11-01"))
        self.assertEqual(run(self.root).returncode, 0)
        text = (self.root / "TASKS.md").read_text(encoding="utf-8")
        active = text.split("## Active")[1].split("## Waiting")[0]
        self.assertLess(active.index("T-0002"), active.index("T-0001"))
        self.assertIn("OVERDUE", active)
        self.assertIn("Next: Call the plumber.", active)
        self.assertEqual(run(self.root, "--check").returncode, 0)

    def test_check_fails_when_stale(self) -> None:
        self.write("T-0001", task("T-0001"))
        run(self.root)
        self.write("T-0001", task("T-0001", status="waiting"))
        result = run(self.root, "--check")
        self.assertEqual(result.returncode, 1)
        self.assertIn("stale", result.stderr)

    def test_missing_field_and_bad_links_are_errors(self) -> None:
        self.write("T-0001", task("T-0001", due="soon", extra="- Facts: facts/nope.md\n").replace("- Area: home\n", ""))
        result = run(self.root)
        self.assertEqual(result.returncode, 1)
        for msg in ("missing '- Area:' line", "Due must be YYYY-MM-DD", "linked file not found: facts/nope.md"):
            self.assertIn(msg, result.stderr)

    def test_known_issue_and_completed_sections(self) -> None:
        self.write("T-0001", task("T-0001", extra="- Kind: known-issue\n"))
        self.write("T-0002", task("T-0002", status="completed"))
        run(self.root)
        text = (self.root / "TASKS.md").read_text(encoding="utf-8")
        self.assertIn("T-0001", text.split("## Known issues")[1].split("## Completed")[0])
        self.assertIn("T-0002", text.split("## Completed")[1])
        self.assertNotIn("T-0001", text.split("## Active")[1].split("## Known issues")[0])


if __name__ == "__main__":
    unittest.main()
