---
name: vendor-neutral-workspace
description: >-
  Initialise, adopt, maintain, audit, or hand over a vendor-neutral workspace:
  the repository's files, not any provider's chat history or hidden memory, are
  the durable record of an AI agent's work, so the same subject resumes from
  another machine or another harness (Claude Code, Codex, Cursor, OpenCode).
  Use whenever the user says "initialise a workspace", "set up the agent
  workspace", "adopt this project", "resume on another machine", "cold start",
  "hand over", "update memory bank", "record a decision", "audit the
  workspace", or wants agent state portable across providers, and whenever
  task, context, decision, session, summary, or approval records are missing or
  stale. Do not use merely to organise ordinary files when no persistent agent
  workflow is wanted.
---

# Vendor-neutral workspace

Make the workspace—not proprietary chat history or hidden model memory—the durable system of record.

## Select the mode

- **Initialise:** The target is new or empty. Establish the smallest useful workspace and initialise the first agent.
- **Adopt:** The target already contains work. Inventory it first, propose a non-destructive mapping, and obtain any required approval before moving or renaming existing material.
- **Operate:** Use the established workspace while performing project work. Keep task, state, decision, evidence, approval, and session records current.
- **Scale:** Add further agents only when recurring ownership, specialised capability, permission isolation, parallel work, or a distinct audit trail justifies it; the default is one agent.
- **Audit or hand over:** Check structural integrity, stale state, unclear ownership, missing evidence, and whether a fresh provider can resume from the files alone.

Read [the workspace standard](references/workspace-standard.md) for initialise, adopt, scale, audit, or policy decisions. Read [the record contracts](references/record-contracts.md) when creating or repairing task, decision, session, approval, or summary records. Read [the task backends](references/task-backends.md) when choosing or operating the task backend. Read [the multi-agent extension](references/multi-agent-extension.md) only when more than one persistent agent is justified.

## Initialise or adopt

1. Read any existing root instructions and policies. They override defaults in this skill.
2. Inspect the target without changing it. Identify existing sources of truth, version control, sensitive material, naming conventions, active work, and conflicts.
3. Choose the minimum topology that preserves continuity. The default is one agent and the flat layout in the standard; a single agent still needs explicit identity, state, tasks, policies, decisions, and sessions. Do not add agents or optional knowledge files without a real need.
4. For a populated target, present the proposed mapping and risks before relocating, renaming, deleting, or overwriting anything. If the target is a v1 workspace (`project/` and `agents/<id>/`), run `scripts/migrate_v1.py --root <dir>` for the preview, then follow [the migration guide](references/migration-v1.md); it moves and converts what it can and leaves `<!-- MIGRATION: ... -->` markers where judgement is needed.
5. Create only missing structure. Preserve unrelated content and never silently replace an existing file.
6. Populate files with actual project facts or clearly marked `unknown` items. Never turn guesses into durable facts.
7. Choose the task backend (`--tasks`, default `markdown`; propose `beads` when `bd` is on PATH and the project needs computed ready-work or atomic claims), record the agent's identity in `AGENTS.md`, create an initial task, record the initialisation session, and state the next action.

When Python 3 is available, preview deterministic creation with:

```bash
python3 scripts/init_workspace.py \
  --root /path/to/project \
  --project "Project name" \
  --agent-id main \
  --agent-name "Main" \
  --tasks markdown
```

Review the preview, then repeat with `--apply`. The script creates missing files and directories only; it does not move or overwrite existing content. If scripts cannot run, copy and customise `assets/workspace-template/` manually using the standard.

## Operate

Before meaningful work:

1. Follow the boot sequence in `AGENTS.md`.
2. Verify the assigned task, accountable owner, acceptance criteria, dependencies, approval state, and next action.
3. Open a uniquely named session record under `sessions/YYYY/MM/`.

During work:

- keep `memory-bank/activeContext.md` concise and current, and when the user says "update memory bank" review every file in `memory-bank/`;
- record facts, inferences, assumptions, proposals, decisions, and approvals as different categories;
- write a decision record under `docs/decisions/` when a choice could later be undone without knowing why it was made, and stop to propose a change when a task conflicts with an accepted record;
- link material claims and completed tasks to evidence or artifacts;
- request approval immediately before consequential external actions unless policy explicitly grants authority;
- keep durable procedures in the harness's skill directory, not in the workspace;
- avoid simultaneous edits to the same shared file and never discard another actor's changes.

Before ending:

1. Verify outputs against acceptance criteria.
2. Update `memory-bank/activeContext.md` and `memory-bank/progress.md`, then the task backend and any decision records under `docs/decisions/` as needed.
3. Record files changed, external actions, approvals, blockers, and a concrete hand-off.
4. Close the session record. Treat it as append-only after closure; add dated corrections rather than rewriting history.
5. Produce due summaries by synthesis, not concatenation.

## Scale carefully

One agent is the default. One task has exactly one accountable owner even when several agents contribute. Before adding an agent, read [the multi-agent extension](references/multi-agent-extension.md) and define its mandate, exclusions, sources of truth, access scope, approval boundary, inputs, outputs, escalation path, and retirement condition. Do not create a decorative hierarchy.

## Preserve authority boundaries

Setting up or maintaining files never grants permission to send communications, publish content, spend money, accept legal terms, change credentials or access, deploy production systems, disclose data, or delete records. Follow project policy and obtain explicit approval when authority is missing or ambiguous.

Never store passwords, tokens, private keys, recovery codes, session cookies, or other secret values in the workspace. Store only approved references to externally managed secrets.

## Validate and hand over

Run the structural validator when Python 3 is available:

```bash
python3 scripts/validate_workspace.py --root /path/to/project
```

Then perform the semantic test the script cannot prove: give a fresh compatible agent no prior conversation and ask it to read `AGENTS.md`. It should correctly identify its mandate, current state, active task, constraints, evidence, approval needs, and next action.

Record audit failures as tasks. A workspace is not portable merely because its files are outside the original vendor.
