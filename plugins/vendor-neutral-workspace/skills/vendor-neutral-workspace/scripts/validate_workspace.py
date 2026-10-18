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
    "DECISIONS.md",
)

ROOT_DIRS = (
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
