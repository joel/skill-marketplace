# Stage 9: Implementation Readiness report

Target: `docs/designs/session-cost-total.md`, DetailedRange lines 249-415
Reviewers (fresh contexts): egm-implementation-readiness and
egm-codebase-details (standard `implementation-readiness-standard.md`), and
egm-style. All three completed. Findings are deduplicated; the Source column
says who raised each one.

**Verdict: not ready to implement.** One claim about the code is false, the
refresh path is undecided, and the plan leaves several decisions to the
implementer.

## Blocker

| # | Finding | Lines | Source | Fix |
|---|---|---|---|---|
| B1 | `readCost` is not called at `session.start` or after a reload (only from `publish` :374 and `poll` :352). The plan says it is. | 344 (ctx 161) | readiness, codebase (+ Stages 5, 7, 8) | Stage 8 recommends deleting the claim. Readiness and codebase recommend adding the call to `session.start`. Choose one. |
| B2 | The refresh path is undecided. `session.measure` fires only after main turns and rate-limit moves. usage-left has no other path, and the live check expects keep-warm pings to move the figure. | 287-289, 339-343, 402-410 | readiness, codebase, style | Accept updates at main-turn granularity and drop the keep-warm expectation, or add a re-read on usage-left's existing 60 s tick. |

## Major

| # | Finding | Lines | Source | Fix |
|---|---|---|---|---|
| J1 | `/clear`: no `session.start`, and `changed` names `cost` only when the total grew, so the old total can stay on screen. | 284-289, 339-342 | codebase (+ Stage 8 #2) | Take `e.cost` on every measurement (Stage 8), or reset on `session.end` with reason `clear`. Add a test. |
| J2 | Cost text per layout is underspecified. `costText(cost, full)` gives a bare `$4.12` in stacked layout and in a narrow no-window row, which contradicts line 141. With no pieces, `SEP*(n-1)` = -3. | 268-275, 290-298 | readiness, codebase | Give a table of the exact text for each layout × with/without windows, and the width formula with no pieces. |
| J3 | The helper-desk rig has no `session.measure` stub, and its `usage` mock is fixed at $0.42, so any `publish` resets the tile. The test depends on timing. | 348-354 | readiness, codebase | Add a measure stub. Let a test seed the cost, or ensure no `publish` after the measurement. Name the asserted figure. |
| J4 | The usage-left rig cannot seed a cost. Defaulting one would break the exact-text tests. | 306 | readiness, codebase | Add a `rig(on, rateLimits, store, cost?)` parameter that defaults to no cost. |
| J5 | `npx tsc -p plugins/usage-left` cannot run: there is no `tsconfig.json` and no engine types there (verified). | 400-401 | readiness, codebase | Add both as files to create, or drop the step. |
| J6 | The plan is not phased. | 249-392 | readiness, codebase | Phase 1 usage-left (items 1-6), phase 2 helper-desk (7-10), phase 3 catalog/README (11-12), each with its own green check. |
| J7 | The label fallback ("change the label if…") leaves a decision open. | 408-411 | readiness, style (+ Stage 8 #4) | Settle `/resume` from the types now (a resumed session counts from first launch) and remove the conditional. |
| J8 | The catalog description text is not given. `check.sh` compares only `version`, not descriptions. The current catalog text ends "draws nothing off a subscription". | 367-372 | codebase | Quote the new catalog string. Correct the `check.sh` claim. |
| J9 | `$.ui.invalidate('ui.render')` is unnecessary: a `$.state.get` while drawing subscribes the drawing, so `set` redraws it. As written it redraws every plugin. | 287-289, 339-341 | codebase | Remove both invalidate calls. |
| J10 | Wording: the double negative "no longer draws nothing off a subscription", the garden-path test sentence at 308-309, "both surfaces" undefined, terms drift (helper/subagent, "off a subscription"/"on an API key"). | 261-262, 299-300, 308-310, 351-406 | style | Rewrite positively, define or rename the terms, use one term per idea. |

## Nit

| # | Finding | Lines | Source |
|---|---|---|---|
| N1 | The helper-desk hook does not specify await vs `void …catch(log)`, which promise `.catch` guards, or the `deskOn()` gate. | 339-345 | readiness, codebase, style |
| N2 | "when a float is open" is redundant: `writeFrame` already does nothing without a float (:816). | 342 | readiness, codebase |
| N3 | Item 13: `design_draft.md` does not exist. Say whether the design and the `*_report.md` files are committed. | 388-392 | all three (+ Stage 5) |
| N4 | helper-desk shows `$0.00` where usage-left shows `under $0.01`. Say that `costText` copies cache-clock's `usd()` rule. | 268-270, 312 | codebase (+ Stages 5, 7, 8) |
| N5 | Missing tests: a measurement with `cost` absent; `usage()` with no cost or throwing at start; a narrow no-window row; a measurement before any helper exists. | 302-354 | codebase |
| N6 | Release-note headings use a `(date)` placeholder. Use `YYYY-MM-DD`. | 385-386 | readiness |
| N7 | Small wording issues: "a fix: the tile goes stale", "as today", undefined `u`, "drawn `dimColor`", `costText` cases without inputs, "moves the figure", "ribbon", "on the subscription", "keep-warm" without a gloss, "never holds up". | various | style |
