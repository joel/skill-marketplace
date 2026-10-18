#!/usr/bin/env python3
"""Validate the structural invariants of a project agent workspace."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT_FILES = (
    "AGENTS.md",
    "README.md",
    "project/ABOUT.md",
    "project/POLICIES.md",
    "project/STATE.md",
    "project/TASKS.md",
    "project/DECISIONS.md",
    "agents/REGISTRY.md",
)

AGENT_FILES = (
    "ABOUT.md",
    "WARM_ME_UP.md",
    "POLICIES.md",
    "STATE.md",
    "TASKS.md",
    "DECISIONS.md",
)

AGENT_DIRS = (
    "inbox",
    "outbox",
    "artifacts",
    "handoffs",
    "sessions",
    "summaries/weekly",
    "summaries/monthly",
    "summaries/yearly",
    "archive",
    ".skills",
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    args = parser.parse_args()
    root = args.root.expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []

    for relative in ROOT_FILES:
        path = root / relative
        if not path.is_file():
            errors.append(f"missing required file: {relative}")

    agents_root = root / "agents"
    agent_dirs = []
    if agents_root.is_dir():
        agent_dirs = sorted(
            path for path in agents_root.iterdir()
            if path.is_dir() and not path.name.startswith(".")
        )
    if not agent_dirs:
        errors.append("no agent directory found under agents/")

    for agent in agent_dirs:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", agent.name):
            warnings.append(f"non-portable agent directory name: agents/{agent.name}")
        for relative in AGENT_FILES:
            if not (agent / relative).is_file():
                errors.append(f"missing agent file: agents/{agent.name}/{relative}")
        for relative in AGENT_DIRS:
            if not (agent / relative).is_dir():
                errors.append(f"missing agent directory: agents/{agent.name}/{relative}")
        sessions = list((agent / "sessions").glob("[0-9][0-9][0-9][0-9]/[0-9][0-9]/*-session.md")) if (agent / "sessions").is_dir() else []
        if not sessions:
            warnings.append(f"no session records found: agents/{agent.name}/sessions")

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
    print(f"summary: errors={len(errors)} warnings={len(warnings)} agents={len(agent_dirs)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
