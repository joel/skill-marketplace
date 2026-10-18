---
status: "accepted"
date: {{DATE}}
decision-makers: {{AGENT_ID}}, project-owner
consulted: none
informed: none
---

# Use a vendor-neutral workspace as the system of record

## Context and Problem Statement

Work on this project is done by AI agents under different harnesses, possibly on different machines, and must resume from what is written down. Project continuity must not depend on one provider's hidden memory or chat history. Where should the durable record of tasks, state, decisions, sessions, and approvals live?

## Decision Drivers

* Resume the same subject from another machine or another harness without the previous conversation
* Records a human reviewer can read and audit
* Explicit task ownership and approval boundaries
* No dependency on a single AI vendor

## Considered Options

* Provider-only conversation history and built-in memory
* A hosted memory service shared across tools
* A file-backed workspace versioned with the project

## Decision Outcome

Chosen option: "A file-backed workspace versioned with the project", because it is the only option that is readable without any vendor's tooling, travels with the repository, and gives explicit places for ownership, approvals, and history.

### Consequences

* Good, because state, decisions, and history are portable and reviewable.
* Good, because hand-offs between sessions, machines, and harnesses are recoverable from files alone.
* Bad, because agents must maintain the records as part of normal work.
* Bad, because stale written state can mislead later agents and must be checked on boot.

### Confirmation

The cold-start test in `AGENTS.md`: a fresh agent with no prior conversation reads the workspace and states purpose, current state, active task, constraints, and next action. `validate_workspace.py` from the skill checks the structure.

## Pros and Cons of the Options

### Provider-only conversation history and built-in memory

* Good, because it needs no maintenance.
* Bad, because it is invisible to other harnesses and machines.
* Bad, because a human cannot audit or correct it.

### A hosted memory service shared across tools

* Good, because recall works from any client signed in to the service.
* Bad, because the record lives with a vendor, not with the project.
* Bad, because it adds an account, a dependency, and a disclosure surface.

### A file-backed workspace versioned with the project

* Good, because it is plain text in the repository.
* Good, because every harness can read and write files.
* Neutral, because it relies on discipline, and on hooks where the harness offers them, to stay current.

## More Information

Revisit when the workspace no longer supports reliable cold-start recovery.
