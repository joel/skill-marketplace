# Issue body, complete plan, current-plan pointer

## Contents

- Two readers, two layers
- plan.md: scope-complete
- The Plan block and revisioning
- Visuals
- Final quality gate

## Two readers, two layers

Write the issue body for people: a short title naming the outcome; one short Why
paragraph; a short What paragraph or bullets; observable Done when bullets; Out of
scope when useful. Add Before release, Dependencies or a visual only when it
answers a real reader question. Prefer concrete language over implementation
narrative or robotic user-story boilerplate. Keep long code paths and commands in
the plan. Do not force a word cap that hides an important safety constraint.

Write the plan for the agent that implements it later with nothing else: the plan,
the issue and the checkout. Use the supplied issue and plan templates. Replace every
`{{...}}` slot; remove optional sections that add no information. Keep required
plan sections with an explicit "Not applicable" and a reason rather than silent
omission. Planned new paths are proposals, not evidence that a file already exists.

## plan.md: scope-complete, not conversation-complete

Each plan is one file, `<plans directory>/<issue>-<slug>.md` (default
`docs/plans/`; [project configuration](project-config.md)). Record one Plan ID, an
integer revision, the issue number, repository, baseline, state and planning
`Level`. Use
`Readiness: ready` only when no blocking prerequisite remains; otherwise use
`Readiness: blocked` and name how to unblock it. Record the exact source and the
user's assignee and milestone decisions, including explicit none or keep-current.
Publication approval never implies implementation authorization.

Include the minimum context a fresh agent needs to implement **this issue**:
verified current behaviour, desired behaviour, non-goals, interfaces, prerequisite
work, ordered change steps, affected files, existing patterns and test helpers,
acceptance criteria and mapped verification, rollout and rollback, risks and stop
conditions. Reference relevant repository instructions instead of copying them.
Describe local verification even when user-facing QA needs another issue; identify
the integrated journey and the prerequisite issues for the latter. Seed the QA
scenarios that plan-implementation turns into the QA notes at handoff: journeys,
data that exposes a regression, and expected results. Record every review round in
`## Review log` ([format](review-loop.md)); its accepted limitations and open
disagreements are part of the plan the executor reads.

At level 3 the plan also carries two tables ([level rules](levels.md)), in the
template's H3 slots:

- `### Outcome table` under `## Acceptance criteria`: `ID | Input | Existing
  state | Expected result`, one row per distinct outcome rather than every
  combination. Each row is an acceptance criterion with its own ID, so
  plan-implementation can turn it into a test.
- `### Failure at each step` under `## Risks and stop conditions`: `Step | What
  fails | What the system does | State left behind`, keyed to the step numbers.

Either may read `N/A: <reason>`. At levels 1 and 2, delete the two subsections.

Commands must be grounded in the checkout or labelled proposed/unverified. State
working directory, environment and expected evidence. Put any destructive or
live-write command behind the executor's authorization gate. "Not run during
planning" is not "passed". No secret values, real tokens or customer identifiers in
reproducible examples: the file is committed.

In the plan, write issue and pull request references as full URLs: GitHub does not
link `#123` inside repository files.

For a parent issue, the plan covers child outcomes, shared decisions, dependency
order, coordination and integrated acceptance. Child plans still contain their own
complete scope and the essential shared contracts, not "see the parent" in place of
implementation guidance.

## The Plan block and revisioning

End the issue body with a small `## Plan` block. It is the current-plan pointer:

```text
Plan <Plan ID>, revision <N>, level <L>. Publication verified; implementation not authorized.
Complete plan: <permalink: https://github.com/<owner>/<repo>/blob/<commit sha>/<path>>; SHA-256 <hash>.
Plan pull request: #<PR>.
Implementation, on explicit request only: /plan-implementation #<issue>.
```

A permalink pins the exact commit, so a referenced plan never changes under the
pointer. The pull request's commits keep the permalink valid after a squash merge
and after its branch is deleted.

On update, reuse the Plan ID, increment the revision, commit the new revision to the
same path in a new docs-only pull request, and point to the **new commit**. If the
approved payload is unchanged and the current plan verifies, reuse it instead of
committing another revision. Never delete an old plan file without a separate
request. Update only the plan-maker-managed Plan block plus the body changes
included in the approved preview.

## Visuals

Use genuine screenshots for reported UI behaviour and diagrams for architecture,
data flow or state. Describe what each image proves and give useful alt text. Mark a
proposed future-state design as a proposal, not evidence.

Prefer Mermaid in the plan: GitHub renders it and it diffs as text. With an
editable diagram tool, commit its source beside a PNG or SVG preview in
`<plans directory>/<issue>-<slug>/`, checking readability and labels first.
Committed images are published with the repository: redact secrets and personal or
customer data from pixels, source elements and metadata. Capture only an authorized,
non-mutating journey. Do not publish to an external or public share service without
explicit approval. During read-only planning, describe the diagram or use a
permitted local preview; create anything stored outside the conversation only after
publication approval.

Warn when screenshot capture or a requested diagram tool is unavailable. Never
present Mermaid, ASCII or a fabricated screenshot as the output of a tool that did
not run.

## Final quality gate

Check artifact identity and revision, real issue numbers, complete required
sections, a review log consistent with the rounds that ran, the plan hash against the committed bytes, the Plan block's permalink and
pull request, no template slots, no secrets, and acceptance criteria that match the
issue body. Then verify semantics, rendering, relations and the approved field
changes separately.
