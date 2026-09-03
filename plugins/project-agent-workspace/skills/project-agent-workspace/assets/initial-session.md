# Session — {{DATE}}

- Agent: {{AGENT_ID}}
- Runtime: unknown
- Started: {{TIMESTAMP}}
- Ended: {{TIMESTAMP}}
- Tasks: SETUP-0001

## Objective

Initialise a vendor-neutral project agent workspace.

## Inputs and sources

- Project name supplied during initialisation: {{PROJECT_NAME}}
- `project-agent-workspace` skill

## Actions performed

- Created missing workspace structure and initial records without overwriting existing files.
- Registered {{AGENT_NAME}} as the initial {{AGENT_ROLE}}.

## Findings

- Substantive project purpose, scope, outcomes, access, and retention rules require confirmation.

## Decisions made or proposed

- `DEC-0001` records the vendor-neutral workspace decision.

## Files created or modified

- See the initial workspace tree.

## External actions

None.

## Approvals

- No consequential external action requested.

## Open questions and blockers

- Confirm the project foundation and authority with the project owner.

## State and task updates

- Created `SETUP-0001` and assigned it to {{AGENT_ID}}.

## Handoff

Follow `WARM_ME_UP.md`, then complete the next action in `project/TASKS.md`.
