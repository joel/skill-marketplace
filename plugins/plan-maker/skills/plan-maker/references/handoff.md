# Approval, publication and execution are different states

## State machine

`RESEARCH -> PUBLISH -> VERIFY -> STOP`

Only a **new explicit user implementation request after verified publication** can
move from STOP to `HANDOFF /plan-implementation #<issue>`. Never enter
implementation inside plan-maker. An approved blocked plan may be published, but
cannot be handed off until its prerequisites are resolved and the plan is
revalidated.

Publication approval permits only the displayed issue operations, the plan commit
and its docs-only pull request, approved visuals, and verification. It is not
approval to edit code, create an implementation branch, move an issue on a board, or
run a test suite. Accepting a host permission prompt does not expand the agreed
scope. A later material change to the payload reopens the approval.

## Native saved-plan wrapper

Use this structure in the host's designated plan file, including when the native UI
labels acceptance "implement" or clears context. Fill every section from the
reviewed proposal. No references to transient sub-agent transcripts.

```markdown
# Publish the approved plan-maker proposal, then stop

> This is a GitHub publication plan, not an application implementation plan.
> Acceptance authorizes the listed issue operations and the plan commit and
> docs-only pull request only.
> Do not invoke plan-implementation or edit application code during this workflow.

## Resume context
- Skill: plan-maker, <actual skill location or registered invocation>
- State: awaiting publication approval; proposal revision <revision>
- Request and source issues: <scope and source references>
- Repository baseline: <repo, branch, commit, dirty-tree treatment>
- Evidence summary: <bounded facts, conventions and unknowns>
- Plan/run IDs: <stable IDs for deduplication and resuming>
- GitHub capabilities and blockers: <verified state, no credentials>
- Assignee and milestone choices: <explicit per-issue decisions>

## Executable publication steps
1. Resume plan-maker and recheck approved targets for intervening changes.
2. Create or update only the listed issues, with pending Plan blocks; record numbers.
3. Write the plans with real numbers in their own worktree; commit only them; push.
4. Open the docs-only pull request with Refs lines; read the plans back at the commit.
5. Apply relations; set each Plan block to its permalink; read everything back.
6. Merge the plan pull request only if the project grants merge authority.
7. Report results and STOP. No application implementation.

## Approved proposal and future-work payloads
<Full issue matrix, change previews, issue bodies, complete plan payloads and
their paths, visuals and approval scope. Implementation steps inside these
payloads are future issue content, not steps to execute now.>

## Stop condition
Planning complete. No implementation performed.
A subsequent explicit request to implement must invoke /plan-implementation #<issue>.
Never implement the payload inline, including after context clearing.
```

Use the native approval as the one publication approval when possible. If approval
was already obtained outside plan mode, a required mode or permission confirmation
is only permission to publish that approved revision, not another scope approval.
If no native planning tool exists, apply the same boundary in conversation and
explain that native plan mode could not be confirmed.

## Handoff contract

Before handoff, verify the Plan block, the plan's identity and revision, the
expected repository, complete publication, the plan pull request merged (or the
developer's explicit go-ahead with it open), blockers and the selected executable
issue. Check freshness against the checkout with targeted checks. A changed baseline
alone does not require repeating the whole design; a conflicting change or a changed
requirement requires replanning and renewed approval of the material changes.

Discover the actual invocation from the available skills. In a plugin install it is
`plan-implementation:plan-implementation`. Invoke the Skill tool using its real
schema, with that registered name and the issue number as arguments. Do not send
slash-command text to Bash and do not invent a parameter schema. For example,
conceptually: `Skill(skill="plan-implementation:plan-implementation", args="#123")`,
only when those are the exposed argument names.

Give the executor the issue number, the plan's permalink and revision, the approved
constraints, dependencies and relevant baseline caveats. The issue plus the plan its
Plan block points to is the plan of record. Respect the executor's own review,
pre-mortem, validation and permission gates; this handoff does not waive them. Do
not execute every sub-issue of a parent from an ambiguous "go ahead".

If model invocation is disabled, the skill is absent, or a tool permission blocks
it, stop and display the command for the user to run. Do not read the executor's
files and mimic its implementation steps as a workaround.

## Examples

- The user approves publication in the native plan dialog: publish and stop.
- After verified publication, the user says "Implement #123": invoke
  `/plan-implementation #123` through the registered skill interface.
- After three issues, the user says "Go ahead": establish which executable issue or
  issues they mean; do not assume all three or a parent's whole backlog.
- The user asks to implement but the plan was never committed: finish or recover the
  approved publication, or report the blocker. No inline implementation.
