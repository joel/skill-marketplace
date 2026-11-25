"""Deterministic plan-contract tests for validate_plan.py, not live Claude or GitHub workflow tests."""
from __future__ import annotations

import hashlib
import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "skills" / "plan-maker" / "scripts" / "validate_plan.py"
SPEC = importlib.util.spec_from_file_location("plan_validator", SCRIPT)
assert SPEC and SPEC.loader
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)

SHA = "0123456789abcdef0123456789abcdef01234567"
REVIEW_LOG = (
    "Level: 2 (standard); chosen by developer\n"
    "Level proposals: None\n"
    "Rounds: 1 of 3; outcome: clean at round 1\n"
    "Reviewers: plan-maker:plan-reviewer (opus, high), EXEC + REGRESSION\n\n"
    "| Round | Lens | ID | Severity | Finding | Disposition | Section |\n"
    "|---|---|---|---|---|---|---|\n"
    "| 1 | EXEC, REGRESSION | - | - | clean | - | - |\n\n"
    "Accepted limitations: None\nOpen disagreements: None\nPrior revisions: None"
)


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.plan = (
            "# Plan for #123: Make the scoped change\n\n> A synthetic test fixture, not a real issue.\n\n"
            "Plan ID: plan-maker-test\nRevision: 1\nReadiness: ready\nLevel: 2\n"
            "Repository: acme/widgets\nBaseline: synthetic fixture\n"
            "Source: synthetic requirements\nAssignee decision: unassigned\n"
            "Milestone decision: none\n\n"
            "Publication approval is not implementation approval.\n"
            "Execution: /plan-implementation #123 on explicit request only.\n\n"
        ) + "\n\n".join(
            f"## {h}\n\n{REVIEW_LOG if h == 'Review log' else 'Explicit test fixture content.'}"
            for h in validator.REQUIRED_SECTIONS
        ) + "\n"
        self.url = f"https://github.com/acme/widgets/blob/{SHA}/docs/plans/123-scoped-change.md"
        self.write()

    def write(self, issue_replace=None):
        self.root.joinpath("plan.md").write_text(self.plan, encoding="utf-8")
        digest = hashlib.sha256(self.plan.encode()).hexdigest()
        self.issue = (
            "# Make the scoped change\n\n## Why\n\nSynthetic.\n\n## Plan\n\n"
            "Plan plan-maker-test, revision 1, level 2. Publication verified; implementation not authorized.\n"
            f"Complete plan: {self.url}; SHA-256 {digest}.\n"
            "Plan pull request: #124.\n"
            "Implementation, on explicit request only: /plan-implementation #123.\n"
        )
        if issue_replace:
            self.issue = issue_replace(self.issue)
        self.root.joinpath("issue.md").write_text(self.issue, encoding="utf-8")

    def errors(self, published=True):
        return validator.validate_bundle(self.root, published)

    def assert_error(self, phrase, published=True):
        found = self.errors(published)
        self.assertTrue(any(phrase in item for item in found), found)

    def test_valid_published_plan(self):
        self.assertEqual([], self.errors())

    def test_command_line_pass_and_fail(self):
        ok = subprocess.run([sys.executable, str(SCRIPT), str(self.root), "--published"], capture_output=True, text=True)
        self.assertEqual(0, ok.returncode, ok.stderr)
        self.root.joinpath("plan.md").write_text("# nope\n", encoding="utf-8")
        bad = subprocess.run([sys.executable, str(SCRIPT), str(self.root)], capture_output=True, text=True)
        self.assertEqual(1, bad.returncode)
        self.assertIn("ERROR:", bad.stderr)

    def test_missing_plan(self):
        self.root.joinpath("plan.md").unlink()
        self.assert_error("cannot read")

    def test_non_utf8(self):
        self.root.joinpath("plan.md").write_bytes(b"\xff")
        self.assert_error("UTF-8")

    def test_draft_needs_no_issue_body(self):
        self.root.joinpath("issue.md").unlink()
        self.assertEqual([], self.errors(published=False))
        self.assert_error("required with --published")

    def test_pending_block_passes_only_in_draft(self):
        self.write(lambda t: t.split("## Plan")[0] + "## Plan\n\nPlan publication pending (run r1).\n")
        self.assertEqual([], self.errors(published=False))
        self.assert_error("publication pending")

    def test_missing_plan_block(self):
        self.write(lambda t: t.split("## Plan")[0])
        self.assert_error("'## Plan' block", published=False)

    def test_hash_detects_modified_plan(self):
        with self.root.joinpath("plan.md").open("a") as stream:
            stream.write("\nChanged after the commit.\n")
        self.assert_error("SHA-256")

    def test_mismatched_revision(self):
        self.write(lambda t: t.replace("revision 1,", "revision 2,"))
        self.assert_error("must match")

    def test_branch_link_is_not_a_permalink(self):
        self.url = "https://github.com/acme/widgets/blob/main/docs/plans/123-scoped-change.md"
        self.write()
        self.assert_error("40-character commit sha")

    def test_link_to_another_repository(self):
        self.url = self.url.replace("acme/widgets", "acme/other")
        self.write()
        self.assert_error("not the plan's repository")

    def test_link_with_query(self):
        self.url += "?token=secret"
        self.write()
        self.assert_error("no credentials or query")

    def test_missing_pull_request_line(self):
        self.write(lambda t: t.replace("Plan pull request: #124.\n", ""))
        self.assert_error("Plan pull request")

    def test_issue_handoff_must_match_number(self):
        self.write(lambda t: t.replace("/plan-implementation #123", "/plan-implementation #999"))
        self.assert_error("/plan-implementation #123")

    def test_header_needs_issue_number(self):
        self.plan = self.plan.replace("# Plan for #123:", "# Plan for issue:")
        self.write()
        self.assert_error("real issue number")

    def test_unresolved_slot(self):
        self.plan += "\n{{ISSUE_NUMBER}}\n"
        self.write()
        self.assert_error("template slot")

    def test_missing_handoff(self):
        self.plan = self.plan.replace("/plan-implementation", "/implement")
        self.write()
        self.assert_error("handoff")

    def test_missing_approval_boundary(self):
        self.plan = self.plan.replace("Publication approval is not implementation approval.", "")
        self.write()
        self.assert_error("boundary")

    def test_empty_required_section(self):
        self.plan = self.plan.replace("## Verification\n\nExplicit test fixture content.", "## Verification\n")
        self.write()
        self.assert_error("Verification")

    def test_code_fence_heading_is_not_a_section(self):
        self.plan = self.plan.replace("## Verification", "## Other")
        self.plan += "\n```markdown\n## Verification\nNot a real section.\n```\n"
        self.write()
        self.assert_error("Verification")

    def test_duplicate_metadata(self):
        self.plan = self.plan.replace("Revision: 1", "Revision: 1\nRevision: 1")
        self.write()
        self.assert_error("one nonempty")

    def test_optional_bom(self):
        self.root.joinpath("issue.md").write_text("\ufeff" + self.issue, encoding="utf-8")
        self.assertEqual([], self.errors())

    def test_blocked_plan_can_be_published(self):
        self.plan = self.plan.replace("Readiness: ready", "Readiness: blocked")
        self.write()
        self.assertEqual([], self.errors())

    def test_invalid_readiness(self):
        self.plan = self.plan.replace("Readiness: ready", "Readiness: unknown")
        self.write()
        self.assert_error("Readiness")

    def test_level_must_be_1_to_3(self):
        self.plan = self.plan.replace("Level: 2\n", "Level: 4\n")
        self.write()
        self.assert_error("Level must be")

    def test_review_log_requires_rounds_line(self):
        self.plan = self.plan.replace("Rounds: 1 of 3; outcome: clean at round 1\n", "")
        self.write()
        self.assert_error("Rounds: N of M")

    def test_review_log_requires_round_row(self):
        self.plan = self.plan.replace("| 1 | EXEC, REGRESSION | - | - | clean | - | - |\n", "")
        self.write()
        self.assert_error("round 1 row")

    def heavy(self, outcome="| ID | Input | Existing state | Expected result |\n|---|---|---|---|\n| AC1 | a | b | c |",
              failure="| Step | What fails | What the system does | State left behind |\n|---|---|---|---|\n| 2 | x | y | z |"):
        self.plan = self.plan.replace("Level: 2\n", "Level: 3\n")
        if outcome is not None:
            self.plan = self.plan.replace(
                "## Acceptance criteria\n\nExplicit test fixture content.",
                f"## Acceptance criteria\n\nExplicit test fixture content.\n\n### Outcome table\n\n{outcome}",
            )
        if failure is not None:
            self.plan = self.plan.replace(
                "## Risks and stop conditions\n\nExplicit test fixture content.",
                f"## Risks and stop conditions\n\nExplicit test fixture content.\n\n### Failure at each step\n\n{failure}",
            )
        self.write(lambda t: t.replace("level 2.", "level 3."))

    def test_level_3_with_both_tables(self):
        self.heavy()
        self.assertEqual([], self.errors())

    def test_level_3_accepts_na_with_reason(self):
        self.heavy(outcome="N/A: no user-visible inputs")
        self.assertEqual([], self.errors())

    def test_level_3_without_outcome_table(self):
        self.heavy(outcome=None)
        self.assert_error("Outcome table")

    def test_level_3_with_empty_failure_table(self):
        self.heavy(failure="| Step | What fails | What the system does | State left behind |\n|---|---|---|---|")
        self.assert_error("Failure at each step")

    def test_level_3_rejects_blank_row(self):
        self.heavy(outcome="| ID | Input | Existing state | Expected result |\n|---|---|---|---|\n| | | | |")
        self.assert_error("Outcome table")

    def test_level_3_rejects_wrong_columns(self):
        self.heavy(failure="| A | B | C | D |\n|---|---|---|---|\n| 1 | x | y | z |")
        self.assert_error("Failure at each step")

    def test_level_3_ignores_fenced_example_table(self):
        self.heavy(outcome=None)
        self.plan = self.plan.replace(
            "## Acceptance criteria\n\nExplicit test fixture content.",
            "## Acceptance criteria\n\nExplicit test fixture content.\n\n```markdown\n### Outcome table\n\n"
            "| ID | Input | Existing state | Expected result |\n|---|---|---|---|\n| AC1 | a | b | c |\n```",
        )
        self.write(lambda t: t.replace("level 2.", "level 3."))
        self.assert_error("Outcome table")

    def test_level_2_needs_no_tables(self):
        self.assertEqual([], self.errors())

    def test_rounds_past_cap_with_developer_approval(self):
        self.plan = self.plan.replace("Rounds: 1 of 3;", "Rounds: 4 of 3 (+1 approved by developer);")
        self.write()
        self.assertEqual([], self.errors())

    def test_rounds_past_cap_without_approval(self):
        self.plan = self.plan.replace("Rounds: 1 of 3;", "Rounds: 4 of 3;")
        self.write()
        self.assert_error("approved by developer")


if __name__ == "__main__":
    unittest.main()
