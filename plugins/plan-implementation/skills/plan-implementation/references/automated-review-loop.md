# Automated PR reviewer loop

Loaded from the plan-implementation skill (Step 10b) when the PR is open and the
project names an automated reviewer.

Applies when the project config names an automated reviewer bot (the worked example
here is OpenAI Codex, `chatgpt-codex-connector[bot]`, which reviews every PR a few
minutes after it opens and re-reviews on new pushes or on an `@codex review`
comment). Adapt the login, trigger, and verdict text to the bot the project uses.

The user should never have to say "check the bot's comment". Opening the PR is not
the end of the loop.

## Where the verdict lives

Findings and a clean pass arrive through **different channels**, and bots change
them over time, so check all of them:

- **Findings**: a formal review (`pulls/<PR>/reviews`, `state: COMMENTED`, with a
  `commit_id`) plus inline `pulls/<PR>/comments`. These are what you triage.
- **A clean round** may post no review at all. Depending on the bot and how the
  round was triggered, it shows as a PR **issue comment** with the bot's
  clean-verdict text, a pinned **status comment that the bot edits** in place
  (Running → Completed, naming the reviewed sha), or a **reaction** on the PR (for
  example 👀 while running, +1 when clean).

Worked example, Codex (`chatgpt-codex-connector[bot]`) as of October 2026: the pinned
"Codex Review Summary" card flips to Completed for the reviewed sha and the bot reacts
+1 on the PR; the "Codex Review: Didn't find any major issues" comment appears only
after a manual `@codex review`.

Polling only `pulls/<PR>/reviews` misses a clean pass and looks like "the bot never
responded". Check every channel, paginated:

```bash
gh api --paginate repos/<owner>/<repo>/pulls/<PR>/reviews \
  --jq '.[] | select(.user.login=="<bot-login>") | {state, submitted_at, commit_id}'
gh api --paginate repos/<owner>/<repo>/pulls/<PR>/comments \
  --jq '.[] | select(.user.login=="<bot-login>") | {id, path, line, body}'
gh api --paginate repos/<owner>/<repo>/issues/<PR>/comments \
  --jq '.[] | select(.user.login=="<bot-login>") | {created_at, updated_at, body: .body[0:120]}'
gh api repos/<owner>/<repo>/issues/<PR>/reactions \
  --jq '.[] | select(.user.login=="<bot-login>") | .content'
```

A clean verdict counts only for the current HEAD: the status comment names the HEAD
sha, or a clean comment's `created_at` is after your last push or trigger comment.

## Dedupe re-anchored findings

The bot re-anchors **already-resolved** inline comments to the new HEAD on each
re-review, so a naive "inline comments where `commit_id == HEAD`" filter resurfaces
resolved findings as new, every round. Dedupe by comment `id` and cross-check the
review thread's `isResolved` (GraphQL `reviewThreads`, see
[pr-review-threads.md](pr-review-threads.md)). A finding is new only if its id is
unseen **and** its thread is unresolved. Inline comments on HEAD with zero unresolved
threads means "all re-anchored, nothing new": safe to merge.

## Polling and nudging

- Background-poll rather than hand-loop. Watch for both a formal review on HEAD and
  the clean issue comment, with a generous deadline.
- The bot usually posts within 1–5 minutes but occasionally nothing appears for
  10–15 minutes, or the auto-trigger never fires. Bake a nudge into the poll: if
  there is no activity about 5 minutes after a push, post one trigger comment and
  keep polling.
- A **force-push after the first round may not retrigger** the bot (a status card
  stays Completed on the old sha). Post one trigger comment yourself, then bound the
  wait.
- Rapid-fire triggers get coalesced or ignored. Space them out (about 45 seconds
  between checks) and confirm via a review on the current HEAD sha or the trigger's
  reaction, not elapsed time.
- Do not merge on "green and silent bot" when the user's gate is "bot clean". Wait
  for the actual verdict.

## Bounded wait after a fix push

After pushing a fix for a finding, do **not** hard-gate the merge on a fresh verdict.
Re-nudge once, wait a bounded window (about 15 minutes), then merge on the objective
gate (every check green, `mergeStateStatus: CLEAN`, zero unresolved threads) and record the
call in the merge summary. Bots frequently stay silent after fix pushes, and a poll
whose success condition requires "CLEAN **and** a fresh verdict" can wait forever on
an already-clean PR. Make the objective conditions the gate and the verdict a bounded
bonus.

## Docs-only delta after a clean verdict

If the bot returned a clean verdict on commit X and HEAD was since force-pushed with a
delta that touches only CI-ignored paths (`git diff X HEAD --stat` shows only docs),
the reviewed code is byte-identical and the prior verdict satisfies the review gate.
Nudge once; if silent, merge on the objective gate and record the judgment call. Two
prerequisites: keep a code-touching commit at HEAD (the docs-only-tip rule), and the
checks must actually be green on the new sha. A history-rewriting force-push
gets CI to run despite path-ignores, because GitHub cannot compute the push diff;
*appending* a docs-only commit instead is the blocked trap.

## Know when to stop

Findings have diminishing returns on mature code. The loop converges in severity:
early rounds catch correctness, ordering, and security; later rounds shrink to
contrived sub-50ms timing interleavings or cosmetic nits on already-correct code.
Each fix is cheap, but a full PR → CI → bot → deploy cycle per nit is not. Watch for
the signature: repeated findings on the **same file**, each needing a more elaborate
condition to trigger, on a low-priority surface. When you see it:

- Prefer **one principled rewrite** (a small state machine or invariant, "drive state
  toward a single target") over another targeted patch. Patches to async or
  optimistic-UI behaviour keep leaking the adjacent interleaving.
- **Make the stop call yourself.** Fix real findings; once they degrade to contrived
  nits, accept the remainder as known and tracked rather than spin another cycle.
  State the call in your summary (what you fixed, what you accepted and why) so it is
  a conscious, recorded decision. Do not pause for approval to make it.
- An accepted nit is **resolved by acknowledgement**: reply that it is accepted
  (fixed-later or won't-fix, with rationale) and resolve the thread. It does not gate
  the merge; branch protection gates on CI and `mergeStateStatus`, not on the bot's
  severity.
- A finding can be valid but **already mitigated** (a deploy risk handled by a runbook
  step). Reply with the evidence and resolve; do not re-fix.
