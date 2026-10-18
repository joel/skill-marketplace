# Decisions — {{PROJECT_NAME}}

Durable decisions, one file each, in [MADR 4.0.0](https://adr.github.io/madr/) form. Accepted records are binding. Proposed records are non-binding context. Superseded and deprecated records are history and are never deleted. Numbers are monotonic and never reused.

| ID | Title | Status | Date |
| --- | --- | --- | --- |
| {{ADR_0001_ID}} | [Use a vendor-neutral workspace as the system of record]({{ADR_0001_FILE}}) | accepted | {{DATE}} |
| {{ADR_0002_ID}} | [Task backend]({{ADR_0002_FILE}}) | accepted | {{DATE}} |

To add a record: copy `adr-template.md` to the next free number as `NNNN-title-with-dashes.md`, remove the optional sections you do not need, set `status: "proposed"`, and add a row here. The project owner's acceptance changes the status to `accepted`.
