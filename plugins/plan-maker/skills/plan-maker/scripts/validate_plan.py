#!/usr/bin/env python3
"""Check one plan-maker plan, and the issue body that points at it, offline.

No network calls or file writes.

Usage: python3 validate_plan.py /path/to/bundle [--published]
The directory holds plan.md (the bytes committed at the plan's commit) and,
once published, issue.md (the issue body read back from GitHub). Python 3.10+;
standard library only. This is a plan-maker contract checker, not proof of
approval, semantics or GitHub access.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

REQUIRED_SECTIONS = (
    "Objective and scope",
    "Evidence and current behaviour",
    "Decisions and constraints",
    "Dependencies and blockers",
    "Implementation steps",
    "Files and interfaces",
    "Acceptance criteria",
    "Verification",
    "Rollout and rollback",
    "Risks and stop conditions",
    "Review log",
    "Execution handoff",
)
HEADER = re.compile(r"^# Plan for #([1-9][0-9]*): .+$")
# Level 3 plans carry these two tables, each under its H2 section.
HEAVY_TABLES = (
    ("Acceptance criteria", "Outcome table", ("ID", "Input", "Existing state", "Expected result")),
    ("Risks and stop conditions", "Failure at each step",
     ("Step", "What fails", "What the system does", "State left behind")),
)
ROUNDS = re.compile(
    r"^Rounds: ([1-9][0-9]*) of ([1-9][0-9]*)(?: \(\+([1-9][0-9]*) approved by developer\))?(?:;.*)?$",
    re.MULTILINE,
)
# Reserved all-caps template slots, not legitimate source examples like {{name}}.
PLACEHOLDER = re.compile(r"\{\{[A-Z][A-Z0-9_]*\}\}")


def metadata(text: str, label: str, errors: list[str], source: str) -> str:
    """Require a single preamble value, not an incidental mention in a code block."""
    preamble = re.split(r"^## ", text, maxsplit=1, flags=re.MULTILINE)[0]
    matches = re.findall(rf"^{re.escape(label)}: (.+)$", preamble, re.MULTILINE)
    if len(matches) != 1 or not matches[0].strip():
        errors.append(f"{source}: expected one nonempty '{label}:' preamble field")
        return ""
    return matches[0].strip()


def sections(text: str) -> dict[str, list[str]]:
    """Collect H2 section bodies, ignoring fenced example headings."""
    result: dict[str, list[str]] = {}
    current = None
    fence = None
    for line in text.splitlines():
        stripped = line.lstrip()
        marker = re.match(r"^(`{3,}|~{3,})", stripped)
        if marker:
            char = marker.group(1)[0]
            if fence is None:
                fence = (char, len(marker.group(1)))
            elif char == fence[0] and len(marker.group(1)) >= fence[1]:
                fence = None
            if current is not None:
                result[current].append(line)
            continue
        if fence is None and line.startswith("## "):
            current = line[3:].strip()
            result.setdefault(current, [])
        elif current is not None:
            result[current].append(line)
    return result


def subsection(lines: list[str], title: str) -> list[str] | None:
    """Return the body of one H3 inside an H2 body, or None when it is absent.

    Fenced lines are skipped: an example heading or table inside a code fence
    is not the plan's own table.
    """
    body: list[str] | None = None
    fence = None
    for line in lines:
        marker = re.match(r"^(`{3,}|~{3,})", line.lstrip())
        if marker:
            char = marker.group(1)[0]
            if fence is None:
                fence = (char, len(marker.group(1)))
            elif char == fence[0] and len(marker.group(1)) >= fence[1]:
                fence = None
            continue
        if fence is not None:
            continue
        if line.startswith("### ") or line.startswith("## "):
            if body is not None:
                break
            if line[4:].strip() == title:
                body = []
        elif body is not None:
            body.append(line)
    return body


def cells(row: str) -> list[str]:
    return [cell.strip() for cell in row.strip().strip("|").split("|")]


def filled_table(body: list[str], columns: tuple[str, ...]) -> bool:
    """The expected header, a separator and one row with every cell filled, or N/A with a reason."""
    if any(re.match(r"^N/A: \S", line.strip()) for line in body):
        return True
    rows = [line for line in body if line.strip().startswith("|")]
    if len(rows) < 3 or tuple(cells(rows[0])) != columns:
        return False
    if not all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells(rows[1])):
        return False
    return any(len(cells(row)) == len(columns) and all(cells(row)) for row in rows[2:])


PERMALINK = re.compile(
    r"^https://github\.com/(?P<repo>[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/blob/(?P<sha>[0-9a-f]{40})/(?P<path>\S+\.md)$"
)
POINTER = re.compile(r"^Plan (\S+), revision ([1-9][0-9]*), level ([123])\. Publication verified; implementation not authorized\.$", re.MULTILINE)
COMPLETE = re.compile(r"^Complete plan: (\S+); SHA-256 ([0-9a-f]{64})\.$", re.MULTILINE)


def check_permalink(url: str, repository: str, errors: list[str]) -> None:
    """A credential-free permalink pinned to a full commit SHA, in the plan's repository."""
    try:
        parsed = urlsplit(url)
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            errors.append(f"issue.md: the plan link must be a plain permalink, no credentials or query: {url}")
            return
    except ValueError as exc:
        errors.append(f"issue.md: malformed URL ({exc})")
        return
    match = PERMALINK.fullmatch(url)
    if not match:
        errors.append(
            "issue.md: the plan link must be https://github.com/<owner>/<repo>/blob/<40-character commit sha>/<path>.md"
        )
        return
    if re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository) and match.group("repo").lower() != repository.lower():
        errors.append(f"issue.md: the plan link points at {match.group('repo')}, not the plan's repository {repository}")


