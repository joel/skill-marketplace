# Manual behavioural acceptance scenarios: knowledge consolidation

Run these in Claude Code inside a test repository, with the plugin loaded from the
branch under test (`claude --plugin-dir plugins/plan-implementation`). They are not
automated. Capture the candidate log, the docs commits, the pushes, the review
rounds, any agent-memory writes and the closing summary's Knowledge consolidation
section.

| Case | Input/setup | Required observation |
|---|---|---|
| Trivial change | One-line copy fix, nothing surprising | Audit still runs; report states "No reusable knowledge identified"; no docs commit |
| Already documented | Run hits a gotcha already in `AGENTS.md` | No duplicate entry; report cites the existing entry |
| Unverified observation | A failure caused by a stale checkout or odd seed data | Not persisted; listed under Unresolved with what would verify it |
| Review exposes an invariant | A review fix reveals a rule the change had to preserve | Pass 2 lists it with a proposed destination and a follow-up issue; no docs commit on the PR, no extra CI run or review round |
| Repository-wide learning, no inbox | A confirmed gotcha applies across the repository; project config names no inbox | Root `AGENTS.md` updated in the Pass 1 docs commit |
| Repository-wide learning, inbox | Same, and project config names an inbox directory | New fragment file in the inbox in the Pass 1 docs commit; root `AGENTS.md` untouched |
| Already in the inbox | A merged fragment covers the discovery | Report cites the fragment; no new fragment |
| Parallel runs with an inbox | Two PRs record the same repository-wide learning | Each adds its own fragment file; both merge without a conflict |
| Resumed branch | "Push changes" on a branch whose PR already exists | Pass 1 runs before this run's push; its docs commit rides along |
| Stale docs | A doc covering the discovery merged to `main` after the branch diverged | Freshness check precedes Pass 1; the Novelty gate cites the merged doc, no duplicate |
| Log starts at Step 1 | The orientation brief or design pass surprises the agent before any code exists | Candidate recorded in the scratch file before implementation; still present at Pass 1 after a compaction |
| Decision with rationale | The design pass picks one approach over another for a stated reason | Recorded in the project's decision records when it keeps them, otherwise in the PR body and issue; never in agent memory |
| Single-use design | New approach used once | Not added to the design-patterns doc; stays in code and PR |
| Second real use | Change reuses an approach with a precedent | Added to the design-patterns or architecture doc, linking the precedent |
| Component-specific rule | Rule only applies under one directory | Goes to that directory's `AGENTS.md` or doc page, not the root one |
| Skill gap | Agent repeats a procedural mistake the skill should prevent | Proposal drafted in the report; `joel/skill-marketplace` untouched |
| Sensitive finding | Evidence contains customer names or a secret | Rule persisted without the data, or not at all |
| Docs-only tip | CI path-ignores docs and Pass 1 adds a docs commit | The docs commit is not the PR's HEAD |
| Docs commit boundaries | Pass 1 commits docs | No merge, release or board change follows that the project config does not already allow |
| Agent memory | Any run | Nothing written to agent memory |
| Knowledge index present | Project config names a knowledge index | Routing consults the index first |
