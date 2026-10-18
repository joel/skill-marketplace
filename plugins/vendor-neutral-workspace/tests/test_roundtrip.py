"""Round-trip checks for the workspace scripts.

Lives outside skills/ so it never ships into an agent's context. Run from the
repo root with `python3 -m unittest discover -s plugins/vendor-neutral-workspace/tests`
or via scripts/check.sh.
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
SKILL_ROOT = PLUGIN_ROOT / "skills" / "vendor-neutral-workspace"
SCRIPTS = SKILL_ROOT / "scripts"


def run(script: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPTS / script), *args],
        capture_output=True,
        text=True,
    )


def init(root: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return run("init_workspace.py", "--root", str(root), "--project", "Round trip", *extra)


class SkillMetadata(unittest.TestCase):
    def test_skill_name_matches_directory(self) -> None:
        frontmatter = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8").split("---", 2)[1]
        match = re.search(r"^name:\s*(\S+)\s*$", frontmatter, re.MULTILINE)
        self.assertIsNotNone(match, "SKILL.md frontmatter has no name")
        self.assertEqual(match.group(1), SKILL_ROOT.name)


class RoundTrip(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / "workspace"

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_preview_creates_nothing(self) -> None:
        result = init(self.root)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("PREVIEW", result.stdout)
        self.assertFalse(self.root.exists(), "preview must not touch the filesystem")

    def test_apply_then_validate_reports_no_errors(self) -> None:
        created = init(self.root, "--apply")
        self.assertEqual(created.returncode, 0, created.stderr)

        validated = run("validate_workspace.py", "--root", str(self.root))
        self.assertEqual(validated.returncode, 0, validated.stdout + validated.stderr)
        self.assertIn("errors=0", validated.stdout)
        self.assertNotIn("ERROR", validated.stdout)

    def test_apply_never_overwrites_existing_files(self) -> None:
        self.root.mkdir(parents=True)
        sentinel = self.root / "AGENTS.md"
        sentinel.write_text("# kept as is\n", encoding="utf-8")

        first = init(self.root, "--apply")
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "# kept as is\n")
        # The script prints resolved paths (/var → /private/var on macOS).
        self.assertIn(f"SKIP existing {sentinel.resolve()}", first.stdout)
        self.assertIn("skipped-existing=1", first.stdout)

        second = init(self.root, "--apply")
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertIn("would-create/created=0", second.stdout)


if __name__ == "__main__":
    unittest.main()
