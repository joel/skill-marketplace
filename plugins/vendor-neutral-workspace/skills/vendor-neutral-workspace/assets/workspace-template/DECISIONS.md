# Decisions — {{PROJECT_NAME}}

## DEC-0001 — Use a vendor-neutral agent workspace

- Date: {{DATE}}
- Status: active
- Owner: {{AGENT_ID}}
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
- Recoverable hand-offs between sessions, machines, and harnesses

### Alternatives considered

- Provider-only conversation history

### Consequences and risks

- Agents must maintain records as part of normal work.
- Stale written state can mislead later agents and must be reviewed.

### Evidence

- AGENTS.md (operating rules and boot sequence)
- README.md
