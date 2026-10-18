#!/usr/bin/env python3
"""Preview or create a vendor-neutral workspace without overwrites."""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path


EMPTY_DIRS = (
    "approvals",
    "artifacts",
    "archive",
    "sessions/{year}/{month}",
    "summaries/weekly",
    "summaries/monthly",
    "summaries/yearly",
)

ADR_DIR = Path("docs/decisions")
ADR_FILENAME = re.compile(r"(?P<number>\d{4})-(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)\.md")


def existing_adrs(directory: Path) -> dict[str, tuple[int, str]]:
    """slug -> (number, filename) for every decision record already in the target."""
    if not directory.is_dir():
        return {}
    found: dict[str, tuple[int, str]] = {}
    for path in sorted(directory.iterdir()):
        match = ADR_FILENAME.fullmatch(path.name)
        if match:
            found.setdefault(match.group("slug"), (int(match.group("number")), path.name))
    return found


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path, help="Target project directory")
    parser.add_argument("--project", required=True, help="Human-readable project name")
    parser.add_argument("--agent-id", default="main", help="Stable lowercase agent ID")
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

    # Decision records: a template record whose slug already exists in the target
    # maps to that file (and is skipped), so re-running init never duplicates it;
    # new records take consecutive next-free numbers, so adopting a project that
    # already has ADRs never collides with the template's numbering.
    present = existing_adrs(root / ADR_DIR)
    next_free = max((number for number, _ in present.values()), default=0) + 1
    file_actions: list[tuple[Path, Path]] = []
    for source in sorted(template_root.rglob("*")):
        if not source.is_file():
            continue
        relative = source.relative_to(template_root)
        match = ADR_FILENAME.fullmatch(source.name) if relative.parent == ADR_DIR else None
        if match:
            template_number = int(match.group("number"))
            slug = match.group("slug")
            if slug in present:
                number, target_name = present[slug]
            else:
                number, target_name = next_free, f"{next_free:04d}-{slug}.md"
                next_free += 1
            values[f"ADR_{template_number:04d}_ID"] = f"ADR-{number:04d}"
            values[f"ADR_{template_number:04d}_FILE"] = target_name
            relative = relative.with_name(target_name)
        file_actions.append((source, root / relative))

    initial_session = template_root.parent / "initial-session.md"
    session_name = now.strftime("%d-%H%M%SZ-session.md")
    session_target = root / "sessions" / values["YEAR"] / values["MONTH"] / session_name
    existing_sessions = list((root / "sessions").glob("[0-9][0-9][0-9][0-9]/[0-9][0-9]/*-session.md"))
    if not existing_sessions:
        file_actions.append((initial_session, session_target))

    directories = [
        root / item.format(year=values["YEAR"], month=values["MONTH"])
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
