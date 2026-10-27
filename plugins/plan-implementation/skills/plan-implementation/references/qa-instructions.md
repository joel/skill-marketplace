# QA instructions: the notes a tester works from

Loaded from the plan-implementation skill (Step 12) before writing the QA notes.

Whoever tests the change after the PR (a QA team, the reviewer, the developer on a
staging deploy) usually has not read the code. Write for a person who knows the
product but not the diff. Without these notes the tester guesses what to check.

## Where they go

Where the project config says: a `## QA` section in the PR body by default (add it
with `gh pr edit <PR> --body-file <file>` once the review loop is done), or an issue
comment, or a field in the project's tracker. A project that sets QA notes to `none`
skips this step, and the closing summary says so.

Write them last, from what shipped: the review loop can change behaviour after the PR
opens.

## Sources, in this order

1. What actually shipped: the final diff, and what live verification (Step 8) or the
   tests proved.
2. The issue's verification section and acceptance criteria. Drop anything the work
   no longer covers.
3. The real UI: page names, headings, button and field labels, taken from the views,
   templates or translation files rather than paraphrased.

## Template

```markdown
## QA: <the outcome in plain words>

**What changed for users.** <One or two sentences. "Nothing you can see" is a valid
answer; then say what must stay the same.>

**Where.** <The page, how to reach it, and the control to use, with the labels as
they appear on screen.>

### Quick check (about 2 minutes)

<The shortest path that proves the change works and that nothing around it broke,
with the least setup that still shows a regression. A tester who runs only this
section should still catch a broken release.>

1. **The change works.** <One action.>
    * ☐ <Expected result, with the near-miss that would mean fail.>
2. **No regression.** <The everyday journey next to the change, one action.>
    * ☐ <Expected result.>

### Full check

#### Data

<What to create or use first. Pick values that make a regression visible: a
near-miss next to each intended match.>

#### 1. <Journey>

1. <Action.>
    * ☐ <Expected result.> <When it helps: "If X also appears, … **fail**.">

### Not expected to change

<Neighbouring pages and behaviour that must stay as they were.>
```

## Rules

- **Quick check first, always.** One step that proves the change and one that proves
  the neighbouring everyday journey still works. The full check follows for edge
  cases and combinations. Never write the full list alone.
- **Make regressions visible.** A check that passes whether the change works or not
  proves nothing. Pair each intended match with a near-miss: a search for `50%` must
  list "Budget 50% overrun" but not "Budget 500 overrun", which would appear only if
  `%` acted as a wildcard.
- **Use the screen's own words**: headings, placeholder text and button labels, never
  class names, routes or code identifiers.
- **State the defaults.** A tester who does not know that a list hides archived
  records by default will report a correct result as a bug.
- **No UI to test?** Say so in the first paragraph and point to the CI checks that
  cover the change. If a developer could still check it, add an optional console or
  script check that leaves no trace (rolled back or read-only). Never invent a UI
  check for a change with nothing to see.
- **Keep it short.** About one screen, with no implementation narrative. The PR and
  the commits carry the why.
