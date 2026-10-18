# Decisions — Main

No agent-scoped decisions have been recorded yet. Project decision `DEC-0001` establishes the vendor-neutral workspace.

## DEC-0004 — Sessions are recorded in UTC

- Date: 2026-08-20
- Status: active
- Owner: main
- Approver: not-required
- Supersedes: none
- Superseded-by: none
- Review: none

### Context

Two machines in different time zones produced out-of-order session names.

### Decision

All session timestamps use UTC with a Z suffix.

### Reasons

- Sortable file names across machines.

### Alternatives considered

- Local time with offset

### Consequences and risks

- Humans must convert when reading.

### Evidence

- agents/main/sessions/
