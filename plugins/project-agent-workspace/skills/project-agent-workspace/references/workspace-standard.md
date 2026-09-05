# Vendor-neutral project agent workspace standard

Use this reference when establishing, adopting, scaling, auditing, or materially changing a persistent agent workspace.

## Invariants

- The workspace is authoritative; provider memory is a cache.
- Persistent context must be human-readable and recoverable without the originating provider.
- State and task queues are mutable. Closed session records and historical decisions are append-only.
- Every active task has one accountable owner.
- External side effects follow explicit project approval policy.
- Reusable procedures belong in standards-compliant skills; live project facts do not.
- Secret values never belong in the workspace.
- Existing material is preserved until a reviewed migration or retention decision authorises change.

## Minimum topology

```text
<project-root>/
├── AGENTS.md
├── README.md
├── project/
│   ├── ABOUT.md
│   ├── POLICIES.md
│   ├── STATE.md
│   ├── TASKS.md
│   └── DECISIONS.md
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
│       ├── archive/
│       └── .skills/
├── inbox/
├── outbox/
├── artifacts/
├── decisions/
├── summaries/{weekly,monthly,yearly}/
└── archive/
```

The project-level directories hold shared cross-agent material. Agent directories hold role-specific work. Add `project/PEOPLE.md`, `SYSTEMS.md`, `GLOSSARY.md`, or domain directories only when their information exists and has a clear owner.

## File responsibilities

| File | Purpose | Mutation rule |
| --- | --- | --- |
| `AGENTS.md` | Enforceable root instructions and precedence | Versioned, carefully reviewed |
| `README.md` | Short human map and entry points | Mutable |
| `project/ABOUT.md` | Stable project identity, scope, outcomes | Mutable with review |
| `project/POLICIES.md` | Authority, privacy, security, retention, approvals | Controlled change |
| `project/STATE.md` | Concise current cross-agent situation | Continuously maintained |
| `project/TASKS.md` | Cross-agent initiatives and ownership | Continuously maintained |
| `project/DECISIONS.md` | Index or compact record of durable decisions | Append or supersede |
| `agents/REGISTRY.md` | Agent identities, mandates, lifecycle, access class | Maintained by coordinator |
| Agent `ABOUT.md` | Mandate, outcomes, exclusions, relationships | Stable; review changes |
| Agent `WARM_ME_UP.md` | Deterministic cold-start sequence | Stable; test changes |
| Agent `POLICIES.md` | Role-specific authority and constraints | Controlled change |
| Agent `STATE.md` | Current role state and priorities | Continuously maintained |
| Agent `TASKS.md` | Agent-owned queue | Continuously maintained |
| Agent `DECISIONS.md` | Role-scoped durable decisions | Append or supersede |

Shared facts live once at project level and are referenced from agents. Do not maintain subtly different copies.

## Deterministic boot sequence

An agent's `WARM_ME_UP.md` should require:

1. Read root `AGENTS.md`.
2. Read `project/ABOUT.md` and `project/POLICIES.md`.
3. Read the agent's `ABOUT.md` and `POLICIES.md`.
4. Read project and agent `STATE.md` and relevant `TASKS.md`.
5. Read relevant active decisions.
6. Read the current monthly summary and, if needed, the previous one.
7. Read the latest three relevant sessions rather than all history.
8. Discover available `.skills/` and load only those relevant to the task.
9. Verify ownership, dependencies, blockers, evidence, and approval status.
10. Open a session record before meaningful work.

A coordinator additionally reads `agents/REGISTRY.md` and checks unowned, stale, blocked, overdue, or conflicting work.

## Agent creation and lifecycle

Create an agent when specialised knowledge, recurring ownership, permission isolation, independent workload, or a distinct audit trail justifies persistent identity. Otherwise use the current agent.

Each registry entry records stable ID, display name, mandate, accountable domain, status, path, runtime when known, access class, owned tasks, dependencies, escalation path, creation date, last activity, review date, and replacement or retirement linkage.

Recommended states: `proposed`, `active`, `paused`, `blocked`, `replacing`, `retired`, `archived`.

Retirement requires reassignment or closure of tasks, a final state and hand-off, preservation of historical sessions and decisions, access revocation where applicable, and a registry update. Do not delete the history simply because the actor is gone.

## Authority baseline

Unless project policy says otherwise, agents may read authorised material, organise non-destructively, analyse, draft, and propose. Explicit approval is normally required immediately before external communications, publication, purchases, payments, trades, legal acceptance, regulatory filing, identity or banking changes, credential or access changes, production deployment, disclosure of protected data, or irreversible deletion.

An approval packet states the exact action, target or recipient, reason, expected result, risks, alternatives, evidence, reversibility, and deadline. An approval is scoped to that action; silence and technical capability are not approval.

## Evidence and epistemic status

Material work should distinguish:

- **fact:** directly supported by a source;
- **inference:** reasoned conclusion from stated facts;
- **assumption:** temporarily accepted but unverified input;
- **proposal:** recommendation awaiting selection;
- **decision:** selected course of action;
- **approval:** permission for a specific consequential action.

Link tasks, decisions, sessions, and artifacts so a reviewer can trace important outcomes. Preserve source originals and document transformations when practical.

## Concurrency

- Assign an accountable owner before editing shared state.
- Re-read a shared file immediately before writing.
- Avoid simultaneous edits to the same file.
- Merge non-conflicting changes; never discard another actor's work.
- Use append-only records for sessions, hand-offs, and decision history.
- Use a documented task lease or reliable lock only if the storage/runtime can support it safely.
- Treat stale locks as unresolved until the owner or coordinator releases them.

Resolve conflicts by policy, ownership, evidence, and human direction—not last-writer-wins.

## Memory compaction

Use:

```text
sessions → weekly summaries → monthly summaries → yearly summaries
```

Names are `YYYY-Www.md`, `YYYY-MM.md`, and `YYYY.md`. Higher levels synthesise outcomes, decisions, task changes, external actions, risks, unresolved issues, and priorities. They do not concatenate logs.

## Portability and recovery checks

- **Cold start:** a fresh agent can resume from files without previous conversation.
- **Provider replacement:** another compatible runtime can operate without hidden state.
- **Dependency:** critical workflows have documented non-proprietary or manual alternatives.
- **Evidence:** material actions trace from source through task, decision, approval, artifact, and session.
- **Restore:** important content can be restored from a tested backup.

Record failures as owned tasks with acceptance criteria and next actions.
