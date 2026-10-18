#!/usr/bin/env python3
"""Migrate a v1 workspace (project/ and agents/<id>/) to the v2 layout without overwriting.

Preview by default; --apply performs the moves, writes the converted files, runs
init_workspace.py to create what v2 adds, converts DEC-NNNN blocks into decision
records, and writes archive/v1/MIGRATION-MANIFEST.md (v1 path -> action -> v2 path).
Judgement calls are left as <!-- MIGRATION: ... --> markers for the agent to resolve
with references/migration-v1.md.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ARCHIVE = Path("archive/v1")
MANIFEST = ARCHIVE / "MIGRATION-MANIFEST.md"
V1_STATUS = {"active": "accepted", "proposed": "proposed", "rejected": "rejected"}
ADR_FILENAME = re.compile(r"(?P<number>\d{4})-(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)\.md")


def mark(text: str) -> str:
    return f"<!-- MIGRATION: {text} -->"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", required=True, type=Path, help="v1 workspace directory")
    parser.add_argument("--project", default=None, help="Project name (default: from project/ABOUT.md)")
    parser.add_argument("--agent-id", default=None, help="Agent to migrate (default: the only agents/<id>/)")
    parser.add_argument("--tasks", choices=("markdown", "beads"), default="markdown", help="v2 task backend")
    parser.add_argument("--apply", action="store_true", help="Perform the migration; default is preview")
    return parser.parse_args()


def detect_v1(root: Path) -> bool:
    return (root / "project" / "ABOUT.md").is_file() and (root / "agents").is_dir()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.is_file() else ""


def body(text: str) -> str:
    """Drop the first heading line of a v1 file; keep the rest."""
    lines = text.splitlines()
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    return "\n".join(lines).strip() + "\n"


def slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug[:60].rstrip("-") or "decision"


def parse_decisions(text: str) -> list[dict[str, object]]:
    blocks: list[dict[str, object]] = []
    for chunk in re.split(r"(?m)^## (?=DEC-)", text)[1:]:
        head, _, rest = chunk.partition("\n")
        match = re.match(r"(DEC-\d+)\s*[—–-]+\s*(.*)", head.strip())
        if not match:
            continue
        fields_part, _, sections_part = rest.partition("\n###")
        fields = dict(re.findall(r"(?m)^- ([A-Za-z-]+):\s*(.*)$", fields_part))
        sections = {
            name.strip(): content.strip()
            for name, content in re.findall(r"(?ms)^### ([^\n]+)\n(.*?)(?=^### |\Z)", "###" + sections_part)
        } if sections_part else {}
        blocks.append({"id": match.group(1), "title": match.group(2).strip(), "fields": fields, "sections": sections})
    return blocks


def render_adr(block: dict[str, object], source: str, id_map: dict[str, str]) -> str:
    fields: dict[str, str] = block["fields"]  # type: ignore[assignment]
    sections: dict[str, str] = block["sections"]  # type: ignore[assignment]
    v1_status = fields.get("Status", "proposed").strip().lower()
    superseded_by = fields.get("Superseded-by", "none").strip()
    if v1_status == "superseded":
        status = f"superseded by {id_map[superseded_by]}" if superseded_by in id_map else "deprecated"
    else:
        status = V1_STATUS.get(v1_status, "proposed")
    makers = [fields.get("Owner", "").strip()]
    approver = fields.get("Approver", "").strip()
    if approver and approver != "not-required":
        makers.append(approver)
    def bullets(name: str) -> str:
        # v1 used "- " bullets; MADR uses "* ".
        return re.sub(r"(?m)^- ", "* ", sections.get(name, "").strip())

    decision = (sections.get("Decision", "").strip() or "unknown").splitlines()[0].rstrip(".")
    alternatives = bullets("Alternatives considered")
    reasons = bullets("Reasons")
    consequences = bullets("Consequences and risks")
    evidence = bullets("Evidence")
    more = [f"Migrated from v1 `{block['id']}` in `{source}`."]
    for key in ("Review", "Supersedes", "Superseded-by"):
        value = fields.get(key, "").strip()
        if value and value != "none":
            more.append(f"{key}: {id_map.get(value, value)}.")
    return (
        "---\n"
        f"status: \"{status}\"\n"
        f"date: {fields.get('Date', '').strip() or dt.date.today().isoformat()}\n"
        f"decision-makers: {', '.join(m for m in makers if m) or 'unknown'}\n"
        "consulted: none\n"
        "informed: none\n"
        "---\n\n"
        f"# {block['title']}\n\n"
        f"{mark('review this migrated record: classify each consequence as Good or Bad, confirm the options, then delete this line')}\n\n"
        "## Context and Problem Statement\n\n"
        f"{sections.get('Context', '').strip() or 'unknown'}\n\n"
        "## Considered Options\n\n"
        f"* {decision} (chosen)\n"
        f"{alternatives}\n\n"
        "## Decision Outcome\n\n"
        f"Chosen option: \"{decision}\", because:\n\n{reasons or '* (reasons not recorded in v1)'}\n\n"
        "### Consequences\n\n"
        f"{consequences or '* none recorded'}\n\n"
        "### Confirmation\n\n"
        f"{evidence or 'none recorded'}\n\n"
        "## More Information\n\n"
        f"{' '.join(more)}\n"
    )


class Migration:
    def __init__(self, root: Path, apply: bool) -> None:
        self.root = root
        self.apply = apply
        self.manifest: list[tuple[str, str, str]] = []

    def rel(self, path: Path) -> str:
        return path.relative_to(self.root).as_posix()

    def move(self, source: Path, target: Path, action: str = "moved") -> None:
        if target.exists():
            fallback = self.root / ARCHIVE / self.rel(source)
            print(f"SKIP target exists, archiving instead: {self.rel(source)} -> {self.rel(fallback)}")
            target, action = fallback, "archived (target existed)"
        print(f"MOVE {self.rel(source)} -> {self.rel(target)}")
        if self.apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(target))
        self.manifest.append((self.rel(source), action, self.rel(target)))

    def write(self, target: Path, content: str, sources: list[Path], action: str) -> None:
        if target.exists():
            print(f"SKIP existing {self.rel(target)}")
            for source in sources:
                self.manifest.append((self.rel(source), "skipped (v2 target existed)", self.rel(target)))
            return
        print(f"WRITE {self.rel(target)}")
        if self.apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8", newline="\n")
        for source in sources:
            self.manifest.append((self.rel(source), action, self.rel(target)))

    def archive(self, source: Path) -> None:
        if source.is_file():
            self.move(source, self.root / ARCHIVE / self.rel(source), "archived")

    def move_tree(self, source_dir: Path, target_dir: Path, action: str = "moved") -> None:
        if not source_dir.is_dir():
            return
        for path in sorted(p for p in source_dir.rglob("*") if p.is_file()):
            self.move(path, target_dir / path.relative_to(source_dir), action)

    def remove_empty_dirs(self, top: Path) -> None:
        if not top.is_dir():
            return
        for directory in sorted((p for p in top.rglob("*") if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
            if self.apply and not any(directory.iterdir()):
                directory.rmdir()
        if self.apply and not any(top.iterdir()):
            top.rmdir()
            print(f"REMOVE empty directory {self.rel(top)}")
        elif not self.apply:
            print(f"REMOVE empty directory {self.rel(top)} (after moves)")


def main() -> int:
    args = parse_args()
    root = args.root.expanduser().resolve()
    if not detect_v1(root):
        print(f"error: no v1 layout (project/ABOUT.md and agents/) under {root}", file=sys.stderr)
        return 2

    agents = sorted(p for p in (root / "agents").iterdir() if p.is_dir() and not p.name.startswith("."))
    if args.agent_id:
        agent_dir = root / "agents" / args.agent_id
        if not agent_dir.is_dir():
            print(f"error: agents/{args.agent_id} not found", file=sys.stderr)
            return 2
    elif len(agents) == 1:
        agent_dir = agents[0]
    else:
        print(f"error: {len(agents)} agent directories found; pass --agent-id to choose the one to migrate "
              f"(the others are archived under {ARCHIVE})", file=sys.stderr)
        return 2
    agent_id = agent_dir.name

    about = read(root / "project" / "ABOUT.md")
    heading = re.search(r"^# Project — (.+)$", about, re.MULTILINE)
    project = (args.project or (heading.group(1).strip() if heading else "")).strip()
    if not project:
        print("error: project name not found in project/ABOUT.md; pass --project", file=sys.stderr)
        return 2

    today = dt.date.today().isoformat()
    m = Migration(root, args.apply)
    print(f"{'APPLY' if args.apply else 'PREVIEW'}: migrate v1 workspace {root}")
    print(f"project: {project}; agent: {agent_id}; task backend: {args.tasks}")

    # 1. Records that keep their shape move to the root.
    for sub in ("sessions", "summaries", "artifacts", "archive"):
        m.move_tree(agent_dir / sub, root / sub)
    # 2. Inter-agent material goes to the archive; single-agent v2 has no equivalent.
    for sub in ("handoffs", "inbox", "outbox", ".skills"):
        m.move_tree(agent_dir / sub, root / ARCHIVE / "agents" / agent_id / sub, "archived")
    for sub in ("inbox", "outbox"):
        m.move_tree(root / sub, root / ARCHIVE / sub, "archived")
    for other in agents:
        if other != agent_dir:
            m.move_tree(other, root / ARCHIVE / "agents" / other.name, "archived (second agent)")

    # 3. Conversions into v2 files, each with a marker where judgement is needed.
    header = f"- Updated: {today}\n- Updated-by: {agent_id}\n\n"
    m.write(
        root / "memory-bank" / "projectbrief.md",
        f"# Project brief — {project}\n\n{header}"
        f"{mark('split product context (why it exists, problems, how it should work, UX goals) into productContext.md, then delete this line')}\n\n"
        f"{body(about)}",
        [root / "project" / "ABOUT.md"], "converted",
    )
    project_state, agent_state = read(root / "project" / "STATE.md"), read(agent_dir / "STATE.md")
    m.write(
        root / "memory-bank" / "activeContext.md",
        f"# Active context — {project}\n\n{header}"
        f"{mark('reshape into Current focus, Recent changes, Open questions, Waiting for, Patterns and preferences, Learnings and insights; the next action belongs on the task; then delete this line')}\n\n"
        f"{body(project_state)}\n## Agent state (migrated from agents/{agent_id}/STATE.md)\n\n{body(agent_state)}",
        [root / "project" / "STATE.md", agent_dir / "STATE.md"], "merged",
    )
    project_policies, agent_policies = read(root / "project" / "POLICIES.md"), read(agent_dir / "POLICIES.md")
    m.write(
        root / "POLICIES.md",
        f"# Policies — {project}\n\n{body(project_policies)}\n"
        f"## Agent policy (migrated from agents/{agent_id}/POLICIES.md)\n\n"
        f"{mark('fold these role rules into the sections above where they are narrower than the baseline, then delete this line')}\n\n{body(agent_policies)}",
        [root / "project" / "POLICIES.md", agent_dir / "POLICIES.md"], "merged",
    )
    project_tasks, agent_tasks = read(root / "project" / "TASKS.md"), read(agent_dir / "TASKS.md")
    merged_tasks = (
        f"# Tasks — {project}\n\n{body(project_tasks)}\n"
        f"## Agent queue (migrated from agents/{agent_id}/TASKS.md)\n\n"
        f"{mark('fold these entries into Active, Waiting, Known issues or Completed above; add Approval-packet lines; then delete this line')}\n\n{body(agent_tasks)}"
    )
    if args.tasks == "markdown":
        m.write(root / "TASKS.md", merged_tasks, [root / "project" / "TASKS.md", agent_dir / "TASKS.md"], "merged")
    else:
        m.write(
            root / ARCHIVE / "TASKS.md",
            f"{mark('create each open task in Beads with bd create (title, --acceptance, --priority, --deps), then delete this file')}\n\n{merged_tasks}",
            [root / "project" / "TASKS.md", agent_dir / "TASKS.md"], "merged for import into Beads",
        )

    # 4. Everything consumed above is archived, never deleted.
    for path in (
        root / "project" / "ABOUT.md", root / "project" / "STATE.md", root / "project" / "POLICIES.md",
        root / "project" / "TASKS.md", root / "project" / "DECISIONS.md", root / "agents" / "REGISTRY.md",
        agent_dir / "ABOUT.md", agent_dir / "WARM_ME_UP.md", agent_dir / "POLICIES.md", agent_dir / "STATE.md",
        agent_dir / "TASKS.md", agent_dir / "DECISIONS.md", root / "AGENTS.md", root / "README.md",
    ):
        m.archive(path)
    decisions_sources = {
        "project/DECISIONS.md": read(root / ARCHIVE / "project" / "DECISIONS.md") if args.apply else read(root / "project" / "DECISIONS.md"),
        f"agents/{agent_id}/DECISIONS.md": read(root / ARCHIVE / "agents" / agent_id / "DECISIONS.md") if args.apply else read(agent_dir / "DECISIONS.md"),
    }

    # 5. init creates what v2 adds and skips everything written above.
    init_cmd = [sys.executable, str(HERE / "init_workspace.py"), "--root", str(root), "--project", project,
                "--agent-id", agent_id, "--tasks", args.tasks] + (["--apply"] if args.apply else [])
    print("RUN " + " ".join(init_cmd[1:]))
    if args.apply:
        result = subprocess.run(init_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(result.stdout + result.stderr, file=sys.stderr)
            return result.returncode

    # 6. DEC-NNNN blocks become decision records; the vendor-neutral one is the template's ADR-0001.
    blocks = [(source, block) for source, text in decisions_sources.items() for block in parse_decisions(text)]
    decisions_dir = root / "docs" / "decisions"
    existing = [int(mt.group("number")) for p in decisions_dir.glob("*.md") if (mt := ADR_FILENAME.fullmatch(p.name))] if decisions_dir.is_dir() else []
    next_free = max(existing, default=2) + 1  # the template's 0001 and 0002 exist after init
    id_map: dict[str, str] = {}
    planned: list[tuple[str, dict[str, object], str]] = []
    for source, block in blocks:
        if "vendor-neutral" in str(block["title"]).lower():
            id_map[str(block["id"])] = "ADR-0001"
            m.manifest.append((f"{source}#{block['id']}", "replaced by the template record", "docs/decisions/0001-use-a-vendor-neutral-workspace.md"))
            continue
        filename = f"{next_free:04d}-{slugify(str(block['title']))}.md"
        id_map[str(block["id"])] = f"ADR-{next_free:04d}"
        planned.append((source, block, filename))
        next_free += 1
    index_rows: list[str] = []
    for source, block, filename in planned:
        print(f"WRITE docs/decisions/{filename}  (from {source}#{block['id']})")
        if args.apply:
            (decisions_dir / filename).write_text(render_adr(block, source, id_map), encoding="utf-8", newline="\n")
        m.manifest.append((f"{source}#{block['id']}", "converted to decision record", f"docs/decisions/{filename}"))
        status = render_adr(block, source, id_map).split("\n", 2)[1].split(":", 1)[1].strip().strip('"')
        fields: dict[str, str] = block["fields"]  # type: ignore[assignment]
        index_rows.append(f"| {id_map[str(block['id'])]} | [{block['title']}]({filename}) | {status} | {fields.get('Date', today).strip()} |")
    if index_rows and args.apply:
        index_path = decisions_dir / "README.md"
        lines = index_path.read_text(encoding="utf-8").splitlines()
        last_row = max(i for i, line in enumerate(lines) if line.startswith("| ADR-"))
        lines[last_row + 1:last_row + 1] = index_rows
        index_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    elif index_rows:
        print(f"APPEND {len(index_rows)} row(s) to docs/decisions/README.md")

    # 7. The generated AGENTS.md needs the project's own rules merged back in.
    print(f"APPEND migration marker to AGENTS.md")
    if args.apply:
        with (root / "AGENTS.md").open("a", encoding="utf-8") as handle:
            handle.write(f"\n{mark(f'merge project-specific rules from {ARCHIVE}/AGENTS.md and {ARCHIVE}/README.md, then delete this line')}\n")

    # 8. Empty v1 directories go; the manifest records everything.
    for top in (root / "project", root / "agents", root / "decisions", root / "inbox", root / "outbox"):
        m.remove_empty_dirs(top)
    manifest_text = (
        f"# Migration manifest — v1 to v2\n\n- Date: {today}\n- Agent: {agent_id}\n- Task backend: {args.tasks}\n\n"
        "| v1 path | Action | v2 path |\n| --- | --- | --- |\n"
        + "\n".join(f"| {src} | {action} | {dst} |" for src, action, dst in m.manifest) + "\n\n"
        f"Resolve every `{mark('...')[:16]}` marker with references/migration-v1.md of the skill, then run validate_workspace.py.\n"
    )
    print(f"WRITE {MANIFEST.as_posix()} ({len(m.manifest)} rows)")
    if args.apply:
        (root / MANIFEST).parent.mkdir(parents=True, exist_ok=True)
        (root / MANIFEST).write_text(manifest_text, encoding="utf-8", newline="\n")
    else:
        print("No changes made. Review the plan, then repeat with --apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
