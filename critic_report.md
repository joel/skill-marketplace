# Stage 7: Critic Review report

Target: `docs/designs/session-cost-total.md`, FeatureRange lines 1-248
Reviewers (fresh contexts): egm-design and egm-structural (standard
`feature-spec-standard.md`), and egm-style. All three completed.

**Verdict:** No blockers. The spec has every section the standard requires.
It needs a revision for two false claims, three internal contradictions, and a
missing alternative. Findings are deduplicated. The Source column names the
reviewers who raised each one.

## Major

| # | Finding | Lines | Source | Fix |
|---|---|---|---|---|
| M1 | "Option C of the placement question" refers to the rejected "Alternative C" (the helper-desk row). The chosen option is never listed. | 96 vs 213-221 | design (via Stage 6), structural, style | Name the decision instead of using a letter. List the chosen option beside the rejected ones. |
| M2 | Alternative D's rejection and the "never older" goal both assume the answer to an open question (are forks counted, and when is the event raised). Stage 5 also found that the engine raises `session.measure` only after main turns and rate-limit moves. | 62-64, 88-92, 227-232 | design, structural, (Stage 5) | Restate the goal and D's rejection on established facts only. Cite the type file and its line. |
| M3 | `readCost` is not called at `session.start` or after a reload today. The spec describes as existing something that is new work. | 161-162 | design, (Stage 5) | List it as a change to the `session.start` hook and the reload path. |
| M4 | A race between the two writers: a slow `usage()` read can overwrite a newer `measure` value, which breaks "never older" and "cannot disagree". | 129-131, 157-171 | design | Keep the larger value (the total only grows), or stop reading once a `measure` has arrived. Add it to Risks. |
| M5 | The Privacy claim "not written to any file" is false. helper-desk writes the figure to the Zellij float's frame file. | 241-242 | design | Say so. |
| M6 | Claude Code's own status line is never weighed as an alternative. | 187-232 | design, (Stage 5) | Add Alternative E, rejected because it drew over Context Meter's footer on desktop (helper-desk `register.tsx:376`). |
| M7 | The label goal ("Session cost") contradicts helper-desk keeping "Total chat cost". "The plugin's description" does not say which plugin. The `/resume` open question also decides the label. | 67-69, 85-87, 163 | design, structural, style | Limit the goal to usage-left, or rename the helper-desk tile. Make the label conditional on the resume answer. |
| M8 | Risks is an H3 without mitigations for most entries. Failure modes are missing: the event not firing, the race (M4), the open questions. | 173-184 | structural | Make it an H2 "Risks & Mitigations" and give every risk a mitigation. |
| M9 | The problem statement rests on "not trusted" and an unsourced "most of a session's spend is the main thread". | 16-19 | style, design | State the defect (the figure goes stale). Drop or soften the quantity. |
| M10 | Terms drift: subagent/helper, chat/session, "API billing"/"API-key billing". | throughout | style, (Stage 6) | Pick one term for each idea, or define the pair once. |

## Nit

| # | Finding | Lines | Source |
|---|---|---|---|
| N1 | Formats differ: helper-desk shows `$0.00` where usage-left shows `under $0.01`. Share one formatter or say they differ. | 148-150, 170 | design, (Stage 5) |
| N2 | On API billing, a $0 ledger now draws `Session cost under $0.01` before any reply. Decide whether exactly $0 shows. | 144-150 | design |
| N3 | In full layout, the cost sits under the "Usage left" label and reads like a window. Add a separator or put it in its own group. | 138-139 | design |
| N4 | The new helper-desk hook does not say whether it is gated on `deskOn()` (`pane: off`). | 157-160 | design |
| N5 | Alternative A is rejected on preference ("Joël chose"). Lead with the technical reason (estimates drift). | 201-202 | design, structural |
| N6 | The layout examples are inline code that wraps. Use a fenced `text` block, and complete the `5H …` ellipsis. | 138-141 | structural, style |
| N7 | The Zellij float is not introduced. | 124, 158 | structural, (Stage 6) |
| N8 | `hooks/register.tsx` is ambiguous. Give the path from the repository root. | 33 | structural |
| N9 | "Weighed in this session" and "Joël wants/chose" depend on the conversation. Use neutral wording. | 30, 75, 189, 201 | structural, style, (Stage 6) |
| N10 | Rules and blank lines are inconsistent (a double blank at line 186). | 185-187 | structural, style |
| N11 | Filler and subjective phrasing to remove: "the reader should know", "mechanical choice and can change", "stops freezing", "raises often", "too much screen", "simple to reason about", "cheaper", and overuse of "already". | 50, 150, 169, 176, 210, 225, 232 | style |
| N12 | "Colour roles" is undefined. "The person" should be "the user". | 135, 165 | style |
