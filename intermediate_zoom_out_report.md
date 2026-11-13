# Stage 8: Intermediate Zoom Out report

Target: `docs/designs/session-cost-total.md` (full file, not yet edited)
Reviewer: egm-zoom-out (fresh context), standard `zoom-out-standard.md`, with
the Stage 5, 6 and 7 reports as input.

**Verdict:** The design is still at the right altitude. The risk is now in the
proposed fixes: three would add mechanism that is not needed, and one would add
a bug. Most findings are fixed by correcting or deleting text.

## 1. Major: reject the "keep the larger value" fix (Stage 7 M4); the race is a Nit

- `/clear` starts the session over without a `session.start` (types lines
  11713-11714 and 12429). If the ledger resets, keeping the larger value would
  show the old chat's figure until the new chat spends more.
- The race exists only in helper-desk, where the next `poll` corrects it.
  usage-left's only `usage()` read happens before any reply.

## 2. Major: do not filter on `changed.includes('cost')`; take `e.cost` on every measurement

- Every `session.measure` carries a snapshot of `cost` (types 11807-11830). It
  fires after each main-thread turn (4555-4556). `changed` names `cost` only
  when the total *grew* (11837), so a reset after `/clear` might never be
  taken.
- Instead: take `e.cost?.usd` on every measurement, and redraw only when it
  differs. This is the same amount of code, removes the race, and handles
  `/clear`. It also drops the "one array check" claim.
- This raises the `/clear` point (Stage 5 #3) from Nit to Major.

## 3. Nit: delete the `readCost`-at-`session.start` claim; do not add a call (Stage 7 M3)

- Every path that opens the pane goes through `publish`, which calls
  `readCost`. The first measurement names cost (types 11833). A pane opened by
  hand with `/helpers` before the first reply is too small an edge case for a
  new call path.
- usage-left's start read reuses an existing call. Keep it.

## 4. Nit: settle `/resume` before implementing; use one label (Stage 7 M7)

- The types point to the answer: a resumed session counts from its first
  launch (12426-12429). Drop "change the label if…" from the plan.
- Rename helper-desk's tile to "Session cost", or limit the Goal to usage-left.
  Do one of these, not both.

## 5. Nit: Risks & Mitigations: promote the heading, add no new risks (Stage 7 M8)

- Give the three existing risks one-line mitigations:
  - the helper-desk hook returns when `!deskOn()` (this also covers Stage 7
    N4);
  - the layout steps down from full to compact to stacked;
  - the README and the plugin description explain what the figure means.

## 6. Nit: add the status-line alternative in three lines at most (Stage 5 #2, Stage 7 M6)

- The reason for rejection is already in the code (helper-desk
  `register.tsx:376`). The decision does not change.

## 7. Nit: align `$` formatting by copying cache-clock's `usd()`; no shared module (Stage 5 #5, Stage 7 N1)

## 8. Nit: say in one line why helper-desk keeps its tile

- helper-desk can be installed without usage-left.

## Agreed as text-only fixes

Stage 5 #1 / Stage 7 M2 (event frequency, Alternative D's real reason),
Stage 7 M5 (the float's frame file holds the figure), Stage 5 #6 (remove plan
item 13), Stage 5 #7 (remove the thousands-separator note).

## No finding

No new component is needed, the data flow is minimal, nothing is optimized
early, and the signatures are within the plan's scope.
