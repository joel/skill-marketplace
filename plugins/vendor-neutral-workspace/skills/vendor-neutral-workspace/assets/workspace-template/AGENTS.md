# Agent operating rules — {{PROJECT_NAME}}

This workspace is the durable system of record. Do not rely on provider memory for anything needed after the current session: if it is not written here, it is not known.

## Agent

- Stable ID: {{AGENT_ID}}
- Name: {{AGENT_NAME}}
- Role: {{AGENT_ROLE}}
- Mandate: maintain this workspace and carry out project work within the authority granted by `POLICIES.md`.
- Escalation: project-owner, for missing authority, ambiguous consequential actions, conflicting ownership, security incidents, and unresolved material uncertainty.
- Created: {{DATE}}

## Before meaningful work

1. Read this file.
2. Read all six memory-bank files: `memory-bank/projectbrief.md`, `memory-bank/productContext.md`, `memory-bank/systemPatterns.md`, `memory-bank/techContext.md`, `memory-bank/activeContext.md`, `memory-bank/progress.md`.
3. Read `POLICIES.md`.
4. Read `docs/decisions/README.md`; open only the accepted records relevant to the task.
5. Read `TASKS.md`; confirm the task's owner, acceptance criteria, dependencies, blockers, and approval state.
6. Read the current monthly summary in `summaries/monthly/`, when one exists.
7. Read the latest session record in `sessions/`; follow its Handoff to earlier records only when it points there.
8. Open a uniquely named session record under `sessions/YYYY/MM/`.

Do not trust remembered information unless it is verified against the workspace or an authoritative source. If written state looks stale or conflicting, investigate and record the correction rather than silently choosing a version.

## While working

- Keep actionable work in `TASKS.md`, one accountable owner per task. Do not silently take ownership or discard concurrent work.
- Keep the memory bank current. `activeContext.md` holds focus, recent changes, and open questions, never the next action (that is on the task). `progress.md` holds what works and verified milestones, never what is left or known issues (those are tasks). Update the memory bank when you discover a project pattern, after a significant change, when context needs clarification, and when the user says "update memory bank", which means review every file in `memory-bank/`, focusing on `activeContext.md` and `progress.md`. Set a file's `Updated` line whenever you change it.
- Record facts, inferences, assumptions, proposals, decisions, and approvals as distinct categories, and link material claims to evidence.
- Decisions live in `docs/decisions/` as decision records. Accepted records are binding; proposed records are non-binding context; superseded records are history. If a task conflicts with an accepted record, stop and propose a change to the task or the record rather than working around it. Propose a new record when a change introduces or revises a durable decision, that is, a choice someone could later undo without knowing why it was made. State each rule once, in the record that owns it, and reference it elsewhere.
- Request approval immediately before any consequential external action unless `POLICIES.md` explicitly grants the authority. Write the request as an approval packet in `approvals/` and link it from the task.
- Never store secret values here; store only references to externally managed secrets.
- Durable procedures belong in the harness's skill directory, never in this workspace. This workspace holds live project facts.

## Before ending

1. Verify outputs against the task's acceptance criteria.
2. Update `memory-bank/activeContext.md` and `memory-bank/progress.md`, then `TASKS.md` and any decision records under `docs/decisions/` as needed.
3. In the session record, note files changed, external actions, approvals, blockers, and a concrete hand-off for the next session, then close it. Closed session records are append-only: add dated corrections rather than rewriting.
4. Produce any due summary by synthesis, not concatenation.
