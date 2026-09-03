#!/usr/bin/env python3
"""Preview or create a vendor-neutral project agent workspace without overwrites."""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path


EMPTY_DIRS = (
    "inbox",
    "outbox",
    "artifacts",
    "decisions",
    "summaries/weekly",
    "summaries/monthly",
    "summaries/yearly",
    "archive",
    "agents/{agent_id}/inbox",
    "agents/{agent_id}/outbox",
    "agents/{agent_id}/artifacts",
    "agents/{agent_id}/handoffs",
    "agents/{agent_id}/sessions/{year}/{month}",
    "agents/{agent_id}/summaries/weekly",
    "agents/{agent_id}/summaries/monthly",
    "agents/{agent_id}/summaries/yearly",
    "agents/{agent_id}/archive",
    "agents/{agent_id}/.skills",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path, help="Target project directory")
    parser.add_argument("--project", required=True, help="Human-readable project name")
    parser.add_argument("--agent-id", default="chief", help="Stable lowercase agent ID")
    parser.add_argument("--agent-name", default=None, help="Human-readable agent name")
    parser.add_argument("--role", default="Coordinator", help="Initial agent role")
    parser.add_argument("--apply", action="store_true", help="Create missing paths; default is preview")
    return parser.parse_args()


def validate_agent_id(value: str) -> str:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise ValueError("--agent-id must contain lowercase letters, digits, and single hyphens only")
    return value


def render(text: str, values: dict[str, str]) -> str:
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return text


def main() -> int:
    args = parse_args()
    try:
        agent_id = validate_agent_id(args.agent_id)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    root = args.root.expanduser().resolve()
    template_root = Path(__file__).resolve().parent.parent / "assets" / "workspace-template"
    if not template_root.is_dir():
        print(f"error: template directory not found: {template_root}", file=sys.stderr)
        return 2

    now = dt.datetime.now(dt.timezone.utc)
    values = {
        "PROJECT_NAME": args.project.strip(),
        "AGENT_ID": agent_id,
        "AGENT_NAME": (args.agent_name or agent_id.replace("-", " ").title()).strip(),
        "AGENT_ROLE": args.role.strip(),
        "DATE": now.date().isoformat(),
        "YEAR": f"{now.year:04d}",
        "MONTH": f"{now.month:02d}",
        "TIMESTAMP": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if not values["PROJECT_NAME"]:
        print("error: --project cannot be empty", file=sys.stderr)
        return 2

    file_actions: list[tuple[Path, Path]] = []
    for source in sorted(template_root.rglob("*")):
        if not source.is_file():
            continue
        relative = source.relative_to(template_root)
        parts = [agent_id if part == "_agent-template" else part for part in relative.parts]
        file_actions.append((source, root.joinpath(*parts)))

    initial_session = template_root.parent / "initial-session.md"
    session_name = now.strftime("%d-%H%M%SZ-session.md")
    session_target = root / "agents" / agent_id / "sessions" / values["YEAR"] / values["MONTH"] / session_name
    existing_sessions = list((root / "agents" / agent_id / "sessions").glob("[0-9][0-9][0-9][0-9]/[0-9][0-9]/*-session.md"))
    if not existing_sessions:
        file_actions.append((initial_session, session_target))

    directories = [
        root / item.format(agent_id=agent_id, year=values["YEAR"], month=values["MONTH"])
        for item in EMPTY_DIRS
    ]
    directories.extend(target.parent for _, target in file_actions)

    mode = "APPLY" if args.apply else "PREVIEW"
    print(f"{mode}: {root}")
    for directory in sorted(set(directories)):
        if directory.exists():
            print(f"KEEP directory {directory}")
        else:
            print(f"CREATE directory {directory}")
            if args.apply:
                directory.mkdir(parents=True, exist_ok=True)

    created = 0
    skipped = 0
    for source, target in file_actions:
        if target.exists():
            print(f"SKIP existing {target}")
            skipped += 1
            continue
        print(f"CREATE file {target}")
        if args.apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            content = render(source.read_text(encoding="utf-8"), values)
            try:
                with target.open("x", encoding="utf-8", newline="\n") as handle:
                    handle.write(content)
            except FileExistsError:
                print(f"SKIP raced-existing {target}")
                skipped += 1
                continue
        created += 1

    print(f"summary: would-create/created={created} skipped-existing={skipped}")
    if not args.apply:
        print("No changes made. Review the preview, then repeat with --apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
