# Project tasks — Fixture project

## Active

### SETUP-0001 — Confirm and complete project foundation

- Status: ready
- Priority: high
- Owner: main
- Created: 2026-10-18
- Updated: 2026-10-18
- Requested-by: project-owner
- Depends-on: none
- Approval: not-required
- Evidence: README.md, AGENTS.md, project/

#### Objective

Replace unknown initial values with verified project purpose, scope, outcomes, sources of truth, authority rules, and next priorities.

#### Acceptance criteria

- Project owner confirms purpose, scope, and intended outcomes.
- Project and agent state contain no unlabelled assumptions.
- Every active task has one owner and a next action.

#### Blockers

- Awaiting project-owner input.

#### Next action

Ask the project owner to confirm the project foundation.

### FIX-0002 — Replace the SQLite pilot store

- Status: in-progress
- Priority: high
- Owner: main
- Created: 2026-09-12
- Updated: 2026-10-01
- Requested-by: project-owner
- Depends-on: none
- Approval: approved (decisions/APPROVAL-FIX-0002-store-swap.md)
- Evidence: project/DECISIONS.md

#### Objective

Move persistent data to PostgreSQL per DEC-0002.

#### Acceptance criteria

- Application boots against PostgreSQL 16.
- Pilot data imported without loss.

#### Blockers

- none

#### Next action

Write the import script.
