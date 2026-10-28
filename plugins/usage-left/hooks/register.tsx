import type { EngineInterface, Register } from 'claude-code'

import type { Window } from '../types'
import { LABEL, SEP, clean, layoutOf, pieceOf } from './usage'
import type { Piece } from './usage'

// One row above the prompt: how much of each usage window is left, and when it resets.
// It reads the figures the engine already has, so it costs no tokens. Off a subscription
// there are no windows, and it draws nothing.

const WINDOWS = { plugin: 'usage-left', key: 'windows' } as const
/** Reset times count down in minutes. */
const TICK_MS = 60_000

async function setWindows($: EngineInterface, list: readonly Window[]) {
  await $.state.set(WINDOWS, clean(list))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const u = await $.session.usage().catch(() => null)
    if (u) await setWindows($, u.rateLimits)
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
    if (e.changed.includes('rateLimits')) await setWindows($, e.rateLimits)
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
        {full ? <Text color={p.color}>{'●'.repeat(p.on)}</Text> : null}
        {full ? <Text dimColor>{`${'·'.repeat(p.off)} `}</Text> : null}
        <Text bold color={p.color}>{`${p.left}%`}</Text>
        {full ? <Text color={p.color}> left</Text> : null}
        {p.low ? <Text bold color={p.color}> LOW</Text> : null}
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
