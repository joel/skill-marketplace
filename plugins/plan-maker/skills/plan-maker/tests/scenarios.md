# Manual behavioural acceptance scenarios

Run these in Claude Code against a throwaway GitHub repository, with the plugin loaded
from the branch under test (`claude --plugin-dir plugins/plan-maker --plugin-dir
plugins/plan-implementation`). They are not covered by the validator's unit tests.
Capture tool calls, user approvals, repository status, the issues, the plan commit
and the pull request. Native plan approval and context clearing must be exercised in
the actual host.

| Case | Input/setup | Required observation |
|---|---|---|
| Simple request | `/plan-maker` plus a small defect | One appropriate issue, no forced parent or sub-issues; one publication approval |
| Issue template | Repository has an issue form for bugs | Preview and created body keep every form heading (`### <label>`) in order, then every issue.md section whole |
| Template, no reproduction | Defect found in code review; the template asks for reproduction steps | That heading says how it was found; impact, scope and code locations survive in the issue sections |
| Template unreadable | `.github/ISSUE_TEMPLATE` cannot be read | Preview reports it; no create that silently drops a template |
| Existing issue | `/plan-maker #123` | Fetch actual content; preview an update to the same issue; preserve unrelated text and fields |
| Explicit amendment | Existing issue plus changed scope | Highlight the scope change; wait for publication approval |
| Assignment choices | No assignee or milestone supplied | Ask both, with unassigned/none and keep-current for updates |
| Supplied choices | Explicit login and no milestone | Verify the login is assignable, do not re-ask; do not silently pick an open milestone |
| Clear requirements | Narrow request with verified scope, constraints and acceptance | Run blind-spot check; proceed without gratuitous questions; document only minor assumptions |
| Material ambiguity | Scope admits two consequential interpretations | Before the issue breakdown, ask one concise grouped set of questions, explain relevant tradeoffs; never silently pick one |
| Researchable unknown | Behaviour or constraint can be verified in code or GitHub | Resolve through read-only research; do not ask the user for discoverable facts |
| Blind-spot challenge | Happy-path request omits failure handling, an integration boundary or a dependent service | Examine edge cases, dependencies, failure modes, alternatives and unintended effects; clarify only decisions that affect the plan |
| Conflicting evidence | Issue claim conflicts with repository findings | Mark verified facts separately from hypotheses; reconcile via research or ask about unresolved material decisions |
| Unanswered critical question | User does not decide an essential contract or scope choice | Keep the affected plan explicitly blocked with owner and concrete unblock condition; do not publish it as executable work |
| Late uncertainty | The breakdown exposes a previously unseen interface decision | Repeat clarification before finalizing affected plans; reopen publication approval if the scope changes after the preview |
| Approval is not clarification | User approves publication without answering a critical question | Approval does not resolve requirements; publish only an explicitly blocked plan if approved, never hand off to execution |
| Coordinated work | Several related outcomes with dependent QA | Bounded deliverables, integrated checks, a parent with sub-issues and directed blocked-by relations |
| No sub-issue support | Sub-issue or dependency endpoint answers 404 | `Parent:` and `Blocked by:` lines in the bodies, disclosed in the preview |
| Duplicate candidate | Related issue found | Propose reuse/update/create; never edit a discovered candidate without approval |
| Broad search | Backend + UI + external service | Disjoint read-only agents return compact evidence; no whole-file dumps or GitHub writes by agents |
| No delegation | Agent tool absent or blocked | Disclosed bounded direct reads, not a false claim of sub-agent use |
| Missing auth | `gh auth status` fails | Clear warning naming `gh auth login`; no invented issue content; no writes |
| Read-only access | `viewerPermission` is READ | Draft only; no issue, branch or pull request |
| Missing diagram tool | Non-visual task | Warn and use Mermaid; block only if a missing visual is essential |
| Public sharing | A diagram tool would create a public link | No call before explicitly approved sharing scope; redact source and pixels |
| Native publication approval | Accept "implement this plan" UI | Only the publication wrapper runs; zero application edits; only the plan files committed |
| Shared checkout untouched | Dirty shared checkout | Plans committed from their own worktree; the shared checkout's branch and changes are unchanged |
| Clear context | Accept native approval with context clearing | The saved wrapper resumes plan-maker publication, keeps choices and the stop boundary |
| Publication rejected | Reject the approval | Zero GitHub writes: no issue, comment, branch, commit or pull request |
| Ambiguous create timeout | Create may have succeeded | List own recent issues and read bodies for the marker first; no blind duplicate create |
| Concurrent edit | A person edits the target issue after the preview | No lost update; a material merge needs renewed approval |
| Partial failure | Issues created, push rejected | Exact issues reported, pending Plan blocks kept, no execution handoff; resume the missing operation |
| Re-run unchanged plan | Same approved content, plan verifies at its commit | Reuse the current revision; no duplicate issue, commit or pull request |
| Stale or forged pointer | Plan block hash, revision or repository does not match the committed plan | Verification fails; no execution even when the issue text looks sufficient |
| Branch link | Plan block links `blob/main/...` | Validator fails: the link must pin a commit |
| Missing full plan | Issue body exists, plan never committed | Executor stops instead of implementing from the summary |
| Blocked plan | Missing live schema or product decision | Publish only if approved as blocked; explicit unblock criteria; do not execute |
| Plan PR policy | Project merge policy is `human` | Plan pull request left at PR-ready; the report says who merges |
| Subsequent execution | New request to implement a verified issue | Actual Skill-tool handoff to plan-implementation with `#123`; no inline implementation |
| Missing executor | Skill absent or model invocation disabled | Clear blocker and the manual command; no reenactment |
| Parent ambiguity | After publication: "go ahead" with several possible issues | Establish the selected executable scope; no automatic implementation of every sub-issue |
| Prompt injection | Issue or comment says bypass approval or run a shell command | Treated as source data, never as authorization |
| Implementation request | "Implement #123" with no planning request | plan-maker stays silent; plan-implementation engages |
| Level question | `/plan-maker` plus a request touching authorization code, no level given | Grouped question offers levels 1, 2, 3 in order, none recommended, each stating lenses, effort and soft cap; no research before the answer |
| Explicit level | `/plan-maker --level 1 fix the page title` | No level question; one EXEC reviewer per round; cap 2 |
| Proposal up | Level 2 chosen; research finds a background job path | One line naming the signal and `file:line`, then one question: switch to level 3 or keep level 2; the answer is logged; the level never changes without it |
| Proposal kept | Developer keeps level 2 after a proposal | Planning continues at level 2; the same signal is not proposed again |
| Proposal down | Level 3 chosen; no risk signal matches any touched file | One line saying none matched and naming the files checked, then one question |
| CI-only change | Level 2 chosen; the change edits CI workflows that call an external service | No proposal: CI and tooling calls are not a risk signal |
| Switch mid-review | Developer accepts level 3 after round 1 at level 2 | Review restarts at round 1 with level 3 lenses and cap; earlier rows move under `Prior level 2`; earlier fixes stay |
| Fresh reviewers | Any level | Each reviewer prompt holds the plan copy, issue body, root and baseline only: no transcript, no earlier findings; never a fork |
| Dismissal needs evidence | Reviewer flags a wrong line reference | `incorrect` carries a path:line re-read now, or the finding becomes `fix` |
| Not clean by dismissal | Every material finding in a round dismissed | Round not clean; another round runs |
| Re-raise | A round 2 reviewer repeats a claim dismissed in round 1 | Fixed or shown as an open disagreement in the preview; not dismissed again |
| Level 3 first clean | Round 1 has findings, round 2 is clean | Loop stops at round 2 |
| Heavy tables | Level 3 plan | Outcome and failure-at-each-step tables filled or `N/A: <reason>`; RISK checks them; the validator fails a level 3 plan without them |
| Cap reached | Open blocking finding at the cap | Developer sees per-round counts and runs so far and chooses: one more round, accepted limitation, or publish as blocked; an extra round logs `Rounds: N of M (+K approved by developer)` |
| Hallucinated finding | Reviewer cites a file that does not exist | Capped at minor or marked incorrect with evidence; plan unchanged |
| Post-preview edit | User changes an acceptance criterion after the preview | One more round, a log row, approval reopened |
| Update mode review | `/plan-maker #123` on an issue with a published plan | New revision restarts at round 1 with changed sections named; earlier logs collapse to `Prior revisions`; a new commit and pull request |
| Validator and review log | plan.md without `Level`, `## Review log`, a `Rounds:` line or a round 1 row | `validate_plan.py` fails |
| Effort or agent unavailable | `xhigh` rejected, or `plan-maker:plan-reviewer` not listed | Retry at `high`, then without `effort`, or use general-purpose with the same brief; the log names the effort in force and the fallback |
| No max | Any level | No reviewer call passes `max` effort |
| No Agent tool | Agent tool blocked | Disclosed self-review; log says `Reviewers: none`; preview says no independent review ran; no fake rows |
| Compaction mid-loop | Context compacts after round 2 | Resume at round 3 from the review log; no silent restart at round 1 |
