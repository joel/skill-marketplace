# A live session cost total (usage-left and helper-desk)

*   **Author:** Joël Azemar
*   **Status:** Proposed
*   **Date:** 2026-11-12

--------------------------------------------------------------------------------

## Overview

helper-desk (`plugins/helper-desk`, version 0.8.2) already shows a "Total chat
cost" tile in its pane. The figure is the session's `/cost` total: the engine
sums the list price of every API response in the session, main thread and
subagents alike (`SessionCost.usd`, read through `$.session.usage()`).

The figure is not trusted today because it is only read while subagents are
running, and the pane that shows it only opens when subagents start. Most of a
session's spend is the main thread, and that spend happens when the pane is
closed and the figure is not being refreshed.

This design makes the session total live (refreshed whenever the engine
reports that the total grew, not only on subagent events) and visible when no
subagent has run. The always-visible figure goes on usage-left's row above the
prompt (`plugins/usage-left`, version 0.2.0), which already reads
`$.session.usage()`. helper-desk's pane tile keeps showing the same figure, now
kept current.

## The Problem

Joël wants to know what a session has cost so far, at any moment, without
typing `/cost`.

What helper-desk does today, read from `hooks/register.tsx`:

*   `readCost` sets the `cost` state from `$.session.usage().cost.usd`.
*   `readCost` runs from `publish` (a helper starts, takes a step, or finishes)
    and from `poll`. The poll timer only runs while at least one helper is
    working (`syncTimers`).
*   So once the last subagent finishes, the tile stops updating. The main
    thread's later replies are not counted on screen until the next subagent
    event.
*   The pane opens by itself only when a new round of subagents starts. A
    session with no subagents never shows the tile at all, unless the pane is
    opened with `/helpers`.
*   For subagents the pane shows tokens ("Subagent tokens"), not dollars.

The result reads as "the cost of the subagents", when the number is the
session total at the time of the last subagent event.

What this design does not fix, and the reader should know:

*   **The figure is a list-price estimate, not a bill.** `/cost` prices each
    response at Anthropic's list price. On a subscription plan (Pro, Max) the
    money actually spent is the subscription fee, and this figure only shows
    what the same usage would cost on the API. On API billing it is close to the
    bill, but it is still the client's own estimate.
*   **It is one session's figure.** It says nothing about other chats running
    at the same time, or about the day's or month's total.

## Goals

*   The session total shown by usage-left is at most about one minute old, and
    current after each main-thread reply: it takes the engine's figure from
    every `session.measure` (raised after each main-thread turn) and re-reads it
    on usage-left's existing 60 s tick, which also catches spend between turns
    (keep-warm pings, subagents still running). helper-desk's pane tile takes
    the figure from every `session.measure`, as well as from the subagent
    events that read it today.
*   Both plugins show the engine's figure as it is, whether it rose or fell, so
    a `/clear` that starts the total over does not leave the old chat's figure
    on screen.
*   The total is visible above the prompt in a session where no subagent has
    run, on a subscription and on API billing alike.
*   The label names the figure as the session's cost ("Session cost"), and the
    plugin's description and README say it is the `/cost` total at list prices,
    covering the main thread and subagents.
*   Where the host keeps no cost ledger (`usage().cost` is missing), nothing is
    shown, as today. No figure is invented.

## Non-Goals

*   Splitting the total into main thread and subagent dollars. Joël chose the
    single live total; a split would need helper-desk to price each subagent
    call itself, because the engine gives only one session total.
*   Daily, weekly or cross-session totals.
*   Budgets, alerts or limits on spend.
*   Showing what a subscription plan actually charges.
*   Changing how the engine computes `/cost`.

## Open Questions

*   **Does a resumed session keep its earlier cost?** If `/resume` starts the
    ledger at $0, the figure is "since this process started", not "this
    session". Needs checking against the engine before the label is fixed.
*   **Are other mods' background calls counted?** cache-clock's keep-warm pings
    use `$.model.fork`, and handoff and effort-optimizer make their own model
    calls. `SessionCost.usd` says "every priced API response this session";
    whether forks and `$.model.complete` calls land in that ledger is not
    stated in the types.

