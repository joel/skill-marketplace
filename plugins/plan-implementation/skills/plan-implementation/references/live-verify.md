# Live verification: the procedure and the wire checks

Loaded from the plan-implementation skill (Step 8) before the first browser step of a
run.

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

## Auth, cookie or session changes: verify the wire, not just the screen

Cookie scope and isolation are invisible in a snapshot. Capture the raw `Set-Cookie`
headers with `curl` and a cookie jar, and assert:

- every auth cookie is host-only (Netscape jar field 2 is `FALSE`; an explicit
  `Domain=` equal to the host still records `TRUE` and is not host-only);
- a cookie set on host A does not authenticate host B;
- single-use tokens reject on replay;
- expired or garbage tokens land on the failure page.
