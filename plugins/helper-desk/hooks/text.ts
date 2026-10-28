// Small drawing helpers shared by the pane, the band and the floating window.

import type { EngineInterface } from 'claude-code'

/** The terminal multiplexer's theme as $.mux.theme() answers it (the multiplexer plugin's contract). */
export type MuxTheme = NonNullable<Awaited<ReturnType<EngineInterface['mux']['theme']>>>

export type Hue = { name: string; color: string }

// Eight body colours that are easy to tell apart and read on light and dark.
export const HUES: Hue[] = [
  { name: 'red', color: '#dc2626' },
  { name: 'orange', color: '#ea580c' },
  { name: 'yellow', color: '#eab308' },
  { name: 'green', color: '#16a34a' },
  { name: 'teal', color: '#0d9488' },
  { name: 'blue', color: '#2563eb' },
  { name: 'purple', color: '#9333ea' },
  { name: 'pink', color: '#db2777' },
]
// The theme colour each hue takes when the multiplexer has a theme, in the same order; the
// eighth is the theme's foreground, so eight cards still tell apart.
const HUE_THEME = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'magenta', 'fg'] as const

/** The hue's name and colour: the theme's when one is given and holds that colour, else its own. */
export const hueOf = (hue: number, theme: MuxTheme | null = null): Hue => {
  const i = ((hue % HUES.length) + HUES.length) % HUES.length
  const own = HUES[i]!
  const key = HUE_THEME[i]!
  const color = theme?.[key] ?? (key === 'fg' ? theme?.white : null) ?? own.color
  return color === own.color ? own : { name: own.name, color }
}

export const cut = (t: string, n: number) => (n <= 0 ? '' : t.length > n ? `${t.slice(0, Math.max(0, n - 1))}…` : t)

export function clockTime(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = String(t % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function tokenText(n: number) {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}