## Technical Plan (Architecture)

Decided: the always-visible figure goes on usage-left's row (option C of the
placement question). helper-desk keeps its pane tile and gets the same live
update.

### Where the number comes from

The engine pushes the figure after each main-thread turn; usage-left also
re-reads it once a minute.

*   `$.session.usage()` returns `cost?: { usd }`, the `/cost` total, absent
    where the host keeps no ledger.
*   The `session.measure` event carries the same `cost?` as a snapshot, and a
    `changed` list. The engine's types
    (`plugins/helper-desk/.claude-plugin/types/claude-code/index.d.ts`, around
    line 4555) say it fires "after each main-thread turn, and when a rate-limit
    window moves a whole point". `changed` names `cost` only when "the total
    grew" (around line 11837), so it misses a total that fell, as after
    `/clear`. Both plugins therefore ignore `changed` for the cost and take
    `e.cost` from every event.
*   A `$.state.get` made while drawing subscribes the drawing, so a later
    `$.state.set` redraws it (types, around line 3481). No `$.ui.invalidate`
    call is needed when the cost changes.
*   usage-left already hooks `session.measure` for `rateLimits`. helper-desk
    does not hook it today.

```text
 API response priced by the engine
            │
            ▼
   session.measure { cost }       usage-left 60 s tick:
   (after each main turn)          $.session.usage().cost
        │                               │ (usage-left only)
        ▼                               ▼
 usage-left                      helper-desk
 state 'cost' = usd               state 'cost' = { usd }
        │                               │
        ▼                               ▼
 AbovePrompt row                  Pane tile "Total chat cost"
 "Session cost $4.12"             (and the Zellij float's line)
```

### usage-left

*   **New state:** `cost: number | null`, the session's total in US dollars.
    It is set at `session.start` from `$.session.usage().cost?.usd`, on every
    `session.measure` that carries a numeric `cost.usd`, and on the existing
    60 s tick from a fresh `$.session.usage()` read. Each source writes the
    value only when it differs from the one held, up or down. It is not saved in
    the store for the next chat, unlike the rate-limit windows: a new chat's
    cost is its own.
*   **Drawing:** the cost is one more piece at the end of the row, after the
    windows, without a bar and without colour roles (it has no limit to be
    measured against; budgets are a non-goal). It is drawn dim, like the reset
    times.
    *   full layout: `Usage left   7D ●●●●●●●··· 68% left · 3d 2h   5H … ·
        Session cost $4.12`
    *   compact layout: `7D 68% · 3d 2h   5H …   $4.12`
    *   stacked layout: the cost on its own line, `Session cost $4.12`.
    *   The width calculation in `layoutOf` counts the cost piece, so the row
        still steps down from full to compact to stacked without clipping.
*   **With no rate-limit windows** (API-key billing, or before the first reply
    on a fresh install): the row draws the cost alone, `Session cost $4.12`,
    instead of drawing nothing. With neither windows nor a cost figure, it draws
    nothing, as today.
*   **Format:** two decimals, `$4.12`. A total under one cent shows as
    `under $0.01`, as cache-clock's `usd()` does, so a new chat does not show
    `$0.00` as if nothing were counted. Above $1,000, no thousands separator is
    added; that is a mechanical choice and can change.
*   **Cost of the feature itself:** none in tokens. It reads figures the engine
    already has, as the row does today.

### helper-desk

*   **New hook:** `session.measure`. When `e.cost?.usd` is a number and
    differs from the held value, set the `cost` state (which redraws the pane)
    and write the float frame. The tile is then current after each main-thread
    reply whether or not a helper is running.
*   No read at `session.start` or after a reload is added. Until the first
    `session.measure` (the first main-thread reply) or the first subagent
    event, the tile shows no figure, so a pane opened by hand with `/helpers`
    before the first reply has no cost tile yet. usage-left's row covers that
    moment.
*   The pane still opens only for subagents. The label "Total chat cost" stays.

### What changes for the person