def validate_bundle(directory: Path, published: bool = False) -> list[str]:
    errors: list[str] = []
    try:
        raw = (directory / "plan.md").read_bytes()
        plan = raw.decode("utf-8-sig")
    except (OSError, UnicodeError) as exc:
        return [f"plan.md: cannot read UTF-8 artifact ({exc})"]
    issue_text = None
    try:
        issue_text = (directory / "issue.md").read_bytes().decode("utf-8-sig")
    except FileNotFoundError:
        if published:
            errors.append("issue.md: the issue body read back from GitHub is required with --published")
    except (OSError, UnicodeError) as exc:
        errors.append(f"issue.md: cannot read UTF-8 artifact ({exc})")

    lines = plan.splitlines()
    match = HEADER.fullmatch(lines[0]) if lines else None
    if not match:
        errors.append("plan.md: first line must be '# Plan for #123: Title' with a real issue number")
    number = match.group(1) if match else ""
    if not any(line.startswith("> ") and line[2:].strip() for line in lines[1:]):
        errors.append("plan.md: a nonempty summary blockquote is required")
    if PLACEHOLDER.search(plan):
        errors.append("plan.md: unresolved all-caps template slot")
    plan_id = metadata(plan, "Plan ID", errors, "plan.md")
    revision = metadata(plan, "Revision", errors, "plan.md")
    if not re.fullmatch(r"[1-9][0-9]*", revision):
        errors.append("plan.md: Revision must be a positive integer")
    if number and f"/plan-implementation #{number}" not in plan:
        errors.append(f"plan.md: missing /plan-implementation #{number} handoff")
    if "publication approval is not implementation approval" not in plan.lower():
        errors.append("plan.md: missing explicit publication/implementation boundary")
    repository = ""
    for label in ("Repository", "Baseline", "Source", "Assignee decision", "Milestone decision"):
        value = metadata(plan, label, errors, "plan.md")
        if label == "Repository":
            repository = value
    readiness = metadata(plan, "Readiness", errors, "plan.md")
    if readiness not in {"ready", "blocked"}:
        errors.append("plan.md: Readiness must be ready or blocked")
    level = metadata(plan, "Level", errors, "plan.md")
    if level not in {"1", "2", "3"}:
        errors.append("plan.md: Level must be 1, 2 or 3")
    bodies = sections(plan)
    if level == "3":
        for parent, title, columns in HEAVY_TABLES:
            body = subsection(bodies.get(parent, []), title)
            if body is None or not filled_table(body, columns):
                errors.append(
                    f"plan.md: level 3 needs '### {title}' under '{parent}' with columns "
                    f"'{' | '.join(columns)}' and a filled row, or 'N/A: <reason>'"
                )
    for heading in REQUIRED_SECTIONS:
        if not any(line.strip() for line in bodies.get(heading, [])):
            errors.append(f"plan.md: missing/empty section '{heading}'")
    # A skipped review loop must not pass as a reviewed plan; a clean round still writes its row.
    review_log = "\n".join(bodies.get("Review log", []))
    rounds = ROUNDS.findall(review_log)
    if len(rounds) != 1:
        errors.append("plan.md: Review log needs one 'Rounds: N of M' line")
    else:
        run, cap, extra = (int(value or 0) for value in rounds[0])
        if run > cap + extra:
            errors.append("plan.md: rounds past the cap need '(+K approved by developer)'")
    if not re.search(r"^\| 1 \|", review_log, re.MULTILINE):
        errors.append("plan.md: Review log needs a round 1 row")

    if issue_text is None:
        return errors
    block = "\n".join(sections(issue_text).get("Plan", []))
    if not block.strip():
        errors.append("issue.md: the issue body needs a nonempty '## Plan' block")
        return errors
    if not published:
        return errors
    if "publication pending" in block.lower():
        errors.append("issue.md: the Plan block still says publication pending")
    pointer = POINTER.search(block)
    if not pointer:
        errors.append(
            "issue.md: the Plan block needs 'Plan <ID>, revision <N>, level <L>. Publication verified; "
            "implementation not authorized.'"
        )
    elif (pointer.group(1), pointer.group(2), pointer.group(3)) != (plan_id, revision, level):
        errors.append("issue.md: the Plan block's Plan ID, revision and level must match plan.md")
    complete = COMPLETE.search(block)
    if not complete:
        errors.append("issue.md: the Plan block needs 'Complete plan: <permalink>; SHA-256 <hash>.'")
    else:
        check_permalink(complete.group(1), repository, errors)
        if complete.group(2) != hashlib.sha256(raw).hexdigest():
            errors.append("issue.md: Plan SHA-256 does not match the exact plan.md bytes")
    if not re.search(r"^Plan pull request: #[1-9][0-9]*\.$", block, re.MULTILINE):
        errors.append("issue.md: the Plan block needs 'Plan pull request: #<number>.'")
    if number and f"/plan-implementation #{number}" not in block:
        errors.append(f"issue.md: the Plan block needs /plan-implementation #{number}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Directory containing plan.md and, once published, issue.md")
    parser.add_argument("--published", action="store_true", help="Require the issue body's verified Plan block")
    args = parser.parse_args()
    errors = validate_bundle(args.directory, args.published)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("PASS: plan-maker plan structure, identity, revision, level, heavy tables, review log, handoff"
          + (", Plan block and plan hash" if args.published else ""))
    print("NOT CHECKED: authorization, semantics, secrets, rendering, live links or GitHub publication")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
