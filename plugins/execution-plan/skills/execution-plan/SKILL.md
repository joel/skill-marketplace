---
name: execution-plan
description: >-
  Drive the end-to-end execution of any coherent piece of code work in a
  GitHub-hosted project: a size-scaled design pass (feature-dev agents,
  frontend-design, UX pass, concurrency pre-mortem), then GitHub issue, Kanban,
  branch, implement, seed data, code and security review loops, validation
  gates, atomic commits, live verification in a real browser, docs, PR,
  automated-reviewer loop, review-thread triage, merge per project policy,
  optional release, board close-out, and persisting what was learned. Trigger
  whenever the user asks to implement a feature, fix a bug, refactor, ship a
  change, or act on a plan that will produce commits; also on "start work",
  "new feature", "fix issue", "create PR", "push changes", "let's implement",
  "execute the plan". No step silently drops. Project-specific values (repo,
  board, commands, gates, reviewer bot, merge policy) come from the project's
  own workflow doc. Do not engage for questions or read-only analysis; defer
  to a project-local execution-plan skill when one exists.
metadata:
  version: "1.0.0"
  origin: "Genericised from a production Rails project's execution-plan skill"
---

# Execution Plan

This skill enforces a full development lifecycle for every coherent piece of code
work:

Design → Issue → Kanban → Branch → Implement → Seed → CR/SR → Validate → Commit →
Live Verify → Docs → Push → PR → Automated review → Respond → Merge → Release →
Done → Persist.

**Announce the skill at the start of every run** with a visible marker line so the
developer can see the lifecycle is engaged:

> **USING EXECUTION PLAN** — #123 · bug fix · issue → branch → implement → CR →
> commit → verify → PR → review loop → merge → done

## Why this matters

Skipping steps, especially the issue, the board move, and live testing, creates
tracking gaps and lets runtime bugs through. Automated tests catch logic errors but
not rendering problems, broken layouts, or integration mistakes between layers.
Live verification regularly catches runtime errors that unit and system tests miss.

## Scope and precedence

- Engage in any git repository with a GitHub remote when the request will produce
  commits. Stay silent for questions, explanations, and read-only analysis.
- **If the repository ships its own execution-plan skill** (for example
  `.claude/skills/execution-plan/`), that project-local version wins. Do not run both.
- **The project's workflow doc overrides this skill.** Read `AGENTS.md` and
  `CLAUDE.md` first. They supply the values this skill deliberately leaves open. See
  [project configuration](references/project-config.md) for the contract and a
  template block to paste into a project.

## GitHub CLI authentication

A `GITHUB_TOKEN` environment variable can override keyring-based `gh` auth and cause
puzzling failures. If `gh auth status` reports a token from the environment that you
did not intend, prefix `gh` commands with `unset GITHUB_TOKEN &&`.

## Design phase (delegated to the feature-dev plugin)

The understand-and-design inner loop and the pre-push reviews are owned by
Anthropic's official plugins. They stay the upstream source of truth; this skill keeps
only the governance and gates around them.

| Capability | Kind | Use it to |
|---|---|---|
| `feature-dev:code-explorer` | agent (`subagent_type`) | Trace how the relevant area works before you plan |
| `feature-dev:code-architect` | agent (`subagent_type`) | Get an implementation blueprint grounded in real patterns |
| `frontend-design` | skill | Visual direction for customer-facing surfaces |
| `/code-review` | skill | The pre-push code review loop (Step 5c) |
| `/security-review` | skill | The pre-push security review loop (Step 5d) |

Do not drive a run through the interactive `/feature-dev` command. It is blind to the
governance here (issues, board, reviewer bot, releases). Invoke the agents instead.

### Scale the design pass to the task size

- **Trivial** (one-line fix, copy or docs change, dependency bump, config tweak):
  skip the design agents. Go straight to issue → branch → commit.
- **Already designed this session** (a plan-mode pass or equivalent exploration plus
  a user-approved plan grounded in real code): do not re-run the explorer and
  architect agents. Feed the existing findings into the issue. This exemption does
  **not** waive the passes with their own mandates: the customer-facing UI pass, the
  UX pass, and the pre-mortem still apply when the work triggers them. "Already
  covered" means the prior plan shows the pass itself, with its checklist walked,
  not merely that design decisions were made. When in doubt, run the pass. It takes
  minutes and the misses it catches otherwise cost review rounds.
