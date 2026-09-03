# skill-marketplace

Joel's personal **Claude Code plugin marketplace**. Reusable skills live here
as plugins so they never have to be committed to the repositories they apply
to, and every machine I work from gets the same behaviour from one
`/plugin install`.

Marketplace name: `joel-skills`. Catalog: `.claude-plugin/marketplace.json`.

| Plugin | What it does |
|--------|--------------|
| _(none yet)_ | Skills are added one at a time. See [Adding a new skill/plugin](#adding-a-new-skillplugin). |

## Installation (one-time, per machine)

Inside any Claude Code session:

```
/plugin marketplace add joel/skill-marketplace
/plugin install <plugin>@joel-skills
```

Plugins install at **user scope** (`~/.claude/plugins/`). Nothing is added to
any project repository. Each skill carries its own scope guard in its
`description` so it stays silent in repositories it does not apply to.

If this repository is **private**, the normal GitHub credentials are used
(`gh auth login` or SSH). If a background marketplace refresh ever fails on
credentials, a manual `/plugin marketplace update joel-skills` inside a session
always works.

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
templates/plugin/                   ← copy this to start a new plugin
scripts/check.sh                    ← validates manifests + version consistency
```

## Links

- [Claude Code docs — plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Claude Code docs — plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code docs — skills](https://code.claude.com/docs/en/skills)
- Modelled on [alliantist/claude-skills](https://github.com/alliantist/claude-skills)
