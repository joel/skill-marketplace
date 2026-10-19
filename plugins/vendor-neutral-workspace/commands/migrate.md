---
description: Migrate the v1 workspace in the current directory (project/ and agents/<id>/) to the v2 layout in one go: preview, apply, resolve the markers, validate, record.
argument-hint: "[--tasks markdown|beads] [--auto] [--commit]"
---

Migrate the v1 workspace in the current working directory to the vendor-neutral-workspace v2 layout. Arguments given: `$ARGUMENTS` (`--tasks markdown|beads` picks the task backend, default markdown; `--auto` skips the approval pause; `--commit` commits at the end).

The skill's scripts are in `${CLAUDE_PLUGIN_ROOT}/skills/vendor-neutral-workspace/scripts/` and the migration guide is `${CLAUDE_PLUGIN_ROOT}/skills/vendor-neutral-workspace/references/migration-v1.md`. Read the guide before step 3.

## 1. Preview

Run `python3 "${CLAUDE_PLUGIN_ROOT}/skills/vendor-neutral-workspace/scripts/migrate_v1.py" --root .` with `--tasks` when given. If it reports no v1 layout, say so and stop. Otherwise summarise the plan in at most ten lines: how many files move, are archived, are converted; which decision records will be created; the task backend; anything the preview flagged (a second agent, a missing project name). Unless `--auto` was passed, stop here and wait for a go-ahead.

## 2. Apply

Run the same command with `--apply`. Report the manifest path (`archive/v1/MIGRATION-MANIFEST.md`) and the row count.

## 3. Resolve the markers

Work through every `<!-- MIGRATION: ... -->` marker in the order the guide gives, deleting each marker line when its file is done:

- Decide from the files and the codebase whatever they answer: fill `memory-bank/systemPatterns.md` and `techContext.md` from the code; split product context out of `projectbrief.md` when the v1 text makes the split obvious; fold the agent policy into `POLICIES.md` where it is narrower; fold the agent task queue into the task sections; classify each migrated decision's consequences as Good or Bad where the wording is plain.
- Where only the project owner can decide (an ambiguous brief-versus-product split, whether a migrated record is a decision or a rule, a task whose status is unclear), make the conservative choice: keep the text where it is, keep statuses as they were, leave the record `accepted` if it was `active`. Do not ask question by question. Collect every such call under a heading "Decisions to confirm" in the session record, one line each with your default and the alternative.
- Merge project-specific rules from `archive/v1/AGENTS.md` and `archive/v1/README.md` into the matching v2 section of `AGENTS.md`; never restore the v1 boot sequence.
- For the Beads backend, create each open task from `archive/v1/TASKS.md` with `bd create` (title, `--acceptance`, `--priority`, `--deps`), then `bd export -o .beads/issues.jsonl`.

## 4. Verify

Run `python3 "${CLAUDE_PLUGIN_ROOT}/skills/vendor-neutral-workspace/scripts/validate_workspace.py" --root .` and show the output. Zero errors and no `migration marker remains` warning are required; fix and re-run until they are. Then do the cold-start check yourself: reading only `AGENTS.md` and what it points at, state purpose, current focus, active task, constraints, and next action in five lines. If any of the five cannot be answered from the files, fix the file that should hold it.

## 5. Record

Write a session record under `sessions/YYYY/MM/` (contract in the skill's `references/record-contracts.md`) covering what moved, what you decided at each marker, the "Decisions to confirm" list, and what was archived. Update `memory-bank/activeContext.md` (focus, recent changes, open questions) and `memory-bank/progress.md` (verified milestone: migrated to v2). Leave `archive/v1/` in place.

Stage everything and show `git status --short`. Commit only if `--commit` was passed, with the message `Migrate workspace from v1 to vendor-neutral-workspace v2` and a body listing the decisions to confirm; otherwise end with the commit command ready to paste.

End with one line: the validator summary, the number of markers resolved, and the number of decisions waiting for confirmation.
