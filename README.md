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
    hooks/hooks.json                ← optional Claude Code hooks (scripts next to it, called via ${CLAUDE_PLUGIN_ROOT})
    tests/                          ← optional unittest suite, run by scripts/check.sh
templates/plugin/                   ← copy this to start a new plugin
scripts/check.sh                    ← validates manifests + version consistency
```

## Links

- [Claude Code docs — plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Claude Code docs — plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code docs — skills](https://code.claude.com/docs/en/skills)
- Modelled on [alliantist/claude-skills](https://github.com/alliantist/claude-skills)
