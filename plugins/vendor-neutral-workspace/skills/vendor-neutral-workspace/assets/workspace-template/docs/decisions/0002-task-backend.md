---
status: "accepted"
date: {{DATE}}
decision-makers: {{AGENT_ID}}, project-owner
consulted: none
informed: none
---

# Task backend

## Context and Problem Statement

Tasks need one accountable owner, a status, dependencies, acceptance criteria, an approval state, evidence, and a next action, and they must be readable by every harness and every machine that works on this project. The record contracts define that task contract; this decision picks where the tasks live. The choice is recorded in `workspace.yaml` as `tasks:` so tooling can read it without parsing this record.

## Decision Drivers

* Readable and recoverable without any vendor's tooling
* Works from every harness and every machine that clones the repository
* Supports dependencies, ready-work discovery, and atomic claims when several sessions or agents work in parallel
* Minimal setup on a fresh machine

## Considered Options

* Markdown task file in the repository (`TASKS.md`)
* Beads (`bd`), a graph issue tracker for agents
* Backlog.md, Markdown task files with a CLI and MCP server
* GitHub Issues through `gh`

## Decision Outcome

{{TASK_BACKEND_DECISION}}

### Confirmation

`workspace.yaml` names the backend; `validate_workspace.py` from the skill checks that the backend's files exist and that no other backend's files are present.

## Pros and Cons of the Options

### Markdown task file in the repository

* Good, because it is plain text, diffable, and needs no tool.
* Good, because every harness can read and edit it.
* Bad, because dependencies and ready-work discovery are by convention, not computed.
* Bad, because concurrent sessions can conflict on one file.

### Beads

* Good, because it computes ready work from typed dependencies and supports atomic claims and leases.
* Good, because it ships integration recipes for many harnesses.
* Bad, because the database is binary and gitignored; the human-readable form is an opt-in JSONL export.
* Bad, because every machine needs the same `bd` version, and the project has shipped breaking changes often.

### Backlog.md

* Good, because tasks are Markdown files with dependencies and acceptance criteria, plus a CLI and MCP server.
* Neutral, because it is a second tool to install, lighter than Beads.
* Bad, because assignees and priorities are not part of its model.

### GitHub Issues

* Good, because it is machine-independent with no setup beyond `gh`.
* Bad, because tasks leave the repository and need the network.
* Bad, because it ties the workspace to one hosting provider.

## More Information

Revisit when the task graph outgrows the chosen backend or when a second agent needs atomic claims. Changing the backend is a new record that supersedes this one, an update to `workspace.yaml`, and a migration of the open tasks.