*   usage-left's row gains `Session cost $x` and, on API billing, now appears
    where it drew nothing before.
*   helper-desk's tile stops freezing after the last subagent.
*   Between main-thread replies, usage-left's row can be up to a minute ahead
    of helper-desk's tile (it re-reads on its tick; the tile waits for the next
    reply or subagent event).

### Risks

*   **A second `session.measure` hook.** helper-desk would run on every
    measurement, once per main-thread turn plus rate-limit moves. The hook
    compares one number with the held one and returns when they match.
*   **usage-left's once-a-minute read.** One `$.session.usage()` call a minute.
    The plain call costs nothing in tokens (types, `usage()`); it reads the
    figures the engine already holds.
*   **The row is denser.** On a narrow terminal the extra piece pushes the row
    into compact or stacked layout sooner. Stacked costs one more row above the
    prompt.
*   **The figure's meaning on a subscription.** It is a list-price estimate,
    not what the plan charges. The label cannot say all of that in a few
    columns; the README and the plugin description carry it.


## Alternatives Considered

These were weighed in this session. Each was rejected for the reason given.

### Alternative A: Split the total into main thread and subagents

*   **Pros**: Answers "what did the subagents cost me" directly, which today's
    "Subagent tokens" tile only hints at.
*   **Cons**: The engine gives one session total, not one per thread. helper-desk
    would have to price each subagent call itself from its token counts, with a
    price table per model (as cache-clock's `price.ts` does), and the main
    thread's figure would be the total minus that estimate. Two estimates
    subtracted from each other drift whenever a price, a model id or a cache
    multiplier is missing from the table.
*   **Reason for Rejection**: Joël chose a single live total. The question
    asked was "how much is this session costing us", which the total answers.

### Alternative B: Open helper-desk's pane after the first reply

*   **Pros**: No new UI. The existing "Total chat cost" tile shows the figure.
*   **Cons**: The pane takes about a quarter of the terminal's width (0.8.2)
    for the whole session, mostly to show one number. Hiding the pane, or
    `pane: off`, hides the figure again.
*   **Reason for Rejection**: Too much screen for one figure, and the figure
    would depend on a pane whose job is subagents.

### Alternative C: A helper-desk row above the prompt

*   **Pros**: Always visible, and the work stays inside helper-desk.
*   **Cons**: One more row above the prompt, where cache-clock's band and
    usage-left's row already sit. On short terminals the bands already compete
    for rows. It would need its own on/off setting, separate from `band`.
*   **Reason for Rejection**: usage-left's row already exists, already reads
    the same engine call, and is about the same subject (what the session is
    using), so the figure fits there without a new row.

### Alternative D: Refresh on each main-thread `turn.complete`

*   **Pros**: Simple to reason about: one read of `$.session.usage()` per main
    reply, the same call `readCost` makes today.
*   **Cons**: `session.measure` fires at the same moments (after each main
    turn), and both miss spend between turns.
*   **Reason for Rejection**: `session.measure` fires at nearly the same moments
    but carries the cost in the event, and usage-left already hooks it, so a
    separate `turn.complete` read adds a hook and a call for nothing. Spend
    between turns is covered by usage-left's 60 s re-read instead.

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **Performance**: no tokens. Both plugins react to `session.measure`, which
    the engine raises anyway, with one number comparison per event. usage-left
    adds one `$.session.usage()` read a minute on its existing tick.
*   **Privacy**: the figure stays on screen and in each plugin's session
    state. It is not written to the store, a log or any file.
*   **Rollout and rollback**: two independent plugin releases in one PR.
    Rolling back either is a plugin downgrade; no stored data changes shape.
    `/plugin disable usage-left` removes the row.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

One PR, two plugin releases: usage-left 0.3.0 (a new feature) and helper-desk
0.8.3 (fixes a cost tile that goes stale). No code here; signatures and
behaviour only. The work is in three phases, done in order. Each phase ends
with a check that must pass before the next one starts.

### Cost text in each layout

usage-left draws its row in one of three layouts, picked by `layoutOf` from
the terminal's width: **full** (the "Usage left" label, dot bars, "left"),
**compact** (no label, no bars), and **stacked** (one window per line). The
cost piece reads as follows. "Labelled" means `Session cost $4.12`; "bare"
means `$4.12`.

| Layout | With rate-limit windows | No windows (API key) |
|---|---|---|
| full | last piece on the row, labelled: `… · 3d 2h   Session cost $4.12` | labelled, alone: `Session cost $4.12` |
| compact | last piece on the row, bare: `… · 3d 2h   $4.12` | labelled, alone: `Session cost $4.12` |
| stacked | its own last line, labelled: `Session cost $4.12` | labelled, alone: `Session cost $4.12` |

Rules behind the table:

*   The label is dropped only in the compact layout with windows, where the
    row is short of room and the `$` beside the windows is enough.
*   With no windows the row is never wider than `Session cost $x.xx` (about
    20 columns), so it is always labelled. If even that does not fit, it is
    drawn with `wrap="truncate-end"`, as the window pieces are.
*   The amount uses cache-clock's `usd()` rule (`plugins/cache-clock/hooks/price.ts`
    line 44), copied, since plugins install independently: two decimals,
    `under $0.01` below one cent.

