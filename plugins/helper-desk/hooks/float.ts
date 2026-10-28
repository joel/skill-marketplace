// The Helper Desk as plain text for a floating pane of the terminal multiplexer ($.mux).
// The mod writes one frame per change to a file; hooks/float.sh, run in the floating pane,
// redraws it. No pets or spinners here: a frame only changes when the desk does.

import type { BandPlan, Helper } from '../types'
import { type MuxTheme, clockTime, cut, hueOf, tokenText } from './text'

/** The floating pane's size, as shares of the screen; it sits flush in the bottom right corner. */
export const FLOAT_W = '45%'
export const FLOAT_H = '55%'
/** Columns a frame is drawn in before the viewer has said how wide its pane is. */
export const FLOAT_COLS = 40
/** How soon after opening the frame is drawn again, once the viewer has reported its width. */
export const FLOAT_REFIT_MS = 1500
/** The first line of a frame that tells the viewer to quit. */
export const ENDED = '#ended'

// The colours with no theme; the multiplexer's theme replaces each it has (the pane does the same).
const GOOD = '#16a34a'
const BAD = '#dc2626'
const WARN = '#eab308'
const ACCENT = '#d97757'
type FloatColors = { good: string; bad: string; warn: string; accent: string }
const floatColors = (t: MuxTheme | null | undefined): FloatColors => ({ good: t?.green ?? GOOD, bad: t?.red ?? BAD, warn: t?.yellow ?? WARN, accent: t?.orange ?? ACCENT })
const P_LIGHT = '#c4b5fd'
const P_MID = '#8b5cf6'
const P_DEEP = '#6d28d9'

const ESC = '\x1b['
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(';')
const fg = (hex: string, s: string) => `${ESC}38;2;${rgb(hex)}m${s}${ESC}39m`
const bold = (s: string) => `${ESC}1m${s}${ESC}22m`
const dim = (s: string) => `${ESC}2m${s}${ESC}22m`

