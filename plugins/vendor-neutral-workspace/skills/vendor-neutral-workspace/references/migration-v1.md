# Migrating a v1 workspace

A v1 workspace has `project/{ABOUT,POLICIES,STATE,TASKS,DECISIONS}.md`, `agents/REGISTRY.md` and `agents/<id>/` with its own copies plus `WARM_ME_UP.md`. v2 is the flat layout in the standard: `AGENTS.md` with the boot sequence, `memory-bank/`, `docs/decisions/` as MADR records, the task backend named in `workspace.yaml`, `approvals/`, and root `sessions/`, `summaries/`, `artifacts/`, `archive/`.

The script does the mechanical part. You do the judgement part, guided by the `<!-- MIGRATION: ... -->` markers it leaves. Nothing is deleted: every consumed v1 file is under `archive/v1/`, and `archive/v1/MIGRATION-MANIFEST.md` lists each v1 path, what happened to it, and where it went.

In Claude Code the whole of this guide runs as one command from the project root: `/vendor-neutral-workspace:migrate [--tasks markdown|beads] [--auto] [--commit]`. It previews, waits for a go-ahead (unless `--auto`), applies, resolves the markers with conservative defaults, lists the calls that need the owner under "Decisions to confirm" in the session record, validates, records, and commits when asked. The steps below are what it does, for other harnesses or for doing it by hand.

## 1. Run the script

```bash
python3 scripts/migrate_v1.py --root /path/to/project            # preview, no changes
python3 scripts/migrate_v1.py --root /path/to/project --apply    # perform
```

Options: `--agent-id` when several agents exist (the others are archived whole; re-create any that must stay from the multi-agent extension), `--project` when `project/ABOUT.md` has no `# Project — <name>` heading, `--tasks beads` to land on the Beads backend (the merged task list then goes to `archive/v1/TASKS.md` for you to create in Beads).

Before running it, the working tree must be clean: `git status --porcelain` prints nothing. Commit the records that are pending first, as a snapshot, so the migration lands as its own reviewable diff. Do not stage untracked files larger than about 50 MB or binary artifacts without the owner's say; list them and leave them for the owner.

Beyond moving files, the script does the mechanical conversions that two real migrations needed: approval packets that v1 kept under `decisions/` move to `approvals/` with their names unchanged (new packets follow the contract name `approvals/<task-id>-<YYYY-MM-DD>.md`); every task gets an `Approval-packet` line (the paths the approval names, `none` when not required, `unknown` otherwise); tasks whose status is completed, cancelled or archived move under `## Completed`; the v1 `DEC-NNNN` ids and the `agents/<id>/…` and `project/…` paths in the converted files are repointed to the records and paths they became; the agent block in `AGENTS.md` takes its name, role and creation date from the v1 profile; Finder metadata and `.gitkeep` placeholders whose directory already exists are dropped, not moved. Closed session records and archived files keep their original text; the manifest maps every move.

Read the preview before applying. The script never overwrites: a v2 target that already exists is skipped and the v1 source is archived instead.

## 2. Resolve the markers, in this order

Each marker names a file and says what to do. Delete the marker line once done; the validator warns while any remains.

1. **`memory-bank/projectbrief.md`** holds the whole of v1 `ABOUT.md`. Move what answers "why does this exist, which problems, how should it work, UX goals" into `memory-bank/productContext.md`; keep purpose, requirements, scope, sources of truth in the brief.
2. **`memory-bank/activeContext.md`** holds project `STATE.md` with agent `STATE.md` appended. Reshape into the v2 sections. Anything that is a next action goes on a task, not here. Then write `systemPatterns.md` and `techContext.md` from the codebase; the templates init created are placeholders.
3. **`POLICIES.md`** has the agent policy appended. Keep only what is narrower than the baseline; drop duplicates.
4. **Tasks.** Markdown backend: `TASKS.md` has the agent queue appended. In practice the agent queue only summarised the project tasks; when every ID in it already has a full entry, delete the section. Resolve every `Approval-packet: unknown`: when the approval was given in session and no packet exists, write `none (given in session)`; when a packet exists elsewhere, name it; when the action still needs approval, write the packet. Statuses the script could not map (`closed`, `tracking`, `handed-over` were seen) are the owner's call; the validator warns about them. Beads backend: create each open task from `archive/v1/TASKS.md` with `bd create "<title>" --type task --priority <0-4> --acceptance "<criteria>"` and `--deps` for dependencies, then `bd export -o .beads/issues.jsonl`; completed v1 tasks can stay in the archive.
5. **Decision records.** Each v1 `DEC-NNNN` block became `docs/decisions/NNNN-<slug>.md` (the vendor-neutral-workspace decision became the template's `0001-…`). For each: classify the consequences as Good or Bad, check the Considered Options are real alternatives, and decide whether it is a decision at all. A rule belongs in `POLICIES.md`; a piece of work belongs on a task; a trivial or temporary choice can be set to `deprecated` with a one-line reason. Keep the `Migrated from v1 …` sentence under More Information. Re-read the index `docs/decisions/README.md` rows the script appended.
6. **`AGENTS.md`** is the v2 template. Compare with `archive/v1/AGENTS.md` and `archive/v1/README.md`; merge project-specific rules into the matching v2 section, never by restoring the v1 boot sequence.
7. **Hand-offs, inbox, outbox, `.skills/`, the registry, `WARM_ME_UP.md`, agent `ABOUT.md`** are archived with no v2 counterpart in the single-agent layout. Anything still live in a hand-off or inbox message becomes a task or an open question in `activeContext.md`.

## 3. Verify and record

```bash
python3 scripts/validate_workspace.py --root /path/to/project
```

Zero errors and no `migration marker remains` warning. Then run the cold-start test: a fresh agent reads only `AGENTS.md` and states purpose, focus, active task, constraints, and next action. Record the migration in a session record (what moved, what you decided at each marker, what was archived), update `memory-bank/activeContext.md` and `progress.md`, and commit. Leave `archive/v1/` in place; it is the audit trail.

## 4. Decisions to confirm: the recurring calls

Two real migrations raised the same owner-only calls. Take the conservative default, list each under "Decisions to confirm" in the session record with its alternative, and leave the owner one task to review them:

1. The agent id. Closed records name the v1 id; renaming to `main` touches `AGENTS.md` and `workspace.yaml` only, and the records stay as written.
2. The brief versus product split: which v1 ABOUT paragraphs moved to `productContext.md`.
3. Statuses outside the contract vocabulary, with the proposed mapping (`closed` to `completed` or `cancelled`; `handed-over` to `archived`; `tracking` to `waiting` or `in-progress`).
4. A record amended by a later one: kept `accepted`, or marked `superseded by ADR-NNNN`.
5. Approvals given in session that have no packet: `none (given in session)`, or packets written retroactively from the session records.
6. Anything the brief or the policies now state as an inference from the task history rather than from an owner statement.
7. Options or context added to a migrated record because v1 recorded none; mark them as added at the review.
8. Live evidence paths repointed while closed session records keep their v1 paths.
9. What the migration found uncommitted or untracked, and large artifacts left outside version control.
