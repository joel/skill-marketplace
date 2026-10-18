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
- Approval-packet: <path under approvals/ or none>
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

## Memory-bank and task updates

## Handoff

What the next session or actor needs to know.
```

After closure, append dated corrections rather than silently rewriting history.

## Decision

Decisions are decision records (ADRs) in `docs/decisions/`, one file per decision, in [MADR 4.0.0](https://adr.github.io/madr/) form. Copy `docs/decisions/adr-template.md` (the MADR 4.0.0 full template, CC0), remove the optional sections you do not need, and keep the mandatory ones: title, Context and Problem Statement, Considered Options, Decision Outcome.

Rules:

- Filename `NNNN-title-with-dashes.md`: four digits, monotonic, never reused; a new record takes the next free number. Add a row to `docs/decisions/README.md`.
- Front matter `status` is exactly one of `proposed | rejected | accepted | deprecated | superseded by ADR-NNNN`, quoted. `date` is the day of the last status change. `decision-makers` names who decided, including the approver; `consulted` and `informed` are optional.
- An accepted record is immutable except its `status` and one line under More Information naming the record that replaced it. To change your mind, write a new record and set the old one to `superseded by ADR-NNNN`. Never delete a record.
- Write a record when a change makes a choice that someone could later undo without knowing why it was made: significant, hard to reverse, cross-cutting, surprising, or a trade-off between real alternatives. Do not write one for a tiny or local choice, a temporary workaround, or something already covered by `POLICIES.md` (a rule) or `TASKS.md` (work).
- A record states one decision, not a design guide or a policy. Keep it to a page; if the title needs an "and", it is two records. Give real alternatives, not a dummy one.

Mapping from the v1 `DECISIONS.md` contract: Owner and Approver → `decision-makers` (or `consulted` when they only advised); Review → More Information ("revisit when ..."); Context → Context and Problem Statement; Decision and Reasons → Decision Outcome; Alternatives considered → Considered Options and Pros and Cons of the Options; Consequences and risks → Consequences; Evidence → Confirmation and More Information; Supersedes and Superseded-by → the old record's `status` and one line in the new record's More Information.

## Hand-off

In the single-agent layout a hand-off is the `## Handoff` section of the closing session record together with current `STATE.md`; there is no separate file. A hand-off between two agents uses the contract in [the multi-agent extension](multi-agent-extension.md).

## Approval packet

Store each packet as `approvals/<task-id>-<YYYY-MM-DD>.md` and link it from the task's `Approval-packet` field.

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
