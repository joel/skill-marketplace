"""The layout `init_workspace.py` creates must equal the committed expected list,
and every path drawn in the standard's "Minimum topology" tree must be in it.

Dates and the session filename are normalised to the tokens YYYY, MM and SESSION.
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
STANDARD = SKILL_ROOT / "references" / "workspace-standard.md"
EXPECTED = PLUGIN_ROOT / "tests" / "expected_layout.txt"


def normalise(relative: str) -> str:
    relative = re.sub(r"^sessions/\d{4}/\d{2}/[^/]+-session\.md$", "sessions/YYYY/MM/SESSION", relative)
    relative = re.sub(r"^sessions/\d{4}/\d{2}$", "sessions/YYYY/MM", relative)
    relative = re.sub(r"^sessions/\d{4}$", "sessions/YYYY", relative)
    return relative


def created_paths(root: Path) -> set[str]:
    return {normalise(path.relative_to(root).as_posix()) for path in root.rglob("*")}


def expand_braces(name: str) -> list[str]:
    match = re.search(r"\{([^}]*)\}", name)
    if not match:
        return [name]
    head, tail = name[: match.start()], name[match.end() :]
    return [item for option in match.group(1).split(",") for item in expand_braces(head + option + tail)]


def with_parents(path: str) -> set[str]:
    parts = path.split("/")
    return {"/".join(parts[: index + 1]) for index in range(len(parts))}


def tree_paths(markdown: Path) -> set[str]:
    text = markdown.read_text(encoding="utf-8")
    block = re.search(r"## Minimum topology\s+```text\n(.*?)```", text, re.DOTALL)
    assert block, "standard has no fenced tree under '## Minimum topology'"
    lines = block.group(1).splitlines()
    assert lines[0].strip() == "<project-root>/", lines[0]

    paths: set[str] = set()
    stack: list[str] = []
    for line in lines[1:]:
        entry = re.search(r"(?:├── |└── )(.*)$", line)
        assert entry, f"unparsed tree line: {line!r}"
        depth = entry.start() // 4
        name = entry.group(1).split("#", 1)[0].strip()
        stack = stack[:depth]
        for expanded in expand_braces(name):
            paths |= with_parents("/".join(stack + [expanded.strip("/")]))
        stack.append(name.strip("/"))
    return paths


class Layout(unittest.TestCase):
    def setUp(self) -> None:
        self.expected = {line.strip() for line in EXPECTED.read_text(encoding="utf-8").splitlines() if line.strip()}

    def test_init_creates_exactly_the_expected_layout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "workspace"
            result = subprocess.run(
                [sys.executable, str(SKILL_ROOT / "scripts" / "init_workspace.py"),
                 "--root", str(root), "--project", "Layout", "--apply"],
                capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(created_paths(root), self.expected)

    def test_standard_tree_is_covered_by_the_expected_layout(self) -> None:
        drawn = tree_paths(STANDARD)
        self.assertTrue(drawn, "tree parsed to nothing")
        self.assertEqual(drawn - self.expected, set(), "paths drawn in the standard but never created")


if __name__ == "__main__":
    unittest.main()
