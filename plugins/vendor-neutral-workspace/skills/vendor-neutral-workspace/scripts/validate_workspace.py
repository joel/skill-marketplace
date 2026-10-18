#!/usr/bin/env python3
"""Validate the structural invariants of a vendor-neutral workspace."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT_FILES = (
    "AGENTS.md",
    "README.md",
    "POLICIES.md",
    "ABOUT.md",
    "STATE.md",
    "TASKS.md",
    "docs/decisions/README.md",
)

ROOT_DIRS = (
    "docs/decisions",
    "approvals",
    "sessions",
    "summaries/weekly",
    "summaries/monthly",
    "summaries/yearly",
    "artifacts",
    "archive",
)

SESSION_GLOB = "[0-9][0-9][0-9][0-9]/[0-9][0-9]/*-session.md"
AGENT_ID_PATTERN = r"[a-z0-9]+(?:-[a-z0-9]+)*"

ADR_DIR = "docs/decisions"
ADR_INDEX = "README.md"
ADR_TEMPLATE = "adr-template.md"
ADR_FILENAME = re.compile(r"(?P<number>\d{4})-(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)\.md")
ADR_STATUSES = ("proposed", "rejected", "accepted", "deprecated")
ADR_SUPERSEDED = re.compile(r"superseded by ADR-\d{4}")


def check_decisions(root: Path, errors: list[str], warnings: list[str]) -> None:
    """MADR records: filename, front matter, status vocabulary, unique numbers, index."""
    directory = root / ADR_DIR
    if not directory.is_dir():
        return
    index_path = directory / ADR_INDEX
    index = index_path.read_text(encoding="utf-8", errors="replace") if index_path.is_file() else ""
    by_number: dict[str, list[str]] = {}

    for path in sorted(directory.glob("*.md")):
        if path.name in (ADR_INDEX, ADR_TEMPLATE):
            continue
        relative = f"{ADR_DIR}/{path.name}"
        match = ADR_FILENAME.fullmatch(path.name)
        if not match:
            errors.append(f"bad ADR filename: {relative}")
            continue
        by_number.setdefault(match.group("number"), []).append(path.name)

        content = path.read_text(encoding="utf-8", errors="replace")
        front_matter = re.match(r"\A---\n(.*?)\n---\n", content, re.DOTALL)
        if not front_matter:
            errors.append(f"ADR missing front matter: {relative}")
        else:
            status = re.search(r"^status:\s*\"?([^\"\n]*?)\"?\s*$", front_matter.group(1), re.MULTILINE)
            if not status:
                errors.append(f"ADR status missing: {relative}")
            elif status.group(1) not in ADR_STATUSES and not ADR_SUPERSEDED.fullmatch(status.group(1)):
                errors.append(f"ADR status not in vocabulary: {relative} ({status.group(1)})")

        if index and path.name not in index:
            warnings.append(f"ADR index drift: {path.name} not listed in {ADR_DIR}/{ADR_INDEX}")

    for number, names in sorted(by_number.items()):
        if len(names) > 1:
            errors.append(f"duplicate ADR number {number}: {', '.join(names)}")

    for listed in sorted(set(re.findall(r"\d{4}-[a-z0-9-]+\.md", index))):
        if not (directory / listed).is_file():
            warnings.append(f"ADR index drift: {ADR_DIR}/{ADR_INDEX} lists {listed} which does not exist")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    args = parser.parse_args()
    root = args.root.expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []

    for relative in ROOT_FILES:
        if not (root / relative).is_file():
            errors.append(f"missing required file: {relative}")

    for relative in ROOT_DIRS:
        if not (root / relative).is_dir():
            errors.append(f"missing required directory: {relative}")

    agents_file = root / "AGENTS.md"
    if agents_file.is_file():
        content = agents_file.read_text(encoding="utf-8", errors="replace")
        match = re.search(r"^- Stable ID:\s*(\S+)\s*$", content, re.MULTILINE)
        if "## Agent" not in content or not match:
            errors.append("AGENTS.md lacks an '## Agent' block with a 'Stable ID' line")
        elif not re.fullmatch(AGENT_ID_PATTERN, match.group(1)):
            warnings.append(f"non-portable agent id in AGENTS.md: {match.group(1)}")

    check_decisions(root, errors, warnings)

    sessions_root = root / "sessions"
    if sessions_root.is_dir() and not list(sessions_root.glob(SESSION_GLOB)):
        warnings.append("no session records found: sessions/")

    for markdown in root.rglob("*.md") if root.exists() else []:
        try:
            content = markdown.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            warnings.append(f"non-UTF-8 Markdown file: {markdown.relative_to(root)}")
            continue
        if re.search(r"\{\{[A-Z][A-Z0-9_]*\}\}", content):
            errors.append(f"unresolved template variable: {markdown.relative_to(root)}")

    for item in errors:
        print(f"ERROR {item}")
    for item in warnings:
        print(f"WARN  {item}")
    print(f"summary: errors={len(errors)} warnings={len(warnings)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
