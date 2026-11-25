# Planning levels: the developer chooses

Loaded from the plan-maker skill when the level is chosen (section 2) and again
when research, clarification or a review finding matches a risk signal.

The developer knows what is at stake better than a keyword rule, so the developer
picks the level. plan-maker never infers, recommends or silently changes it. When
research shows a risk the chosen level does not cover, or shows the level is more
than the work needs, plan-maker says so and proposes another level; the developer
decides. The level never changes the contract: no level implements anything or
skips the publication approval.

This file is the only place the per-level values live. Other files point here
instead of repeating them.

## The three levels

| | 1 Light | 2 Standard | 3 Heavy |
|---|---|---|---|
| Research (section 3) | one targeted lookup or one Explore agent | 1-3 disjoint read-only researchers | 2-3 researchers, one architect for design alternatives, and a search for bug issues in the same area within twelve months |
| Clarify (section 3a) | inline; minor assumptions recorded in the plan | one grouped question on material unknowns | one grouped question; the five pre-mortem questions below answered under Risks |
| Required plan content | the template | the template | the template plus the outcome table and the failure-at-each-step table (below) |
| Review lenses per round (section 4a) | EXEC | EXEC, REGRESSION; COORD with more than one issue | EXEC, REGRESSION, RISK; FRAME in round 1 and after any fix to Objective or Decisions; COORD with more than one issue |
| Reviewer model / effort | opus / medium | opus / high | the strongest model the Agent tool lists (fable, else opus) / xhigh |
| Stop rule | first clean round | first clean round | first clean round |
| Soft cap (the developer decides past it) | 2 rounds | 3 rounds | 5 rounds |
| Reviewer runs to the cap, worst case | 2 | 6 (9 with COORD) | 16-20 (21-25 with COORD) |
| Recommended session | any | `/model opus` or better, `/effort high` | `/model opus` or better, `/effort xhigh` |

No level uses `max` effort. Heavy's worst case counts EXEC, REGRESSION and RISK in
each of five rounds, plus FRAME in round 1 and in up to four rounds after fixes to
Objective or Decisions.

In the level question, name the lenses in plain words:

- EXEC: an executor dry run against the checkout.
- REGRESSION: callers and side effects of every changed symbol.
- RISK: the pre-mortem questions and the two heavy tables.
- FRAME: whether the plan solves the stated problem the right way.
- COORD: several issues read together.

## Choose it before research

An explicit level in the arguments wins: `--level 1`, `--level 2` or `--level 3`
anywhere, or a leading `light`, `standard` or `heavy`. Say which level is in use
and that it came from the arguments.

Otherwise the level joins the section 2 grouped question with assignee and
milestone. List the three options in order 1, 2, 3. Mark none as recommended and do
not guess from the request: the developer chooses. Each option states its lenses in
plain words, its reviewer effort, its stop rule and soft cap. Do not start research
before the answer: the answer sets how much research to do.

```text
Which planning level?
- Level 1 light: executor dry run only; reviewers at medium; first clean
  round, soft cap 2.
- Level 2 standard: dry run plus regression check; reviewers at high; first
  clean round, soft cap 3.
- Level 3 heavy: dry run, regression, risk and framing checks; outcome and
  failure tables required; reviewers at xhigh; first clean round, soft cap 5.
```

Once known, print `> plan-maker level N (<name>): <lenses>, cap <M>` and record the
level in the plan preamble and the review log as `chosen by developer` or `set by
argument`.

## Risk signals

A short reference list. It only prompts a level proposal; it never sets or changes
the level. The project config may add paths or areas
([project configuration](project-config.md)).

- Authorization, permissions or tenant isolation.
- Authentication, single sign-on, provisioning or session flows.
- Background jobs, scheduled or other async work.
- A migration or backfill.
- A public or internal API, event or schema contract that other code consumes.
- Shared state mutated under concurrency: access calculations, memberships,
  counters, caches.