- **Feature, multi-file, or architectural** work: run the full design pass before
  writing the issue, so the issue's plan is grounded in real code:
  1. Launch 2–3 `feature-dev:code-explorer` agents in parallel, each on a different
     aspect (similar features, architecture and abstractions, extension points).
  2. Resolve ambiguities with concrete questions to the user and wait for answers.
  3. For customer-facing UI, invoke `frontend-design` for the visual pass. If the
     project has a design-system doc or an external design source, treat it as a
     reference input and let the design pass lead, unless the project doc says
     otherwise.
  4. For any user-facing change, do an interaction/UX pass against the project's UX
     conventions doc if it has one. Checklist in
     [design-pass.md](references/design-pass.md).
  5. Run the concurrency and failure-mode pre-mortem when the feature is async,
     job-backed, pushes server updates, calls anything external or paid, mutates
     shared state under concurrency, or adds client-side interaction state.
     Questions in [design-pass.md](references/design-pass.md). This is the cheapest
     place to catch the bug class that an automated reviewer otherwise surfaces one
     round at a time.
  6. Launch 2–3 `feature-dev:code-architect` agents in parallel (minimal-change,
     clean-architecture, pragmatic-balance). Pick one with reasoning and confirm the
     approach with the user.
  7. Feed the chosen blueprint, including UI and UX decisions and any accepted
     limitation from the pre-mortem, into the issue plan and the implementation.

## Workflow steps

### Step 1: Create the GitHub issue

Before writing code, create an issue with a plan. For feature work, base the scope on
the explorer findings and the chosen architect blueprint.

```bash
gh issue create --repo <owner>/<repo> --title "<descriptive title>" --label "<label>" \
  --body "$(cat <<'EOT'
## Summary
<what and why>

## Scope
<bullet list of changes>

## Verification
<how to confirm it works>
EOT
)"
```

Pick the label from the project's label set (typically `enhancement`, `bug`,
`cleanup` or `refactor`, `documentation`). If the project keeps a per-effort audit
log, open it now. See [audit-log.md](references/audit-log.md).

### Step 2: Add to the Kanban board

If the project uses a GitHub Projects board:

```bash
gh project item-add <project-number> --owner <owner> --url <issue-url> --format json | jq -r .id
```

Capture the item ID from this output. The command is idempotent, so re-running it for
an existing issue returns the same ID. Do not look the item up through
`item-list`; its default page misses freshly added items on a large board.

### Step 3: Move to In Progress

Update the status field using the IDs from the project config. When work starts
immediately after issue creation, move straight to In Progress and skip the Ready
hop. Commands and ID discovery in [github-projects.md](references/github-projects.md).

### Step 4: Create the branch

```bash
git checkout main && git pull origin main
git checkout -b feature/<descriptive-name>
```

Prefixes: `feature/*`, `fix/*`, `docs/*`, `refactor/*`, unless the project doc says
otherwise.

### Step 5: Implement

Implement the architect blueprint (for trivial changes, implement directly), following
the project's conventions doc. Before writing, decide where the code lives. If the
project enforces module or domain boundaries (a package boundary checker, a
dependency-direction linter, a type checker on part of the tree), place code in the
owning module and cross boundaries only through the declared public surface. **Never
weaken enforcement to make a change pass.** If a boundary genuinely blocks a
legitimate change, the boundary is what should change, deliberately.

### Step 5b: Seed data (mandatory for any new user-facing surface)

Extend the seed or fixture data so that after a fresh reset a developer can sign in
and immediately play with the new surface, with no manual record building:

- **Comprehensive states**: seed records across every state the surface renders,
  including an empty case.
- **Idempotent**: find-or-create keyed on a natural attribute; re-running never
  duplicates.
- **Production-guarded**: seeds never run in production.
- **Loginable**: seeded accounts can sign in; note the demo credentials in a comment.
- **Verify**: run the seed task twice against the same database. A reset that
  drops the database masks non-idempotent seeds. Confirm the records render in
  Step 8.

### Step 5c: Code review (CR), the internal loop before push

Review your own code before the PR exists, so any remote automated reviewer opens on
already-clean code instead of being the first reviewer. Skip only for trivial changes.

