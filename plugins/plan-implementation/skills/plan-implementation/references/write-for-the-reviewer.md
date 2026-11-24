# Write for the reviewer

Loaded from the plan-implementation skill before writing the issue (Step 1), the PR
description (Step 9), a review reply (Step 11), the QA notes (Step 12) or the closing
summary, and whenever a code comment is about to grow past a few lines.

Reviewers report that AI-assisted pull requests take longer to read than hand-written
ones: too many comments, write-ups that over-explain a small change, and
inconsistencies (one early exit logs its reason, the next does not). Calibrate every
written artifact to its reader: neither a wall of prose nor a bare diff.

## Code comments

- **Say what the code cannot**: an external constraint, a non-obvious *why*, an
  invariant the next change must keep. Never what the code does, the history of the
  change, or the alternatives considered; that is the commit message's job.
- One to three lines is normal; a paragraph is a smell.
- A comment asking the reader to keep two places in sync marks a duplication to
  remove, not a note to keep.
- Runtime behaviour is explained at runtime: an early exit or a fallback logs *why*
  it happened, consistently across the file, instead of being narrated in a comment.
- Match the comment density of the surrounding code.

## Read the whole diff before pushing

Read it as its first reviewer: comment density, consistency between similar
branches, unreadable one-liners, leftover debugging, secrets and personal data (a
personal email address counts). A reviewer must never be the first human-facing
reader of an AI-generated diff.

## The issue (Step 1)

The problem, the expected outcome, the scope and how to verify it. The scope lists
what will change, grounded in the design pass; it is not an implementation narrative,
which the PR and its commits record.

```bash
gh issue create --repo <owner>/<repo> --title "<descriptive title>" --label "<label>" \
  --body "$(cat <<'EOT'
## Problem
<what is wrong or missing, and for whom>

## Outcome
<what is true once this is done>

## Scope
<bullet list of changes>

## Verification
<how to confirm it works>
EOT
)"
```

## The PR description (Step 9)

What changed, why, and what to look at, in a few sentences; a short test plan; notes
on migrations, data tasks, configuration or manual steps. Under roughly 150 words of
prose: the rationale lives in the per-commit messages. Include sample output only
when the reviewer cannot produce it themselves (a screenshot of a UI change, a
payload), and keep it short. The title follows the project's convention; with squash
merges it becomes the merge commit subject.

```bash
gh pr create --repo <owner>/<repo> --title "<PR title>" --body "$(cat <<'EOT'
## Summary
<what changed and why; what to look at>

## Test plan
- [x] Tests, lint and every merge-blocking gate pass
- [x] Live verification of <journey>

## Notes
<migrations, data tasks, configuration or manual steps; omit when none>

Closes #<issue-number>
EOT
)"
```

Add the attribution footer your harness instructs.

## References to issues, PRs and commits

A reader follows a reference only when it links, and GitHub links some forms on its
own but not others:

- **Same repository:** `#123` for an issue or PR, a short sha for a commit. GitHub
  links them in issues, PR bodies, comments and commit messages.
- **Another repository:** `owner/repo#123` and `owner/repo@<sha>`. A bare `#123`
  points at this repository's issue of that number.
- **Closing keywords** (`Closes #123`) close the issue when the PR merges into the
  default branch; an issue in another repository needs `Closes owner/repo#123`.
- **An external tracker's key** is a Markdown link to the ticket, unless the
  repository has an autolink reference set up for that prefix.
- **Never linked:** a reference inside backticks or a code block, and any reference
  in a committed file (docs, decision records, knowledge fragments), since GitHub
  renders repository files without these links. There, write the full URL.
- **Editing a body:** `gh pr edit --body` and `gh issue edit --body` replace the
  whole body. Read it first (`gh pr view <PR> --json body --jq .body`), change that
  text and write it back, so ticked checkboxes and other people's edits survive.
- **Check:** after writing, read the body back; for a closing keyword,
  `gh pr view <PR> --json closingIssuesReferences` must list the issue.

## Review replies (Step 11) and the closing summary

- A review reply names the commit and the change in one or two sentences, or gives
  the evidence for "no change needed".
- The closing summary says what shipped, what was accepted or deferred and why, and
  what was verified: a few lines each, without restating the PR body.
