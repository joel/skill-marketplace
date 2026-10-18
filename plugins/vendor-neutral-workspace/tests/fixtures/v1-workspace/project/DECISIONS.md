# Project decisions — Fixture project

## DEC-0001 — Use a vendor-neutral agent workspace

- Date: 2026-10-18
- Status: active
- Owner: main
- Approver: project-owner
- Supersedes: none
- Superseded-by: none
- Review: when the workspace no longer supports reliable cold-start recovery

### Context

Project continuity must not depend on one model provider's hidden memory.

### Decision

Use this file-backed workspace as the durable system of record.

### Reasons

- Human-readable, portable state and history
- Explicit task ownership and approval boundaries
- Recoverable hand-offs between compatible agents

### Alternatives considered

- Provider-only conversation history

### Consequences and risks

- Agents must maintain records as part of normal work.
- Stale written state can mislead later agents and must be reviewed.

### Evidence

- AGENTS.md
- agents/main/WARM_ME_UP.md

## DEC-0002 — Keep PostgreSQL as the primary store

- Date: 2026-09-12
- Status: active
- Owner: main
- Approver: project-owner
- Supersedes: DEC-0003
- Superseded-by: none
- Review: 2027-03-01

### Context

The pilot ran on SQLite; concurrent writers from two agents corrupted the file twice.

### Decision

Use PostgreSQL 16 for all persistent application data.

### Reasons

- Concurrent writers are safe.
- Managed hosting is available.

### Alternatives considered

- Stay on SQLite with a single writer
- MySQL

### Consequences and risks

- A database server is required for local development.
- Migrations must be reviewed before deploy.

### Evidence

- artifacts/sqlite-corruption-2026-09.md

## DEC-0003 — Use SQLite for the pilot

- Date: 2026-07-02
- Status: superseded
- Owner: main
- Approver: not-required
- Supersedes: none
- Superseded-by: DEC-0002
- Review: none

### Context

The pilot needed zero setup.

### Decision

Use a single SQLite file.

### Reasons

- No server to run.

### Alternatives considered

- PostgreSQL

### Consequences and risks

- Single writer only.

### Evidence

- none
