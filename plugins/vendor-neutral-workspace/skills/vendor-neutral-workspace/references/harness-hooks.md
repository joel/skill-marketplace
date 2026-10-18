# Harness hooks

Prose rules fade. The two records that make a workspace resumable on another machine, the session record and the memory bank, are the ones an agent most often skips at the end of a session. Where the harness offers lifecycle hooks, the workspace enforces them mechanically; where it does not, the rules in `AGENTS.md` are all there is.

Hooks are harness-specific by nature. They live with the plugin, never in the workspace, and they do nothing unless the session's working directory (or its git top level) holds a `workspace.yaml` with `hooks: on`. Set `hooks: off` to opt a workspace out.

## Claude Code

This plugin ships `hooks/hooks.json` and `hooks/vnw_hook.py`; they are active whenever the plugin is enabled.

| Event | What the hook does |
| --- | --- |
| `SessionStart` | Injects a reminder of the boot sequence and of the session-record rule as additional context. For `tasks: beads` it also runs `bd prime` and injects its output, so the Beads workflow is in context from the first turn. Resume and compaction keep the original session start time. |
| `Stop` | When no file under `sessions/` was created or modified since the session started, blocks **once** with the reason (write the session record, update the memory bank if anything moved, a no-work session gets a one-line record), then lets the next turn end. Honours `stop_hook_active`, so it never loops. When a record was written but no `memory-bank/` file changed, shows a one-time warning instead of blocking. |

Per-session state (start time, whether it has blocked or warned) is kept outside the workspace, under `$CLAUDE_PLUGIN_DATA/hooks/` (or `$VNW_HOOK_STATE_DIR` in tests), so nothing hook-related is ever committed.

Limits: a Stop hook fires after every assistant turn, not only at the end of a session, which is why it blocks once rather than every time. `SessionEnd` cannot block, so it is not used. The hook is passive on the Beads side: it does not run `bd dolt push`; that stays an explicit step in the Beads loop.

## Other harnesses

- **Codex CLI** has native lifecycle hooks (Beads' `bd setup codex` installs some). Wiring the two scripts above to its session-start and turn-end events is the equivalent; not yet packaged here.
- **Gemini CLI** accepts a SessionStart hook JSON envelope compatible with `bd prime --hook-json`; the same reminder can be injected there.
- **Cursor, OpenCode, Windsurf and the rest**: rules files only. The boot sequence and the before-ending steps in `AGENTS.md` are the enforcement; the cold-start test and the validator's `migration marker` and session warnings are the checks.

When a harness is added here, the scripts stay the same; only the registration and the stdin contract differ. Keep any new wiring under the plugin, never in the workspace, and keep the scope guard.
