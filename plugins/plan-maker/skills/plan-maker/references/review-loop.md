# Plan review loop: fresh reviewers until the plan converges

Loaded from the plan-maker skill at section 4a, after the draft artifacts exist
and before the publication preview. Round 1 runs at every level.

## Why fresh reviewers

The author's blind-spot check (section 3a) finds what the author can see. The
executor who later implements the plan will have the plan and the checkout and
nothing else; each reviewer gets exactly that, so whatever a reviewer has to
guess, the executor would have guessed wrong. A reviewer that inherits this
conversation inherits its framing, so a reviewer is never a fork and never a
continued agent, and no round sees the previous round's findings.

## One round

1. **Reviewer copy.** The current `plan.md` with its `## Review log` reduced to
   the `Level:` line and `Accepted limitations:` (so reviewers do not re-raise
   accepted trade-offs without new evidence); the issue body text; the
   repository root, baseline commit and the path of the repository instructions
   (`AGENTS.md`/`CLAUDE.md`); in later rounds and update mode, the list of
   sections changed since the last review. Nothing from the conversation, no
   earlier findings, no dispositions.
2. **Spawn one reviewer per lens, in parallel.** `subagent_type:
   "plan-maker:plan-reviewer"`, with the `effort` and `model` that
   [the level rules](levels.md) set for the level. The agent's own
   `effort: high` frontmatter is a fallback only; always pass the level's
   effort. The prompt is the lens brief followed by the reviewer copy. COORD
   receives every plan in the proposal.
3. **Collect.** Dedupe findings that name the same section and claim; keep the
   higher severity and both IDs.
4. **Triage** every finding (below).
5. **Revise** `plan.md`, and the issue body when acceptance criteria changed.
   Keep the plan's `Revision` unchanged; rounds are internal to one revision.
6. **Log** the round in `## Review log` and print one progress line, for
   example `round 2/3: EXEC, REGRESSION; 0 blocking, 1 material, fixed`.
7. **Apply the stop rule.**

## Reviewer prompt

```text
Review only. No edits, writes, installs, tests with side effects, GitHub writes,
nested agents or re-planning. Return findings in the contract below.

Lens: <EXEC | REGRESSION | RISK | FRAME | COORD>, <the lens brief>
Repository: <root>; baseline <commit> (<branch>; dirty-tree caveat if any)
Repository instructions: <path(s)>
Changed since the last review: <sections, or "first review">
Issue:
<issue body>
Plan:
<plan.md reviewer copy>
```

## Return contract

At most 600 words and 8 findings, ordered by severity, no narrative, no files:

```text
Verdict: clean | findings
- ID: R<round>-<LENS>-<n> | Severity: blocking | material | minor | Section: <plan.md H2>
  Claim: <one sentence>
  Evidence: <path:line, grep or command run> | plan-internal | unverified
  Fix: <one sentence>
Checked and sound: <up to five bullets>
Not checked: <what and why>
```

- **blocking**: an executor following the plan would do the wrong thing or
  could not proceed: wrong file or symbol, missing prerequisite, an
  authorization, tenant or data-loss gap, an acceptance criterion nobody can
  verify, contradictory steps.
- **material**: implementable, but likely to produce a review finding or a
  regression: a missed consumer, a missing test or edge case, no rollback, an
  unverified command, a step with two readings.
- **minor**: clarity only.
- `Evidence: unverified` caps a finding at minor. `plan-internal` is for a
  contradiction inside the plan itself.

## Lenses

Each lens says what to verify in the checkout, not what to accept from the plan.

- **EXEC**, executor dry run, every level. You are the fresh agent that must
  implement this plan with no other context. Verify that every cited path,
  symbol, line range, quoted snippet, helper, factory and command (scripts,
  task-runner targets, test groups) exists at the baseline and says what the plan says;
  that each step can be performed as written and in that order; that each
  acceptance criterion maps to a verification you could run; that the file
  list is complete; that the plan respects the repository instructions.
  Anything you would have to guess is a finding.
- **REGRESSION**, from level 2. Grep every changed symbol's callers and
  consumers and check the plan names them. Check that the tests the plan names
  would assert each acceptance criterion, with negative and edge cases; that
  the QA scenarios and verification commands would detect a regression in each
  consumer, with near-miss data; which existing tests must keep passing; and
  that "not expected to change" is stated and true.
- **RISK**, level 3. The five pre-mortem questions (double-submit, external-call
  failure, async ordering, multi-user/role, lease/TTL and crash recovery),
  tenant isolation and IDOR, module-boundary rules, migration and rollback,
  feature flags, observability, partial failure. Verify in the policies, jobs
  and migrations the plan touches. Check the two heavy tables: derive the
  outcome table's dimensions from the roles, permissions, record types and
  state fields the change touches and report a missing distinct outcome;
  check that every step that can fail has a failure row and that each
  `N/A: <reason>` holds.
