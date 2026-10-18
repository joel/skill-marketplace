#!/usr/bin/env python3
"""Preview or create a vendor-neutral workspace without overwrites."""

from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import shutil
import subprocess
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

INITIAL_TASK_TITLE = "Confirm and complete project foundation"
INITIAL_TASK_ACCEPTANCE = (
    "Project owner confirms purpose, scope, and intended outcomes; "
    "no file in memory-bank/ contains an unlabelled assumption; "
    "every active task has one owner and a next action."
)
BEADS_ENV = {"BD_NON_INTERACTIVE": "1", "DO_NOT_TRACK": "1"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path, help="Target project directory")
    parser.add_argument("--project", required=True, help="Human-readable project name")
    parser.add_argument("--agent-id", default="main", help="Stable lowercase agent ID")
    parser.add_argument("--agent-name", default=None, help="Human-readable agent name")
    parser.add_argument("--role", default="Coordinator", help="Initial agent role")
    parser.add_argument(
        "--tasks",
        choices=("markdown", "beads"),
        default="markdown",
        help="Task backend; recorded in workspace.yaml and a decision record (default: markdown)",
    )
    parser.add_argument("--beads-prefix", default=None, help="Beads issue ID prefix (default: slug of the project name)")
    parser.add_argument("--apply", action="store_true", help="Create missing paths; default is preview")
    return parser.parse_args()


def validate_agent_id(value: str) -> str:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise ValueError("--agent-id must contain lowercase letters, digits, and single hyphens only")
    return value


def slug_prefix(project: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "", project.lower())
    return slug[:10] or "ws"


def render(text: str, values: dict[str, str]) -> str:
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    return text


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


def bd(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["bd", *args], cwd=root, capture_output=True, text=True, env={**os.environ, **BEADS_ENV}
    )
    if result.returncode != 0:
        raise RuntimeError(f"bd {' '.join(args)} failed: {result.stderr.strip() or result.stdout.strip()}")
    return result.stdout.strip()


def beads_commands(prefix: str, create_initial_task: bool) -> list[list[str]]:
    commands = [
        ["init", "--prefix", prefix, "--skip-agents", "--skip-hooks", "--non-interactive", "--quiet"],
        ["config", "set", "export.auto", "true"],
        ["config", "set", "export.git-add", "true"],
    ]
    if create_initial_task:
        commands.append(
            ["create", INITIAL_TASK_TITLE, "--type", "task", "--priority", "1",
             "--acceptance", INITIAL_TASK_ACCEPTANCE, "--silent"]
        )
    commands.append(["export", "-o", ".beads/issues.jsonl"])
    return commands


def main() -> int:
    args = parse_args()
    try:
        agent_id = validate_agent_id(args.agent_id)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    root = args.root.expanduser().resolve()
    assets_root = Path(__file__).resolve().parent.parent / "assets"
    template_root = assets_root / "workspace-template"
    backend_root = assets_root / "task-backends" / args.tasks
    for required in (template_root, backend_root / "fragments"):
        if not required.is_dir():
            print(f"error: template directory not found: {required}", file=sys.stderr)
            return 2

    if args.tasks == "beads" and not shutil.which("bd"):
        print("error: --tasks beads needs `bd` on PATH; install Beads or use --tasks markdown", file=sys.stderr)
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
        "TASK_BACKEND": args.tasks,
        "INITIAL_TASK_ID": "SETUP-0001",
    }
    if not values["PROJECT_NAME"]:
        print("error: --project cannot be empty", file=sys.stderr)
        return 2

    # Backend fragments fill the backend-specific blocks of shared templates:
    # fragments/block.md -> {{TASK_BACKEND_BLOCK}} (AGENTS.md "Tasks" section),
    # fragments/decision.md -> {{TASK_BACKEND_DECISION}} (the task-backend ADR).
    # render() is literal substitution, so fragments must not contain placeholders.
    for fragment in sorted((backend_root / "fragments").glob("*.md")):
        values["TASK_BACKEND_" + fragment.stem.upper().replace("-", "_")] = fragment.read_text(encoding="utf-8").strip()

    sessions_root = root / "sessions"
    first_session = not list(sessions_root.glob("[0-9][0-9][0-9][0-9]/[0-9][0-9]/*-session.md"))

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
    # Backend-specific files (for example TASKS.md) land at the root alongside the shared ones.
    backend_files = backend_root / "files"
    if backend_files.is_dir():
        for source in sorted(backend_files.rglob("*")):
            if source.is_file():
                file_actions.append((source, root / source.relative_to(backend_files)))

    initial_session = template_root.parent / "initial-session.md"
    session_name = now.strftime("%d-%H%M%SZ-session.md")
    if first_session:
        file_actions.append((initial_session, sessions_root / values["YEAR"] / values["MONTH"] / session_name))

    directories = [
        root / item.format(year=values["YEAR"], month=values["MONTH"])
        for item in EMPTY_DIRS
    ]
    directories.extend(target.parent for _, target in file_actions)

    mode = "APPLY" if args.apply else "PREVIEW"
    print(f"{mode}: {root}")
    print(f"task backend: {args.tasks}")
    if shutil.which("bd") and args.tasks != "beads":
        print("bd detected on PATH: pass --tasks beads to use Beads instead of TASKS.md")

    # Beads runs before the files are rendered so the initial task's ID can be
    # written into the session record. Only `bd init` is skipped when .beads/
    # already exists; config and export are idempotent.
    if args.tasks == "beads":
        prefix = args.beads_prefix or slug_prefix(values["PROJECT_NAME"])
        commands = beads_commands(prefix, create_initial_task=first_session)
        if (root / ".beads").exists():
            commands = [command for command in commands if command[0] != "init"]
            print(f"KEEP .beads (bd init skipped)")
        for command in commands:
            print("RUN bd " + " ".join(f'"{part}"' if " " in part else part for part in command))
        if not args.apply:
            values["INITIAL_TASK_ID"] = "(assigned by bd create on --apply)"
        else:
            if not (root / ".git").exists() and subprocess.run(
                ["git", "-C", str(root), "rev-parse", "--show-toplevel"], capture_output=True
            ).returncode != 0:
                print("error: the Beads backend needs the workspace root inside a git repository", file=sys.stderr)
                return 2
            root.mkdir(parents=True, exist_ok=True)
            try:
                for command in commands:
                    output = bd(root, *command)
                    if command[0] == "create":
                        values["INITIAL_TASK_ID"] = output.splitlines()[-1].strip()
            except RuntimeError as exc:
                print(f"error: {exc}", file=sys.stderr)
                return 1

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
