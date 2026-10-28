# multiplexer

One interface for terminal multiplexers, for Claude Code mods. A mod calls `$.mux` and says what it wants, like "a floating pane in the bottom right corner that leaves the keyboard with the chat". The multiplexer the chat runs in does it. **Zellij** is supported today. Others plug in as a backend (see below).

Install it with `claude plugin install multiplexer@joel-skills`, after `claude plugin marketplace add joel/skill-marketplace`. Mods that use it list it under `dependencies`, and Claude Code installs it with them. A mod whose dependency is missing doesn't load; Claude Code names the missing plugin and the command to install it.

## The interface

The contract is in `types/index.d.ts`:

| Call | Answers | With no multiplexer |
|------|---------|---------------------|
| `$.mux.info()` | `{ name, floating, beside, edit }` | `null` |
| `$.mux.openFloating({ name, argv, cwd?, anchor, width, height, pinned?, takeFocus?, closeOnExit? })` | the pane, `{ mux, id }` | `null` |
| `$.mux.openBeside({ name, argv, cwd? })` | the pane | `null` |
| `$.mux.edit({ path, floating? })` | the pane, running the person's `$EDITOR` | `null` |
| `$.mux.isOpen({ pane })` | `true` or `false` | `null` (cannot tell) |
| `$.mux.close({ pane })` | nothing | nothing |
| `$.mux.theme()` | the active theme: `{ name, fg, bg, black, red, green, yellow, blue, magenta, cyan, white, orange }`, each `#rrggbb` or `null` | `null` |

- **`anchor`** is `bottom-right` or `center`.
- **`width` and `height`** are shares of the screen, such as `"45%"`. A `bottom-right` pane of any size sits flush in the corner.
- **`theme()`** is Zellij's active theme, read from its files: `theme` in `config.kdl` (`theme_dark` and `theme_light` when both are set, picked by Claude Code's own light or dark setting), the config's `themes {}` block, and every `.kdl` file in the themes folder (`theme_dir`, else `themes` beside the config; `ZELLIJ_CONFIG_DIR` and `ZELLIJ_CONFIG_FILE` are honoured). Both theme formats are read, the older palette and the component one. A built-in theme is compiled into Zellij, not on disk, so it answers `null`; a colour written as an 8-bit index is `null` on its own. The theme is read once per process.

**The default is the absence of a multiplexer.** Every call has a defined answer then: `null`, or nothing for `close`. So a mod doesn't need special cases. It falls back where the answer is `null`:
- **helper-desk** docks its pane;
- **handoff** copies the handoff and shows the command to run, and opens files with the Mac's `open`, or `xdg-open` elsewhere.

A chat inside tmux counts as having no multiplexer until someone writes a tmux backend. The debug log says so once.

## Adding a backend

A backend is pure: it builds command lines and reads their output, and `hooks/register.ts` runs them. See `hooks/backend.ts` for the `Backend` type and `hooks/zellij.ts` for a complete one.

1. Write `hooks/<name>.ts` exporting a `Backend`:
   - `detect(env)`;
   - `can` (what it supports; a `false` makes that call answer as with no multiplexer);
   - `floatingArgv`, `besideArgv`, `editArgv`, `listArgv` with `listed`, `closeArgv`;
   - `paneFrom`, to read the new pane's id out of the command's output;
   - `theme`, optional, when the multiplexer keeps its theme in files: `dirs`, `file`, `plan` and `pick` (`ThemeBackend` in `hooks/backend.ts`; `hooks/zellij-theme.ts` is Zellij's).
2. Add it to `BACKENDS` in `hooks/register.ts`, above Zellij if it should win when both are present.
3. Read the environment variable its `detect` needs, by name, in `environment()` in `hooks/register.ts`. Claude Code lists the variables a mod reads, so each one is spelled out there.
4. Test it the way `hooks/zellij.test.ts` tests Zellij, add a case to `hooks/register.test.ts`, and bump the version.

A tmux backend, for example, would:
- detect `TMUX`;
- open a float with `tmux display-popup` (tmux 3.2 or later; its `-x`, `-y`, `-w` and `-h` take the position and size);
- open a pane beside with `tmux split-window -h -P -F '#{pane_id}'`, which prints the new pane's id;
- list panes with `tmux list-panes -a -F '#{pane_id}'`, close one with `tmux kill-pane -t <id>`, and edit with `tmux split-window "$EDITOR <path>"`.

A popup isn't a pane tmux lists. So its `isOpen` would answer `null`, and the mods treat `null` as "still open".
