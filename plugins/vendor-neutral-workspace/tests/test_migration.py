"""v1 → v2 migration against the committed fixture tests/fixtures/v1-workspace.

The fixture was generated once by the v1.1.0 init script (commit 134ec81) and then
given extra decisions, a task, a session, a summary, a hand-off, a skills file and
an inbox message, so every converter has something to chew on.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = PLUGIN_ROOT / "skills" / "vendor-neutral-workspace" / "scripts"
FIXTURE = PLUGIN_ROOT / "tests" / "fixtures" / "v1-workspace"
EXPECTED_MARKERS = 7  # projectbrief, activeContext, POLICIES, TASKS, AGENTS.md, three converted ADRs minus the vendor-neutral one = 3 -> total 8; keep >= 7


def run(script: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(SCRIPTS / script), *args], capture_output=True, text=True)


def files_under(root: Path) -> set[str]:
    return {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}


class Migration(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / "ws"
        shutil.copytree(FIXTURE, self.root)
        # Junk and duplicate placeholders as found in real v1 trees.
        (self.root / "agents" / "main" / "sessions" / ".DS_Store").write_bytes(b"\x00")
        (self.root / "summaries" / "monthly").mkdir(parents=True, exist_ok=True)
        (self.root / "summaries" / "monthly" / ".gitkeep").write_text("", encoding="utf-8")
        (self.root / "agents" / "main" / "summaries" / "monthly" / ".gitkeep").write_text("", encoding="utf-8")
        self.v1_files = files_under(self.root)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_validator_detects_v1_and_points_at_the_migration(self) -> None:
        out = run("validate_workspace.py", "--root", str(self.root)).stdout
        self.assertIn("ERROR v1 layout detected (project/ and agents/): run scripts/migrate_v1.py", out)

    def test_preview_changes_nothing(self) -> None:
        result = run("migrate_v1.py", "--root", str(self.root))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("PREVIEW", result.stdout)
        self.assertEqual(files_under(self.root), self.v1_files)

    def test_apply_migrates_to_a_valid_v2_workspace_with_a_complete_manifest(self) -> None:
        result = run("migrate_v1.py", "--root", str(self.root), "--apply")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

        manifest_path = self.root / "archive" / "v1" / "MIGRATION-MANIFEST.md"
        self.assertTrue(manifest_path.is_file())
        manifest = manifest_path.read_text(encoding="utf-8")
        rows = re.findall(r"^\| (?P<src>[^|]+?) \| (?P<action>[^|]+?) \| (?P<dst>[^|]+?) \|$", manifest, re.MULTILINE)
        rows = [r for r in rows if r[0] not in ("v1 path", "---")]

        # Every v1 file appears in the manifest (the DEC blocks appear as path#DEC-NNNN rows).
        sources = {src.split("#", 1)[0] for src, _, _ in rows}
        missing = sorted(self.v1_files - sources - {"summaries/monthly/.gitkeep"})  # the root placeholder stays in place
        self.assertEqual(missing, [], f"v1 files absent from the manifest: {missing}")

        # Every v2 target exists; dropped junk has no target.
        absent = sorted(dst for _, _, dst in rows if dst != "(none)" and not (self.root / dst).exists())
        self.assertEqual(absent, [], f"manifest targets that do not exist: {absent}")
        self.assertIn("| agents/main/sessions/.DS_Store | dropped (Finder metadata) | (none) |", manifest)
        self.assertIn("| agents/main/summaries/monthly/.gitkeep | dropped (placeholder; directory exists) | (none) |", manifest)
        self.assertFalse(list((self.root / "sessions").rglob(".DS_Store")))

        # Markers where judgement is needed, and the v1 tree gone.
        markers = sum(
            p.read_text(encoding="utf-8").count("<!-- MIGRATION:")
            for p in self.root.rglob("*.md") if "archive/v1" not in p.as_posix()
        )
        self.assertGreaterEqual(markers, EXPECTED_MARKERS)
        self.assertFalse((self.root / "project").exists())
        self.assertFalse((self.root / "agents").exists())
        self.assertTrue((self.root / "archive" / "v1" / "AGENTS.md").is_file())
        self.assertTrue((self.root / "archive" / "v1" / "agents" / "main" / "WARM_ME_UP.md").is_file())

        # Decision records: the vendor-neutral DEC became the template's 0001; the others 0003+.
        decisions = self.root / "docs" / "decisions"
        names = sorted(p.name for p in decisions.glob("[0-9]*.md"))
        self.assertEqual(names[:2], ["0001-use-a-vendor-neutral-workspace.md", "0002-task-backend.md"])
        postgres = next(p for p in decisions.glob("*keep-postgresql*"))
        sqlite = next(p for p in decisions.glob("*use-sqlite*"))
        postgres_text, sqlite_text = postgres.read_text(encoding="utf-8"), sqlite.read_text(encoding="utf-8")
        self.assertIn('status: "accepted"', postgres_text)
        self.assertRegex(sqlite_text, r'status: "superseded by ADR-\d{4}"')
        # The whole v1 decision text is carried, not just its first line; makers are not duplicated;
        # a long title is cut between words; provenance keeps the v1 id.
        self.assertIn("pgbouncer", postgres_text)
        self.assertIn("decision-makers: main\n", sqlite_text)
        self.assertEqual(sqlite.name[5:], "use-sqlite-for-the-pilot-while-the-team-is-a-single.md")
        self.assertIn("Migrated from v1 `DEC-0003`", sqlite_text)
        index = (decisions / "README.md").read_text(encoding="utf-8")
        self.assertIn(postgres.name, index)
        self.assertIn(sqlite.name, index)

        # Records that keep their shape moved to the root; tasks merged.
        self.assertTrue(list((self.root / "sessions").rglob("30-120000Z-session.md")))
        self.assertTrue((self.root / "summaries" / "monthly" / "2026-09.md").is_file())
        tasks = (self.root / "TASKS.md").read_text(encoding="utf-8")
        self.assertIn("FIX-0002", tasks)
        self.assertIn("Agent queue (migrated", tasks)

        # Completed tasks left under Active are under Completed; every task has an Approval-packet line;
        # v1 ids and agent-relative paths are repointed in the live file.
        self.assertLess(tasks.index("### FIX-0002"), tasks.index("## Completed"))
        self.assertLess(tasks.index("## Completed"), tasks.index("### FIX-0001"))
        self.assertLess(tasks.index("### FIX-0001"), tasks.index("## Agent queue"))
        self.assertIn("- Approval: not-required\n- Approval-packet: none\n", tasks)
        self.assertIn("- Approval: owner said yes in chat\n- Approval-packet: unknown\n", tasks)
        self.assertIn("- Approval-packet: approvals/APPROVAL-FIX-0002-store-swap.md\n", tasks)
        self.assertIn("- Evidence: sessions/2026/09/30-120000Z-session.md", tasks)
        self.assertNotIn("agents/main/", tasks.split("## Agent queue")[0])
        self.assertRegex(tasks, r"see ADR-\d{4}\.")
        self.assertNotIn("DEC-0003", tasks)
        self.assertIn("- Evidence: docs/decisions/\n", tasks)

        # The agent block carries the v1 profile; the merged state has one Updated header.
        agents_md = (self.root / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("- Created: 2026-10-18 (v1 workspace); migrated to v2 on ", agents_md)
        self.assertIn("- Name: Main\n- Role: Coordinator\n", agents_md)
        active = (self.root / "memory-bank" / "activeContext.md").read_text(encoding="utf-8")
        self.assertEqual(active.count("- Updated:"), 1)

        # Approval packets that v1 kept under decisions/ are in approvals/, references follow, v1 dir gone.
        self.assertTrue((self.root / "approvals" / "APPROVAL-FIX-0002-store-swap.md").is_file())
        self.assertIn("approvals/APPROVAL-FIX-0002-store-swap.md", tasks)
        self.assertNotIn("decisions/APPROVAL-", tasks)
        self.assertFalse((self.root / "decisions").exists())

        # The v2 validator accepts the result, warning only about the markers left for the agent.
        validated = run("validate_workspace.py", "--root", str(self.root))
        self.assertEqual(validated.returncode, 0, validated.stdout)
        self.assertIn("errors=0", validated.stdout)
        self.assertIn("WARN  migration marker remains:", validated.stdout)

    def test_validator_names_a_pre_v1_agent_os_layout(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "company").mkdir()
            (root / "company" / "ABOUT.md").write_text("# Company\n", encoding="utf-8")
            (root / "agents" / "chief").mkdir(parents=True)
            out = run("validate_workspace.py", "--root", str(root)).stdout
            self.assertIn("ERROR pre-v1 Agent OS layout detected (company/ and agents/)", out)

    def test_apply_twice_is_refused_because_the_layout_is_no_longer_v1(self) -> None:
        self.assertEqual(run("migrate_v1.py", "--root", str(self.root), "--apply").returncode, 0)
        second = run("migrate_v1.py", "--root", str(self.root), "--apply")
        self.assertEqual(second.returncode, 2)
        self.assertIn("no v1 layout", second.stderr)


if __name__ == "__main__":
    unittest.main()