- **FRAME**, level 3, round 1 and after fixes to Objective or Decisions. What
  did the plan inherit from the request: an implied cause, a chosen
  decomposition, a definition of done, an "also do X"? Does it solve the stated
  problem or the stated solution? Is the "current behaviour" claim evidenced
  in the checkout? Were the rejected alternatives real? Is there a simpler
  principled model? What would surprise the requester?
- **COORD**, from level 2 with more than one issue; round 1 and after any
  round that changed a shared contract or dependency. One reviewer, all plans:
  shared contracts agree, dependency direction and order hold, no work is
  duplicated or missing between issues, integrated acceptance is owned.

## Triage, in the main agent

Every ID gets exactly one disposition, and every ID appears in the log:

- `fix <section>`: re-read the cited range first (a hallucinated finding
  "fixed" corrupts the plan), then revise.
- `incorrect: <path:line or command re-read now>`: never from memory, never
  by assertion.
- `defer: <named follow-up or accepted limitation, reason>`: into Risks or Out
  of scope. Blocking is never deferred without the user.
- `duplicate <ID>`.

If half or more of a round's blocking and material findings are `incorrect`,
the round line says so; that pattern is either a bad lens brief or a
rubber stamp, and the next round decides which.

## Clean, stop, cap

A round is **clean** only when the reviewers raised no blocking or material
finding. A round whose material findings were all dismissed is not clean;
another round runs. A revision changed by fixes always gets another round: the
plan shown for approval is the revision that passed its last round.

Every level stops at the first clean round. The cap is the level's soft cap in
[the level rules](levels.md).

At the cap with open blocking or material findings, ask the developer before
each extra round. Show the blocking and material counts per round so far and
the reviewer runs so far, then offer:

- run one more round, at the same level and lenses;
- accept the open findings as named limitations (recorded under Risks and
  `Accepted limitations`);
- publish the plan as `Readiness: blocked`.

```text
Round 3 of 3 reached: 2 material findings open (R3-REGRESSION-1, R3-EXEC-2).
Per round, blocking/material: 1/4, 0/3, 0/2. Reviewer runs so far: 6.
Run one more round, accept them as limitations, or publish as blocked?
```

An approved extra round is logged as `Rounds: N of M (+K approved by
developer)`. Never stop silently with blocking or material findings open, and
never run past the cap without the developer's answer.

## Re-raise

A claim dismissed as `incorrect` that a later fresh reviewer raises again
independently is not dismissed twice: fix it, or list it under
`Open disagreements` with both sides' evidence and show it in the publication
preview for the user. A re-raised `defer` is answered by citing its ID.

## Re-run triggers

Run at least one more round, at the current level, after any of these:

- User answers that change scope after the loop.
- A material edit after the publication preview (steps, files, acceptance,
  risks); approval reopens too. A cosmetic edit gets a log line, `post-review
  edit, cosmetic`, and approval still reopens.
- Update mode: the new revision restarts at round 1, reviewers are told which
  sections changed, and earlier revisions' logs collapse to one `Prior
  revisions` line each.
- The baseline moved under files the plan cites.

## Compaction, fallbacks, honesty

- The main agent keeps the log table, never the raw returns; after a
  compaction the `## Review log` in the draft is the resume state. Resume at
  round N+1, never silently at round 1.
- Plugin agent not listed: use `general-purpose` with the reviewer agent's body
  inlined and the same `model`/`effort`; log `fallback: general-purpose`.
- `effort` rejected by this Claude Code version: retry one step lower
  (`xhigh` to `high`, `high` to `medium`), then without it; log the effort
  actually in force, for example `effort degraded to high`.
- Level switched by the developer after review started: restart at round 1 as
  [the level rules](levels.md) describe; move the logged rows under a
  `Prior level N` line.
- Agent tool unavailable: run a disclosed self-review against the lens briefs,
  log `Reviewers: none (Agent tool unavailable)`, and say in the preview that
  the plan had no independent review. Never record a round that did not run.

## Review log format

```text
## Review log

Level: 2 (standard); chosen by developer
Level proposals: authorization (src/auth/document_policy.ts:12); developer kept 2
Rounds: 2 of 3; outcome: clean at round 2
Reviewers: plan-maker:plan-reviewer (opus, high), EXEC + REGRESSION per round

| Round | Lens | ID | Severity | Finding | Disposition | Section |
|---|---|---|---|---|---|---|
| 1 | EXEC | R1-EXEC-1 | blocking | recalculateAccess not at cited line | fix | Files and interfaces |
| 1 | REGRESSION | R1-REGRESSION-2 | minor | null guard said missing | incorrect: src/models/x.ts:40 guards null | - |
| 2 | EXEC, REGRESSION | - | - | clean | - | - |

Accepted limitations: None
Open disagreements: None
Prior revisions: None
```

The validator requires the `Level` preamble field, this section, one
`Rounds: N of M` line (optionally `(+K approved by developer)`, with N at most
M + K) and a round 1 row; a clean round still writes its row. At level 3 it also
requires the two heavy tables.
