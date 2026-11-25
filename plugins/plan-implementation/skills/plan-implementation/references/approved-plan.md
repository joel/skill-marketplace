# Acting on an approved plan

Loaded from the plan-implementation skill (Design phase, "Already designed") when the
run implements a plan approved before it started: a plan-mode plan, a plan file or
design doc in the repository, the plan in an issue body, or the plan an issue's
`## Plan` block points to (plan-maker).

## The plan of record

Read the whole plan before Step 1. Its scope, non-goals, acceptance checks, baseline
and stop conditions carry into the issue and the implementation. The user's current
instructions win when they conflict; reconcile a substantive change with the user
before going on.

Reuse its design, evidence and file map, but check freshness first: compare the
baseline it names with `origin/main` and inspect only the relevant differences. A
newer commit alone does not invalidate a plan; a changed interface or requirement it
relied on does, so replan that part.

## A plan an issue points to

A run that starts from an issue (`#123`) whose body ends with a `## Plan` block
works on that issue; it never opens a second one. The block names the plan's
permalink at a commit, its Plan ID, revision and SHA-256:

- Read the plan at that commit (`gh api "repos/<owner>/<repo>/contents/<path>?ref=<sha>"
  --jq .content | base64 -d`), not from the working tree, and check its SHA-256,
  Plan ID and revision against the block.
- A block that still says publication is pending, a mismatch, an unreachable
  plan or `Readiness: blocked` is a stop-and-ask; do not implement from the issue
  text alone.
- The issue plus that plan is the plan of record. Its acceptance criteria and QA
  scenarios feed Step 12's QA notes; its review log follows the next section.

## When the plan records its own review

Some planning processes review a plan before it is approved and keep a review log in
it (plan-maker's `## Review log`): a `Rounds: N of M` line against a cap, and each
finding with its disposition (`fix`, `incorrect`, `defer`, `duplicate`). Treat the
log as part of the plan:

- **Blocked.** The rounds reached the cap with a blocking finding still open: stop
  and ask; do not implement from it. Extra rounds the developer approved past the
  cap (`Rounds: N of M (+K approved by developer)`) count as within it.
- **Required but missing.** When the project config says approved plans carry a
  review log and this one has none, stop and ask. Otherwise a plan without a log is
  normal, and the rest of this section does not apply.
- **Known risks.** Accepted limitations and open disagreements go into the pre-mortem
  answers and the PR's Notes: they are risks the reviewer must see.
- **Deferred findings** (`defer`) go into the knowledge candidate log at Step 1 and become
  follow-up issues at Step 15.
- **Missed by plan review.** When an automated-reviewer finding (Step 10b) or a review
  comment (Step 11) matches a log item dispositioned `incorrect` or `defer`, list it in
  the closing summary under **Missed by plan review**, with the log item and the
  comment. That is how the plan review improves; when the planning process is itself
  a skill, a proposal for it follows the skill-proposal route in
  [knowledge-consolidation.md](knowledge-consolidation.md).

## Outcome and failure tables

A plan may carry an **outcome table** (each input or state and the result it must
produce; plan-maker's `### Outcome table`) and a **failure-at-each-step table** (each
step, how it can fail, and what must happen then; `### Failure at each step`). Turn every outcome row into a test case, and every failure row
into a test or a reason it cannot be tested, recorded in the PR's Notes. A table that
reads `N/A: <reason>` needs no tests.

## No gate is waived

A reviewed plan does not replace this skill's pre-mortem, UX pass, code and security
review, validation or live verification, and it does not change who merges.