/** A colour between `a` and `b`, both #rrggbb; `t` from 0 to 1. */
function mix(a: string, b: string, t: number): string {
  const at = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2].map(i => Math.round(at(a, i) + (at(b, i) - at(a, i)) * t).toString(16).padStart(2, '0')).join('')}`
}

export type FloatInput = {
  helpers: readonly Helper[]
  /** The band's plan; drawn only while the band would show it. */
  plan: BandPlan | null
  now: number
  costUsd: number | null
  /** Columns to draw in. */
  width: number
  /** The terminal multiplexer's theme ($.mux.theme()); its colours when given. */
  theme?: MuxTheme | null
}

function planLines(p: BandPlan, w: number): string[] {
  const n = p.steps.length
  const done = p.steps.filter(st => st.status === 'completed').length
  const label = `Tasks ${done}/${n}`
  const pct = `${Math.round((done / n) * 100)}%`
  const title = cut(p.title, Math.min(24, Math.floor(w / 3)))
  const barW = Math.max(6, w - title.length - label.length - pct.length - 5)
  const fillC = Math.round((barW * done) / n)
  const now = p.steps.find(st => st.status === 'in_progress')
  const liveC = now ? Math.max(0, Math.round((barW * Math.min(n, done + 1)) / n) - fillC) : 0
  const cells = Array.from({ length: fillC }, (_, i) => fg(mix(P_LIGHT, P_DEEP, fillC > 1 ? i / (fillC - 1) : 1), '█')).join('')
  const bar = `${cells}${liveC ? fg(P_MID, '▓'.repeat(liveC)) : ''}${dim('░'.repeat(Math.max(0, barW - fillC - liveC)))}`
  const nextUp = p.steps.find(st => st.status === 'pending')
  const line = now ? `Now: ${now.text}` : done === n ? 'All steps done' : nextUp ? `Next: ${nextUp.text}` : ''
  const out = [`${fg(P_DEEP, '●')} ${bold(title)} ${bar} ${bold(fg(P_MID, label))} ${dim(pct)}`]
  if (line) out.push(dim(cut(line, w)))
  return out
}

function cardLines(hp: Helper, now: number, w: number, C: FloatColors, theme: MuxTheme | null | undefined): string[] {
  const live = hp.phase === 'working'
  const mark = live ? fg(hueOf(hp.hue, theme).color, '●') : hp.phase === 'done' ? fg(C.good, '✓') : fg(C.bad, '✗')
  const time = clockTime((live ? Math.max(now, hp.startedAt) : hp.endedAt) - hp.startedAt)
  const meta = [hp.hasUsage ? `${tokenText(hp.tokens + hp.turnTokens)} tokens` : '', time].filter(Boolean).join(' · ')
  const who = [hp.type, hp.model, hp.effort].filter(Boolean).join(' · ')
  const current = hp.steps[hp.steps.length - 1]
  const steps = `${hp.count} step${hp.count === 1 ? '' : 's'}`
  const lead = live
    ? `Step ${hp.count} · ${current?.live ?? 'Getting started'}`
    : hp.phase === 'done'
      ? `Done · ${steps}`
      : `Stopped before it finished · ${steps}`
  const out = [
    `${mark} ${bold(cut(hp.description, w - 2))}`,
    // Tokens and time stay whole; the agent type and model give way first.
    `  ${dim(meta ? `${cut(who, Math.max(0, w - 5 - meta.length))}${who ? ' · ' : ''}${meta}` : cut(who, w - 2))}`,
    `  ${fg(live ? C.accent : hp.phase === 'done' ? C.good : C.bad, cut(lead, w - 2))}`,
  ]
  if (live) for (const st of hp.steps.slice(0, -1).slice(-2)) out.push(dim(cut(`    ${st.live}`, w)))
  return out
}

/** One frame: every line ends by clearing the rest of its row, so a shorter frame leaves nothing behind. */
export function floatFrame({ helpers, plan, now, costUsd, width, theme }: FloatInput): string {
  const w = Math.max(24, width)
  const C = floatColors(theme)
  const running = helpers.filter(hp => hp.phase === 'working')
  const groups: [string, string, Helper[]][] = [
    ['Running', C.good, running],
    ['Finished', C.warn, helpers.filter(hp => hp.phase === 'done')],
    ['Stopped', C.bad, helpers.filter(hp => hp.phase === 'failed')],
  ]
  const facts: string[] = []
  if (costUsd !== null) facts.push(`$${costUsd.toFixed(2)}`)
  if (helpers.some(hp => hp.hasUsage)) facts.push(`${tokenText(helpers.reduce((n, hp) => n + hp.tokens + hp.turnTokens, 0))} tokens`)
  if (helpers.length) {
    const start = Math.min(...helpers.map(hp => hp.startedAt))
    const end = running.length ? Math.max(now, ...running.map(hp => hp.startedAt)) : Math.max(...helpers.map(hp => hp.endedAt))
    facts.push(clockTime(end - start))
  }
  const count = helpers.length ? `${helpers.length} subagent${helpers.length === 1 ? '' : 's'}` : 'No subagents yet'
  const lines = [`${bold(fg(running.length ? C.accent : helpers.length ? C.good : P_MID, count))}  ${dim(cut(facts.join(' · '), w - count.length - 2))}`, '']
  if (plan?.shown && plan.steps.length) lines.push(...planLines(plan, w), '')
  if (!helpers.length) lines.push(dim(cut('Cards show up here when Claude starts a subagent.', w)), '')
  for (const [title, color, members] of groups) {
    if (!members.length) continue
    lines.push(bold(fg(color, `${title} · ${members.length}`)))
    for (const hp of members) lines.push(...cardLines(hp, now, w, C, theme), '')
  }
  lines.push(dim(cut('q closes this window · /helpers float toggles it', w)))
  return lines.map(l => `${l}${ESC}K`).join('\n')
}

/** A pane a multiplexer opened ($.mux): which one, and its id for the pane. */
export type FloatPane = { mux: string; id: string }

/**
 * The floating pane to ask the multiplexer for ($.mux.openFloating): the viewer, in the bottom
 * right corner, on top, leaving the keyboard with the chat, gone when the viewer quits.
 */
export function floatSpec(script: string, frameFile: string, title: string) {
  return {
    name: title,
    argv: ['sh', script, frameFile],
    anchor: 'bottom-right' as const,
    width: FLOAT_W,
    height: FLOAT_H,
    pinned: true,
    takeFocus: false,
    closeOnExit: true,
  }
}