Steps 5c and 5d are **one combined pre-push gate**. Decide both here, before any
`git push`. If the repository is public, a push publishes the diff, so a security
review sequenced after the push defeats its purpose.

```
/code-review            # scale effort to the change
/code-review high       # high to max for security, auth, concurrency, wide blast radius
```

The loop:

1. Run `/code-review` (optionally `--fix` for mechanical fixes to the working tree).
2. Triage each finding exactly like a reviewer comment (Step 11b): fix real ones into
   the relevant atomic commit; reproduce before dismissing a suspected false
   positive; defer to a tracked issue only when genuinely justified.
3. Re-run after fixes and repeat until a round comes back clean, or the only
   remainder is explicitly deferred.

**Stop rule.** The loop converges in severity: early rounds catch correctness,
ordering, and security bugs; later rounds shrink to cosmetic nits on already-correct
code. When findings degrade to nits, or each needs a more contrived condition to
trigger, stop and push. Prefer one principled fix (a small invariant or state machine)
over patching each adjacent edge case. Two substantive rounds that converge is
enough. The aim is correct code, not a perfect local verdict.

### Step 5d: Security review (SR), the adversarial pass before push

`/code-review` hunts correctness bugs; this pass hunts security defects against the
project's own threat model (tenant isolation, authorization and IDOR, auth,
injection, upload and egress, secrets, output safety). They are different lenses, so
run both.

```
/security-review        # reviews the pending changes on the current branch
```

Point it at the project's security model or review rubric doc if one exists, so it
reasons about the project's risks rather than generic boilerplate.

**Mandatory when the diff touches any of:** authentication, authorization, tenancy,
the actions or service layer, request params or raw SQL, file upload or media,
externally callable tools or endpoints, external-provider calls, secrets, or any
new route. The project config may extend this list. **Skip only** for docs-only or
purely cosmetic UI diffs. Same triage and stop rule as Step 5c.

### Step 6: Pre-commit validation

Run the project's lint, test, and system-test tasks and make sure they pass. Use the
commands from the project config; confirm task names against the project's task
runner rather than assuming.

**Run every merge-blocking gate explicitly.** Projects often have CI checks that the
default test task does not run (boundary checkers, type checkers, schema drift,
dependency audits). The project config lists them. A gate violation usually prints its
exact fix; apply it. Never suppress a fresh violation with a config toggle or a
todo-list entry.

Some tests may only be runnable in CI (for example browser-driven specs when the
local environment has no browser driver). Treat that class of failure as
environmental, not a regression, rely on CI for it, and confirm CI green on HEAD
before merging. If such a surface is central to the change, live-verify it in Step 8.

### Step 7: Commit (atomic commits required)

**Never bundle all changes into one giant commit.** Each commit must be:

