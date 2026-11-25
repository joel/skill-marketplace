# Capability-driven, resumable GitHub publication

## Contents

- Capability checks and degraded mode
- Field and hierarchy decisions
- Issue templates
- Publication transaction
- Verification and recovery
- References in issue and pull request text

## Capability checks and degraded mode

Use `gh` and its JSON output, and `gh api` for what `gh` lacks. Check, read-only,
before promising publication:

- **Authentication:** `gh auth status`. A `GITHUB_TOKEN` in the environment can
  override the keyring login; if it is not the account you meant, prefix commands
  with `unset GITHUB_TOKEN &&`.
- **Permission:** `gh repo view --json viewerPermission,hasIssuesEnabled`. Creating
  issues and pushing a branch need `WRITE` or higher. Read-only access means a
  local draft only.
- **Issue types:** GraphQL `repository { issueTypes(first: 25) { nodes { id name } } }`.
  An empty list means the repository uses labels instead.
- **Sub-issues and dependencies:** a `GET` on an existing issue's
  `issues/<n>/sub_issues` and `issues/<n>/dependencies/blocked_by` answers 200
  when supported. A 404 means fall back to text (below).
- **Projects board** (when the project config names one): `gh project view` and
  `gh project field-list`; the token needs the `project` scope.

Distinguish missing `gh`, not authenticated, permission denied, an unsupported
feature and a transient failure. Give the user the known fix (`gh auth login`,
`gh auth refresh -s project`); never ask for a token in chat, switch to new
credentials, or use another client without explicit authorization. A pull request
the user creates by hand is a disclosed incomplete handoff, not verified
publication.

No editable diagram tool produces a warning, not a delay: use Mermaid. If a visual
is essential and cannot be produced, keep publication blocked until the user
approves a text-only alternative.

## Field and hierarchy decisions

- **Type and labels.** Choose a type by outcome when the repository has types, and
  set it with the REST `type` field on create or update (`gh api
  repos/<owner>/<repo>/issues -f type=<name> ...`), then read it back. Use only
  existing labels; never create a label, milestone or field: that is project
  configuration.
- **Assignee.** `gh api repos/<owner>/<repo>/assignees/<login>` answers 204 for an
  assignable login; never guess a login from a display name or an email.
  Distinguish unassigned from omitted.
- **Milestone.** Only an open milestone (`gh api --paginate
  repos/<owner>/<repo>/milestones`); ask when two names are close. Treat
  `keep current`, `none` and a specific milestone as different choices.
- **Board.** When approved, add the issue to the configured board (`gh project
  item-add`) and set an iteration field. Never set its Status: moving the issue is
  plan-implementation's step, not planning.
- **Parent and sub-issues.** `gh api -X POST
  repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<id>`, where
  `<id>` is the child's REST `id` (`gh api repos/<owner>/<repo>/issues/<n> --jq
  .id`), not its number.
- **Dependencies.** `gh api -X POST
  repos/<owner>/<repo>/issues/<n>/dependencies/blocked_by -F issue_id=<id of the
  blocker>`, only for a real dependency; read both issues back to check the
  direction.
- **Fallback.** Without sub-issues or dependencies, write `Parent: #<n>` or
  `Blocked by: #<n>` lines in the issue body and say so in the preview.
- **No state changes.** Planning never closes, reopens, locks or transfers an issue.

If the requested input is already an issue, plan to update it. New issues are
additional approved scope, not an excuse to duplicate the input. Keep comments,
existing evidence and unrelated body sections. Include explicitly proposed removals
or replacements in the before/after review.

## Issue templates

For new issues only. Templates live in `.github/ISSUE_TEMPLATE/`: Markdown
templates (front matter, then the body headings) and issue forms (`.yml`, whose
`body` entries render in the created issue as `### <attributes.label>` headings).
Creating an issue through the API does not apply a template, so plan-maker applies
the one that fits the chosen type. Read the files on every run; never write a
template from memory or copy it from an existing issue.

Shape the body as:

- Optionally, one or two lines of impact or preconditions.
- Every template heading, in order, with its exact wording. Fill a heading only
  from direct evidence. Where a heading asks for something the plan cannot supply,
  such as reproduction steps for a defect found in code review, write one line
  saying how it was found instead (`Not reproduced; found in code review of #123`).
- Every `assets/issue.md` section, whole. Why and What may shrink to one line where
  a template heading already says the same.

