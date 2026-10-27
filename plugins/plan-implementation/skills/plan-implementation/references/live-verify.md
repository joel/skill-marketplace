# Live verification: pre-flight, procedure, wire checks, measurements

Loaded from the plan-implementation skill (Step 8) before the first browser step of a
run, and for performance work (Step 7).

## Pre-flight (before the first browser step)

- **Background work is running.** If the app relies on a job worker, a queue
  consumer, a mail catcher or a scheduler, check that the run commands started it.
  Many dev stacks start the web server only, and mail, notifications and exports then
  sit unprocessed while the page looks fine.
- **Your own account.** Sign in with a dev account the developer is not using in
  their browser. Apps that allow one session per user log the other one out, so a
  shared account makes both of you chase phantom logouts. Give every sub-agent its
  own account too.
- **No test run in flight.** If the test suite shares a datastore with the running dev
  app (cache, session store, search index, queue), a test run can sign every browser
  out or empty state the page relies on. Run the validation gate (Step 6) before this
  step, and never report a lost session or emptied state during a test run as a
  product defect.
- **Reproduce server errors through the real server**, not a console or one-off
  script runner: middleware, instrumentation and boot-time configuration can differ,
  so a script reproduction can pass while the browser gets a 500.
- **Never write a password into a committed script.** Read it from an environment
  variable and fail fast when it is unset.

## Procedure

If the project has a product-review or verify skill, use it. Otherwise:

1. Start the app with the new code using the project's run commands, from the
   effort's worktree (rebuild first if dependencies changed; rebuild assets if the
   change added new pins or styles).
2. Sign in using the project's documented dev login recipe.
3. Drive the changed journey end-to-end in a real browser (an agent-driven browser
   or a browser MCP): every state the surface renders, dark and light themes, a
   mobile viewport, and DOM assertions for what a screenshot cannot show (aria
   attributes, computed styles, selected options).
4. Fix anything found, commit the fix into the relevant atomic commit, and re-run
   the test suite.

## Browser tools

- Use what the harness provides: an agent-driven browser, a browser MCP, or a
  Playwright script. If the project already depends on Playwright, use it for scripted
  checks and benchmarks rather than adding a new tool.
- MCP servers registered during a session usually load on the next harness start, not
  the current one: plan the current run on the tools already loaded.
- A headless Chrome on Linux with user-namespace restrictions may need
  `--no-sandbox` to launch.

## Auth, cookie or session changes: verify the wire, not just the screen

Cookie scope and isolation are invisible in a snapshot. Capture the raw `Set-Cookie`
headers with `curl` and a cookie jar, and assert:

- every auth cookie is host-only (Netscape jar field 2 is `FALSE`; an explicit
  `Domain=` equal to the host still records `TRUE` and is not host-only);
- a cookie set on host A does not authenticate host B;
- single-use tokens reject on replay;
- expired or garbage tokens land on the failure page.

## Performance work and long-running measurements

- **One measured change per commit.** Record the baseline in its own commit, then each
  optimisation carries before → after medians, with the spread, for the scenarios it
  touches in its body. Commits that change no measured path say "Performance gain:
  not applicable". Raw runs stay out of git; result tables go in the project's docs.
  A change that measures inside the noise is reverted, not committed.
- Run a benchmark matrix as one background script that writes a log. Never overlap
  two measurements (server, browser and test harnesses share the CPU, and the numbers
  stop meaning anything).
- Do not edit application code while a measurement runs: a dev server that reloads on
  change measures a mix of versions.
- `pkill -f "<pattern>"` inside a shell tool call matches that call's own command
  line and kills it. Stop background tasks through the harness, or from a call whose
  text does not contain the pattern.
- If the app runs in a container without `git`, pass the sha in
  (`BENCH_SHA=$(git rev-parse --short HEAD)`) rather than resolving it inside.