### Phase 1: usage-left 0.3.0

Done when `claude plugin test plugins/usage-left` passes and
`npx tsc --noEmit -p plugins/usage-left` reports no errors.

#### 1. `plugins/usage-left/tsconfig.json` (Create, local only)

*   **Type / Scope**: TypeScript project file for the type check.
*   **Proposed Changes**: the same one line as helper-desk's and cache-clock's:
    `{ "extends": "./.claude-plugin/types/tsconfig.json" }`.
*   **Note**: the repository's `.gitignore` ignores `plugins/*/tsconfig.json`
    and `plugins/*/.claude-plugin/types/`, so this file and the next are not
    committed. They exist on the developer's machine only, as they do for the
    other plugins. The PR does not contain them.

#### 2. `plugins/usage-left/.claude-plugin/types/` (Create, local only)

*   **Type / Scope**: the engine's type definitions, for the type check.
*   **Proposed Changes**: copy `plugins/helper-desk/.claude-plugin/types/` as
    it stands: `tsconfig.json` (compiler options and `include` of
    `../../hooks`, `../../types`, `../../tests`) and the `claude-code`,
    `claude-code-mcp` and `claude-code-tools` folders with their `index.d.ts`.
    Ignored by git, as above.

#### 3. `plugins/usage-left/types/index.d.ts` (Modify)

*   **Type / Scope**: TypeScript state declaration.
*   **Proposed Changes**: add `cost: number | null` to the `'usage-left'`
    state, documented as "the session's `/cost` total in US dollars at list
    prices; null where the host keeps no ledger". The `windows` comment stays.

#### 4. `plugins/usage-left/hooks/usage.ts` (Modify)

*   **Type / Scope**: pure text and layout helpers (no engine calls).
*   **Proposed Changes**:
    *   `usd(n: number): string`: copied from cache-clock's `price.ts`.
    *   `costText(usd: number, labelled: boolean): string`:
        `Session cost ${usd(n)}` when `labelled`, `usd(n)` otherwise.
    *   `layoutOf(pieces, cols, cost: number | null = null)`: when `cost` is a
        number and `pieces` is not empty, the full width adds
        `SEP + costText(cost, true).length` and the compact width adds
        `SEP + costText(cost, false).length`. When `pieces` is empty it returns
        `'full'` (the cost-alone row has one form; see the table). The existing
        `SEP * (pieces.length - 1)` term is only used when `pieces` is not
        empty.
    *   No change to `pieceOf`, `clean`, `stillCurrent` or the palettes.

#### 5. `plugins/usage-left/hooks/register.tsx` (Modify)

