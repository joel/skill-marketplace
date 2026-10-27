---
name: plan-implementation
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
  to a project-local skill with the same job when one exists.
metadata:
  version: "2.7.0"
  origin: "Genericised from a production Rails project's execution-plan skill"
---

# Plan Implementation

This skill enforces a full development lifecycle for every coherent piece of code
work:

Design → Issue → Kanban → Branch → Implement → Seed → CR/SR → Validate → Commit →
Live Verify → Docs → Push → PR → Automated review → Respond → Merge → Release →
Done → Persist.

**Announce the skill at the start of every run** with a visible marker line so the
developer can see the lifecycle is engaged:

> **USING PLAN IMPLEMENTATION** — #123 · bug fix · issue → branch → implement → CR →
> commit → verify → PR → review loop → merge → done

## Why this matters

Skipping steps, especially the issue, the board move, and live testing, creates
tracking gaps and lets runtime bugs through. Automated tests catch logic errors but
not rendering problems, broken layouts, or integration mistakes between layers.
Live verification regularly catches runtime errors that unit and system tests miss.

## Scope and precedence

- Engage in any git repository with a GitHub remote when the request will produce
  commits. Stay silent for questions, explanations, and read-only analysis.
- **If the repository ships its own skill with the same job** (for example
  `.claude/skills/execution-plan/` or `.claude/skills/plan-implementation/`), that
  project-local version wins. Do not run both.
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
  architect agents, and say so in the announce marker. Feed the existing findings
  into the issue. This exemption does **not** waive the passes with their own
  mandates: the customer-facing UI pass, the UX pass, and the pre-mortem still apply
  when the work triggers them. "Already
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

## Sub-agents: keep the main context for reasoning

A run that reads the whole area and every test run in the main context compacts
before the PR opens, and each compaction throws away what was read. Delegate the reads
and runs whose output is mostly noise; keep what the main agent must reason about.

| Step | Delegate to | It returns |
|---|---|---|
| Orientation, before Step 5 and after every compaction | one `Explore` agent | a one-page brief: entry points, files to change, conventions, the snippets that matter |
| Design pass | `feature-dev:code-explorer` / `code-architect` | findings and a blueprint; read the snippets they quote, not the files behind them |
| Validation, Step 6 and per commit in Step 7 | one `general-purpose` agent | failures only, with ten lines of context; "clean" otherwise |
| A local tooling gap blocking the run | one `general-purpose` agent in its own worktree | root cause and the PR that fixes it |

**Stays in the main agent:** implementing, commit messages, the PR body, review
replies and triage. Briefs and what to ask back: [sub-agents.md](references/sub-agents.md).

## Write for the reviewer

AI-assisted PRs take longer to review when they over-comment or over-explain.
Comments say what the code cannot (a constraint, a non-obvious *why*, an invariant),
in one to three lines. Read the whole diff before pushing, as its first reviewer. The
PR description stays under ~150 words of prose; review replies and the closing
summary are a few lines each. Details and templates:
[write-for-the-reviewer.md](references/write-for-the-reviewer.md).

## Workflow steps

### Step 1: Create the GitHub issue

Before writing code, create an issue with a plan (`gh issue create`): the problem,
the expected outcome, the scope and how to verify it. For feature work, base the scope
on the explorer findings and the chosen architect blueprint. Body template in
[write-for-the-reviewer.md](references/write-for-the-reviewer.md).

Pick the label from the project's label set (typically `enhancement`, `bug`,
`cleanup` or `refactor`, `documentation`). If the project keeps a per-effort audit
log, open it now. See [audit-log.md](references/audit-log.md).

Start the **knowledge candidate log** now: a scratch file outside the checkout, one
line per surprise (rule, why, evidence, status). Passes 1 and 2 consume it; see
[knowledge-consolidation.md](references/knowledge-consolidation.md).

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

### Step 4: Create the branch in its own worktree

Several sessions or agents often share one checkout, and a `git checkout` there moves
every session's HEAD at once: a parallel session can switch branches under you and
leave your edit beside its uncommitted files. So every effort works in **its own
worktree from its first edit**. In the main checkout, never switch branches, stash
or reset: its uncommitted changes may belong to someone else.

Check where you are first (`git worktree list`, then `git status` in the worktree).
Resuming an effort that already has a branch? Work in its existing worktree; never
create a second branch for the same effort.

```bash
git fetch origin main
git worktree add ../<repo>-wt-<slug> -b feature/<descriptive-name> origin/main
```

