# Multi-agent extension

The standard's default is one agent, identified in `AGENTS.md`, working the flat layout. Add persistent agents only when one of these holds: recurring ownership of a domain, specialised capability, permission isolation, independent parallel workload, or a distinct audit trail. A second harness, a second machine, or a second session of the same agent is not a second agent; the standard's concurrency rules already cover that.

This extension adds a registry, a per-agent directory, a per-agent boot file, inter-agent hand-offs and messages, and the rules that keep several actors from colliding. Everything in the standard still applies; the root files remain the shared source of truth.

## Topology

```text
<project-root>/
├── AGENTS.md                 # shared rules; the coordinator's identity block
├── ... (root files and directories of the standard)
├── inbox/                    # messages to the project (any agent may read)
├── outbox/                   # messages from the project to outside actors
└── agents/
    ├── REGISTRY.md
    └── <agent-id>/
        ├── ABOUT.md
        ├── WARM_ME_UP.md
        ├── POLICIES.md
        ├── STATE.md
        ├── TASKS.md
        ├── DECISIONS.md
        ├── inbox/
        ├── outbox/
        ├── artifacts/
        ├── handoffs/
        ├── sessions/YYYY/MM/
        ├── summaries/{weekly,monthly,yearly}/
        └── archive/
```

Root files hold shared, cross-agent material. Agent directories hold role-specific work. Shared facts live once at root and are referenced from agents; do not maintain subtly different copies. Agent IDs are lowercase letters, digits and single hyphens, and never change.

## File responsibilities

| Path | Purpose | Mutation rule |
| --- | --- | --- |
| `agents/REGISTRY.md` | Agent identities, mandates, lifecycle state, access class | Maintained by the coordinator |
| Agent `ABOUT.md` | Mandate, outcomes, exclusions, relationships | Stable; review changes |
| Agent `WARM_ME_UP.md` | Deterministic cold-start sequence for that agent | Stable; test changes |
| Agent `POLICIES.md` | Role-specific authority and constraints, narrower than root `POLICIES.md` | Controlled change |
| Agent `STATE.md` | Current role state and priorities | Continuously maintained |
| Agent `TASKS.md` | The agent's owned queue; cross-agent initiatives stay in root `TASKS.md` | Continuously maintained |
| Agent `DECISIONS.md` | Role-scoped durable decisions | Append or supersede |
| Agent `inbox/`, `outbox/` | Messages to and from this agent | Append-only |
| Agent `handoffs/` | Hand-offs this agent has sent | Append-only once acknowledged |
| Agent `sessions/`, `summaries/`, `artifacts/`, `archive/` | As in the standard, scoped to the agent | As in the standard |
| Root `inbox/`, `outbox/` | Messages to and from the project as a whole | Append-only |

## Adding an agent

1. Check `agents/REGISTRY.md` for overlap with an existing mandate. If the work fits an active agent, use that agent.
2. Define, before creating anything: mandate, accountable domain, exclusions, sources of truth, access scope and class, approval boundary, inputs, outputs, escalation path, and retirement condition.
3. Create `agents/<agent-id>/` from the templates below. Create only missing files; never overwrite.
4. Add the registry entry with status `proposed`, then `active` once the project owner confirms the mandate.
5. Give the agent one initial task in its `TASKS.md`, owned by it, with acceptance criteria and a next action.
6. Record the creation in the creating agent's session record and in root `STATE.md`.
7. Run the agent's cold-start test: a fresh session reads only its `WARM_ME_UP.md` and states its mandate, current state, active task, constraints, and next action.

The first agent may coordinate the project while also doing small cross-cutting work. Delegate substantial domain work when separate ownership improves continuity, safety, or auditability. Do not create a decorative hierarchy.

## Registry

`agents/REGISTRY.md` holds one entry per agent, past and present:

```markdown
# Agent registry — <project>

## <agent-id> — <Display name>

- Role: <role>
- Mandate: <one or two sentences>
- Accountable domain: <domain>
- Status: proposed | active | paused | blocked | replacing | retired | archived
- Workspace: agents/<agent-id>/
- Runtime: <provider/model or unknown>
- Access class: <least privilege; systems granted>
- Owned tasks: <IDs>
- Dependencies: <agents, humans, systems>
- Escalation: <identity>
- Created: <YYYY-MM-DD>
- Last active: <YYYY-MM-DD>
- Review: <YYYY-MM-DD>
- Replacement or retirement: <agent-id, date, or none>
```

States: `proposed` (defined, not yet confirmed), `active`, `paused` (no work expected, tasks kept), `blocked` (cannot proceed, escalation open), `replacing` (handing over to a named successor), `retired` (no further work; history preserved), `archived` (directory moved under `archive/`, entry kept).

## Agent files

`ABOUT.md`:

