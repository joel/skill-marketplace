"""The task backend: workspace.yaml, the Markdown default, the task-backend ADR, and the
validator's cross-checks between workspace.yaml and the files on disk.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = PLUGIN_ROOT / "skills" / "vendor-neutral-workspace" / "scripts"


def run(script: str, *args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(SCRIPTS / script), *args], capture_output=True, text=True, env=env)


class MarkdownBackend(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / "workspace"
        created = run("init_workspace.py", "--root", str(self.root), "--project", "Tasks", "--apply")
        self.assertEqual(created.returncode, 0, created.stderr)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def validate(self) -> str:
        return run("validate_workspace.py", "--root", str(self.root)).stdout

    def test_fresh_init_declares_and_renders_the_markdown_backend(self) -> None:
        config = (self.root / "workspace.yaml").read_text(encoding="utf-8")
        for line in ("schema: 2", "agent: main", "tasks: markdown", "hooks: on"):
            self.assertIn(line, config)
        self.assertTrue((self.root / "TASKS.md").is_file())

        adr = (self.root / "docs" / "decisions" / "0002-task-backend.md").read_text(encoding="utf-8")
        self.assertIn('Chosen option: "Markdown task file in the repository"', adr)
        self.assertNotIn("{{", adr)
        self.assertIn("ADR-0002", (self.root / "docs" / "decisions" / "README.md").read_text(encoding="utf-8"))

        agents = (self.root / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("## Tasks\n\nTasks live in `TASKS.md`", agents)
        self.assertIn("errors=0", self.validate())

    def test_validator_rejects_beads_directory_in_a_markdown_workspace(self) -> None:
        (self.root / ".beads").mkdir()
        self.assertIn("ERROR workspace.yaml says tasks: markdown but .beads/ exists", self.validate())

    def test_validator_requires_tasks_md_for_the_markdown_backend(self) -> None:
        (self.root / "TASKS.md").unlink()
        self.assertIn("ERROR missing required file: TASKS.md (tasks: markdown)", self.validate())

    def test_validator_rejects_agent_mismatch(self) -> None:
        config = self.root / "workspace.yaml"
        config.write_text(config.read_text(encoding="utf-8").replace("agent: main", "agent: other"), encoding="utf-8")
        self.assertIn("ERROR workspace.yaml agent 'other' differs from AGENTS.md Stable ID 'main'", self.validate())

    def test_validator_rejects_unknown_backend(self) -> None:
        config = self.root / "workspace.yaml"
        config.write_text(config.read_text(encoding="utf-8").replace("tasks: markdown", "tasks: jira"), encoding="utf-8")
        self.assertIn("ERROR workspace.yaml: tasks must be one of markdown, beads (got jira)", self.validate())


class BeadsWithoutBd(unittest.TestCase):
    def test_beads_flag_without_bd_on_path_exits_and_creates_nothing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "workspace"
            env = {**os.environ, "PATH": "/nonexistent"}  # sys.executable is absolute, bd is not found
            result = run("init_workspace.py", "--root", str(root), "--project", "Beads", "--tasks", "beads", "--apply", env=env)
            self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
            self.assertIn("needs `bd` on PATH", result.stderr)
            self.assertFalse(root.exists())


if __name__ == "__main__":
    unittest.main()
