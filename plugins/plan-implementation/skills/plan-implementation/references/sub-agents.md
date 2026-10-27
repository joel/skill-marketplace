# Sub-agents: briefs, what to ask back, what stays in the main agent

Loaded from the plan-implementation skill when delegating orientation (before Step 5,
again after a compaction), validation (Step 6, per commit in Step 7), a blocking
tooling gap, or when deciding whether a step belongs in a sub-agent at all.

Why: a multi-file change reads the code, its tests and the project's docs in the main
context, then reads them again after each compaction; the output of a green test run
and raw API payloads join them. That is where most of a run's context goes, not the
reasoning. A sub-agent absorbs the read or the run and hands back the part the next
step needs.

## Orientation brief (`Explore`; before Step 5, again after a compaction)

Give it the issue summary, the branch, and the files or symbols the issue names. Ask
for, in under a page:

- the entry points and the files the change will touch, with line ranges;
- the project docs and agent instructions (nested `AGENTS.md`, `doc/**` pages) that
  govern the area, one line each;
- the conventions those files follow (naming, module placement, test placement,
  background jobs, authorization) with one example each;
- the two or three snippets the change must fit, quoted verbatim, not paraphrased;
- what the existing tests set up (helpers, fixtures, factories, stubs) so new tests
  reuse them;
- open questions for the developer.

Ask it not to return whole files or a narrative of how it searched. After a
compaction, pass the summary's file list and ask only for what the next step edits;
the brief replaces re-reading the area yourself.

## Validation runner (`general-purpose`; Step 6, per commit in Step 7)

Give it the checkout path, the validation commands and merge-blocking gates from the
project config, and what they need to run (version-manager prefix, environment
variables, services such as the test database). Ask for:

- per command: pass or fail, and the summary counts line;
- per failure: `file:line`, the assertion or offence, and ten lines of context,
  nothing else;
- the exact command to re-run one failing test.

Progress output, deprecation warnings and log noise are not results. For a stack of
atomic commits, one agent checks each commit out in turn (in a second worktree, never
by switching the shared checkout) and reports per commit.

If the test suite shares state with the running development app (a cache, the
session store, a search index, a queue), tell the agent: its runs can wipe or pollute
that state. Batch the runs, say when one starts, and reproduce through the UI only
with an account the developer is not using.

## Tooling-gap implementer (`general-purpose`; when the local stack blocks the run)

When the run is blocked by the local environment rather than by the change itself (a
background worker that does not start, a missing service, a crash that only happens
in development, a broken dev CLI), do not fix it in the main context. Brief one agent
with: the observed failure and how to reproduce it, the repository that owns the fix
(this project, or the repository of the tool or dev environment), and the rule that
it works in **its own worktree** (`git worktree add <path> -b <topic>
origin/<default-branch>`), runs that repository's own lifecycle (branch, atomic
commits, tests, lint, PR, CI green, review), and proves the blocked use case end to
end before opening the PR, so it never opens a PR that changes nothing. Ask back one
page at most: root cause, what changed, the PR link, what is deferred. The main agent
consumes the summary, not the diff.

Two agents on one checkout each work in their own worktree from their first command.
A branch switch in a shared checkout carries the other agent's uncommitted files onto
your branch.

## What stays in the main agent

Implementation, commit messages, the PR body, review replies and review triage. The
main agent must have read the diff it describes: a reviewer reading a summary of a
sub-agent's summary is the "AI pull requests take longer to review" problem in
another form. `/code-review` and `/security-review` already run their angles as
agents and return findings; triage those findings in the main agent.

Open a file yourself only when you are about to edit it, and only the range you need.
Read a project doc page when it matches the current step, never all of them up front.
CI status is cheap to watch with the Monitor tool or a background poll; do not spend
an agent on it.

Sub-agents lower main-context growth, not total spend: one review pass can cost more
than the whole main context. Spend them on reads that would otherwise be repeated
after each compaction and on runs whose output is discarded when green.