```markdown
# <Display name>

- Stable ID: <agent-id>
- Role: <role>
- Status: <registry status>
- Created: <YYYY-MM-DD>

## Purpose

## Accountable outcomes

## Responsibilities

## Exclusions

- No external side effects without policy authority and required approval.
- No assumption of competence or access that has not been granted.

## Sources of truth

- ../../AGENTS.md
- ../../ABOUT.md, ../../STATE.md, ../../TASKS.md, ../../DECISIONS.md
- ../REGISTRY.md
- This agent workspace

## Escalation

## Success and retirement
```

`WARM_ME_UP.md` follows the standard's boot sequence and adds the agent's own files:

```markdown
# Bootstrap — <Display name>

Before meaningful work:

1. Read `../../AGENTS.md`.
2. Read `../../ABOUT.md` and `../../STATE.md`.
3. Read `../../POLICIES.md`, then `ABOUT.md` and `POLICIES.md` here.
4. Read `../../DECISIONS.md` and `DECISIONS.md` here.
5. Read `TASKS.md` here and the entries in `../../TASKS.md` that name this agent; confirm owner, acceptance criteria, dependencies, blockers, and approval state.
6. Read `inbox/` for unacknowledged messages and hand-offs addressed to this agent.
7. Read the current monthly summary here, when one exists.
8. Read the latest session record here; follow its Handoff to earlier records only when it points there.
9. Open a uniquely named session record under `sessions/YYYY/MM/`.

Do not trust remembered information unless it is verified against the workspace or an authoritative source. If written state looks stale or conflicting, investigate and record the correction rather than silently choosing a version.
```

A coordinator's `WARM_ME_UP.md` adds, after step 5: read `../REGISTRY.md` and check for unowned, stale, blocked, overdue, or conflicting work across agents.

`POLICIES.md` starts with "Follow `../../POLICIES.md`." and then lists only what is narrower for this role: permitted actions, actions needing approval, prohibitions, and the tool and data scope actually granted. `STATE.md`, `TASKS.md`, and `DECISIONS.md` use the root templates and record contracts unchanged, scoped to the agent; the agent's `TASKS.md` lists the IDs it owns and links cross-agent tasks that live in root `TASKS.md` rather than copying them.

## Coordination

- One task has exactly one accountable owner even when several agents contribute. Contributors are named on the task; ownership moves only through a hand-off.
- Cross-agent initiatives live in root `TASKS.md`; each agent's queue lives in its own `TASKS.md`.
- The coordinator reviews the registry and the root task list at every boot, routes unowned work, and escalates conflicts it cannot resolve by policy, ownership, or evidence.
- Agents do not edit another agent's `STATE.md`, `TASKS.md`, or `DECISIONS.md`. They send a message or a hand-off instead.

## Messages

Use an agent's `inbox/` for requests, questions, and notices addressed to it, and `outbox/` for what it sends out; root `inbox/` and `outbox/` carry the same for the project as a whole. Name files `YYYY-MM-DD-<from>-<slug>.md`, state `From`, `To`, `At`, and `Status: open | acknowledged | closed` at the top, and never edit a message after sending: reply with a new one. A message does not transfer ownership or authority; a hand-off does.

## Hand-off between agents

```markdown
# Hand-off — <task IDs>

- From: <agent-id>
- To: <agent-id>
- At: <ISO 8601 timestamp>
- Status: offered | acknowledged | rejected | completed

## Requested outcome

## Context and completed work

## Files and evidence

## Unresolved questions

## Authority and approval state

## Next action
```

Store the hand-off under the sender's `handoffs/` and drop a notice in the recipient's `inbox/`. The recipient acknowledges by updating the hand-off's status and the linked task's owner. Until then the sender remains accountable. A hand-off does not transfer authority that the sender did not possess; approvals stay scoped to the action and actor they named.

## Concurrency between agents

- Assign an accountable owner before editing shared state.
- Re-read a shared file immediately before writing; avoid simultaneous edits to the same file.
- Merge non-conflicting changes; never discard another actor's work.
- Use append-only records for sessions, hand-offs, messages, and decision history.
- Use a documented task lease or a reliable lock only if the storage and runtime can support it safely; record the lease on the task (`Leased-by`, `Leased-until`).
- Treat a stale lease or lock as unresolved until the owner or the coordinator releases it; do not take it silently.

Resolve conflicts by policy, ownership, evidence, and human direction, not last-writer-wins.

## Retirement

Retiring an agent requires: reassignment or closure of every task it owns; a final `STATE.md` and a hand-off for anything in progress; preservation of its sessions, decisions, and artifacts; revocation of any access granted to it where applicable; and a registry update to `retired` or `archived` with the replacement named. Do not delete the history because the actor is gone; move the directory under `archive/` when it is no longer read.

## Validation

`scripts/validate_workspace.py` checks the root layout only. For each agent directory, check the file set against the table above by hand, confirm its registry entry and status, and run the cold-start test from its `WARM_ME_UP.md`.
