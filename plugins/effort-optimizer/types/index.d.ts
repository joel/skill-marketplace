export type Level = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** The level the mod puts on requests, and the effort the request carried when it took over. */
export type Hold = { level: Level; base: string }

export type Band = {
  /** offer: the suggestion and its buttons. applied: one line for a few seconds. info: the Learn more panel, open until closed. */
  phase: 'offer' | 'applied' | 'info'
  /** Changes with every new band, so an old timer never clears a newer one. */
  id: number
  /** The level the framework picked. */
  level: Level
  /** The level the chat ran at when the prompt went in. */
  from: Level | ''
  /** One short reason, from the framework. */
  why: string
  /** A line under the buttons: an error, or how the level was set. */
  note: string
}

declare module 'claude-code' {
  interface PluginState {
    'effort-optimizer': {
      band: Band | null
      /** The level the mod puts on every main-chat request; the person's own effort setting is never changed. */
      override: Level | null
      /** The same level with the effort it replaced, so a reload carries on and a change by the person still lets go. */
      hold: Hold | null
      /** True while /effort-optimizer off pauses the mod in this chat. */
      paused: boolean
    }
  }
}
