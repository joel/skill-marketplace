# skill-marketplace

Joel's personal **Claude Code plugin marketplace**. Reusable skills live here
as plugins so they never have to be committed to the repositories they apply
to, and every machine I work from gets the same behaviour from one
`/plugin install`.

Marketplace name: `joel-skills`. Catalog: `.claude-plugin/marketplace.json`.

| Plugin | What it does |
|--------|--------------|
| `vendor-neutral-workspace` | Initialise, adopt, maintain, audit, or hand over a vendor-neutral workspace. The repository's files, not any provider's chat history or hidden memory, are the durable record of an AI agent's work, so the same subject resumes from another machine or another harness (Claude Code, Codex, Cursor, OpenCode). One agent by default, `AGENTS.md` carrying the boot sequence; context in the six Memory Bank files; decisions as MADR 4.0 records in `docs/decisions/`; tasks in a Markdown file or in Beads, declared in `workspace.yaml`; session records, summaries and approval packets beside them. Ships the standard, the template, scripts to create, validate and migrate (v1 → v2) a workspace, and Claude Code hooks that block ending a session without its record. |
| `plan-implementation` | Drives any piece of code work through a full lifecycle: size-scaled design pass, GitHub issue, Kanban, branch, implement, seed data, internal code and security review loops, validation gates, atomic commits, live verification in a real browser, docs and diagrams, PR, automated-reviewer loop, review-thread triage, merge per project policy, optional release, and persisting what was learned. Generic: each project supplies its own repo, board, commands, gates, reviewer bot, and merge policy through its workflow doc. |
| `prompt-debias` | Rewrites a draft prompt before you send it so the answering model cannot silently inherit your frames. Models refute what you assert but inherit what you assume. The skill inventories every injected frame, keeps real constraints and evidence, quarantines the rest as hypotheses to test, states the question neutrally, and adds instructions that force competing framings and odds-backed conclusions. Returns the rewritten prompt plus a table of what changed. Inspired by [Techintrospect's AI Bullshit Fixer](https://techintrospect.substack.com/p/ai-bullshit-fixer-prompt). |
| `joel-tone` | Rewrites drafts, emails, Slack messages, proposals, or LLM-generated copy into Joel's voice so they read like a careful human wrote them. Picks the register first (public Vogon Partners copy or Joel's own messages), then applies the hard rules: no em or en dashes, no invented facts, no empty intensifiers, no filled-template rhythm. Ships the public-website voice brief as a reference. Returns paste-ready text plus a short note on what changed and what to check. |
| `helper-desk` | A Claude Code mod (a hooks module, not a skill) by [Ben AI](https://www.benai.co), redistributed with permission. A purple task bar above the prompt fills as Claude ticks off its plan, and the Helper Desk pane shows one live card per subagent: its current step, tokens, time and a progress bar. Registers a `plan` tool and `/helpers`, and adds a short system-prompt section plus plan nudges to every session while it is enabled. Built and tested on Claude Code 2.1.311 (upstream 0.4.0 needed 2.1.287 or newer). See [helper-desk 0.7.1](#cache-clock-042-effort-optimizer-021-helper-desk-071-2026-10-28). |
| `handoff` | A Claude Code mod by [Ben AI](https://www.benai.co), redistributed with permission. When a chat reaches 250k tokens (configurable), a Refresh row offers to move the work to a fresh chat. It writes a handoff of the whole chat (what was asked, decided and done, files to open, next steps) with one model call, saves a draft first, and keeps every handoff in `~/.claude/handoffs/`. Then it copies the handoff, or starts the new chat: in a Zellij pane beside this one, or in the desktop app. `/refresh` shows the row, `/handoff` writes one now. Pairs with cache-clock's "Hand off" button. See [handoff 0.2.0](#handoff-020-2026-10-27). |
| `cache-clock` | A Claude Code mod by [Ben AI](https://www.benai.co), redistributed with permission. Counts down above the prompt until the chat's prompt cache goes cold (5 min or 1 hour, read from the chat's transcript), so you know when a reply is still cheap. Keep warm (`/keepwarm`) sends a tiny background ping before the cache expires. When a big chat goes cold, "Hand off to a fresh chat" runs the handoff mod, so install both. Fits narrow terminals and Zellij panes. See [cache-clock 0.7.0](#cache-clock-070-2026-10-28). |
| `effort-optimizer` | A Claude Code mod by [Ben AI](https://www.benai.co), redistributed with permission. Before Claude starts on a prompt, one short model call reads it and picks the effort level it needs (low to max) with Ben's four-question framework. In `suggest` mode a question offers the switch; in `auto` mode it switches by itself. The level goes on this chat's requests only, never into your own effort setting, and the footer shows it (`Effort Low`). Settings in `/config`; `/effort-optimizer` shows the real level. See [effort-optimizer 0.2.1](#cache-clock-042-effort-optimizer-021-helper-desk-071-2026-10-28). |
| `usage-left` | A Claude Code mod. One row above the prompt shows how much of your 7-day and 5-hour usage windows is left (`7D ●●●●●●···· 59% left · 3d 9h`), and when each resets. A window under 15% says LOW. It reads the figures Claude Code already has, so it costs no tokens, and it draws nothing when you use an API key rather than a subscription. On a narrow screen it drops the dot bars, then puts one window per row. Turn it off with `/plugin disable usage-left`. Idea from [ribbon](https://github.com/robonuggets/ribbon) (MIT). See [usage-left 0.1.1](#usage-left-011-2026-10-28). |
| `multiplexer` | Not a mod you see: a plugin that gives mods one interface to terminal multiplexers (`$.mux`). helper-desk and handoff use it for floating windows, panes beside the chat and a floating editor, and Claude Code installs it with them. Zellij is supported. With no multiplexer, each call has a defined "none" answer and each mod falls back (see [Terminal multiplexers](#terminal-multiplexers)). tmux and others can be added as a backend. See [multiplexer 0.1.0](#multiplexer-010-2026-10-27). |

## Terminal multiplexers

helper-desk and handoff use the `multiplexer` plugin's `$.mux` interface. They never call a multiplexer directly.

| Mod | In Zellij | With no multiplexer |
|-----|-----------|---------------------|
| helper-desk `/helpers float`, `pane: float` | a pinned window in the bottom right corner | the docked pane, and a line saying why |
| handoff Start new chat | a pane beside the chat running `claude` on the handoff | the handoff copied, plus the command to run |
| handoff Open file | your `$EDITOR` in a floating pane | `open` on a Mac, `xdg-open` elsewhere |

- **tmux:** a chat inside tmux behaves as having no multiplexer until someone writes a tmux backend. `plugins/multiplexer/README.md` says how, with a sketch.
- **The dependency is required.** A mod that depends on `multiplexer` doesn't load without it, and Claude Code names the missing plugin. When updating from helper-desk 0.6 or handoff 0.2, install it first with `claude plugin install multiplexer@joel-skills`, then update the mods.

## Installation (one-time, per machine)

Inside any Claude Code session:

```
/plugin marketplace add joel/skill-marketplace
/plugin install <plugin>@joel-skills
```

Plugins install at **user scope** (`~/.claude/plugins/`). Nothing is added to
any project repository. Each skill carries its own scope guard in its
`description` so it stays silent in repositories it does not apply to.

This repository is **public**, so no credentials are needed to install. If a
background marketplace refresh ever fails, a manual
`/plugin marketplace update joel-skills` inside a session always works.

## Getting updates

Installed plugins are **pinned** at install time. Merging to `main` alone does
not change a local install. A change reaches installs when the `version` field
in `.claude-plugin/marketplace.json` is bumped (that is the release act):

- With background auto-update enabled (the default), the new version is picked
  up automatically at the next session start.
- To force it immediately: `claude plugin update <plugin>@joel-skills`
- To refresh the catalog only: `/plugin marketplace update joel-skills`

## Releasing a change

1. Branch, edit the skill/plugin, open a PR to `main`.
2. **In the same PR**, bump `version` in **both**
   `plugins/<plugin>/.claude-plugin/plugin.json` and the plugin's entry in
   `.claude-plugin/marketplace.json`. No version bump = merged but not
   released. `scripts/check.sh` fails if the two disagree.
3. Optional: tag the release with `claude plugin tag plugins/<plugin>` (creates
   `<plugin>--v<version>` and checks both manifests agree).
4. Optional, for strict reproducibility: after merging, set the entry's `sha`
   to the merge commit in a follow-up PR. With a `sha` pin, even a force-push
   to `main` cannot move installed versions.

For a change that spans several PRs (a rename, a new major), use an
integration branch: branch `v2`-style off `main`, open one PR per issue into
it (squash-merged, like `main`), keep the versions unchanged inside it, and
test with `--plugin-dir`. The release PR merges the integration branch into
`main` **with a rebase merge, not a squash**, so the per-issue commits land on
`main` in order (`main` requires linear history, so a merge commit is not
allowed), and it is the only PR that bumps the version. A rename cannot land on
`main` any earlier: it removes the old catalog entry, and `scripts/check.sh`
forbids an entry without a directory.

## Release notes

### usage-left 0.1.1 (2026-10-28)

A band only a few columns wide now stacks its windows. Before, a width
under the engine's own 6-column margin read as "width unknown" and drew
the widest row.

### cache-clock 0.7.0 (2026-10-28)

The band now says what the next message's prompt costs, in dollars:
"Reply now and 182k tokens cost about $0.04, not $0.91" while the cache is
warm, and "at full cost (about $0.91)" once it is cold. The cold price
follows the cache length the clock detects: a 5 minute cache costs 1.25
times the input price to write again, and a 1 hour cache 2 times.

- **Priced models:** Fable 5.1, Mythos 5.1, Opus 5.5, Sonnet 5.5 and
  Haiku 5.5, at list price. Any other model keeps the token wording.
- **The price covers the prompt only**, not Claude's reply.
- **Prices live in `plugins/cache-clock/hooks/price.ts`.** Edit that table
  when Anthropic changes them. After a resume, Claude Code's own estimate is
  used instead.

### cache-clock 0.6.0 (2026-10-28)

- **A resumed or forked chat shows its clock at once.** Before, the band
  stayed empty until the first reply. It now starts from how long ago the
  chat's last reply was. When that chat has gone cold, the line gives
  Claude Code's own estimate of what re-reading it costs ("at full cost
  (about $0.60)").
- **`/clear` and `/compact` drop the clock** and stop keep warm. The chat's
  next request starts a new cache, so the old countdown no longer applies.
  The clock comes back with the next reply.

### usage-left 0.1.0 (2026-10-28)

A new mod: one row above the prompt with what is left of the 7-day (7D) and
5-hour (5H) usage windows, each with its reset time, and LOW under 15%.

- **Free to run.** It reads the rate-limit figures Claude Code already gets with
  every reply (`session.measure`). It never calls a model.
- **Off a subscription it draws nothing**, since there are no windows.
- **Fits narrow panes.** Dot bars first, then the label, then one window per row.
- The idea and the layout come from [ribbon](https://github.com/robonuggets/ribbon)
  by Jay E (RoboNuggets, MIT). Its `NOTICE` gives the credit.

### cache-clock 0.5.0 (2026-10-28)

The countdown now starts when Claude's last request in a reply was sent, not
when the reply finished. The prompt cache's timer starts at the request, so a
long reply used to make the clock show more time left than the cache had, and
keep warm could ping after a 5 minute cache had already expired. Requests made
by subagents still leave the clock alone. The idea comes from
[ribbon](https://github.com/robonuggets/ribbon) by Jay E (RoboNuggets, MIT).

### cache-clock 0.4.2, effort-optimizer 0.2.1, helper-desk 0.7.1 (2026-10-28)

The three bands above the prompt now space their rows the same way in the
desktop app.

- **Even gaps.** Every row of a band, and each band from the next, is
  separated by the app's smallest spacing step (`xs`). Before, cache-clock
  0.4.1 used a full cell, which left the text rows further apart than the
  buttons, and effort-optimizer used none, so "Learn more" sat on its text.
- **No extra space on top.** cache-clock and effort-optimizer no longer put
  Claude Code's empty placeholder in their column, where it took a gap above
  the band. helper-desk already left it out.
- **The terminal is unchanged:** its rows keep no gap.

### cache-clock 0.4.1 (2026-10-28)

In the desktop app, the band's buttons no longer sit on the line of text above
them. The app draws a button taller than a line of text, so the band now puts a
gap between its rows there. The terminal layout is unchanged.

### multiplexer 0.1.0 (2026-10-27)

A new plugin: one `$.mux` interface for terminal multiplexers, so mods ask for what they want and never call a multiplexer directly. Examples: "a pinned floating pane in the bottom right corner that leaves the keyboard with the chat", or "a pane beside the chat".

- **Calls:** `info`, `openFloating`, `openBeside`, `edit`, `isOpen` and `close`. The contract is `plugins/multiplexer/types/index.d.ts`.
- **No multiplexer is the default.** Every call then answers `null` (`close` answers nothing), and each mod falls back where it gets `null`.
- **Zellij** is the one backend, using the same commands helper-desk and handoff used before. A bottom-right float is placed from its size.
- **tmux** is detected but has no backend, so it counts as none. The debug log says so once. The plugin's README explains how to add a backend.

### helper-desk 0.7.0 (2026-10-27)

The floating window goes through `$.mux`, and helper-desk now depends on `multiplexer`.
- With no multiplexer, `/helpers float` opens the docked pane and says why. Before, it refused.
- A float opened by 0.6 is still recognised after the update.

### handoff 0.3.0 (2026-10-27)

Start new chat and Open file go through `$.mux`, and handoff now depends on `multiplexer`. With no multiplexer, Open file uses `xdg-open` outside a Mac, not only `open`.

### effort-optimizer 0.2.0 (2026-10-27)

First release here, based on Ben AI's effort-optimizer 0.1.0 (its `NOTICE`
lists what changed). Ben's four-question framework is unchanged.

- **Cost.** Each prompt you type (not slash commands) costs one short model
  call at low effort: Sonnet 5.5 by default, or Haiku 5.5 with
  `picker_model` in `/config`.
- **Your own effort setting is never touched.** Claude Code keeps it in
  `~/.claude/settings.json` (`effortLevel`), shared by every chat. The mod
  instead puts its pick on this chat's requests. The terminal's own indicator
  above the prompt keeps showing your setting, so the real level is in the
  footer (`Effort High`) and in `/effort-optimizer`. If you change your effort
  with `/effort`, the mod lets go.
- **No cache cost.** Checked live: the request after a switch from low to
  high read the whole chat from cache (56k read, 67 written), so switching
  levels does not re-cache the chat.
- **Settings in `/config`.** `mode` (`suggest` or `auto`) and
  `picker_model`. `/effort-optimizer auto|suggest` and the dialog's "Switch,
  and auto-adjust from now" write the mode there. `/effort-optimizer off|on`
  pauses it in the current chat only, and `/plugin disable effort-optimizer`
  turns it off. Upstream's stored mode and on/off are no longer read.
- **Terminal.** The suggest question is Claude Code's own dialog. The "Effort
  set to …" line and its Learn more panel fit the width (lines cut, the button
  on its own row when needed), with wording about the terminal's indicator and
  `/effort` instead of the desktop app's menu.
- **helper-desk.** Each pick is shared in
  `~/.claude/mods-state/effort-<session>.json`, for helper-desk to show.

### helper-desk 0.6.1 (2026-10-27)

The Zellij floating window (`/helpers float`, `pane: float`) opens in the
bottom right corner instead of the middle of the screen. It takes 45% of the
width and 55% of the height, so it stays in the corner at any terminal size.
The first frame now fits a narrow pane and is redrawn once the window has
reported its real width. The empty-desk line no longer runs past a narrow
pane's edge.

### cache-clock 0.4.0 (2026-10-27)

First release here, based on Ben AI's cache-clock 0.3.0 (its `NOTICE` lists
what changed).

- **Keep warm costs real model calls.** Each ping is one small
  `$.model.fork` reply that reads the chat from cache, about 5 to 10% of a
  normal reply on the same context. It stops after 2 hours, 30 pings, 3
  failures in a row, or your next message. It is off until you turn it on.
- **Switches are Claude Code's own.** Turn it off with `/plugin disable
  cache-clock`. Hide and `/cacheclock hide` hide it in the current chat;
  `/cacheclock` shows it again.
- **No python3.** The 5 min versus 1 hour cache length is read from the last
  3 MB of the chat's transcript with `tail`, at the path Claude Code's Stop
  hook gives. With no transcript, the clock says its 5 min length is a
  guess.
- **Terminal.** When Ben's one-row band would wrap (it needs about 165
  columns), the band uses three short rows instead: the clock with a shorter
  bar, the cost, then the buttons. It then shows the tip only while keeping
  warm, so nothing wraps in a normal terminal or Zellij pane.
- **Handoff.** The cold row's "Hand off to a fresh chat" runs the handoff
  mod. If handoff isn't running, the band says so after 7 s, instead of
  leaving the request behind.

### handoff 0.2.0 (2026-10-27)

First release here, based on Ben AI's handoff 0.1.0 (its `NOTICE` lists what
changed). The handoff itself is written by one model call (`$.model.fork`)
over the chat, so it costs about one reply on a big context.

- **Switches are Claude Code's own.** Turn it off with `/plugin disable
  handoff`. In `/config`, `offer` (`auto`/`off`) sets whether the Refresh row
  offers itself, and `offer_at` sets the token count where it does (250000 by
  default). Hide on the row applies to the current chat only; `/refresh`
  brings it back.
- **Terminal and Zellij.**
  - **Copy** uses Claude Code's own clipboard, so it works in a terminal too
    (OSC 52, Zellij included), not only on a Mac.
  - **Start new chat**, inside Zellij, opens a pane beside the chat running
    `claude` on the handoff. In a plain terminal it copies the handoff and
    shows the `claude "$(cat …)"` command to run. The desktop app still fills
    a new chat.
  - **Open file** opens the handoff in your `$EDITOR` in a floating Zellij
    pane.
- **Home from `HOME`**, so logs and handoffs land in `~/.claude/handoffs/`
  under `--plugin-dir` too.

### helper-desk 0.6.0 (2026-10-27)

A Zellij floating window for the desk. Inside Zellij, `/helpers float` opens
the Helper Desk in a pinned floating pane in the bottom right corner that
leaves the keyboard with Claude; running it again closes the pane, and so does `q` in the window.
Set `pane` to `float` in `/config` to have it open by itself when subagents
start (outside Zellij that setting falls back to the docked pane). The window
shows the plan bar and one text card per subagent (step, tokens, time), with
no pets or spinners. It is redrawn on every change and about once a second
while helpers run.

How it works: the mod writes each frame to
`~/.claude/mods-state/helper-desk-<session>.txt` (written to a temp file and
moved into place), and `hooks/float.sh`, a POSIX `sh` loop with no other
dependency, redraws it in the pane. The viewer reports the pane's width
beside the frame, so the next frame fits a narrower or resized pane. Lines
are cut at the edge, never wrapped.
- **One window.** Helpers that start together open one window. The pane id
  is kept in session state, so a plugin reload never opens a second one.
- **Interactive chats only.** `pane: float` opens the window by itself only
  in chats someone is watching, never under `claude -p`.
- **Closing.** The window stays open across `/clear` and a resume. It closes
  and its files are removed when Claude Code exits. After a crash, it keeps
  its last frame until `q`.
- **Tested on** Zellij 0.45.1.

### helper-desk 0.5.0 (2026-10-27)

First release here, based on Ben AI's helper-desk 0.4.0 (its `NOTICE` lists
what changed).

- **Switches are Claude Code's own.** Turn it off with
  `/plugin disable helper-desk`. In `/config`, `band` (`on`/`off`) shows or
  hides the task bar and `pane` (`auto`/`manual`/`off`) sets whether the pane
  opens when subagents start, only on `/helpers`, or never. The pane's Hide
  button and `/helpers hide` close it for the current session. Ben's
  `~/.claude/mods/switches.json` is no longer read.
- **Home from `HOME`.** Logs (`~/.claude/mods-logs/helper-desk.log`) and the
  plan file (`~/.claude/mods-state/plan-<session>.json`, which Ben's
  chat-inventory reads) now land in the home directory under `--plugin-dir`
  too, not inside the checkout.
- **Zellij.** In a terminal it draws text glyphs and truecolor, never
  images, so nothing depends on graphics passthrough. Checked in Zellij
  0.45.1, which gets Claude Code's fullscreen layout (tmux gets the main
  screen): at 160 columns the pane docks beside the transcript (from 110
  columns when asked for, 144 when it opens by itself); at 80 columns
  `/helpers` places it inline above the prompt. Zellij's default normal
  mode keeps `Ctrl o`, `Ctrl t`, `Ctrl s`, `Ctrl p` and its other mode keys for
  itself, so press `Ctrl g` (locked mode) first when Claude Code needs them;
  `ctrl+x` is not bound by Zellij.

### plan-implementation 2.8.0 (2026-10-27)

Live-verification pre-flight and performance measurements. Before the first
browser step the agent checks that background work (job worker, queue
consumer, mail catcher) is running, signs in with its own account rather than
the developer's, and avoids running tests that share a datastore with the dev
app. Server errors are reproduced through the real server. Performance work is
one measured change per commit, with a baseline first, before → after medians,
no overlapping measurements, and changes inside the noise reverted. Details in
`references/live-verify.md`.

### plan-implementation 2.7.0 (2026-10-27)

Review loop and merge gate. Every list call is paginated, and the
unresolved-thread check follows `pageInfo` across every page. Clean verdicts
are looked for on every channel a bot uses (review, inline comment, issue
comment, an edited status comment, a reaction), with Codex's current behaviour
as the worked example; a force-push may not retrigger the bot, so post one
trigger and bound the wait. Review claims are verified in both directions,
human counter-claims included, and replies never quote customer data. The
merge gate needs every check on HEAD green, not only the required ones. A test
that fails only in a grouped run but passes alone on the branch and on the
base commit is reported as order-dependent.

### plan-implementation 2.6.0 (2026-10-27)

Rebase hygiene. When the freshness check finds the branch behind `main`, the
agent rebases (an already-pushed branch goes out with `--force-with-lease`,
never `--force`; a branch others build on merges `main` instead), regenerates
generated or binary files rather than hand-merging them, then checks what came
in before validating again: reinstall dependencies and rebuild containers when
a lockfile changed, run new migrations, move aside a local file that `main`
now tracks. Symptoms of a stale branch, such as CI lint on files you did not
touch, are listed too. Procedure in `references/freshness.md`.

### plan-implementation 2.5.0 (2026-10-27)

One worktree per effort. Step 4 creates the branch in its own worktree
(`git worktree add ../<repo>-wt-<slug> -b <branch> origin/main`) after
checking for an existing one, and never switches, stashes or resets the
shared checkout, where another session's uncommitted work may live. A new
`Worktree setup` project-config key names the gitignored files to copy and the
install command. Review rounds that land later are fixed in the PR's worktree;
the worktree is removed after merge; Step 13 no longer checks out `main`. The
live-verification procedure and the release commands move to
`references/live-verify.md` and `references/release.md`.

### plan-implementation 2.4.0 (2026-10-27)

QA notes and a closing summary. Before merging or handing off, the agent
writes QA notes for a tester who knows the product but not the code: a
two-minute Quick check, then a Full check with data that makes a regression
visible, using the screen's own labels. They go in a `## QA` section of the
PR body by default; the new `QA notes` project-config key can send them to an
issue comment or a tracker field, or turn them off. The closing summary
(what shipped, what was accepted and why, verification, the knowledge report,
follow-up issues) is posted at PR-ready or after merge. Template in
`references/qa-instructions.md`.

### plan-implementation 2.3.0 (2026-10-27)

Knowledge consolidation, in the repository only. A candidate log starts at
Step 1; before the first push (Pass 1), candidates that pass five gates
(novel, verified, reusable, scoped, durable) go to their narrowest home in the
repository as a docs commit; after the review loop (Pass 2), new learnings
are reported and filed as follow-up issues, never committed to the PR. Step 15
no longer writes agent memory: it closes with a Knowledge consolidation
report. New project-config key for knowledge homes (index, inbox, business
rules, decision records, design patterns). Manual acceptance scenarios in
`skills/plan-implementation/tests/scenarios.md`.

### plan-implementation 2.2.0 (2026-10-27)

Write for the reviewer. Code comments say what the code cannot, in one to
three lines; the agent reads the whole diff as its first reviewer before
pushing; the PR description stays under about 150 words of prose; review
replies name the commit in a sentence or two. The issue body now states the
problem and the expected outcome before the scope. The issue and PR templates
moved to `references/write-for-the-reviewer.md`.

### plan-implementation 2.1.0 (2026-10-27)

Sub-agents keep the main context for reasoning. An `Explore` agent writes a
one-page orientation brief before implementing and again after every
compaction, a `general-purpose` agent runs validation and reports failures
only (per commit for a stack), and a blocking local tooling gap is fixed by an
agent in its own worktree. Implementation, commit messages, the PR body and
review triage stay in the main agent. Briefs in `references/sub-agents.md`.
The announce marker says when the run reuses an approved plan-mode plan.

### plan-implementation 2.0.0 (2026-10-27)

The plugin and skill `execution-plan` 1.x are renamed `plan-implementation`,
so they no longer clash with the `execution-plan` skill in
[alliantist/claude-skills](https://github.com/alliantist/claude-skills) when
both marketplaces are installed. The behaviour is unchanged. The run banner
now reads **USING PLAN IMPLEMENTATION**. The `## Execution plan configuration`
block that projects paste into their workflow doc keeps its heading, so
existing project configuration still applies.

```
claude plugin uninstall execution-plan@joel-skills
claude plugin marketplace update joel-skills
claude plugin install plan-implementation@joel-skills
```

### vendor-neutral-workspace 2.0.0 (2026-10-18)

The plugin `project-agent-workspace` 1.x is renamed and redesigned. Nothing in
the v1 layout survives unchanged, so this is a new plugin in the catalog:

```
claude plugin uninstall project-agent-workspace@joel-skills
claude plugin marketplace update joel-skills
claude plugin install vendor-neutral-workspace@joel-skills
```

What changed: one agent by default, with the boot sequence in `AGENTS.md`
(no `WARM_ME_UP.md`, no `agents/` tree; the multi-agent layout is a reference
extension); project context in the six Memory Bank files under
`memory-bank/`; decisions as MADR 4.0.0 records in `docs/decisions/` with an
index; tasks in `TASKS.md` or in Beads, chosen at init and declared in
`workspace.yaml`; approval packets in `approvals/`; `sessions/`, `summaries/`,
`artifacts/`, `archive/` at the root; Claude Code hooks that remind the agent
of the boot sequence and block ending a session once when no session record
was written.

Existing v1 workspaces: in the project root, run
`/vendor-neutral-workspace:migrate` (2.1.0). It previews, waits for your
go-ahead (`--auto` skips the pause), applies, resolves the judgement markers
with conservative defaults and lists the calls that need you in the session
record, validates, and commits with `--commit`. By hand or in another
harness: `scripts/migrate_v1.py --root <dir>` for a preview, then `--apply`,
then `references/migration-v1.md`. Nothing is deleted; everything consumed
lands under `archive/v1/` with a manifest.

### vendor-neutral-workspace 2.2.0 (2026-10-19)

Lessons from migrating two real v1 workspaces. The migration now carries the
whole text of a v1 decision into its record, cuts long record names between
words, deduplicates decision-makers, strips v1 metadata from merged files,
adds `Approval-packet` lines, moves completed tasks under `## Completed`,
repoints v1 ids and paths in the converted files, fills the agent block from
the v1 profile, and drops Finder metadata and redundant `.gitkeep` files. The
validator warns on task fields outside the contract and on missing packets,
and names a pre-v1 "Agent OS" layout. The Markdown task template ships the
`Waiting`, `Known issues` and `Completed` sections. The guide lists the owner
calls that recur; the command checks for a dirty tree first.

### vendor-neutral-workspace 2.1.1 (2026-10-19)

The migration moves approval packets that v1 kept under `decisions/` to
`approvals/` and repoints the references to them; before, they were left
behind and absent from the manifest.

### vendor-neutral-workspace 2.1.0 (2026-10-19)

Adds the `/vendor-neutral-workspace:migrate [--tasks markdown|beads] [--auto]
[--commit]` command, so a v1 workspace is upgraded with one command instead
of a multi-step prompt.

## Local development (iterate without touching the install)

Load the working copy of a plugin directly. The marketplace install is
untouched for that session:

```bash
claude --plugin-dir /path/to/skill-marketplace/plugins/<plugin>
```

- The local copy takes precedence over the installed marketplace version for
  that session.
- A plugin with `dependencies` needs them loaded too, or it doesn't load: it
  fails with only a debug-log line. helper-desk and handoff need
  `--plugin-dir /path/to/skill-marketplace/plugins/multiplexer` beside their own.
- After editing `SKILL.md` mid-session, run `/reload-plugins` to pick the
  change up.
- To test the marketplace file itself: `/plugin marketplace add ./skill-marketplace`
  (local marketplaces don't auto-update, refresh with
  `/plugin marketplace update joel-skills`).

## Adding a new skill/plugin

1. Copy the template:

   ```bash
   cp -r templates/plugin plugins/<plugin-name>
   mv plugins/<plugin-name>/skills/skill-name plugins/<plugin-name>/skills/<skill-name>
   ```

2. Edit `plugins/<plugin-name>/.claude-plugin/plugin.json`: `name`,
   `description`, keep `version: 0.1.0`.
3. Edit `plugins/<plugin-name>/skills/<skill-name>/SKILL.md`. Frontmatter is
   `name` + `description`. The description drives auto-triggering, so make it:
   - say what the skill does,
   - list the phrases that should trigger it,
   - name the repository/context it applies to and tell the agent to stay
     silent elsewhere (user-scope plugins are active in every repo you open).

   Quote or block-scalar (`>-`) the description if it contains a colon.
4. Add the plugin's entry to `.claude-plugin/marketplace.json`:

   ```json
   {
     "name": "<plugin-name>",
     "description": "Same text as plugin.json",
     "author": { "name": "Joel Azemar" },
     "category": "workflow",
     "version": "0.1.0",
     "source": {
       "source": "git-subdir",
       "url": "https://github.com/joel/skill-marketplace.git",
       "path": "plugins/<plugin-name>",
       "ref": "main"
     }
   }
   ```

5. Add a row to the plugin table at the top of this README.
6. Run `scripts/check.sh`, then PR to `main`.

A plugin can also ship `commands/`, `agents/`, and `hooks/` alongside
`skills/`. See the [plugin reference](https://code.claude.com/docs/en/plugins-reference).

## Repository layout

```
.claude-plugin/marketplace.json     ← the marketplace catalog (versions live here)
plugins/
  <plugin-name>/
    .claude-plugin/plugin.json      ← plugin manifest
    skills/<skill-name>/SKILL.md    ← the skill itself
    hooks/hooks.json                ← optional Claude Code hooks (scripts next to it, called via ${CLAUDE_PLUGIN_ROOT}),
                                      or a mod's hooks module: { "modules": ["./register.tsx"] } (tests: *.test.tsx)
    tests/                          ← optional unittest suite, run by scripts/check.sh
templates/plugin/                   ← copy this to start a new plugin
scripts/check.sh                    ← validates manifests + version consistency, runs plugin tests
```

## Links

- [Claude Code docs — plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Claude Code docs — plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code docs — skills](https://code.claude.com/docs/en/skills)
- Modelled on [alliantist/claude-skills](https://github.com/alliantist/claude-skills)
