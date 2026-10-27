# Freshness check, rebase and what to check after it

Loaded from the plan-implementation skill (Step 9) before the first push, before any
later push after a pause, and before tagging.

## Compare

```bash
git fetch origin
git log --oneline HEAD..origin/main | head              # what main gained
git log --oneline HEAD..origin/<branch> 2>/dev/null     # did the remote branch move?
```

- **The remote branch moved** (another session or a teammate pushed): reconcile onto
  its version; never clobber it.
- **Behind `main`**: bring the branch up to date before pushing, so CI and the
  reviewers see the code that will merge.

## Rebase or merge

```bash
base=$(git merge-base HEAD origin/main)   # remember the old base for the checks below
git rebase origin/main
git push --force-with-lease               # only if the branch was already pushed
```

- Rebase only a branch nobody else builds on. A rebase of a pushed branch rewrites
  shared history: push it with `--force-with-lease` (a plain push is rejected; never
  bare `--force`). When others build on the branch, merge `origin/main` into it
  instead.
- **A conflict on a generated or binary file** (a lockfile, a schema dump, a database
  snapshot, a compiled asset): never hand-merge it. Take one side and regenerate it
  with the project's command, then continue.

## After the rebase, check what came in before validating

```bash
git diff --name-only "$base" origin/main
```

- **Dependency manifests or lockfiles changed**: reinstall dependencies on the host
  and rebuild any containers (project run commands) before running a single check.
  A stale install fails in confusing ways, and a piped `| tail` hides the failure:
  check the exit code.
- **Migrations or schema changes came in**: run them before the tests.
- **A newly tracked file exists untracked in your worktree** (for example a file
  that became a symlink upstream): move your local copy aside; never delete it, never
  stage it.
- Then re-run the validation gate (Step 6). A green run before the rebase says
  nothing about the rebased code.

## Symptoms of a stale branch

- CI's linter flags files you did not touch: whole-repository linters run on `main`'s
  newer rules or files. Rebase before assuming the offence is yours.
- A test fails in CI on code you did not change, and passes locally: check whether
  `main` changed it, before chasing it.
