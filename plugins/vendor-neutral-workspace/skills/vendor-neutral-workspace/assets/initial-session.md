# Session — {{DATE}}

- Agent: {{AGENT_ID}}
- Runtime: unknown
- Started: {{TIMESTAMP}}
- Ended: {{TIMESTAMP}}
- Tasks: {{INITIAL_TASK_ID}}

## Objective

Initialise a vendor-neutral workspace.

## Inputs and sources

- Project name supplied during initialisation: {{PROJECT_NAME}}
- `vendor-neutral-workspace` skill

## Actions performed

- Created missing workspace structure and initial records without overwriting existing files.
- Created the six memory-bank files with `unknown` placeholders.
- Recorded {{AGENT_NAME}} (`{{AGENT_ID}}`) as the {{AGENT_ROLE}} in `AGENTS.md`.

## Findings

- Substantive project purpose, scope, outcomes, access, and retention rules require confirmation.

## Decisions made or proposed

- `{{ADR_0001_ID}}` (`docs/decisions/{{ADR_0001_FILE}}`) records the vendor-neutral workspace decision, status accepted.

## Files created or modified

- See the initial workspace tree.

## External actions

None.

## Approvals

- No consequential external action requested.

## Open questions and blockers

- Confirm the project foundation and authority with the project owner.

## Memory-bank and task updates

- Created `{{INITIAL_TASK_ID}}` in the {{TASK_BACKEND}} task backend and assigned it to {{AGENT_ID}}.

## Handoff

Follow the boot sequence in `AGENTS.md`, then complete the next action on the initial task in the task backend.
