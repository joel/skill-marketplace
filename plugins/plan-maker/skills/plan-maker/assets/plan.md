# Plan for #{{ISSUE_NUMBER}}: {{OUTCOME_TITLE}}

> {{The scoped objective and essential constraints for a fresh implementing agent.}}

Plan ID: {{STABLE_PLAN_ID}}
Revision: {{POSITIVE_INTEGER}}
Readiness: {{ready_or_blocked}}
Repository: {{VERIFIED_OWNER_AND_REPOSITORY}}
Baseline: {{COMMIT_SHA_BRANCH_AND_DIRTY_TREE_TREATMENT}}
Source: {{ISSUE_URL_AND_RELEVANT_REQUEST_OR_EVIDENCE}}
Approval: publication only; implementation requires a separate explicit request.
Assignee decision: {{LOGIN_OR_UNASSIGNED_OR_KEEP_CURRENT}}
Milestone decision: {{OPEN_MILESTONE_OR_ITERATION_OR_NONE_OR_KEEP_CURRENT_OR_NOT_USED}}
Execution: `/plan-implementation #{{ISSUE_NUMBER}}` only, after explicit implementation authorization.

## Objective and scope

{{Desired outcome, in-scope behaviour, non-goals and coordination scope for a parent issue.}}

## Evidence and current behaviour

{{Verified facts with repo-relative path, symbol and line range at the baseline.
Distinguish observations, inferences, proposed new paths and unknowns.}}

## Decisions and constraints

{{Chosen approach and why; relevant repository instructions and conventions;
important alternatives rejected; safety, permission and compatibility boundaries.}}

## Dependencies and blockers

{{Actual issue references and shared contracts, correct dependency direction and
order. For each blocker: condition, owner, how to verify resolution and whether
execution must stop. Write "None" explicitly when no blocker or dependency remains.}}

## Implementation steps

{{Ordered issue-scoped changes, entry points, interfaces and expected behaviour.
For a parent issue: child outcomes, shared decisions and coordination sequence.
These are instructions for the later executor, not authorization to execute now.}}

## Files and interfaces

{{Files/symbols to change and evidenced reusable patterns/helpers; identify proposed
new files as new. State interface/schema/data implications or not applicable.}}

## Acceptance criteria

{{Number criteria AC1, AC2, etc. Match the issue body. Distinguish local
verifiability from integrated QA requiring another issue.}}

## QA scenarios

{{Start with the quick check: the fastest path that proves the change works, and
one everyday journey that proves nothing around it broke. Then list the user
journeys QA should run once this ships: where in the app, the data that makes a
regression visible (a near-miss next to each intended match), and the expected
result of each step. plan-implementation turns these into the QA notes at handoff.
For work with nothing a user can see, write "No UI to test" and name the automated
checks that cover it.}}

## Verification

{{Map acceptance to exact evidenced commands or manual checks, working directory,
environment, expected results, and relevant test helpers. State not run during
planning. Mark proposed commands unverified; do not fabricate a pass. Gate
live/destructive writes behind the executor's explicit authorization flow.}}

## Rollout and rollback

{{Prerequisites, migration/config/feature-flag steps, dry run and observability,
rollback boundaries and data consequences; or not applicable with a reason.}}

## Risks and stop conditions

{{Relevant authorization and tenant isolation, concurrency, ordering, retries,
idempotency, external system failure, data loss, security or UI-state risks. State
what halts execution and which unknowns cannot safely be assumed away.}}

## Execution handoff

Publication approval is not implementation approval. On a separate explicit
implementation request, invoke `/plan-implementation #{{ISSUE_NUMBER}}` through its
registered skill interface, using this exact plan revision and the issue as the
plan of record. Never implement inline or bypass that workflow. Stop if the plan is
blocked, publication is incomplete, or the executor is unavailable or incompatible.

{{Any essential handoff context not captured above. Remove optional filler.}}
