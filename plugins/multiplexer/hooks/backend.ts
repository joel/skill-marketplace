// What a multiplexer backend is: pure functions, no engine calls. A backend says when this chat
// runs in its multiplexer (from the environment register.ts reads), builds the command line for
// each $.mux call, and reads the answers. register.ts runs the commands.
//
// To add one (tmux, screen, wezterm):
// 1. Write hooks/<name>.ts exporting a Backend, tested the way zellij.test.ts tests Zellij.
// 2. Add it to BACKENDS in register.ts (above Zellij if it should win).
// 3. Read the variable its `detect` needs in register.ts's `environment`, by name: the engine
//    lists the variables a mod reads, so each is spelled out there.
// 4. If the multiplexer keeps its theme in files, give the backend a `theme` group (ThemeBackend):
//    which config directories to try, the config file, what the config says, and which theme a
//    set of files defines. Still pure: register.ts reads the files between the steps.

import type { MuxCommand, MuxEdit, MuxFloating, MuxInfo, MuxPalette, MuxPane, MuxTheme } from '../types'

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
  /** Its themes; absent for a multiplexer whose colours are not on disk. */
  theme?: ThemeBackend
}

/** What a config says about themes, worked out without the disk; register.ts reads what it names. */
export type ThemePlan = {
  /** The theme for a dark terminal and for a light one: one name twice unless the config sets both. */
  dark: string
  light: string
  /** The directory whose theme files define themes. */
  dir: string
  /** Themes the config defines itself, by name; a file in `dir` with the same name wins over them. */
  inline: Readonly<Record<string, MuxPalette>>
}

/** One theme file register.ts read: its file name and text. */
export type ThemeFile = { name: string; text: string }

/** A backend's themes: pure, like the rest; register.ts reads between the steps. */
export type ThemeBackend = {
  /** The config directories to try, in the multiplexer's own order; the first that exists is it. */
  dirs: (env: Environment) => string[]
  /** The config file, given the directory found: the environment's override, else the usual name. */
  file: (env: Environment, dir: string) => string
  /** The plan from the config's text; empty text is the multiplexer's defaults. Throws on text it cannot read. */
  plan: (config: string, dir: string) => ThemePlan
  /** The theme named: from the files, then the plan's inline themes; null when nothing defines it. */
  pick: (name: string, plan: ThemePlan, files: readonly ThemeFile[]) => MuxTheme | null
}

/** The last word of a command's output: how a multiplexer prints the id of a pane it opened. */
export const lastWord = (out: string) => out.trim().split(/\s+/).pop() ?? ''