- **Atomic**: one logical change ("harden pagination", "fix policy bypass", "add
  edit UI" are three commits, not one).
- **Focused**: only files related to that change.
- **Reversible**: revertable independently without breaking other changes.
- **Buildable**: passes lint and tests on its own.

Stage specific files, not `git add .`, and write a descriptive message with a body.
Include the attribution trailer your harness instructs.

**Verify the commit contains every file you changed.** An explicit file list is how an
edited file gets silently left behind: you commit, the build still passes because the
working tree has your fix, and the old version ships. After committing, check
`git show --stat HEAD`. If a reviewer later says "you didn't fix X" and you are sure
you did, check the pushed code with `git show origin/<branch>:<path>`, not your
working tree.

**Pre-commit hooks.** If a hook is a false positive, skip only that hook and say why
in the commit body (`SKIP=<hook> git commit ...` or the framework's equivalent).
Never disable the whole hook framework.

A subject-only message starting with `#<issue>` can be stripped to nothing by git's
default comment character and rejected as empty. Add a body, or use
`git -c core.commentChar=";"`.

**`[skip ci]` markers.** Check the project config before adding one. Where CI already
path-ignores docs, none is needed; where a squash merge folds commit bodies into the
merge commit and a deploy pipeline reads markers, a `[skip ci]` in any commit body can
silently skip a production deploy.

### Step 8: Live verification (runtime test)

After committing and before pushing, verify the change running in the real app. If
the project has a product-review or verify skill, use it. Otherwise:

1. Start the app with the new code using the project's run commands (rebuild first
   if dependencies changed; rebuild assets if the change added new pins or styles).
2. Sign in using the project's documented dev login recipe.
3. Drive the changed journey end-to-end in a real browser (an agent-driven browser
   or a browser MCP): every state the surface renders, dark and light themes, a
   mobile viewport, and DOM assertions for what a screenshot cannot show (aria
   attributes, computed styles, selected options).
4. Fix anything found, commit the fix, and re-run the test suite.

**Auth, cookie, or session changes: verify the wire, not just the screen.** Cookie
scope and isolation are invisible in a snapshot. Capture the raw `Set-Cookie` headers
with `curl` and a cookie jar, and assert: every auth cookie is host-only (Netscape jar
field 2 is `FALSE`; an explicit `Domain=` equal to the host still records `TRUE` and
is not host-only), a cookie set on host A does not authenticate host B, single-use
tokens reject on replay, and expired or garbage tokens land on the failure page.

### Step 8b: Documentation and diagrams (mandatory for cross-cutting work)

If the change touches architecture, infrastructure, deployment, tenancy, auth, or any
cross-cutting flow, update the project docs and their visual schemas before pushing:

- Update the architecture doc, the setup recipe (keep commands copy-paste
  reproducible), and any gotcha table. Append to the per-effort audit log if used.
- Include visual schemas, not just prose: Mermaid inline for request flows, schema,
  and sequence diagrams; an editable scene (for example Excalidraw) for the headline
  architecture when the project keeps one.
- Add or update a per-directory README for directories whose purpose is not obvious.
- **Design-system sync.** If the change adds or alters a design token or a shared UI
  component and the project keeps a design-system doc, update it in the same PR.
- Commit docs atomically.

**Do not leave a docs-only commit as the PR tip** when CI path-ignores docs. Branch
protection needs the checks on the HEAD sha, and a docs-only HEAD never runs CI, so
the PR sits blocked. Order commits so code lands last, or fold trailing docs into the
preceding code commit before pushing.

### Step 9: Push and create the PR

**Freshness check first.** Other sessions and agents may have moved things: `main`
can gain merges, the remote branch can be rebased under you, the next release tag
can be taken. Before pushing, and again before tagging:

```bash
git fetch origin && git log --oneline HEAD..origin/main | head   # anything new under you?
git push -u origin <branch-name>
```

If the remote branch moved, reconcile onto its version; do not clobber it.

```bash
gh pr create --repo <owner>/<repo> --title "<PR title>" --body "$(cat <<'EOT'
## Summary
<bullet points of what changed>

## Test plan
- [x] Tests pass
- [x] Lint and all gates pass
- [x] Pre-commit hooks pass
- [x] Live verification of <journey>

Closes #<issue-number>
EOT
)"
```

Add the attribution footer your harness instructs.

### Step 10: Move the issue to In Review

Board update as in Step 3, with the In Review option ID.

### Step 10b: Wait for and check the automated review (do not skip)

If the project has an automated PR reviewer (a bot such as Codex configured to
review every PR), **proactively wait for and check its review before declaring the
work done or handing back**, without being asked. Opening the PR is not the end of
the loop. The bot's verdict may arrive through different APIs for findings versus a
clean pass, it re-anchors already-resolved comments on every round, and it is
sometimes slow or silent. The polling recipe, the dedupe rule, the stop rule, and
the bounded-wait rule are in
[automated-review-loop.md](references/automated-review-loop.md).

The review is iterative. Expect several rounds. After every fix push, re-trigger,
wait, re-check, address. Loop until a round comes back clean, or the remaining items
are explicitly deferred to tracked issues and their threads resolved.

### Step 11: Respond to every review comment

After the PR receives comments, human or bot, respond to every one and resolve each
thread. Never leave a comment unanswered. For each comment decide one of:

- **Actionable**: fix, commit, push, reply referencing the commit sha.
- **Incorrect**: reply with a clear technical explanation of why no change is
  needed.
- **Deferred**: reply acknowledging the concern and naming the issue or PR that will
  address it.

**Before replying "incorrect" or "already fixed", verify it.** Bot findings are
frequently subtle and correct. For "already fixed", confirm the fix is in the pushed
code, not just edited locally. For "false positive", reproduce the claim first with a
30-second probe (a runner script, a focused test, a curl) and quote the evidence in
the reply. If the probe confirms the finding, fix it. Expect several rounds; a fix
can introduce a new, sometimes higher-severity, finding.

API recipes for reading, replying, and resolving threads (including the reply
endpoint that returns 404 without the PR number) are in
[pr-review-threads.md](references/pr-review-threads.md).

### Step 12: Merge, per project policy

The objective gate is:

- required CI checks green on HEAD,
- `mergeStateStatus: CLEAN` and `MERGEABLE`,
- zero unresolved review threads (every thread fixed or accepted-and-resolved),
- the latest automated-reviewer verdict is clean, or the remainder is accepted nits
  you consciously resolved.

**Who merges is a project setting.** If the project config grants merge authority to
the agent, merge once the gate is green and do not pause for approval:

```bash
gh pr merge <PR> --repo <owner>/<repo> --squash
```

If the project config says humans merge, or says nothing, **stop at PR-ready**:
report the gate status and hand off. Docs-only PRs that sit blocked with no failing
checks follow the project's docs-PR convention (often an admin merge).

### Step 13: Tag and publish a release (optional, after merge)

If the project versions releases, follow its release policy immediately after merge.
Re-run the freshness check (`git fetch --tags`) and confirm the intended version is
free. If the project keeps a curated changelog, fill the entry **before** tagging, in
the same PR as the feature when practical, so the tag captures it. Auto-generated
release notes do not replace the curated entry. Check for drift: the changelog's
newest heading should be the previous tag; backfill from release notes if not.

```bash
git checkout main && git pull origin main
# Confirm the merge commit's own main CI/deploy run is green. Get the sha from
# `gh pr view <PR> --json mergeCommit`; the PR's status rollup describes the PR-head
# checks, not the push-to-main run of the squash commit.
gh release view <tag> --repo <owner>/<repo> >/dev/null 2>&1 \
  && echo "<tag> already released, skip" \
  || gh release create <tag> --repo <owner>/<repo> --target main --title "<title>" --generate-notes
```

### Step 14: Move the issue to Done

Board update with the Done option ID. Write the final summary (issue → commit →
release → status) to the audit log if used.

### Step 15: Persist what is worth keeping

Finishing a feature is the moment to save what would otherwise evaporate at the
next context reset:

- **Agent memory**: a gotcha that cost real time, a decision and its rationale, a
  consciously accepted limitation, a recurring failure mode. Write the non-obvious
  part, not what code or git already records. Update rather than duplicate.
- **Project documentation**: architecture and flow changes with diagrams, the setup
  recipe when a step changed, the design system when tokens or components changed,
  the changelog entry.
- **Follow-ups**: anything deferred or discovered out of scope becomes a tracked
  issue, not a PR comment or a memory.

Rule of thumb: if a future you or a teammate would have to re-derive it from scratch,
write it down now.

## Quick reference: complete flow

```
0.  explorer + architect agents (×2-3)          → Design pass (feature/multi-file; skip if trivial)
1.  gh issue create (+ open audit log)          → Issue with plan grounded in the design pass
2.  gh project item-add                         → Add to board (Backlog)
3.  gh project item-edit                        → In Progress
4.  git checkout -b feature/                    → Branch
5.  implement the blueprint                     → Respect module boundaries; never weaken enforcement
5b. extend seeds (+ run seeds twice)            → Showcase-ready demo data
5c. /code-review (loop; mind the stop rule)     → Internal CR, combined pre-push gate with 5d
5d. /security-review (decided at 5c, pre-push)  → Adversarial SR
6.  lint + tests + every merge-blocking gate    → Must be green
7.  git commit (atomic; verify --stat)          → Hooks validate
8.  run app + real browser (+ curl for cookies) → Live verification
8b. docs + diagrams + design-system sync        → Code commit last
9.  git fetch + push + gh pr create             → PR (Closes #N)
10. gh project item-edit                        → In Review
10b. wait for + check the automated review      → Iterate until clean; bounded wait
11. read + reply + resolve every thread         → Human and bot
12. merge per project policy                    → Agent merges only if the project grants it
13. changelog first, then gh release create     → Optional
14. gh project item-edit + final summary        → Done
15. memory + project docs + follow-up issues    → Persist before the context resets
```
