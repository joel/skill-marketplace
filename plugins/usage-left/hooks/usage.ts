// What the row says, as plain text pieces. Pure: nothing here touches the engine.

import type { Window } from '../types'

/** Under this much left, a window says LOW. */
export const LOW_AT = 15
export const CELLS = 10

const NAMES: Record<string, string> = { seven_day: '7D', five_hour: '5H', spend_limit: 'Spend' }
const ORDER: Record<string, number> = { seven_day: 0, five_hour: 1 }

/** Which colour a window takes: good with over half left, warn under, bad under LOW_AT. */
export type Role = 'good' | 'warn' | 'bad'
export type Palette = Record<Role, string>
/** The app's fixed colours. */
export const HEX: Palette = { good: '#16a34a', warn: '#ca8a04', bad: '#dc2626' }
/** Claude Code's theme keys: in the terminal an ANSI theme draws them in its own palette. */
export const THEME: Palette = { good: 'success', warn: 'warning', bad: 'error' }
export const paletteOf = (surface: string): Palette => (surface === 'terminal' ? THEME : HEX)

/** Only the fields the row reads, 7-day first, then 5-hour, then any other. */
export const clean = (list: readonly Window[]): Window[] =>
  list
    .map(w => ({ kind: w.kind, percentUsed: w.percentUsed, ...(w.resetsAt ? { resetsAt: w.resetsAt } : {}) }))
    .sort((a, b) => (ORDER[a.kind] ?? 9) - (ORDER[b.kind] ?? 9))

const isWindow = (x: unknown): x is Window =>
  typeof x === 'object' && x !== null && typeof (x as Window).kind === 'string' && typeof (x as Window).percentUsed === 'number'

/** A stored list read back as windows: well-formed ones, less any whose reset has passed (its figure is stale). */
export const stillCurrent = (value: unknown, now: number): Window[] =>
  (Array.isArray(value) ? value : []).filter(isWindow).filter(w => !w.resetsAt || !(Date.parse(w.resetsAt) <= now))

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
  role: Role
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
    role: left < LOW_AT ? 'bad' : left < 50 ? 'warn' : 'good',
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
