// The pure decisions of the mod: reading a pick, and which effort a main-chat request goes out
// with. Kept apart from the hooks so they can be tested without a model request stream.

import type { RenderSurface } from 'claude-code'

import type { Hold, Level } from '../types'

export const LEVELS: readonly Level[] = ['low', 'medium', 'high', 'xhigh', 'max']
export const NAMES: Record<Level, string> = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra high', max: 'Max' }
// Fits the footer slot (about 14 cells).
export const SHORT = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'XHigh', max: 'Max' } as const

export type Pick = { level: Level; why: string }

// "Extra high", "x-high" and "xhigh" all read as xhigh.
export function norm(s: string) {
  const t = s.toLowerCase().replace(/[^a-z]/g, '')
  if (t === 'extrahigh' || t === 'xhigh') return 'xhigh'
  return t
}

export function asLevel(v: unknown): Level | '' {
  if (typeof v !== 'string') return ''
  const t = norm(v)
  return (LEVELS as readonly string[]).includes(t) ? (t as Level) : ''
}

// Plain text: no em or en dashes, never the banned word, one short line.
export function cleanWhy(raw: string) {
  const r = raw
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\bship(s|ped|ping)?\b/gi, 'publish')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'`\s]+|["'`\s.]+$/g, '')
  return r.slice(0, 90)
}

/** The picker's JSON reply; null for "keep", a level it does not know, or no JSON. */
export function parsePick(text: string): Pick | null {
  const m = /\{[\s\S]*\}/.exec(text)
  if (!m) return null
  try {
    const j = JSON.parse(m[0]) as { level?: unknown; why?: unknown }
    const level = asLevel(j.level)
    if (!level) return null
    return { level, why: cleanWhy(typeof j.why === 'string' ? j.why : '') }
  } catch {
    return null
  }
}

export type StepState = {
  /** The effort the request carries: the person's own setting. */
  incoming: string
  hold: Hold | null
  turnLevel: Level | null
  paused: boolean
}

/**
 * What one main-chat request goes out with. `release`: the person changed their own effort
 * since the mod took over, so the mod lets go. `send`: the level to put on the request in
 * place of `incoming`, or null to leave it.
 */
export function stepDecision({ incoming, hold, turnLevel, paused }: StepState): { release: boolean; send: Level | null } {
  const release = !!hold && incoming !== hold.base
  const held = release ? null : hold
  const turn = release ? null : turnLevel
  const want = turn ?? (!paused && held ? held.level : null)
  return { release, send: want && want !== incoming ? want : null }
}

/** The engine keeps the last few columns of a band for its own [-] control. */
export const EDGE = 6

/** Whether `len` characters fit one band row `cols` wide; any length fits an unknown width. */
export const fitsRow = (len: number, cols: number) => !cols || len <= cols - EDGE

/** The footer label for the level the mod holds. */
export const footerLabel = (level: Level) => `Effort ${SHORT[level]}`

/** ⓘ is an ambiguous-width glyph: some terminals draw it two cells wide, so the terminal gets i. */
export const infoGlyph = (surface: RenderSurface) => (surface === 'terminal' ? 'i' : 'ⓘ')

/** The terminal says "the effort above the prompt"; the apps have a menu beside the model name. */
export function infoLines(level: Level, from: Level | '', surface: RenderSurface): string[] {
  const was = from ? NAMES[from] : 'your own level'
  if (surface === 'terminal') {
    return [
      `Every request of this chat now goes out at ${NAMES[level]} effort.`,
      `The effort shown above the prompt is still your own setting (${was}); /effort changes that one.`,
      `The "Effort ${SHORT[level]}" label at the bottom is the real level. /effort-optimizer says it too.`,
    ]
  }
  return [
    'The mod sets the level on each message before it leaves your computer.',
    `The effort menu next to the model name still shows ${was}. Only you can move that menu: the app does not let a chat change its own menu.`,
    `To check the real level, look for the orange "Effort ${SHORT[level]}" label at the bottom, or type /effort-optimizer.`,
    'If you move the menu yourself, the mod follows the menu again.',
  ]
}
