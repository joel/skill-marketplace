# Vendor-neutral workspace standard

Use this reference when establishing, adopting, auditing, or materially changing a persistent agent workspace. For more than one persistent agent, read it together with [the multi-agent extension](multi-agent-extension.md).

## Invariants

- The workspace is authoritative; provider memory is a cache.
- Persistent context must be human-readable and recoverable without the originating AI provider. Any tool the workspace relies on is declared in `workspace.yaml` and justified by a decision record. *(Changed in 2.0: v1 admitted no tooling at all.)*
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
├── workspace.yaml
├── memory-bank/
│   ├── projectbrief.md
│   ├── productContext.md
│   ├── systemPatterns.md
│   ├── techContext.md
│   ├── activeContext.md
│   └── progress.md
├── TASKS.md                  # or .beads/ when workspace.yaml says tasks: beads
├── docs/decisions/
│   ├── README.md
│   ├── adr-template.md
│   └── NNNN-title.md
├── approvals/
├── sessions/YYYY/MM/
├── summaries/{weekly,monthly,yearly}/
├── artifacts/
└── archive/
```

One agent, identified in `AGENTS.md`, owns this layout. Add `PEOPLE.md`, `GLOSSARY.md`, further files under `memory-bank/`, or domain directories only when their information exists and has a clear owner. Several agents need the per-agent layout described in the extension.

## File responsibilities

| Path | Purpose | Mutation rule |
| --- | --- | --- |
| `AGENTS.md` | Operating rules, agent identity, boot sequence | Versioned, carefully reviewed |
| `README.md` | Short human map and entry point | Mutable |
| `POLICIES.md` | Authority, approvals, privacy, security, retention | Controlled change |
| `workspace.yaml` | Machine-readable facts: schema, agent id, task backend, hooks; authoritative for tooling | Changed together with a decision record |
| `memory-bank/projectbrief.md` | Purpose, requirements, scope; the source of truth the other five build on | Mutable with review |
| `memory-bank/productContext.md` | Why the project exists, problems solved, how it should work, UX goals | Mutable with review |
| `memory-bank/systemPatterns.md` | Architecture as it is, patterns, component relationships, links to decision records | Maintained as the system changes |
| `memory-bank/techContext.md` | Technologies, setup, constraints, dependencies, tool usage | Maintained as the stack changes |
| `memory-bank/activeContext.md` | Current focus, recent changes, open questions; never the next action | Continuously maintained |
| `memory-bank/progress.md` | What works and verified milestones; never what is left or known issues | Updated on verification |
| `TASKS.md` or `.beads/` | Tasks, in the backend `workspace.yaml` names; see the task backends reference | Continuously maintained |
| `docs/decisions/` | One MADR record per durable decision, plus `README.md` index and `adr-template.md` | New record or status change; accepted records otherwise immutable |
| `approvals/` | One packet per approval request | Append-only once decided |
| `sessions/YYYY/MM/` | One record per working session | Append-only once closed |
| `summaries/` | Weekly, monthly, yearly syntheses | Append or regenerate |
| `artifacts/` | Outputs and evidence | Preserve originals |
| `archive/` | Retired material | Append-only |

Each fact lives once and is referenced from elsewhere. Do not maintain subtly different copies.

## Machine-readable facts and the task backend

`workspace.yaml` is a flat `key: value` file: `schema` (2), `agent` (the stable ID in `AGENTS.md`), `tasks` (`markdown` or `beads`), `hooks` (`on` or `off`). It is authoritative for tooling; when it and a prose file disagree, fix the prose. The validator errors when `agent` differs from `AGENTS.md`, or when a backend's files are present that `tasks` does not name. The task backend is chosen at init, recorded as a decision record, and described in [the task backends](task-backends.md).

## Deterministic boot sequence

`AGENTS.md` carries the sequence, so every harness that reads it boots the same way:

1. Read `AGENTS.md`.
2. Read all six `memory-bank/` files.
3. Read `POLICIES.md`.
4. Read `docs/decisions/README.md`; open only the accepted records relevant to the task.
5. List ready work in the task backend; confirm the task's owner, acceptance criteria, dependencies, blockers, and approval state.
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

## Memory bank

Project context lives in `memory-bank/`, in the six files of the Memory Bank pattern (Cline, Nick Baumann, 2025: <https://docs.cline.bot/features/memory-bank>). The files build on each other:

```text
projectbrief.md ──► productContext.md ──┐
                ──► systemPatterns.md ──┼──► activeContext.md ──► progress.md
                ──► techContext.md   ───┘
```

Read all six at the start of every session; they are short by design. Update them when a project pattern is discovered, after a significant change, when context needs clarification, and on the phrase "update memory bank", which means reviewing every file with attention on `activeContext.md` and `progress.md`. Each file carries an `Updated` line so staleness is visible.

Two files are scoped more tightly than in the original pattern, so they do not duplicate the task list: `activeContext.md` holds focus, recent changes, and open questions, never the next action; `progress.md` holds what works and verified milestones, never what is left or known issues. Both of those belong on tasks.

The pattern on its own has no tasks, no decision history, no session log, no hand-off, and no approval record, and it rewrites files in place, so it keeps no history. That is why `TASKS.md`, `docs/decisions/`, `sessions/`, `summaries/`, and `approvals/` sit beside it: the memory bank is the current picture, the rest is the record.

## Decisions

Durable decisions are decision records in `docs/decisions/`, one file per decision in MADR 4.0.0 form, indexed by `docs/decisions/README.md`. Accepted records are binding; proposed records are non-binding context; superseded and deprecated records are history. An agent that finds a task in conflict with an accepted record stops and proposes a change to the task or the record instead of working around it. The record contracts give the filename rule, the status vocabulary, the immutability rule, and the test for what deserves a record.

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
- **Dependency:** every tool the workspace relies on is named in `workspace.yaml`, and the task backends reference documents how to recover without it.
- **Evidence:** material actions trace from source through task, decision, approval, artifact, and session.
- **Restore:** important content can be restored from a tested backup.

Record failures as owned tasks with acceptance criteria and next actions.
