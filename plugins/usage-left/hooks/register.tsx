import type { EngineInterface, Register } from 'claude-code'

import type { Window } from '../types'
import { LABEL, SEP, clean, costText, layoutOf, paletteOf, pieceOf, stillCurrent } from './usage'
import type { Piece } from './usage'

// One row above the prompt: how much of each usage window is left, when it resets, and what
// the session has cost so far (the /cost total). It reads the figures the engine already has,
// so it costs no tokens. With no windows (an API key), the row shows the session's cost alone;
// it draws nothing only when there are neither windows nor a cost.

const WINDOWS = { plugin: 'usage-left', key: 'windows' } as const
/** This session's cost. Never kept in the store, so a new chat does not show the last one's. */
const COST = { plugin: 'usage-left', key: 'cost' } as const
/** The last windows seen, kept across chats in the store. */
const LAST = 'lastWindows'
/** Reset times count down in minutes, and the cost is read again. */
const TICK_MS = 60_000

async function setWindows($: EngineInterface, list: readonly Window[]) {
  await $.state.set(WINDOWS, clean(list))
}

/** Fresh figures: shown now, and kept for the next chat's start. */
async function take($: EngineInterface, list: readonly Window[]) {
  await setWindows($, list)
  if (list.length > 0) await $.store.set(LAST, clean(list)).catch(() => undefined)
}

/** A new cost figure, taken whether it rose or fell (it falls after /clear). */
async function setCost($: EngineInterface, usd: unknown) {
  if (typeof usd !== 'number') return
  const { value } = await $.state.get(COST)
  if (value !== usd) await $.state.set(COST, usd)
}

/** The last chat's windows, less any whose reset has passed; none when nothing was kept. */
async function recall($: EngineInterface): Promise<Window[]> {
  const value = await $.store.get(LAST).catch(() => undefined)
  return stillCurrent(value, await $.clock.now())
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    // The engine learns the windows from the first reply, so a new chat would show nothing until
    // then: the last chat's figures stand in, and the first reply replaces them.
    const u = await $.session.usage().catch(() => null)
    const fresh = u?.rateLimits ?? []
    if (fresh.length > 0) await take($, fresh)
    else await setWindows($, await recall($))
    await $.state.set(COST, typeof u?.cost?.usd === 'number' ? u.cost.usd : null)
    // session.measure comes after main-thread turns only; the tick catches cost that grows in
    // between (subagents, keep-warm pings).
    $.clock.every(TICK_MS, async () => {
      const now = await $.session.usage().catch(() => null)
      await setCost($, now?.cost?.usd).catch(() => undefined)
      try {
        $.ui.invalidate('ui.render')
      } catch {
        // The next tick redraws anyway.
      }
    })
    return r
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await take($, e.rateLimits)
    // Every value, not only when `changed` names cost: it names it only when the total grew.
    await setCost($, e.cost?.usd)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { value: list = [] } = await $.state.get(WINDOWS)
    const { value: held } = await $.state.get(COST)
    const cost = typeof held === 'number' ? held : null
    if (list.length === 0 && cost === null) return next(e)
    // Claude Code's own placeholder draws nothing but would take a gap above the row.
    const drawn = await next(e)
    const rest = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null
    const { Box, Text } = $.ui.resolve(e)
    const palette = paletteOf(e.surface)
    const rowGap = e.surface === 'terminal' ? 0 : 'xs'
    const now = await $.clock.now()
    const pieces = list.map(w => pieceOf(w, now))
    // The engine keeps the last few columns for its own [-] control.
    const cols = typeof e.props.bodyColumns === 'number' && e.props.bodyColumns > 0 ? Math.max(1, Math.floor(e.props.bodyColumns) - 6) : 0
    const layout = layoutOf(pieces, cols, cost)
    const full = layout === 'full'
    const alone = pieces.length === 0

    const piece = (p: Piece, i: number) => (
      <Text key={`w-${i}`} wrap="truncate-end">
        <Text bold>{p.name} </Text>
        {full ? <Text color={palette[p.role]}>{'●'.repeat(p.on)}</Text> : null}
        {full ? <Text dimColor>{`${'·'.repeat(p.off)} `}</Text> : null}
        <Text bold color={palette[p.role]}>{`${p.left}%`}</Text>
        {full ? <Text color={palette[p.role]}> left</Text> : null}
        {p.low ? <Text bold color={palette[p.role]}> LOW</Text> : null}
        {p.reset ? <Text dimColor>{` · ${p.reset}`}</Text> : null}
      </Text>
    )

    // Labelled everywhere but the compact row beside windows, where the $ is enough.
    const costPiece =
      cost === null ? null : (
        <Text key="cost" dimColor wrap="truncate-end">
          {costText(cost, alone || layout !== 'compact')}
        </Text>
      )

    const rows = alone ? (
      costPiece
    ) : layout === 'stacked' ? (
      [...pieces.map(piece), costPiece]
    ) : (
      <Box key="row" flexDirection="row" gap={SEP}>
        {full ? <Text dimColor>{LABEL}</Text> : null}
        {pieces.map(piece)}
        {costPiece}
      </Box>
    )
    return (
      <Box key="usage" flexDirection="column" gap={rowGap}>
        {rest as never}
        {rows}
      </Box>
    )
  })
}
