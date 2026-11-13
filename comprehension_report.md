# Stage 6: Comprehension Test report

Target: `docs/designs/session-cost-total.md`
Ranges: FeatureRange lines 1-248, DetailedRange lines 249-415
Reviewer: egm-comprehension (fresh context), no document standard

## What this proposes

The design shows the session's running dollar cost (the engine's `/cost` total
at list prices, main thread plus subagents) at all times, and keeps it current.
The figure goes at the end of usage-left's row above the prompt, as
`Session cost $4.12` (`$4.12` in compact layout). On API-key billing, with no
rate-limit windows, the row shows the cost alone. helper-desk's existing "Total
chat cost" tile now updates on `session.measure` events that say the cost
grew, not only on subagent events. It ships as one PR with two releases:
usage-left 0.3.0 and helper-desk 0.8.3.

## How the existing system works, per this document

The engine prices each API response and keeps one session total. Plugins read
it with `$.session.usage().cost.usd`, or receive it in `session.measure`
events. helper-desk reads it only on subagent events and from a poll that runs
only while a subagent works, so the tile goes stale. Its pane opens only for
subagents. usage-left already listens to `session.measure` for rate-limit data.
It draws nothing without windows, and stores the windows for the next chat.

## Findings

| # | Severity | Scope | Issue |
|---|---|---|---|
| 1 | Major | L96 vs L213-221 | "Option C of the placement question" collides with "Alternative C" (a helper-desk row, which is rejected). The placement question is never shown. |
| 2 | Major | L227-232 vs L88-92, L403-410 | Alternative D is rejected on the claim that forks and compaction are reported, while Open Questions says that is unknown (also flagged in Stage 5). |
| 3 | Major | L13, 70, 102, 105 | "The engine" and "the host" are never defined, and there is no link to the `$` plugin API or its type definitions. |
| 4 | Major | L124, 158-159, 342 | helper-desk's Zellij float is never introduced, but the change must redraw it. |
| 5 | Major | L131-132, 286, 318-319, 242 | "The store" is not defined: what it is, who owns it, how long it lasts. A test and the Privacy requirement depend on it. |
| 6 | Nit | L132, 138 | "Windows", "7D" and "5H" are used before they are explained. |
| 7 | Nit | L108 | "Unit" (the values `changed` can name) is not defined. |
| 8 | Nit | L216, 310-311 | "Band" means two different things; "both surfaces" is unexplained. |
| 9 | Nit | L88-90, 149, 197, 209, 216 | cache-clock, handoff, effort-optimizer, keep-warm and `pane: off` are named without description. |
| 10 | Nit | L333 | "ribbon" is undefined. |
| 11 | Nit | L135, 272, 275 | "Colour roles", "palettes" and `SEP` are not described. |
| 12 | Nit | L36-38, 158-160 | "Helper" and "subagent" are used as synonyms without saying so. |
| 13 | Nit | L343 | It is unclear what promise "guarded with `.catch`" catches in a hook that does only synchronous work. |
| 14 | Nit | L189, 201 | "Weighed in this session" and "Joël chose" refer to a conversation the reader did not see. |
