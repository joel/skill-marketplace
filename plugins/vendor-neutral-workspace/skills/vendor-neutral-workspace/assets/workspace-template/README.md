# {{PROJECT_NAME}}

A vendor-neutral workspace: these files, not any provider's chat history, are the durable record of the work. Humans and AI agents start by reading `AGENTS.md`.

| Path | Holds |
| --- | --- |
| `AGENTS.md` | Operating rules, agent identity, boot sequence |
| `POLICIES.md` | Authority, approvals, security, retention |
| `memory-bank/` | Project context in six Memory Bank files: brief, product, system patterns, tech, active context, progress |
| `workspace.yaml` | Machine-readable facts: schema, agent, task backend, hooks |
| `TASKS.md` | Actionable work, one owner each (Markdown backend; Beads uses `.beads/` instead, per `workspace.yaml`) |
| `docs/decisions/` | Decision records (MADR), one file each, with an index |
| `approvals/` | Approval packets for consequential actions |
| `sessions/` | One record per working session, filed `YYYY/MM/` |
| `summaries/` | Weekly, monthly, yearly syntheses |
| `artifacts/` | Outputs and evidence |
| `archive/` | Retired material; history is never deleted |

Created: {{DATE}}
