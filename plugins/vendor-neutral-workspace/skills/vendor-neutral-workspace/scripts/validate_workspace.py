#!/usr/bin/env python3
"""Validate the structural invariants of a vendor-neutral workspace."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


MEMORY_BANK_FILES = (
    "memory-bank/projectbrief.md",
    "memory-bank/productContext.md",
    "memory-bank/systemPatterns.md",
    "memory-bank/techContext.md",
    "memory-bank/activeContext.md",
    "memory-bank/progress.md",
)

ROOT_FILES = (
    "AGENTS.md",
    "README.md",
    "POLICIES.md",
    "workspace.yaml",
    *MEMORY_BANK_FILES,
    "docs/decisions/README.md",
)

ROOT_DIRS = (
    "memory-bank",
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

TASK_BACKENDS = ("markdown", "beads")
TASK_STATUSES = ("proposed", "ready", "in-progress", "waiting", "blocked", "review", "completed", "cancelled", "archived")
APPROVAL_STATES = ("not-required", "required", "requested", "approved", "rejected")

ADR_DIR = "docs/decisions"
ADR_INDEX = "README.md"
ADR_TEMPLATE = "adr-template.md"
ADR_FILENAME = re.compile(r"(?P<number>\d{4})-(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)\.md")
ADR_STATUSES = ("proposed", "rejected", "accepted", "deprecated")
ADR_SUPERSEDED = re.compile(r"superseded by ADR-\d{4}")


def read_workspace_yaml(path: Path) -> dict[str, str]:
    """workspace.yaml is deliberately flat `key: value` so no YAML library is needed."""
    config: dict[str, str] = {}
    if not path.is_file():
        return config
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition(":")
        if separator:
            config[key.strip()] = value.strip().strip("\"'")
    return config


def check_agent(root: Path, errors: list[str], warnings: list[str]) -> str | None:
    """AGENTS.md must carry the identity block; returns the stable id when found."""
    agents_file = root / "AGENTS.md"
    if not agents_file.is_file():
        return None
    content = agents_file.read_text(encoding="utf-8", errors="replace")
    match = re.search(r"^- Stable ID:\s*(\S+)\s*$", content, re.MULTILINE)
    if "## Agent" not in content or not match:
        errors.append("AGENTS.md lacks an '## Agent' block with a 'Stable ID' line")
        return None
    if not re.fullmatch(AGENT_ID_PATTERN, match.group(1)):
        warnings.append(f"non-portable agent id in AGENTS.md: {match.group(1)}")
    return match.group(1)


def check_workspace_yaml(root: Path, agent_id: str | None, errors: list[str]) -> dict[str, str]:
    """workspace.yaml is authoritative for tooling; it must agree with the files on disk."""
    config = read_workspace_yaml(root / "workspace.yaml")
    if not config:
        return config  # the missing-file error is reported by ROOT_FILES
    if config.get("schema") != "2":
        errors.append(f"workspace.yaml: schema must be 2 (got {config.get('schema', 'nothing')})")
    if agent_id and config.get("agent") != agent_id:
        errors.append(f"workspace.yaml agent '{config.get('agent', '')}' differs from AGENTS.md Stable ID '{agent_id}'")

    tasks = config.get("tasks")
    if tasks not in TASK_BACKENDS:
        errors.append(f"workspace.yaml: tasks must be one of {', '.join(TASK_BACKENDS)} (got {tasks or 'nothing'})")
        return config
    if tasks == "markdown":
        if not (root / "TASKS.md").is_file():
            errors.append("missing required file: TASKS.md (tasks: markdown)")
        if (root / ".beads").exists():
            errors.append("workspace.yaml says tasks: markdown but .beads/ exists")
    else:
        if not (root / ".beads").is_dir():
            errors.append("workspace.yaml says tasks: beads but .beads/ is missing")
        elif not (root / ".beads" / "issues.jsonl").is_file():
            errors.append("missing .beads/issues.jsonl (tasks: beads); run `bd export -o .beads/issues.jsonl`")
        if (root / "TASKS.md").exists():
            errors.append("workspace.yaml says tasks: beads but TASKS.md exists")
    return config


def check_tasks_markdown(root: Path, warnings: list[str]) -> None:
    """Each task in TASKS.md carries the contract's fields with vocabulary values; a packet it names exists."""
    path = root / "TASKS.md"
    if not path.is_file():
        return
    text = path.read_text(encoding="utf-8", errors="replace")
    for block in re.split(r"(?m)^(?=### )", text)[1:]:
        heading = re.match(r"### (\S+)", block)
        status = re.search(r"(?m)^- Status:\s*(\S*)", block)
        if not heading or not status:
            continue
        task = heading.group(1)
        token = re.match(r"[a-z-]+", status.group(1))
        if not token or token.group(0) not in TASK_STATUSES:
            warnings.append(f"task {task}: status '{status.group(1)}' not in vocabulary")
        approval = re.search(r"(?m)^- Approval:\s*(\S*)", block)
        if approval:
            token = re.match(r"[a-z-]+", approval.group(1))
            if not token or token.group(0) not in APPROVAL_STATES:
                warnings.append(f"task {task}: approval '{approval.group(1)}' not in vocabulary")
        packet = re.search(r"(?m)^- Approval-packet:\s*(.*)$", block)
        if not packet:
            warnings.append(f"task {task}: no Approval-packet line")
        elif packet.group(1).strip().startswith("unknown"):
            warnings.append(f"task {task}: Approval-packet unknown (write the packet or set none)")
        else:
            for named in re.findall(r"approvals/[A-Za-z0-9._-]+\.md", packet.group(1)):
                if not (root / named).is_file():
                    warnings.append(f"task {task}: approval packet not found: {named}")


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

    if (root / "project" / "ABOUT.md").is_file() and (root / "agents").is_dir():
        print("ERROR v1 layout detected (project/ and agents/): run scripts/migrate_v1.py --root <root>, then follow references/migration-v1.md")
        print("summary: errors=1 warnings=0")
        return 1
    if (root / "company").is_dir() and (root / "agents").is_dir() and not (root / "project").is_dir():
        print("ERROR pre-v1 Agent OS layout detected (company/ and agents/): put a copy under git, then follow references/migration-v1.md; migrate_v1.py expects project/ and a single agents/<id>/")
        print("summary: errors=1 warnings=0")
        return 1

    for relative in ROOT_FILES:
        if not (root / relative).is_file():
            errors.append(f"missing required file: {relative}")

    for relative in ROOT_DIRS:
        if not (root / relative).is_dir():
            errors.append(f"missing required directory: {relative}")

    agent_id = check_agent(root, errors, warnings)
    config = check_workspace_yaml(root, agent_id, errors)
    if config.get("tasks") == "markdown":
        check_tasks_markdown(root, warnings)

    for relative in MEMORY_BANK_FILES:
        path = root / relative
        if path.is_file() and not re.search(r"^- Updated:\s*\d{4}-\d{2}-\d{2}", path.read_text(encoding="utf-8", errors="replace"), re.MULTILINE):
            warnings.append(f"memory-bank file without an Updated date: {relative}")

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
        if "<!-- MIGRATION:" in content and not markdown.is_relative_to(root / "archive"):
            warnings.append(f"migration marker remains: {markdown.relative_to(root)}")

    for item in errors:
        print(f"ERROR {item}")
    for item in warnings:
        print(f"WARN  {item}")
    print(f"summary: errors={len(errors)} warnings={len(warnings)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
