"""Decision-record checks in validate_workspace.py, and next-free-number allocation in init.

Each test initialises a workspace from the template into a temp dir, mutates
docs/decisions/, and asserts the exact ERROR / WARN line the validator prints.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = PLUGIN_ROOT / "skills" / "vendor-neutral-workspace" / "scripts"
TEMPLATE_ADR = "0001-use-a-vendor-neutral-workspace.md"


def run(script: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(SCRIPTS / script), *args], capture_output=True, text=True)


def adr(status: str = '"accepted"', front_matter: bool = True) -> str:
    head = f"---\nstatus: {status}\ndate: 2026-10-18\ndecision-makers: main\n---\n\n" if front_matter else ""
    return head + "# A decision\n\n## Context and Problem Statement\n\n## Considered Options\n\n## Decision Outcome\n"


class AdrValidation(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / "workspace"
        created = run("init_workspace.py", "--root", str(self.root), "--project", "ADR", "--apply")
        self.assertEqual(created.returncode, 0, created.stderr)
        self.decisions = self.root / "docs" / "decisions"
        self.index = self.decisions / "README.md"

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def add(self, name: str, content: str, listed: bool = True) -> None:
        (self.decisions / name).write_text(content, encoding="utf-8")
        if listed:
            with self.index.open("a", encoding="utf-8") as handle:
                handle.write(f"| ADR-{name[:4]} | [{name}]({name}) | accepted | 2026-10-18 |\n")

    def validate(self) -> str:
        result = run("validate_workspace.py", "--root", str(self.root))
        return result.stdout

    def test_fresh_init_has_no_adr_findings(self) -> None:
        out = self.validate()
        self.assertIn("errors=0", out)
        self.assertNotIn("ADR", out)
        self.assertTrue((self.decisions / TEMPLATE_ADR).is_file())
        self.assertIn("ADR-0001", self.index.read_text(encoding="utf-8"))

    def test_bad_status(self) -> None:
        self.add("0002-bad-status.md", adr(status='"maybe"'))
        self.assertIn("ERROR ADR status not in vocabulary: docs/decisions/0002-bad-status.md (maybe)", self.validate())

    def test_superseded_status_is_in_vocabulary(self) -> None:
        self.add("0002-old.md", adr(status='"superseded by ADR-0003"'))
        self.assertNotIn("ADR status", self.validate())

    def test_duplicate_number(self) -> None:
        self.add("0001-another-decision.md", adr())
        self.assertIn(
            f"ERROR duplicate ADR number 0001: 0001-another-decision.md, {TEMPLATE_ADR}",
            self.validate(),
        )

    def test_bad_filename(self) -> None:
        self.add("Use-Spaces.md", adr())
        self.assertIn("ERROR bad ADR filename: docs/decisions/Use-Spaces.md", self.validate())

    def test_missing_front_matter(self) -> None:
        self.add("0002-no-front-matter.md", adr(front_matter=False))
        self.assertIn("ERROR ADR missing front matter: docs/decisions/0002-no-front-matter.md", self.validate())

    def test_unlisted_record_is_a_warning(self) -> None:
        self.add("0002-unlisted.md", adr(), listed=False)
        out = self.validate()
        self.assertIn("WARN  ADR index drift: 0002-unlisted.md not listed in docs/decisions/README.md", out)
        self.assertIn("errors=0", out)

    def test_listed_but_missing_record_is_a_warning(self) -> None:
        with self.index.open("a", encoding="utf-8") as handle:
            handle.write("| ADR-0009 | [ghost](0009-ghost.md) | accepted | 2026-10-18 |\n")
        self.assertIn(
            "WARN  ADR index drift: docs/decisions/README.md lists 0009-ghost.md which does not exist",
            self.validate(),
        )


class AdrNumbering(unittest.TestCase):
    def test_init_takes_the_next_free_number(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "existing"
            decisions = root / "docs" / "decisions"
            decisions.mkdir(parents=True)
            (decisions / "0003-keep-postgres.md").write_text(adr(), encoding="utf-8")

            created = run("init_workspace.py", "--root", str(root), "--project", "Adopt", "--apply")
            self.assertEqual(created.returncode, 0, created.stderr)

            self.assertFalse((decisions / TEMPLATE_ADR).exists())
            self.assertTrue((decisions / "0004-use-a-vendor-neutral-workspace.md").is_file())
            index = (decisions / "README.md").read_text(encoding="utf-8")
            self.assertIn("ADR-0004", index)
            self.assertIn("0004-use-a-vendor-neutral-workspace.md", index)
            self.assertNotIn("{{", index)


if __name__ == "__main__":
    unittest.main()
