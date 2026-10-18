"""Every path the AGENTS.md boot section tells an agent to read must exist after init,
and the rendered workspace must contain no unresolved template variable.
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = PLUGIN_ROOT / "skills" / "vendor-neutral-workspace" / "scripts"


def boot_paths(agents_md: str) -> list[str]:
    section = re.search(r"## Before meaningful work\n(.*?)\n## ", agents_md, re.DOTALL)
    assert section, "AGENTS.md has no '## Before meaningful work' section"
    candidates = re.findall(r"`([^`\n]+)`", section.group(1))
    # Keep only path-like references; skip placeholders such as sessions/YYYY/MM/.
    return [c.rstrip("/") for c in candidates if ("/" in c or c.endswith(".md")) and "YYYY" not in c]


class BootSection(unittest.TestCase):
    def test_every_boot_path_exists_after_init(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "workspace"
            result = subprocess.run(
                [sys.executable, str(SCRIPTS / "init_workspace.py"), "--root", str(root), "--project", "Boot", "--apply"],
                capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

            paths = boot_paths((root / "AGENTS.md").read_text(encoding="utf-8"))
            self.assertGreaterEqual(len(paths), 8, paths)
            missing = [p for p in paths if not (root / p).exists()]
            self.assertEqual(missing, [], f"boot section names paths that init did not create: {missing}")

            unresolved = [
                str(p.relative_to(root))
                for p in root.rglob("*.md")
                if re.search(r"\{\{[A-Z][A-Z0-9_]*\}\}", p.read_text(encoding="utf-8"))
            ]
            self.assertEqual(unresolved, [])


if __name__ == "__main__":
    unittest.main()
