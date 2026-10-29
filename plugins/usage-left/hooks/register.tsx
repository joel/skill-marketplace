import type { EngineInterface, Register } from 'claude-code'

import type { Window } from '../types'
import { LABEL, SEP, clean, layoutOf, paletteOf, pieceOf, stillCurrent } from './usage'
import type { Piece } from './usage'

// One row above the prompt: how much of each usage window is left, and when it resets.
// It reads the figures the engine already has, so it costs no tokens. Off a subscription
// there are no windows, and it draws nothing.

const WINDOWS = { plugin: 'usage-left', key: 'windows' } as const
/** The last windows seen, kept across chats in the store. */
const LAST = 'lastWindows'
/** Reset times count down in minutes. */
const TICK_MS = 60_000

async function setWindows($: EngineInterface, list: readonly Window[]) {
  await $.state.set(WINDOWS, clean(list))
}

/** Fresh figures: shown now, and kept for the next chat's start. */
async function take($: EngineInterface, list: readonly Window[]) {
  await setWindows($, list)
  if (list.length > 0) await $.store.set(LAST, clean(list)).catch(() => undefined)
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
    $.clock.every(TICK_MS, () => {
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
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { value: list = [] } = await $.state.get(WINDOWS)
    if (list.length === 0) return next(e)
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
    const layout = layoutOf(pieces, cols)
    const full = layout === 'full'

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

    const rows =
      layout === 'stacked' ? (
        pieces.map(piece)
      ) : (
        <Box key="row" flexDirection="row" gap={SEP}>
          {full ? <Text dimColor>{LABEL}</Text> : null}
          {pieces.map(piece)}
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