*   **Type / Scope**: hooks module.
*   **Proposed Changes**:
    *   A `COST` state key `{ plugin: 'usage-left', key: 'cost' }`.
    *   `session.start`: from the `$.session.usage()` call it already makes,
        set `cost` to the result's `cost.usd` when it is a number, else
        `null`. Not read from or written to the store.
    *   `session.measure`: in addition to the existing `rateLimits` handling,
        when `typeof e.cost?.usd === 'number'` and it differs from the held
        `cost`, set `cost`. `e.changed` is not consulted for the cost.
    *   The existing 60 s tick (`$.clock.every(TICK_MS, …)`): before its
        `$.ui.invalidate`, read `$.session.usage()` (errors caught and
        ignored) and set `cost` when `cost.usd` is a number that differs from
        the held one.
    *   `ui.render` (`AbovePrompt`): return `next(e)` only when there are no
        windows and no cost. Otherwise draw the cost piece as the table says,
        with `dimColor`, after the windows. With no windows, draw only the
        labelled cost, without the "Usage left" label.
    *   Rewrite the file's header comment: "With no windows (an API key), the
        row shows the session's cost alone; it draws nothing only when there
        are neither windows nor a cost."

#### 6. `plugins/usage-left/hooks/register.test.tsx` (Modify)

*   **Type / Scope**: engine test kit (`claude plugin test`).
*   **Rig change**: `rig(on, rateLimits = WINDOWS, store = {}, cost?: number)`.
    The `session.usage` mock returns `cost: { usd: cost }` only when `cost` is
    given, so the existing tests, which pass no cost, keep their exact text.
    The rig returns a setter, `setCost(n)`, that changes what later `usage()`
    calls return, for the tick test. Its `session.measure` stub stays as it
    is (it echoes `{ changed }`).
*   **New and changed tests**:
    *   `costText(4.12, true)` → `Session cost $4.12`; `costText(4.12, false)` →
        `$4.12`; `costText(0.004, true)` → `Session cost under $0.01`.
    *   `layoutOf`: at a width that fits the windows alone but not the windows
        plus the cost, it returns the next smaller layout. With no pieces and a
        cost, it returns `'full'`.
    *   Each cell of the layout table, on the terminal and desktop surfaces
        (the two render targets the existing tests already loop over).
    *   The existing "no windows: nothing drawn" test becomes two: no windows
        and no cost draws nothing; no windows with a cost draws only
        `Session cost $…`, without "Usage left".
    *   A `session.measure` with a higher `cost.usd` updates the figure,
        whatever `changed` lists; one with a lower `cost.usd` (as after
        `/clear`) also updates it; one with no `cost` leaves it alone.
    *   After `setCost(5)` and 60 s of clock time with no measurement, the row
        shows `$5.00` (the tick re-read).
    *   `usage()` with no `cost` at `session.start` leaves the row without a
        cost piece.
    *   A new chat does not show the last chat's cost (the store holds no cost
        key after a session).

#### 7. `plugins/usage-left/.claude-plugin/plugin.json` (Modify)

*   **Type / Scope**: manifest.
*   **Proposed Changes**: version `0.3.0`, and the description quoted under
    item 13.

#### 8. `plugins/usage-left/NOTICE` (Modify)

