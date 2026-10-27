// What a multiplexer backend is: pure functions, no engine calls. A backend says when this chat
// runs in its multiplexer (from the environment register.ts reads), builds the command line for
// each $.mux call, and reads the answers. register.ts runs the commands.
//
// To add one (tmux, screen, wezterm):
// 1. Write hooks/<name>.ts exporting a Backend, tested the way zellij.test.ts tests Zellij.
// 2. Add it to BACKENDS in register.ts (above Zellij if it should win).
// 3. Read the variable its `detect` needs in register.ts's `environment`, by name: the engine
//    lists the variables a mod reads, so each is spelled out there.

import type { MuxCommand, MuxEdit, MuxFloating, MuxInfo, MuxPane } from '../types'

/** The environment variables register.ts reads for the backends, unset ones absent. */
export type Environment = Readonly<Record<string, string | undefined>>

export type Backend = {
  /** The name panes carry (MuxPane.mux) and info() reports. */
  name: string
  /** What it can do; a false makes that call answer null, as with no multiplexer. */
  can: Omit<MuxInfo, 'name'>
  /** True when this chat runs inside the multiplexer. */
  detect: (env: Environment) => boolean
  floatingArgv: (a: MuxFloating) => string[]
  besideArgv: (a: MuxCommand) => string[]
  editArgv: (a: MuxEdit) => string[]
  /** The command whose output lists the open panes; isOpen reads it with `listed`. */
  listArgv: () => string[]
  listed: (out: string, pane: MuxPane) => boolean
  closeArgv: (pane: MuxPane) => string[]
  /** The pane an open command's output names, or null. */
  paneFrom: (out: string) => MuxPane | null
}

/** The last word of a command's output: how a multiplexer prints the id of a pane it opened. */
export const lastWord = (out: string) => out.trim().split(/\s+/).pop() ?? ''
