# Per-effort audit log (optional)

Use when the project config names a path pattern for a running steps log next to
each effort's plan (for example `doc/phases/<Phase> - Steps.md`).

**Why it exists.** Git and GitHub record *what* happened; the audit log records *why*
and *in what order*, readable sequentially by a human without clicking through commit
bodies and issue threads. It is a flight recorder, useful when picking up work after a
context reset or when explaining to a reviewer how the work unfolded.

**How to maintain it.** Append-only. Create it alongside the GitHub issue (Step 1)
and update at these points:

| At step | Append |
|---------|--------|
| 1 (issue) | issue number, title, link to the plan, "User approved the plan." |
| 4 (branch) | branch name |
| 7 (commit) | sha plus one-line rationale; note any skipped hook with its reason |
| 8 (live verify) | pages or journeys verified, anything that broke and the fix commit |
| 11 (review round) | per-comment action, fix commit, and resolution, as a table |
| 13 (release) | changelog entry filled, then release tag and URL |
| 14 (done) | final summary table: issue → commit → release → status |
| 15 (persist) | memories written or updated, docs touched, follow-up issues filed |

**Tone.** Factual and short. The audience is future-you or a reviewer reconstructing
what decisions were made, not re-arguing them.
