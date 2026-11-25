# Focused research, not a second full conversation

## Delegate by question

| Research need | Agent | Expected result |
|---|---|---|
| Entry points, similar code, tests in one area | Read-only Explore/Plan; available feature-dev:code-explorer | A bounded evidence brief |
| Independent backend, UI, integration areas | Up to three agents with disjoint scopes | One brief each, shared interface questions |
| A consequential design choice | One available feature-dev:code-architect or Plan | One recommended design, alternatives and tradeoffs |
| Plan review loop (section 4a) | `plan-maker:plan-reviewer`, one fresh agent per lens and round, never a fork; effort per level | Severity-ranked findings with evidence; see [the review loop](review-loop.md) |

Do not delegate an obvious one-file lookup or start a design tournament for a simple
bug. Do not use implementation or validation agents to execute the proposed work. No
nested delegation without a specific need. Only the main agent contacts the user or
writes to GitHub or the repository.

## Brief to send

Pass the question and a small scope, not the whole transcript:

```text
Research only. No edits, installs, branch changes, tests with side effects,
GitHub writes, external-state changes, plan-implementation calls, or nested agents.

Request: <one outcome and relevant acceptance requirements>
Repository/root: <verified checkout>
Baseline: <commit/branch; relevant dirty-tree caveat>
Instructions: <applicable AGENTS.md/CLAUDE.md constraints and relevant skill rules>
Scope: <directories, symbols or integration boundary>
Question: <specific uncertainty to resolve>
Already known: <short facts; exclude raw issue JSON and unrelated reports>

Return at most about 600 words, extending only for essential quoted evidence:
- Answer/recommendation and verified vs inferred status.
- Entry points and files, exact path:line ranges and symbols.
- At most three short quoted snippets the plan must fit.
- Existing test setup, helper/stub/factory and evidenced check commands.
- Constraints, shared contracts, failure modes and dependencies.
- Unknowns/blockers, sources not accessible, and one targeted next lookup if needed.
Do not return whole files, raw tool output or a narrative of the search.
```

Supply relevant repository instructions explicitly; do not assume every agent
inherits them or the main conversation. Confirm delegated tools preserve read-only
research permissions. Do not delegate GitHub access to an agent that cannot use it;
keep a bounded `gh` read in the main agent when needed.

## Synthesize without repeating the search

Maintain a compact evidence register: claim, source path/symbol/range, baseline,
status (verified/inferred/unknown), and implications for the plan. Read quoted
snippets first. Reopen only the specific range needed to resolve a conflict or
verify a critical assertion; do not reflexively re-read every referenced file.

For async, external-call, auth, shared-state or interactive UI work, ask about
retries, duplicates, idempotency, ordering, concurrency, partial failures,
authorization and tenant boundaries, and stale UI state where applicable. Record the
answers in the plan, not an unrelated general checklist.

Stop when the outcome, scope, interfaces, acceptance, checks, dependencies and
unknowns are clear. A missing live credential or product decision is a blocker, not
a reason for unlimited searching. After compaction, pass the evidence summary and
only the unresolved question to the next researcher.

If an agent fails or returns an unsupported claim, say so and narrow or retry that
question once, or inspect a bounded range directly. Delegation does not reduce total
compute; the objective is to keep raw reads out of the main context.
