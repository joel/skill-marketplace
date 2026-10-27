# Tag and publish a release

Loaded from the plan-implementation skill (Step 13) when the project versions
releases.

- Follow the project's release policy immediately after merge.
- Re-run the freshness check (`git fetch origin main --tags`) and confirm the intended
  version is free. Never switch the shared checkout to `main` to do it.
- If the project keeps a curated changelog, fill the entry **before** tagging, in the
  same PR as the feature when practical, so the tag captures it. Auto-generated
  release notes do not replace the curated entry.
- Check for drift: the changelog's newest heading should be the previous tag;
  backfill from the release notes if not.
- Confirm the merge commit's own `main` CI or deploy run is green before tagging. Get
  the sha from `gh pr view <PR> --json mergeCommit`; the PR's status rollup describes
  the PR-head checks, not the push-to-`main` run of the merge commit.

```bash
gh release view <tag> --repo <owner>/<repo> >/dev/null 2>&1 \
  && echo "<tag> already released, skip" \
  || gh release create <tag> --repo <owner>/<repo> --target main --title "<title>" --generate-notes
```