- An external or paid call made from application runtime code. CI configuration,
  docs and developer tooling do not count.

## Level proposals

Propose a level, in either direction, when research, clarification or a blocking or
material review finding shows the chosen level does not fit:

- **Up**: a risk signal matches a file the plan touches and the chosen level is
  below 3. Cite the signal and the `file:line` evidence.
- **Down**: the chosen level is above 1 and no risk signal matches any file the
  plan touches. Say that none matched and name the files checked.

Say it in one line, then ask one question:

```text
> Risk signal: authorization (src/auth/document_policy.ts:12). Level 2 was chosen.
Switch to level 3 heavy, or keep level 2?
```

The developer decides. Never change the level without the answer. Record each
proposal in the plan preamble's `Level proposals:` line and in the review log, as
`<signal or none matched>, <evidence>; developer kept N` or `; switched N -> M`.
Propose at most once per signal; a signal the developer already answered is not
raised again.

### Switching level after review has started

Review restarts at round 1 with the new level's lenses, and the round cap resets to
the new level's. What was already found is kept:

- Fixes already made stay in the plan.
- The review log keeps every earlier row under a `Prior level N` line.
- Fresh reviewers still receive no earlier findings, so their view stays
  independent.
- The main agent triages new findings against the earlier rows with the existing
  `duplicate` and re-raise rules: an earlier fix is not redone, and a re-raised
  `incorrect` follows the re-raise rule.

## The two heavy tables

Required at level 3 and written into the plan template's two H3 slots; see
[the artifact contract](artifacts.md). Either may read `N/A: <reason>` when it does
not apply, for example `N/A: no user-visible inputs`.

- **Outcome table**, under `## Acceptance criteria`: `ID | Input | Existing state
  | Expected result`. One row per distinct outcome, not one per combination. Each
  row is an acceptance criterion that plan-implementation turns into a test.
- **Failure at each step**, under `## Risks and stop conditions`: `Step | What
  fails | What the system does | State left behind`. Keyed to the plan's step
  numbers; it is the written form of the pre-mortem answers, and
  plan-implementation turns each row into a test or a recorded reason it cannot
  be tested.

The RISK reviewer checks that both are complete, or that the `N/A` reason holds.

## Session model and effort

The skill cannot change the session's model or effort and sets neither in its own
frontmatter: one value would apply to all three levels. It states the recommended
session in the level question and warns once when the session effort is below it.
Reviewer agents are different: their model and effort are passed per call, so the
level applies to them exactly.

## Pre-mortem questions (level 3, answered under Risks)

The same questions as plan-implementation's concurrency and failure-mode
pre-mortem; answer every one before the draft, as requirements the plan encodes, not
as a checklist to tick. The answers fill the failure-at-each-step table:

- **Double-submit and re-entrancy**: two tabs, a double-click, a retry: is there an
  atomic claim or guard before any expensive or paid side effect, at the
  synchronous entry point, so the in-flight state is observable?
- **External or paid call**: the cost of doing it twice? Timeout, non-2xx,
  transport error, malformed-but-2xx body: does each become a handled failure that
  releases the claim and reverts the UI?
- **Async ordering**: can a job's effect and the request's own response land out of
  order and leave a stale view? Does a reload mid-flight show the persisted state?
- **Multi-user and role**: can a shared payload or cached fragment carry a mutating
  affordance a read-only viewer should not see? Gate by permission.
- **Lease, TTL and crash recovery**: is any in-flight claim's TTL comfortably longer
  than the longest job run, and what happens at the boundary?

Prefer one principled model (a state machine, a single atomic claim) over patching
adjacent interleavings; record the chosen model and any accepted limitation in the
plan's Decisions.

## Parent issues and several issues

The developer chooses a level per sub-issue; a copy-only sub-issue may be level 1
beside a level 3 sibling. Ask once for all of them in the grouped question. The
parent's coordination plan takes the highest sub-issue level. From level 2, a COORD
reviewer reads every plan in the proposal together (see the review loop).