A fresh worktree has no gitignored files: run the project's worktree setup (copy the
local config the app and tests need, install dependencies). For a branch that exists
only on the remote (a bot's PR), fetch it explicitly first
(`git fetch origin +refs/heads/<branch>:refs/remotes/origin/<branch>`), then
`git worktree add <path> -b <branch> origin/<branch>`. Run every edit, test, commit
and push from the worktree, and point `/code-review` and the sub-agents at it. The
harness's own worktree support is fine when these rules hold.

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

Unless the change is trivial, work from the orientation brief (Sub-agents above).
After a compaction, relaunch it for the files the next step edits; do not re-read the area.

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
runner rather than assuming. Run them through the validation agent (Sub-agents
above), which returns failures only; fix in the main agent and re-run the same way.

**Run every merge-blocking gate explicitly.** Projects often have CI checks that the
default test task does not run (boundary checkers, type checkers, schema drift,
dependency audits). The project config lists them. A gate violation usually prints its
exact fix; apply it. Never suppress a fresh violation with a config toggle or a
todo-list entry.

Some tests may only run in CI (browser specs without a local driver): treat their
local failure as environmental, rely on CI and confirm it green on HEAD; live-verify
such a surface in Step 8 when it is central. A failure that appears only in a full or
grouped run, and passes when its file runs alone on your branch and on the base
commit, is order-dependent, not yours: report it with both runs; do not chase it.

### Step 7: Commit (atomic commits required)

**Never bundle all changes into one giant commit.** Each commit must be:

- **Atomic**: one logical change ("harden pagination", "fix policy bypass", "add
  edit UI" are three commits, not one).
- **Focused**: only files related to that change.
- **Reversible**: revertable independently without breaking other changes.
- **Buildable**: passes lint and tests on its own (the validation agent checks each
  commit of a stack).

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

After committing and before pushing, verify the change running in the real app, with
the project's product-review or verify skill if it has one. Otherwise start the app
from the worktree, sign in with the dev login recipe, and drive every changed journey
end to end in a real browser: every state, both themes, a mobile viewport, and DOM
assertions for what a screenshot cannot show. Fix what breaks into the relevant
commit and re-run the tests. **Auth, cookie or session changes also verify the wire**
with `curl`, not just the screen. Procedure and checks:
[live-verify.md](references/live-verify.md).

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
can be taken. Before pushing, and again before tagging, `git fetch origin` and look at
`HEAD..origin/main`. If the remote branch moved, reconcile onto it; never clobber it.
**Behind?** Rebase onto `origin/main` (an already-pushed branch goes out with
`--force-with-lease`, never `--force`; a branch others build on merges `main`
instead), regenerate rather than hand-merge generated files, then check what came in
(dependencies, migrations, newly tracked files) and re-run Step 6 before
`git push -u origin <branch>`. Procedure: [freshness.md](references/freshness.md).

After the freshness check and before this run's first push, run **consolidation Pass 1**:
confirmed candidates that pass the five gates go into their own docs commit, pushed
with the code and named in the PR body (never as a docs-only PR tip, Step 8b).

Before the first push, read the whole diff as its first reviewer. Then open the PR
with `gh pr create`: what changed, why and what to look at, a short test plan, notes
on migrations or manual steps, `Closes #<issue-number>`, under ~150 words of prose.
Template in [write-for-the-reviewer.md](references/write-for-the-reviewer.md); add
the attribution footer your harness instructs.

### Step 10: Move the issue to In Review

Board update as in Step 3, with the In Review option ID.

### Step 10b: Wait for and check the automated review (do not skip)

If the project has an automated PR reviewer (a bot such as Codex), **wait for and
check its review before declaring the work done**, without being asked. Findings and
clean verdicts arrive through different channels (reviews, inline comments, an
edited status comment, a reaction), resolved comments are re-anchored on every round,
a force-push may not retrigger it, and it is sometimes slow or silent. Paginate every
list. Expect several rounds: after every fix push, re-trigger once, wait a bounded
time, re-check, address, until a round is clean or the remainder is deferred to
tracked issues with threads resolved. Recipes, dedupe and stop rules:
[automated-review-loop.md](references/automated-review-loop.md).

### Step 11: Respond to every review comment

After the PR receives comments, human or bot, respond to every one and resolve each
thread. Never leave a comment unanswered. For each comment decide one of:

- **Actionable**: fix, commit, push, reply naming the commit sha and the change in
  one or two sentences.
- **Incorrect**: reply with a clear technical explanation of why no change is
  needed.
- **Deferred**: reply acknowledging the concern and naming the issue or PR that will
  address it.

**Verify claims against code and data, in both directions.** Bot findings are
frequently subtle and correct, and a human's counter-claim ("no, that can't happen")
gets the same check. For "already fixed", confirm the fix is in the pushed code. For
"false positive", reproduce first with a 30-second probe (a script, a focused test, a
curl, a read-only count) and quote the evidence; reply with counts and file
references, never customer or personal data. A reviewer can be wrong on the fact and
right on the direction: say both. A fix can introduce a new, higher-severity finding.

API recipes for reading, replying, and resolving threads (including the reply
endpoint that returns 404 without the PR number) are in
[pr-review-threads.md](references/pr-review-threads.md).

A round that lands after the developer's checkout moved on is fixed in the PR's own
worktree; never switch or dirty the developer's checkout.

When the review loop is done, run **consolidation Pass 2** over what CI and the
reviews taught. It reports, it never commits to this PR (Step 15).

### Step 12: Merge, per project policy

The objective gate is:

- **every** check on HEAD completed green, not only the required ones (a running or
  failed optional check is not green), re-verified after any fix push,
- `mergeStateStatus: CLEAN` and `MERGEABLE`,
- zero unresolved review threads (every thread fixed or accepted-and-resolved),
- the latest automated-reviewer verdict is clean, or the remainder is accepted nits
  you consciously resolved,
- the **QA notes** are written where the project config says (default: a `## QA`
  section in the PR body), unless it sets them to `none`.

Write the QA notes last, from what shipped, for a tester who knows the product but not
the code: a two-minute **Quick check** (the change works, the neighbouring journey
still does), then a **Full check** with data that makes a regression visible. Template
in [qa-instructions.md](references/qa-instructions.md).

**Who merges is a project setting.** If the project config grants merge authority to
the agent, merge once the gate is green and do not pause for approval:

```bash
gh pr merge <PR> --repo <owner>/<repo> --squash
```

If the project config says humans merge, or says nothing, **stop at PR-ready**:
post the closing summary (Step 14) and hand off. Docs-only PRs that sit blocked with
no failing checks follow the project's docs-PR convention (often an admin merge).

### Step 13: Tag and publish a release (optional, after merge)

If the project versions releases, follow its release policy right after merge: the
curated changelog entry is filled **before** tagging, the intended version is free,
and the merge commit's own `main` run is green. Commands and checks:
[release.md](references/release.md).

### Step 14: Move the issue to Done

Board update with the Done option ID. Post the **closing summary**, a few lines each:
what shipped, what was accepted or deferred and why, what verification ran, the
Knowledge consolidation report (Step 15), and the follow-up issues filed. Copy it to
the audit log if used. Once the PR is merged, remove the effort's worktree
(`git worktree remove <path>`) and its local branch; when a human merges, say so.

### Step 15: Knowledge consolidation report (mandatory)

Every effort makes the next one easier, and **the repository remembers, never agent
memory**: do not write the harness's memory or any personal store, which teammates,
other machines and other agents cannot see. Pass 1 committed what passed the five
gates (novel, verified, reusable, scoped, durable) to its narrowest home in the
repository; Pass 2 only reported.

- The closing summary carries a **Knowledge consolidation** section: captured, Pass 2
  not committed, already documented, unresolved, skill proposals, or "No reusable
  knowledge identified".
- **Follow-ups**: Pass 2 learnings and anything deferred or out of scope become
  tracked issues, not a PR comment or a memory.
- Project documentation (architecture, setup recipe, design system, changelog) is
  Step 8b's and Step 13's; confirm it landed.

## Quick reference: complete flow

```
0.  explorer + architect agents (×2-3)          → Design pass (feature/multi-file; skip if trivial)
1.  gh issue create (+ audit, candidate log)    → Issue with plan grounded in the design pass
2.  gh project item-add                         → Add to board (Backlog)
3.  gh project item-edit                        → In Progress
4.  git worktree add … origin/main              → Branch in its own worktree; never switch the shared checkout
4b. Explore agent (skip if trivial)             → Orientation brief; again after every compaction
5.  implement the blueprint                     → Respect module boundaries; never weaken enforcement
5b. extend seeds (+ run seeds twice)            → Showcase-ready demo data
5c. /code-review (loop; mind the stop rule)     → Internal CR, combined pre-push gate with 5d
5d. /security-review (decided at 5c, pre-push)  → Adversarial SR
6.  lint + tests + every merge-blocking gate    → Must be green
7.  git commit (atomic; verify --stat)          → Hooks validate
8.  run app + real browser (+ curl for cookies) → Live verification
8b. docs + diagrams + design-system sync        → Code commit last
9.  read the diff, git fetch, push, gh pr create → Pass 1 docs commit; PR (Closes #N; under ~150 words)
10. gh project item-edit                        → In Review
10b. wait for + check the automated review      → Iterate until clean; bounded wait
11. read + reply + resolve every thread         → Human and bot; then Pass 2 (report only)
12. QA notes, then merge per project policy     → Agent merges only if the project grants it
13. changelog first, then gh release create     → Optional
14. gh project item-edit + closing summary      → Done; remove the worktree after merge
15. knowledge report + follow-up issues         → The repository remembers, never agent memory
```
