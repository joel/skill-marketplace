// The multiplexer plugin's contract: the `$.mux` noun other mods call. Mods ask for what they
// want (a floating pane in the bottom right corner, a pane beside the chat), never for a
// multiplexer's flags; a backend translates. With no multiplexer every call answers null, or
// nothing for close, and each mod falls back in its own way.

/** A pane a multiplexer opened: which multiplexer, and its own id for the pane. */
export type MuxPane = {
  mux: string
  id: string
}

/** The multiplexer this terminal runs in, and what its backend can do. */
export type MuxInfo = {
  name: string
  floating: boolean
  beside: boolean
  edit: boolean
}

/** A command to run in a new pane, and the pane's title. */
export type MuxCommand = {
  name: string
  argv: readonly string[]
  cwd?: string
}

/** A floating pane: where it sits and its size, as shares of the screen ("45%"). */
export type MuxFloating = MuxCommand & {
  anchor: 'bottom-right' | 'center'
  width: string
  height: string
  /** Stays on top of the other panes. */
  pinned?: boolean
  /** Takes the keyboard when it opens; false leaves it with the chat. */
  takeFocus?: boolean
  /** The pane closes when its command exits. */
  closeOnExit?: boolean
}

export type MuxEdit = {
  path: string
  floating?: boolean
}

export type MuxPaneArgs = {
  pane: MuxPane
}

/**
 * The 11 colours of a multiplexer's theme (Zellij's palette), each "#rrggbb" in lower case, or
 * null when the theme gives none a mod can use: an 8-bit terminal index, a colour left out.
 */
export type MuxPalette = {
  fg: string | null
  bg: string | null
  black: string | null
  red: string | null
  green: string | null
  yellow: string | null
  blue: string | null
  magenta: string | null
  cyan: string | null
  white: string | null
  orange: string | null
}

/** The active theme: its name as the multiplexer's config names it ("tokyo-night"), and its colours. */
export type MuxTheme = MuxPalette & {
  name: string
}

export type Mux = {
  /** The multiplexer this chat runs in, or null: none, or one with no backend yet. */
  info: () => Promise<MuxInfo | null>
  /** Opens a floating pane running the command; null when none could open. */
  openFloating: (a: MuxFloating) => Promise<MuxPane | null>
  /** Opens a pane beside the chat's own running the command; null when none could open. */
  openBeside: (a: MuxCommand) => Promise<MuxPane | null>
  /** Opens the file in the person's editor in a new pane; null when none could open. */
  edit: (a: MuxEdit) => Promise<MuxPane | null>
  /** Whether the pane is still open; null when the multiplexer cannot tell. */
  isOpen: (a: MuxPaneArgs) => Promise<boolean | null>
  /** Closes the pane; quiet when it is already gone. */
  close: (a: MuxPaneArgs) => Promise<void>
  /**
   * The active theme's colours; null with no multiplexer, one that keeps no theme on disk, or a
   * theme the backend cannot read (a built-in one, a name nothing defines). Read once a process.
   */
  theme: () => Promise<MuxTheme | null>
}

declare module 'claude-code' {
  interface EngineInterface {
    mux: Mux
  }
}
