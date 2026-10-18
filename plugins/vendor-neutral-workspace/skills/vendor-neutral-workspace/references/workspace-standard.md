# Vendor-neutral workspace standard

Use this reference when establishing, adopting, auditing, or materially changing a persistent agent workspace. For more than one persistent agent, read it together with [the multi-agent extension](multi-agent-extension.md).

## Invariants

- The workspace is authoritative; provider memory is a cache.
- Persistent context must be human-readable and recoverable without the originating provider.
- State and task queues are mutable. Closed session records and historical decisions are append-only.
- Every active task has one accountable owner.
- External side effects follow explicit project approval policy.
- Durable procedures belong in the harness's skill directory; the workspace holds live project facts.
- Secret values never belong in the workspace.
- Existing material is preserved until a reviewed migration or retention decision authorises change.

## Minimum topology

```text
<project-root>/
├── AGENTS.md
├── README.md
├── POLICIES.md
├── ABOUT.md
├── STATE.md
├── TASKS.md
├── DECISIONS.md
├── approvals/
├── sessions/YYYY/MM/
├── summaries/{weekly,monthly,yearly}/
├── artifacts/
└── archive/
```

One agent, identified in `AGENTS.md`, owns this layout. Add `PEOPLE.md`, `SYSTEMS.md`, `GLOSSARY.md`, or domain directories only when their information exists and has a clear owner. Several agents need the per-agent layout described in the extension.

## File responsibilities

| Path | Purpose | Mutation rule |
| --- | --- | --- |
| `AGENTS.md` | Operating rules, agent identity, boot sequence | Versioned, carefully reviewed |
| `README.md` | Short human map and entry point | Mutable |
| `POLICIES.md` | Authority, approvals, privacy, security, retention | Controlled change |
| `ABOUT.md` | Stable project identity, scope, outcomes | Mutable with review |
| `STATE.md` | Concise current situation and priorities | Continuously maintained |
| `TASKS.md` | Actionable work, one owner each | Continuously maintained |
| `DECISIONS.md` | Durable decisions; superseded ones kept and linked | Append or supersede |
| `approvals/` | One packet per approval request | Append-only once decided |
| `sessions/YYYY/MM/` | One record per working session | Append-only once closed |
| `summaries/` | Weekly, monthly, yearly syntheses | Append or regenerate |
| `artifacts/` | Outputs and evidence | Preserve originals |
| `archive/` | Retired material | Append-only |

Each fact lives once and is referenced from elsewhere. Do not maintain subtly different copies.

## Deterministic boot sequence

`AGENTS.md` carries the sequence, so every harness that reads it boots the same way:

1. Read `AGENTS.md`.
2. Read `ABOUT.md` and `STATE.md`.
3. Read `POLICIES.md`.
4. Read `DECISIONS.md`.
5. Read `TASKS.md`; confirm the task's owner, acceptance criteria, dependencies, blockers, and approval state.
6. Read the current monthly summary, when one exists.
7. Read the latest session record; follow its Handoff to earlier records only when it points there. Reading all history is a boot-budget failure, not diligence.
8. Open a session record before meaningful work.

## Authority baseline

Unless project policy says otherwise, agents may read authorised material, organise non-destructively, analyse, draft, and propose. Explicit approval is normally required immediately before external communications, publication, purchases, payments, trades, legal acceptance, regulatory filing, identity or banking changes, credential or access changes, production deployment, disclosure of protected data, or irreversible deletion.

An approval packet lives in `approvals/` and states the exact action, target or recipient, reason, expected result, risks, alternatives, evidence, reversibility, and deadline. An approval is scoped to that action; silence and technical capability are not approval.

## Evidence and epistemic status

Material work should distinguish:

- **fact:** directly supported by a source;
- **inference:** reasoned conclusion from stated facts;
- **assumption:** temporarily accepted but unverified input;
- **proposal:** recommendation awaiting selection;
- **decision:** selected course of action;
- **approval:** permission for a specific consequential action.

Link tasks, decisions, sessions, approvals, and artifacts so a reviewer can trace important outcomes. Preserve source originals and document transformations when practical.

## Concurrency

Concurrent actors in this layout are usually the same agent in two sessions, on two machines, or under two harnesses, working the same repository.

- Re-read a shared file immediately before writing.
- Avoid simultaneous edits to the same file; prefer appending to the session record over rewriting shared state mid-task.
- Merge non-conflicting changes; never discard another actor's work.
- Use append-only records for sessions, approvals, and decision history.

Resolve conflicts by policy, ownership, evidence, and human direction, not last-writer-wins. Task leases, locks, and coordinator roles are described in the extension.

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
