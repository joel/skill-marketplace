#!/usr/bin/env python3
"""Claude Code hooks for a vendor-neutral workspace.

session-start: remind the agent of the boot sequence (and inject `bd prime` for the
Beads backend; for task_layout: files, rebuild TASKS.md and inject it). stop: for task_layout: files, rebuild TASKS.md and block once when a task file is
malformed; then block once per session when no session record was written, and
warn once when the memory bank was not touched after real work.

Scope guard: the hook does nothing unless the session's cwd (or its git top level)
holds a workspace.yaml with `hooks: on`. Outside a workspace it exits 0 silently.
State lives per session_id under $VNW_HOOK_STATE_DIR, else $CLAUDE_PLUGIN_DATA/hooks,
else the system temp directory; never inside the workspace.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

BOOT_REMINDER = (
    "This directory is a vendor-neutral workspace. Before meaningful work follow the boot "
    "sequence in AGENTS.md (memory bank, POLICIES.md, decision index, ready work, latest "
    "session) and open a session record under sessions/YYYY/MM/. Ending a turn without a "
    "session record written this session is blocked once by the workspace hook; a session "
    "that did no work still gets a one-line record."
)
BLOCK_REASON = (
    "vendor-neutral-workspace: no file under sessions/ was created or modified during this "
    "session. Write the session record (sessions/YYYY/MM/DD-HHMMSSZ-session.md, contract in the "
    "skill's record-contracts.md) with what was done, decided, and handed off, update "
    "memory-bank/activeContext.md and progress.md if anything changed, then finish. If this "
    "session did no work, write a one-line record saying so."
)
FILES_BOOT_REMINDER = (
    "This directory is a vendor-neutral workspace with one file per task (task_layout: files). "
    "Before meaningful work follow the boot sequence in AGENTS.md: read memory-bank/activeContext.md "
    "and the task index below (generated from tasks/*.md; this hook rebuilds it at session start and "
    "after every turn, never edit it by hand), raise anything OVERDUE, then open only the named task's "
    "file, its - Facts: files and its - Log: when history matters. Read the other memory-bank files "
    "when the task touches them, and all of them on a cold start. Open a session record under "
    "sessions/YYYY/MM/. Ending a turn without a session record written this session is blocked once "
    "by the workspace hook; a session that did no work still gets a one-line record."
)
INDEX_SCRIPT = Path(__file__).resolve().parents[1] / "skills" / "vendor-neutral-workspace" / "scripts" / "build_task_index.py"
INDEX_BLOCK_REASON = (
    "vendor-neutral-workspace: the task index could not be rebuilt because a task file breaks the "
    "contract. Fix these in tasks/, then finish (the hook rebuilds TASKS.md itself):\n"
)
MEMORY_BANK_WARNING = (
    "vendor-neutral-workspace: a session record was written but no memory-bank/ file changed. "
    "If focus, recent changes, open questions, or verified progress moved, update "
    "memory-bank/activeContext.md and progress.md."
)


def read_workspace_yaml(path: Path) -> dict[str, str]:
    config: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition(":")
        if separator:
            config[key.strip()] = value.strip().strip("\"'")
    return config


def find_workspace(cwd: Path) -> tuple[Path, dict[str, str]] | None:
    candidates = [cwd]
    toplevel = subprocess.run(["git", "-C", str(cwd), "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    if toplevel.returncode == 0 and toplevel.stdout.strip():
        candidates.append(Path(toplevel.stdout.strip()))
    for candidate in candidates:
        config_path = candidate / "workspace.yaml"
        if config_path.is_file():
            config = read_workspace_yaml(config_path)
            if config.get("hooks") == "on":
                return candidate, config
            return None  # a workspace that opted out
    return None


def state_dir() -> Path:
    base = os.environ.get("VNW_HOOK_STATE_DIR") or (
        os.path.join(os.environ["CLAUDE_PLUGIN_DATA"], "hooks") if os.environ.get("CLAUDE_PLUGIN_DATA") else None
    ) or os.path.join(tempfile.gettempdir(), "vendor-neutral-workspace-hooks")
    path = Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_state(session_id: str) -> dict[str, object]:
    path = state_dir() / f"{session_id}.json"
    if path.is_file():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def save_state(session_id: str, state: dict[str, object]) -> None:
    (state_dir() / f"{session_id}.json").write_text(json.dumps(state), encoding="utf-8")


def newest_mtime(directory: Path) -> float:
    if not directory.is_dir():
        return 0.0
    return max((p.stat().st_mtime for p in directory.rglob("*") if p.is_file()), default=0.0)


def rebuild_index(workspace: Path) -> tuple[bool, str]:
    """Rebuild TASKS.md from tasks/*.md. Returns (ok, error text)."""
    result = subprocess.run(
        [sys.executable, str(INDEX_SCRIPT), "--root", str(workspace)], capture_output=True, text=True, timeout=15,
    )
    return result.returncode == 0, result.stderr.strip()


def session_start(payload: dict[str, object], workspace: Path, config: dict[str, str]) -> int:
    session_id = str(payload.get("session_id", "unknown"))
    state = load_state(session_id)
    if "started" not in state:  # resume/compact keep the original start, or earlier records look stale
        state["started"] = time.time()
        state["workspace"] = str(workspace)
        save_state(session_id, state)

    context = BOOT_REMINDER
    if config.get("task_layout") == "files":
        context = FILES_BOOT_REMINDER
        ok, problems = rebuild_index(workspace)
        index = workspace / "TASKS.md"
        if index.is_file():
            context += "\n\nTask index (TASKS.md):\n" + index.read_text(encoding="utf-8")[:8000]
        if not ok:
            context += "\n\nThe index could not be rebuilt; fix these task files first:\n" + problems[:2000]
    if config.get("tasks") == "beads" and shutil.which("bd"):
        prime = subprocess.run(
            ["bd", "prime"], cwd=workspace, capture_output=True, text=True, timeout=15,
            env={**os.environ, "BD_NON_INTERACTIVE": "1", "DO_NOT_TRACK": "1"},
        )
        if prime.returncode == 0 and prime.stdout.strip():
            context += "\n\nBeads workflow context (bd prime):\n" + prime.stdout.strip()[:6000]
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": context}}))
    return 0


def stop(payload: dict[str, object], workspace: Path, config: dict[str, str]) -> int:
    if config.get("task_layout") == "files":
        ok, problems = rebuild_index(workspace)  # the agent never has to remember the rebuild
    if payload.get("stop_hook_active"):
        return 0  # Claude is already continuing because of a stop hook; never loop
    session_id = str(payload.get("session_id", "unknown"))
    state = load_state(session_id)
    if config.get("task_layout") == "files" and not ok and not state.get("index_blocked"):
        state["index_blocked"] = True
        save_state(session_id, state)
        print(INDEX_BLOCK_REASON + problems[:2000], file=sys.stderr)
        return 2
    started = state.get("started")
    if not isinstance(started, (int, float)):
        return 0  # no start marker (hook enabled mid-session): nothing to judge against

    session_written = newest_mtime(workspace / "sessions") >= started - 2
    if not session_written:
        if state.get("blocked"):
            return 0  # block once per session, then let the agent finish
        state["blocked"] = True
        save_state(session_id, state)
        print(BLOCK_REASON, file=sys.stderr)
        return 2

    if not state.get("memory_bank_warned") and newest_mtime(workspace / "memory-bank") < started - 2:
        state["memory_bank_warned"] = True
        save_state(session_id, state)
        print(json.dumps({"systemMessage": MEMORY_BANK_WARNING}))
    return 0


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ("session-start", "stop"):
        print("usage: vnw_hook.py session-start|stop  (hook JSON on stdin)", file=sys.stderr)
        return 1
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return 0
    cwd = Path(str(payload.get("cwd") or os.getcwd()))
    found = find_workspace(cwd)
    if not found:
        return 0
    workspace, config = found
    if sys.argv[1] == "session-start":
        return session_start(payload, workspace, config)
    return stop(payload, workspace, config)


if __name__ == "__main__":
    raise SystemExit(main())
