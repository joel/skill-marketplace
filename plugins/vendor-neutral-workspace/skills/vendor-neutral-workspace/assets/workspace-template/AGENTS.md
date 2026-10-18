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
2. Read `ABOUT.md` and `STATE.md`.
3. Read `POLICIES.md`.
4. Read `DECISIONS.md`.
5. Read `TASKS.md`; confirm the task's owner, acceptance criteria, dependencies, blockers, and approval state.
6. Read the current monthly summary in `summaries/monthly/`, when one exists.
7. Read the latest session record in `sessions/`; follow its Handoff to earlier records only when it points there.
8. Open a uniquely named session record under `sessions/YYYY/MM/`.

Do not trust remembered information unless it is verified against the workspace or an authoritative source. If written state looks stale or conflicting, investigate and record the correction rather than silently choosing a version.

## While working

- Keep `STATE.md` concise and current; keep actionable work in `TASKS.md`, one accountable owner per task. Do not silently take ownership or discard concurrent work.
- Record facts, inferences, assumptions, proposals, decisions, and approvals as distinct categories, and link material claims to evidence.
- Record durable decisions in `DECISIONS.md`. Never delete a superseded decision; link its replacement.
- Request approval immediately before any consequential external action unless `POLICIES.md` explicitly grants the authority. Write the request as an approval packet in `approvals/` and link it from the task.
- Never store secret values here; store only references to externally managed secrets.
- Durable procedures belong in the harness's skill directory, never in this workspace. This workspace holds live project facts.

## Before ending

1. Verify outputs against the task's acceptance criteria.
2. Update `STATE.md`, `TASKS.md`, and `DECISIONS.md` as needed.
3. In the session record, note files changed, external actions, approvals, blockers, and a concrete hand-off for the next session, then close it. Closed session records are append-only: add dated corrections rather than rewriting.
4. Produce any due summary by synthesis, not concatenation.
