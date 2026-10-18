# Task backends

The task contract in [the record contracts](record-contracts.md) says what every task carries. This reference says where tasks live. The choice is a project decision (the "Task backend" record in `docs/decisions/`, created at init) and is declared as `tasks:` in `workspace.yaml`, which tooling reads. The default is `markdown`. Propose Beads when `bd` is on PATH and the project needs computed ready-work, typed dependencies, or atomic claims.

## Markdown (`tasks: markdown`)

`TASKS.md` at the root with the sections `## Active`, `## Waiting`, `## Known issues`, `## Completed`. One entry per task:

```markdown
### <NAMESPACE>-0001 — <Outcome-oriented title>

- Status: proposed | ready | in-progress | waiting | blocked | review | completed | cancelled | archived
- Priority: low | normal | high | urgent
- Owner: <one accountable agent or human>
- Contributors: <optional>
- Created: <YYYY-MM-DD>
- Updated: <YYYY-MM-DD>
- Requested-by: <identity or source>
- Depends-on: <IDs or none>
- Approval: not-required | required | requested | approved | rejected
- Approval-packet: <path under approvals/ or none>
- Evidence: <paths, links, or none-yet>

#### Objective

<Intended outcome>

#### Acceptance criteria

- <Verifiable completion condition>

#### Blockers

- <What or whom this is waiting for, or none>

#### Next action

<One concrete next step>
```

Rules:

- IDs are `<NAMESPACE>-NNNN` and are never reused. The namespace is the project's choice; the initial task uses `SETUP`.
- Ready work is every task with `Status: ready` whose `Depends-on` tasks are all `completed`. Nothing computes this; read the file.
- Claim a task by setting `Owner` to yourself and `Status: in-progress` in one edit, after re-reading the file. Two sessions can collide on one file; the standard's concurrency rules apply.
- Complete a task with `Status: completed`, a new `Updated` date, `Evidence`, and move the entry to `## Completed`. When the file grows long, move completed entries older than the current month to `archive/tasks-YYYY-MM.md`.
- Known issues are tasks of their own under `## Known issues`, so `memory-bank/progress.md` never lists them.
- Recovery: the file is the record. There is nothing else to restore.

## Beads (`tasks: beads`)

Not yet supported by `init_workspace.py`; the Beads backend arrives in a later release and `--tasks beads` exits with a message until then. The documented shape will be `bd init --skip-agents` (the workspace owns `AGENTS.md`), the JSONL export committed as the human-readable mirror, the loop `bd ready` → `bd update --claim` → `bd close`, and the same `bd` version on every machine.
