# Record contracts

Use these contracts when creating or repairing durable workspace records. Adapt fields to the project, but preserve stable IDs, ownership, evidence, approval state, and next actions.

## Task

```markdown
### <NAMESPACE>-0001 — <Outcome-oriented title>

- Status: proposed | ready | in-progress | waiting | blocked | review | completed | cancelled | archived
- Priority: low | normal | high | urgent
- Owner: <one accountable agent or human>
- Contributors: <optional>
- Created: <YYYY-MM-DD>
- Updated: <YYYY-MM-DD>
- Requested-by: <identity or source>
- Depends-on: <IDs or none>
- Approval: not-required | required | requested | approved | rejected
- Evidence: <paths, links, or none-yet>

#### Objective

<Intended outcome>

#### Acceptance criteria

- <Verifiable completion condition>

#### Blockers

- <What or whom this is waiting for, or none>

#### Next action

<One concrete next step>
```

Completion requires acceptance criteria and evidence. A task with consequential execution remains in `review` until required approval or verification is complete.

## Session

Use `sessions/YYYY/MM/DD-HHMMSSZ-session.md`, or another collision-safe sortable suffix.

```markdown
# Session — <date>

- Agent: <stable-agent-id>
- Runtime: <provider/model or unknown>
- Started: <ISO 8601 timestamp with offset or Z>
- Ended: <ISO 8601 timestamp with offset or Z>
- Tasks: <IDs>

## Objective

## Inputs and sources

## Actions performed

## Findings

## Decisions made or proposed

## Files created or modified

## External actions

State `None` if no external action occurred.

## Approvals

## Open questions and blockers

## State and task updates

## Handoff

What the next session or actor needs to know.
```

After closure, append dated corrections rather than silently rewriting history.

## Decision

```markdown
## <DECISION-ID> — <Title>

- Date: <YYYY-MM-DD>
- Status: proposed | active | rejected | superseded
- Owner: <identity>
- Approver: <identity or not-required>
- Supersedes: <ID or none>
- Superseded-by: <ID or none>
- Review: <date or trigger>

### Context

### Decision

### Reasons

### Alternatives considered

### Consequences and risks

### Evidence
```

Never delete a superseded decision; link its replacement.

## Hand-off

```markdown
# Hand-off — <task IDs>

- From: <agent-id>
- To: <agent-id>
- At: <ISO 8601 timestamp>
- Status: offered | acknowledged | rejected | completed

## Requested outcome

## Context and completed work

## Files and evidence

## Unresolved questions

## Authority and approval state

## Next action
```

The recipient acknowledges by updating the hand-off or linked task. A hand-off does not transfer authority that the sender did not possess.

## Approval packet

```markdown
# Approval request — <task ID>

- Requested-by: <agent-id>
- Requested-at: <ISO 8601 timestamp>
- Decision-by: <deadline or none>
- Status: requested | approved | rejected | expired | withdrawn

## Exact proposed action

## Target, recipient, system, or amount

## Reason and expected result

## Material risks

## Alternatives

## Evidence

## Reversibility

## Decision record

- Decided-by: <identity>
- Decided-at: <timestamp>
- Scope or conditions: <exact limits>
```

Do not include secret values. Approval applies only to the described action and conditions.

## Summary

```markdown
# <Weekly | Monthly | Yearly> summary — <period>

## Outcomes

## Material findings

## Decisions

## Task changes

## External actions and approvals

## Risks and unresolved issues

## Next priorities

## Source records
```

Summarise and link; do not concatenate source records.
