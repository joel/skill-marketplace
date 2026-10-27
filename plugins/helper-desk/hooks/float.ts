// The Helper Desk as plain text for a Zellij floating pane.
// The mod writes one frame per change to a file; hooks/float.sh, run in the floating pane,
// redraws it. No pets or spinners here: a frame only changes when the desk does.

import type { BandPlan, Helper } from '../types'
import { clockTime, cut, hueOf, tokenText } from './text'

/** Columns the floating pane opens with; its border takes 2 of them. */
export const FLOAT_W = 66
export const FLOAT_H = '70%'
/** The first line of a frame that tells the viewer to quit. */
export const ENDED = '#ended'

const GOOD = '#16a34a'
const BAD = '#dc2626'
const WARN = '#eab308'
const ACCENT = '#d97757'
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

function cardLines(hp: Helper, now: number, w: number): string[] {
  const live = hp.phase === 'working'
  const mark = live ? fg(hueOf(hp.hue).color, '●') : hp.phase === 'done' ? fg(GOOD, '✓') : fg(BAD, '✗')
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
    `  ${dim(cut([who, meta].filter(Boolean).join(' · '), w - 2))}`,
    `  ${fg(live ? ACCENT : hp.phase === 'done' ? GOOD : BAD, cut(lead, w - 2))}`,
  ]
  if (live) for (const st of hp.steps.slice(0, -1).slice(-2)) out.push(dim(cut(`    ${st.live}`, w)))
  return out
}

/** One frame: every line ends by clearing the rest of its row, so a shorter frame leaves nothing behind. */
export function floatFrame({ helpers, plan, now, costUsd, width }: FloatInput): string {
  const w = Math.max(24, width)
  const running = helpers.filter(hp => hp.phase === 'working')
  const groups: [string, string, Helper[]][] = [
    ['Running', GOOD, running],
    ['Finished', WARN, helpers.filter(hp => hp.phase === 'done')],
    ['Stopped', BAD, helpers.filter(hp => hp.phase === 'failed')],
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
  const lines = [`${bold(fg(running.length ? ACCENT : helpers.length ? GOOD : P_MID, count))}  ${dim(cut(facts.join(' · '), w - count.length - 2))}`, '']
  if (plan?.shown && plan.steps.length) lines.push(...planLines(plan, w), '')
  if (!helpers.length) lines.push(dim('Cards show up here when Claude starts a subagent.'), '')
  for (const [title, color, members] of groups) {
    if (!members.length) continue
    lines.push(bold(fg(color, `${title} · ${members.length}`)))
    for (const hp of members) lines.push(...cardLines(hp, now, w), '')
  }
  lines.push(dim(cut('q closes this window · /helpers float toggles it', w)))
  return lines.map(l => `${l}${ESC}K`).join('\n')
}

/** The `zellij run` that opens the viewer beside the chat without taking the keyboard. */
export function floatRunArgv(script: string, frameFile: string, title: string): string[] {
  return [
    'zellij',
    'run',
    '--floating',
    '--pinned',
    'true',
    '--no-focus',
    '--near-current-pane',
    '--close-on-exit',
    '--name',
    title,
    '--width',
    String(FLOAT_W),
    '--height',
    FLOAT_H,
    '--',
    'sh',
    script,
    frameFile,
  ]
}
