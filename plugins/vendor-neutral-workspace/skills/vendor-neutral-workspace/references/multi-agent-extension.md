# Multi-agent extension

The default workspace has one agent. Use this extension only when recurring ownership, specialised capability, permission isolation, parallel work, or a distinct audit trail justifies more than one persistent agent. Otherwise use the current agent.

The text below was moved from the single-agent standard when the default layout was flattened; it is kept intact here so nothing is lost and will be restructured in a follow-up.

## Per-agent layout

```text
<project-root>/
├── agents/
│   ├── REGISTRY.md
│   └── <agent-id>/
│       ├── ABOUT.md
│       ├── WARM_ME_UP.md
│       ├── POLICIES.md
│       ├── STATE.md
│       ├── TASKS.md
│       ├── DECISIONS.md
│       ├── inbox/
│       ├── outbox/
│       ├── artifacts/
│       ├── handoffs/
│       ├── sessions/YYYY/MM/
│       ├── summaries/{weekly,monthly,yearly}/
│       └── archive/
├── inbox/
└── outbox/
```

The project-level files of the standard hold shared cross-agent material; agent directories hold role-specific work. Project-level `inbox/` and `outbox/` carry cross-agent messages.

| File | Purpose | Mutation rule |
| --- | --- | --- |
| `agents/REGISTRY.md` | Agent identities, mandates, lifecycle, access class | Maintained by coordinator |
| Agent `ABOUT.md` | Mandate, outcomes, exclusions, relationships | Stable; review changes |
| Agent `WARM_ME_UP.md` | Deterministic cold-start sequence for that agent | Stable; test changes |
| Agent `POLICIES.md` | Role-specific authority and constraints | Controlled change |
| Agent `STATE.md` | Current role state and priorities | Continuously maintained |
| Agent `TASKS.md` | Agent-owned queue | Continuously maintained |
| Agent `DECISIONS.md` | Role-scoped durable decisions | Append or supersede |

Shared facts live once at project level and are referenced from agents. Do not maintain subtly different copies.

## Boot sequence additions

An agent's `WARM_ME_UP.md` follows the standard's boot sequence and additionally reads the agent's own `ABOUT.md`, `POLICIES.md`, `STATE.md`, `TASKS.md`, and `DECISIONS.md`.

A coordinator additionally reads `agents/REGISTRY.md` and checks unowned, stale, blocked, overdue, or conflicting work. The first agent may coordinate the project while also performing small cross-cutting work. Delegate substantial domain work when separate ownership improves continuity, safety, or auditability.

## Agent creation and lifecycle

Before adding an agent, check the registry for overlap and define its mandate, exclusions, sources of truth, access scope, approval boundary, inputs, outputs, escalation path, and retirement condition.

Each registry entry records stable ID, display name, mandate, accountable domain, status, path, runtime when known, access class, owned tasks, dependencies, escalation path, creation date, last activity, review date, and replacement or retirement linkage.

Recommended states: `proposed`, `active`, `paused`, `blocked`, `replacing`, `retired`, `archived`.

Retirement requires reassignment or closure of tasks, a final state and hand-off, preservation of historical sessions and decisions, access revocation where applicable, and a registry update. Do not delete the history simply because the actor is gone.

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

Store hand-offs under the sending agent's `handoffs/`. The recipient acknowledges by updating the hand-off or linked task. A hand-off does not transfer authority that the sender did not possess.

## Concurrency between agents

- Assign an accountable owner before editing shared state.
- Use a documented task lease or reliable lock only if the storage/runtime can support it safely.
- Treat stale locks as unresolved until the owner or coordinator releases them.
- Use append-only records for hand-offs as well as sessions and decision history.
