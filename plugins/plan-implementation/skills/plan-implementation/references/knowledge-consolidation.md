# Knowledge consolidation: candidate log, five gates, routing, two passes

Loaded from the plan-implementation skill when the candidate log starts (Step 1),
before the first push (Pass 1, Step 9), after the review loop (Pass 2, Step 11) and
when writing the closing report (Step 15).

The goal is that every effort makes the next one easier. **The repository
remembers, not the agent: never write agent memory** (the harness's memory files,
a memory MCP, a personal notes store). A learning kept there is invisible to
teammates, to other machines and to other agents, and drifts from the code. The
audit is mandatory on every run, trivial ones included; a documentation change is
not. "No reusable knowledge identified" is a valid outcome.

## The candidate log

Keep a scratch file outside the checkout from Step 1 onwards (the harness's
scratchpad or temp directory); it survives a compaction. Note a candidate the moment
something surprises you. Sources: the orientation brief and the design pass,
implementation surprises, validation failures, CR/SR findings, live verification,
CI failures, and every review round. Review triage is the richest source: a **fix**
often exposes a hidden assumption, and an **incorrect** that took evidence to refute
is often a trap worth naming.

Record each candidate as: **rule** (one actionable sentence), **why it matters**,
**evidence** (paths, tests, commands, counts), **status**: *confirmed*,
*observation* or *hypothesis*.

## Five gates: persist only a candidate that passes all of them

1. **Novelty.** Search the target doc, its neighbours and the project's knowledge
   inbox (if it keeps one) first. Already documented? Cite it in the report; sharpen
   the existing entry only if it was wrong or incomplete.
2. **Verification.** Backed by code, tests, configuration or behaviour you can
   reproduce. A stale checkout, odd seed data, one machine's configuration or an
   unverified reviewer claim is not evidence. Never turn an observation into a rule.
3. **Reuse.** Would another developer or agent act differently for knowing it?
4. **Scope.** General, component-specific or environment-specific; this picks the
   destination.
5. **Durability.** Still true and useful after this PR merges?

## Routing: the narrowest authoritative home

If the project keeps a knowledge index (project config), consult it first and route
through it. Prefer updating an existing entry over adding one; never add a rule that
conflicts with another, so reconcile or report the conflict instead.

| Discovery | Destination |
|---|---|
| Repository-wide convention, recurring error or gotcha | The project's knowledge inbox as a new fragment, if it keeps one (below); otherwise the root agent instructions (`AGENTS.md`) |
| Rule specific to one directory or component | Its nested `AGENTS.md` or the doc page for that component |
| Product or business invariant the change had to preserve and nothing documented | The project's business-rules doc if it has one, naming where the rule is enforced; otherwise a test that pins it plus a line in the nearest doc |
| A decision and its rationale, or a consciously accepted limitation | The project's decision records if it keeps them (for example `docs/decisions/`); otherwise the PR body and the issue |
| Architectural approach on its **second** real use | The project's design-patterns or architecture doc, linking the precedent; a first use stays in the code and the PR |
| Local setup, command, environment limit, troubleshooting recipe | The project's setup or troubleshooting doc |
| This skill got something wrong in a way that will recur | A proposal in the closing report: problem, evidence, target file in `joel/skill-marketplace` (`plugins/plan-implementation/`), suggested wording. Never edit that repository from the run |
| Finding specific to this effort with no wider reuse | Tests, a code comment, the PR body or the issue |

Never persist effort history, transient failures, secrets, customer or personal data,
or speculative advice.

## Knowledge inbox fragments (when the project keeps an inbox)

Concurrent PRs that each edit the root `AGENTS.md` conflict, and none of them sees
the others' unmerged rules. A project that has hit this keeps an inbox directory
(project config): a repository-wide learning becomes a **new file** there, one per
learning, named after the issue (`<issue-number>-<kebab-slug>.md`), and the project's
curation step folds the inbox into the docs. Learnings tied to code this PR changes
still go next to that code: they only conflict when the code does, and must ship
with it.

```markdown
---
issue: <number>
destination: AGENTS.md#<anchor>
status: confirmed
---
**Rule:** one actionable sentence.
**Why it matters:** one or two sentences.
**Evidence:** paths, tests, commands.
```

`destination` proposes a repository path, optionally with an anchor; the curator
decides. Only confirmed candidates become fragments. Never edit another effort's
fragment.

## Pass 1: before the first push (Step 9)

Run it after the freshness check, so the Novelty gate sees docs merged since the
branch diverged, and before this run's first push: a resumed branch that was pushed
earlier still gets its Pass 1. Run the gates over the whole log. Confirmed updates go
into their own atomic commit (`Docs: <subject>` or the project's convention),
validated like any other commit and pushed with the code. Respect the docs-only-tip
rule from Step 8b: when CI path-ignores docs, the docs commit must not be the PR's
HEAD. The PR body names the documentation changes so the reviewer reviews them like
code.

## Pass 2: after the review loop (Step 11)

Delta only: what CI and the review rounds taught. Pass 2 **reports, it never commits
to this PR**, so documentation never costs another CI run or review round. List the
results in the closing report; each confirmed learning becomes a follow-up issue
with its proposed destination, so it survives the merge.

Documentation changes never authorise a merge, a release or board changes beyond what
the skill and the project config already allow.

## Report: the closing summary's Knowledge consolidation section

A few lines, always present:

- **Captured:** each rule and the file or fragment it went to.
- **Pass 2, not committed:** confirmed learnings from CI and reviews, each with its
  proposed destination and the follow-up issue.
- **Already documented:** relevant discoveries, with the doc that covers them.
- **Unresolved:** observations and hypotheses, with what would verify each.
- **Skill proposals:** drafted for separate work in `joel/skill-marketplace`.
- Or, explicitly: **"No reusable knowledge identified."**

Maintainers: behavioural acceptance cases live in `tests/scenarios.md` next to this
skill; do not load them during an ordinary run.
