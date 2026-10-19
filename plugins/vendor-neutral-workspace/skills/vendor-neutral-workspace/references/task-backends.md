# Task backends

The task contract in [the record contracts](record-contracts.md) says what every task carries. This reference says where tasks live. The choice is a project decision (the "Task backend" record in `docs/decisions/`, created at init) and is declared as `tasks:` in `workspace.yaml`, which tooling reads. The default is `markdown`. Propose Beads when `bd` is on PATH and the project needs computed ready-work, typed dependencies, or atomic claims. Changing backend later is a new decision record superseding the task-backend one, an edit to `workspace.yaml`, and a migration of the open tasks.

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
- The validator warns, per task, when `Status` or `Approval` does not start with a vocabulary word, when the `Approval-packet` line is missing or says `unknown`, and when a packet it names does not exist.

## Beads (`tasks: beads`)

[Beads](https://github.com/gastownhall/beads) (`bd`) is a graph issue tracker for agents: typed dependencies, computed ready-work, atomic claims, and setup recipes for most harnesses. Verified against `bd` 1.1.0 and the 1.3 CLI reference; re-check flags after upgrading.

**Requirements.** The workspace root is a git repository with a remote. `bd` is on PATH at the **same version on every machine** that works the project (a newer `bd` migrates the database in place and an older one then refuses it); record the version in `memory-bank/techContext.md`. Nothing else is needed: the embedded engine starts on demand.

**What init does** (`init_workspace.py --tasks beads --apply`; preview prints the same commands without running them):

```bash
bd init --prefix <prefix> --skip-agents --skip-hooks --non-interactive --quiet
bd config set export.auto true
bd config set export.git-add true
bd create "Confirm and complete project foundation" --type task --priority 1 --acceptance "..." --silent
bd export -o .beads/issues.jsonl
```

`--skip-agents` because the workspace owns `AGENTS.md` (its Tasks section carries the Beads block); `--skip-hooks` because the workspace does not install git hooks. `bd init` wires the Dolt remote from the git origin by itself and makes one local commit with `.beads/{.gitignore,README.md,config.yaml,interactions.jsonl,metadata.json}` and a root `.gitignore`; push it like any commit. The prefix defaults to a slug of the project name (`--beads-prefix` overrides) and becomes the issue ID prefix (`orchard-3kf`).

**Where the data lives.** The database is a Dolt directory under `.beads/` (ignored by git). Its history is pushed with `bd dolt push` to the **same git remote** under the custom ref `refs/dolt/data`; verified on GitHub, which retains the ref and serves it to `bd bootstrap`. A plain `git clone` does not fetch it: **run `bd bootstrap` once in every fresh clone.** Beads also pushes a branch named `__dolt_remote_info__`; expect it in the branch list and exclude it from branch rules that match `*`. `.beads/issues.jsonl` is refreshed after writes (`export.auto`, throttled to once a minute) and staged (`export.git-add`); it is the human-readable mirror, not the sync mechanism.

**Loop.** `bd prime` prints the workflow context (about 1–2k tokens). Then: `bd ready --json` → `bd update <id> --claim` → work → `bd close <id> --reason "<evidence>"` → `bd dolt push`. Discovered work: `bd create "<title>" --type task --deps discovered-from:<id>`. Several agents or sessions on one machine need an external Dolt server (`bd init --server`); the embedded engine is single-writer.

**Task contract mapping.** ID → Beads ID; owner → `assignee` (one); status → `open | in_progress | blocked | deferred | closed`, with `review` as the label `status:review` until the close policy is configured; priority → P0–P4 (`urgent`=0, `high`=1, `normal`=2, `low`=3); dependencies → typed deps (`blocks` by default); acceptance criteria → `--acceptance`; approval state → label `approval:<state>` and the packet path in `--external-ref`; evidence → `bd note <id>`; next action → the first line of the description or a `next:` note; known issues → `--type bug`.

**Recovery without the Dolt history.** `.beads/issues.jsonl` holds every issue with labels, dependencies, and comments, readable as plain text. To rebuild a database from it: `bd init --prefix <prefix> --skip-agents --skip-hooks --non-interactive --quiet && bd import .beads/issues.jsonl` (upsert; comments and history on the Dolt side are lost, the task list is not). `bd export` is not a full backup; `bd backup` is, if Dolt-level restore matters.

**Telemetry.** `bd` sends anonymous metrics by default. Init runs its own `bd` calls with `DO_NOT_TRACK=1`; to disable globally run `bd metrics off` or export `DO_NOT_TRACK=1`.

**What the validator checks.** `tasks: beads` requires `.beads/` and `.beads/issues.jsonl` and forbids a root `TASKS.md`.