A template's `labels`, `assignees` or `type` defaults are proposals for the
preview, not decisions. Show the body in the preview and check it in verification.
If the directory cannot be read, say so; never treat that as no template.

## Publication transaction

GitHub operations are not one atomic transaction. Generate a stable run ID and a
Plan ID per proposed issue. Save the proposal IDs, approved revision, selected
fields, returned issue numbers, the plan commit, the pull request and per-operation
outcomes in a private journal outside the checkout after approval. Before then,
use the host's permitted plan artifact. Never store secrets in the journal.

1. **Re-read before writing.** Compare each target issue's body, `updated_at` and
   affected fields to the reviewed snapshot. If concurrent edits affect the approved
   change, reconcile and obtain renewed approval of the material changes. Do not
   claim this is an atomic compare-and-swap.
2. **Recheck duplicates and earlier operations.** Consult the journal. Put a marker
   in each new issue's pending Plan block (`<!-- plan-maker run=<run> proposal=<id>
   -->`). Search does not index HTML comments, so reconcile an uncertain create by
   listing your own recent issues (`gh issue list --author @me --state all --search
   "created:>=<run start>"`) and reading their bodies for the marker. Do not adopt an
   unrelated issue because its title matches.
3. **Create or update the approved issues.** Parents before children. Use the
   approved body with a `## Plan` block reading `Plan publication pending` and the
   marker, explicit assignee and milestone where approved, and no state change.
   Record every returned number before the next operation. Create all issues before
   resolving cross-issue references.
4. **Commit the plans.** In a worktree off `origin/main`, never the shared checkout,
   on a branch named per the project's convention (default
   `docs/plans-<issue>-<slug>`): write each plan to its path with real issue
   numbers and links, plus any approved visuals. Commit only those files, in one
   docs commit; let the project's hooks run, skipping one only as a disclosed false
   positive. Push the branch.
5. **Open the docs-only pull request.** What the plans cover, `Refs #<issue>` for
   each, never a closing keyword (the implementation closes the issue), and the
   attribution footer the harness instructs. Where CI path-filters docs, a
   docs-only pull request may sit with no checks; follow the project's docs
   pull-request convention.
6. **Verify the bytes.** Read each plan back at the pushed commit (`gh api
   "repos/<owner>/<repo>/contents/<path>?ref=<sha>" --jq .content | base64 -d`),
   compute its SHA-256, and compare it with the local file.
7. **Link and mark current.** Apply the approved sub-issue and dependency relations,
   checking direction. Replace each pending Plan block with the current-plan block
   ([artifacts](artifacts.md)) pointing at the permalink, only after step 6
   succeeded. Re-read the body and the relations. Never leave a "verified" block on
   a known-incomplete publication.
8. **Merge per project policy.** When the project grants the agent merge authority,
   merge the plan pull request once its checks are green; otherwise stop at
   PR-ready and say who merges. The permalinks stay valid either way.

A referenced plan is immutable: its permalink pins the commit. If a number or link
correction changes a committed plan, commit a corrected revision, then update its
hash and pointer. Resolving draft numbers and links is part of the approved
publication, not a new scope change.

## Verification and recovery

Verify each issue's number, type, labels, assignee, milestone, board fields, that it
is still open, its rendered body (links resolve), its relations and their direction;
each plan file at its commit and its hash; the pull request and its `Refs` lines;
and the Plan block. Paginate list and search results: a first page is not proof that
no duplicate exists.

After an ambiguous timeout, first read or list for the operation's result. Never
retry a create blindly. If the result cannot be disambiguated, stop and report it. A
rejected push is fetched and inspected, never force-pushed over someone else's work.
Do not close partial issues or delete a branch to simulate a rollback without
explicit approval.

If publication partly succeeds, report the exact created and updated issues, what
verified, what failed and the next missing operation. Keep the pending Plan block on
affected issues. Block the execution handoff until the selected issue and its
required dependencies have complete verified publication. Resume only missing
operations the approval covers; new scope, fields or substantive content need
renewed approval.

## References in issue and pull request text

- `#123` for an issue or pull request in the same repository, `owner/repo#123` in
  another. GitHub links both in issue bodies, comments, pull request bodies and
  commit messages, but not inside backticks or code blocks.
- In committed files, plans included, write the full URL: GitHub does not link
  `#123` there.
- `gh issue edit --body` replaces the whole body. Read it first (`gh issue view <n>
  --json body --jq .body`), change only the plan-maker-managed block and the
  approved sections, and write it back, so other people's edits survive.