*   **Type / Scope**: attribution and change record.
*   **Proposed Changes**: a "Changes in 0.3.0" note: the row shows the
    session's `/cost` total. Original to this repository, not taken from
    ribbon (the upstream project usage-left's window layout is adapted from).

### Phase 2: helper-desk 0.8.3

Done when `claude plugin test plugins/helper-desk` passes and
`npx tsc --noEmit -p plugins/helper-desk` reports no errors.

#### 9. `plugins/helper-desk/hooks/register.tsx` (Modify)

*   **Type / Scope**: hooks module.
*   **Proposed Changes**:
    *   A `session.measure` hook: when `typeof e.cost?.usd === 'number'` and it
        differs from the `COST` state's `usd`, set `COST` to `{ usd: e.cost.usd }`
        and call `writeFrame($)` (it does nothing without a float). `e.changed`
        is not consulted. Then `return next(e)`. The state work runs as
        `void (…).catch(err => log($, …))`, as the file's other hooks do, so a
        failure does not block the measurement. It runs whether or not
        `deskOn()`, so the tile is current when the pane is opened later.
    *   `readCost` is unchanged: still called only from `publish` and `poll`.
        No call is added at `session.start` or after a reload.
    *   No change to the tile's label or to when the pane opens.

#### 10. `plugins/helper-desk/hooks/register.test.tsx` (Modify)

*   **Type / Scope**: engine test kit.
*   **Rig change**: add a `session.measure` stub that echoes `{ changed }`, as
    usage-left's rig has. Replace the fixed `cost: { usd: 0.42 }` in the
    `session.usage` mock with a variable the rig returns a setter for
    (default 0.42, so existing tests are unchanged).
*   **New test**: start a helper and let it finish (await its `turn.complete`
    so no `publish` is still pending). Set the rig's usage cost to 1.50, so a
    late `readCost` would agree. Raise `session.measure` with
    `cost: { usd: 1.5 }`: the pane's "Total chat cost" tile shows `$1.50`.
    Raise one with `cost: { usd: 0.10 }` (as after `/clear`): it shows
    `$0.10`. Raise one with no `cost`: it still shows `$0.10`.

#### 11. `plugins/helper-desk/.claude-plugin/plugin.json` (Modify)

*   **Type / Scope**: manifest.
*   **Proposed Changes**: version `0.8.3`.

#### 12. `plugins/helper-desk/NOTICE` (Modify)

*   **Type / Scope**: change record.
*   **Proposed Changes**: a "Changes in 0.8.3" note: the cost tile follows
    `session.measure`, so it keeps updating after the last subagent finishes.

### Phase 3: catalog and README

Done when `bash scripts/check.sh` exits 0.

#### 13. `.claude-plugin/marketplace.json` (Modify)

*   **Type / Scope**: marketplace catalog (what `/plugin` shows when browsing).
*   **Proposed Changes**:
    *   usage-left: version `0.3.0`, and replace the description, which today
        ends "draws nothing off a subscription", with exactly the same text as
        its `plugin.json`:

        > One row above the prompt: how much of your 7-day and 5-hour usage
        > windows is left, when each resets, and what this session has cost so
        > far (the /cost total, at list prices). LOW under 15%. Reads the
        > engine's own figures, so it costs no tokens; on an API key it shows
        > the cost alone

    *   helper-desk: version `0.8.3`.
*   **Note**: `scripts/check.sh` compares only the `version` of each catalog
    entry with its `plugin.json`. It does not compare descriptions, so keeping
    the two descriptions identical is a manual step.

#### 14. `README.md` (Modify)

*   **Type / Scope**: marketplace documentation.
*   **Proposed Changes**:
    *   usage-left's table row: replace "it draws nothing when you use an API
        key rather than a subscription" with: the row ends with the session's
        cost so far, and on an API key it shows that cost alone. Say the figure
        is the `/cost` total at list prices, so on a subscription it is what
        the same use would cost on the API, not what the plan charges. Link to
        the 0.3.0 notes.
    *   helper-desk's table row: link to the 0.8.3 notes.
    *   Release notes `### usage-left 0.3.0 (YYYY-MM-DD)` and
        `### helper-desk 0.8.3 (YYYY-MM-DD)` with the release date, above the
        existing ones.

### Verification Plan

*   **Per phase**: the check that ends each phase, above.
*   **Whole PR**: `bash scripts/check.sh` exits 0 (validates every plugin,
    runs their tests, checks versions against the catalog).
*   **Live check, terminal**: after installing, in a new chat on a subscription
    account: the row shows `Session cost` after the first reply, and the
    figure grows with each reply, and within a minute of a cache-clock
    keep-warm ping. Compare it with `/cost`: the same amount to the cent.
    After `/clear`, the figure drops to the new chat's total after the next
    reply or tick.
*   **Live check, helper-desk**: run one subagent, let it finish, keep chatting:
    the pane's tile keeps matching `/cost`.
*   **Open questions to settle during the live check**: after `/resume`, does
    the figure restart at $0 or continue? Do keep-warm pings land in the
    ledger at all? Record the answers in the README notes.

--------------------------------------------------------------------------------

*Drafted with EGM*
