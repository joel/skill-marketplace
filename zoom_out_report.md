# Stage 5: Initial Zoom Out report

Target: `docs/designs/session-cost-total.md` (full file, lines 1-415)
Reviewer: egm-zoom-out (fresh context), standard `zoom-out-standard.md`
Goldfish context: none beyond files the document names.

**Verdict:** No blockers. The architecture holds: usage-left's existing row,
plus both plugins listening to `session.measure`. But the document overstates
how often `session.measure` fires. A Goal, a rejection reason, a claim and a
live check all depend on that.

Finding 1 was checked against the source: `index.d.ts` lines 4555-4556 say the
event fires "after each main-thread turn, and when a rate-limit window moves a
whole point".

## 1. Major: `session.measure` does not fire on every cost growth

- **Scope:** Goals (62-64), the data-source section (106-108), the rejection of
  Alternative D (223-232), "same number" (169-171), Risks (175-178), the live
  check (403-405).
- **Evidence:** the engine fires the event after each main-thread turn and when
  a rate-limit window moves. `changed` only says which figures moved when it
  does fire.
- **Consequences:**
  - The Goal "never older than the last priced API response" is not met.
  - Alternative D was rejected for the wrong reason. On cost, the event fires at
    nearly the same moments as `turn.complete`.
  - helper-desk's subagent poll will make its tile fresher than usage-left's
    row while helpers run.
  - The live check "grows with keep-warm pings" would fail.
- **Fix:** restate the Goal as "current as of the last main-thread turn, or
  sooner when the engine measures". Give Alternative D's real reason for
  rejection: usage-left already hooks the event, and the event carries the
  cost. Widen the open question on forks to cover when they appear. Rewrite the
  live check.

## 2. Major: the status line is not weighed as an alternative

- **Scope:** Alternatives Considered (187-232).
- **Evidence:** `SessionCost` is what "/cost and the status line total"
  (`index.d.ts` line 11637). helper-desk line 376 says "No status line: on
  desktop it drew over Context Meter's footer bar."
- **Fix:** add the status line as an alternative, with its reason for
  rejection.

## 3. Nit: what resume and `/clear` do to the figure

- **Scope:** Open Questions (85-87), the label (67, 141), verification
  (408-411).
- **Evidence:** `SessionUsage.startedAt` (`index.d.ts` 12425-12429) counts a
  resumed session from its first launch, and `/clear` restarts it. This makes
  it likely that the cost survives a resume.
- **Fix:** cite this, and name the `/clear` case.

## 4. Nit: `readCost` is not called at `session.start` today

- **Scope:** the helper-desk section (161), plan item 7 (344-345).
- **Evidence:** it is only called from `poll` and `publish` (register.tsx 352
  and 374).
- **Fix:** list adding that call as a change, or correct the text.

## 5. Nit: the two plugins format the figure differently

- **Scope:** Format (148-151), "cannot disagree" (169-171).
- **Evidence:** helper-desk's tile and float use `toFixed(2)`, so they show
  `$0.00` where usage-left will show `under $0.01`.
- **Fix:** align helper-desk in this PR, or drop the "same number" claim.
  Copying `usd()` into usage-left is fine: plugins install independently.

## 6. Nit: plan item 13 is stale

- `design_draft.md` no longer exists. Remove the item.

## 7. Nit: low-level details have crept in

- The thousands-separator note adds nothing; remove it. The signatures are
  acceptable, since the document says it gives them on purpose.

## Checks with no finding

The design fits the project's patterns, adds no speculative features or
premature optimization, and the helper-desk change is small.
