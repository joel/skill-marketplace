// What the row says, as plain text pieces. Pure: nothing here touches the engine.

import type { Window } from '../types'

/** Under this much left, a window says LOW. */
export const LOW_AT = 15
export const CELLS = 10

const NAMES: Record<string, string> = { seven_day: '7D', five_hour: '5H', spend_limit: 'Spend' }
const ORDER: Record<string, number> = { seven_day: 0, five_hour: 1 }

export const GOOD = '#16a34a'
export const WARN = '#ca8a04'
export const BAD = '#dc2626'

/** Only the fields the row reads, 7-day first, then 5-hour, then any other. */
export const clean = (list: readonly Window[]): Window[] =>
  list
    .map(w => ({ kind: w.kind, percentUsed: w.percentUsed, ...(w.resetsAt ? { resetsAt: w.resetsAt } : {}) }))
    .sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9))

/** Time until a reset: 42m, 2h 10m, 3d 9h; '' without a time. */
export const until = (iso: string | undefined, now: number): string => {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'resetting'
  const mins = Math.ceil(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

export type Piece = {
  name: string
  /** Percent left, 0 to 100, one decimal at most. */
  left: number
  low: boolean
  color: string
  /** Filled and empty cells of the dot bar. */
  on: number
  off: number
  reset: string
}

export const pieceOf = (w: Window, now: number): Piece => {
  const left = Math.max(0, Math.min(100, Math.round((100 - w.percentUsed) * 10) / 10))
  const on = Math.round((left / 100) * CELLS)
  return {
    name: NAMES[w.kind] ?? w.kind,
    left,
    low: left < LOW_AT,
    color: left < LOW_AT ? BAD : left < 50 ? WARN : GOOD,
    on,
    off: CELLS - on,
    reset: until(w.resetsAt, now),
  }
}

/** One window as text: full has the dot bar and "left"; compact drops both. */
export const textOf = (p: Piece, full: boolean): string =>
  `${p.name} ${full ? `${'●'.repeat(p.on)}${'·'.repeat(p.off)} ` : ''}${p.left}%${full ? ' left' : ''}${p.low ? ' LOW' : ''}${p.reset ? ` · ${p.reset}` : ''}`

export const LABEL = 'Usage left'
export const SEP = 3

export type Layout = 'full' | 'compact' | 'stacked'

/** The widest layout whose row fits `cols` (0: unknown, so full). */
export const layoutOf = (pieces: readonly Piece[], cols: number): Layout => {
  if (cols <= 0) return 'full'
  const width = (full: boolean) =>
    (full ? LABEL.length + SEP : 0) + pieces.reduce((n, p) => n + textOf(p, full).length, 0) + SEP * (pieces.length - 1)
  if (width(true) <= cols) return 'full'
  if (width(false) <= cols) return 'compact'
  return 'stacked'
}
