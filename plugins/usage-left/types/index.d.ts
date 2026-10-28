export type Window = {
  /** five_hour, seven_day, or a gateway's spend_limit. */
  kind: string
  /** 0 to 100, past 100 on an exceeded spend limit. */
  percentUsed: number
  /** ISO 8601. */
  resetsAt?: string
}

declare module 'claude-code' {
  interface PluginState {
    'usage-left': {
      /** The windows the last response reported; empty off a subscription. */
      windows: Window[]
    }
  }
}
