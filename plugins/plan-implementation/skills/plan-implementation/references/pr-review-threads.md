# PR review threads: read, reply, resolve

Loaded from the plan-implementation skill (Step 11) when reading, replying to or
resolving review comments, and for the Step 12 merge-readiness check.

**Paginate every list.** A long-running PR accumulates more reviews, comments and
threads than one page holds, and an unpaginated call silently drops the overflow:
pass `--paginate` to REST list endpoints and follow `pageInfo` in GraphQL.

## Read all inline review comments

```bash
gh api --paginate repos/<owner>/<repo>/pulls/<PR_NUMBER>/comments \
  --jq '.[] | {id: .id, node_id: .node_id, path: .path, line: .line, user: .user.login, body: .body}'
```

## Reply to a comment

The reply endpoint **requires the PR number**. Omitting it
(`repos/<owner>/<repo>/pulls/comments/<COMMENT_ID>/replies`) returns `HTTP 404`.

```bash
gh api repos/<owner>/<repo>/pulls/<PR_NUMBER>/comments/<COMMENT_ID>/replies \
  -X POST \
  -f body='**Fixed in <commit-sha>.** <what changed and why>'
```

Reply shapes:

- Actionable: `**Fixed in <sha>.** <explanation>`
- Incorrect: the technical reason, **quoting the probe command and output** that
  contradicts the finding.
- Deferred: the concern acknowledged, plus the issue or PR that will address it.
- Accepted nit: accepted as fixed-later or won't-fix, with the rationale.

## List unresolved threads

```bash
gh api graphql -f query='
{
  repository(owner: "<owner>", name: "<repo>") {
    pullRequest(number: <PR_NUMBER>) {
      reviewThreads(first: 100) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          comments(first: 1) { nodes { path databaseId } }
        }
      }
    }
  }
}' --jq '.data.repository.pullRequest.reviewThreads
  | {hasNextPage: .pageInfo.hasNextPage, endCursor: .pageInfo.endCursor,
     unresolved: [.nodes[] | select(.isResolved == false)
       | {id, path: .comments.nodes[0].path, comment_id: .comments.nodes[0].databaseId}]}'
```

`hasNextPage` true? Repeat with `reviewThreads(first: 100, after: "<endCursor>")`.
The zero-unresolved assertion must cover every page, not just the first.

`databaseId` is the REST comment `id`, which is what you dedupe on across automated
review rounds.

## Resolve threads

```bash
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {threadId: "<THREAD_NODE_ID>"}) { thread { isResolved } }
}'
```

Several at once, by aliasing:

```bash
gh api graphql -f query='
mutation {
  t1: resolveReviewThread(input: {threadId: "<ID1>"}) { thread { isResolved } }
  t2: resolveReviewThread(input: {threadId: "<ID2>"}) { thread { isResolved } }
}'
```

## Merge-readiness check

```bash
gh pr view <PR> --repo <owner>/<repo> --json mergeStateStatus,mergeable,statusCheckRollup \
  --jq '{mergeStateStatus, mergeable, checks: [.statusCheckRollup[] | {name: (.name // .context), status: (.conclusion // .state)}]}'
```

Ready when `mergeStateStatus` is `CLEAN`, `mergeable` is `MERGEABLE`, **every** check
in the rollup has completed green (not only the required ones: a still-running or
failed optional check is not green), and the unresolved-thread query above returns
nothing on every page.
