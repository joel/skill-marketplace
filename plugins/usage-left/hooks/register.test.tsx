import { expect, mock, test } from 'claude-code/testing'

import { costText, layoutOf, pieceOf, stillCurrent, textOf, until } from './usage'

/** The `on` a test body is handed. */
type On = Parameters<NonNullable<Parameters<typeof test>[2]>>[1]

const NOW = Date.parse('2098-12-31T22:00:00Z')
const WINDOWS = [
  { kind: 'five_hour', percentUsed: 4, resetsAt: '2099-01-01T00:10:00Z' },
  { kind: 'seven_day', percentUsed: 41, resetsAt: '2099-01-04T07:00:00Z' },
]

function rig(on: On, rateLimits: unknown[] = WINDOWS, store: Record<string, unknown> = {}, cost?: number) {
  let usd = cost
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('store.get', async ($, e) => ({ value: store[(e as { key: string }).key] }) as never)
  on('store.set', async ($, e) => {
    const { key, value } = e as { key: string; value: unknown }
    store[key] = value
    return { value: undefined } as never
  })
  const clock = mock.clock(on, { now: NOW })
  on('session.usage', async () => ({ value: { context: { window: 1_000_000 }, rateLimits, ...(usd === undefined ? {} : { cost: { usd } }) } }) as never)
  on('session.measure', async ($, e) => ({ changed: (e as { changed: string[] }).changed }) as never)
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>REST</Text>
  })
  return { store, clock, setCost: (n: number) => void (usd = n) }
}

/** The colour of the Text that says `text`: a theme key in the terminal, hex in the app. */
const colourOf = async (v: { findAll: (q: { text: string }) => Promise<unknown[]> }, text: string) =>
  (await v.findAll({ text })).map(n => (n as { props: { color?: string } }).props.color).find(Boolean)

const band = (bodyColumns = 200) => ({ isWorking: false, hasSurvey: false, maxRows: 10, bodyColumns }) as never
const begin = { source: 'startup', cwd: '/Users/test/vault', isInteractive: true } as const

test('the text of a window: percent left, the dot bar, the reset time', () => {
  const p = pieceOf({ kind: 'seven_day', percentUsed: 41, resetsAt: '2099-01-04T07:00:00Z' }, NOW)
  expect(textOf(p, true)).toBe('7D ●●●●●●···· 59% left · 3d 9h')
  expect(textOf(p, false)).toBe('7D 59% · 3d 9h')
  expect(until('2099-01-01T00:10:00Z', NOW)).toBe('2h 10m')
  expect(until('2098-12-31T21:00:00Z', NOW)).toBe('resetting')
  expect(until(undefined, NOW)).toBe('')
  expect(pieceOf({ kind: 'five_hour', percentUsed: 87.5 }, NOW).low, 'under 15% left is LOW').toBe(true)
  expect(pieceOf({ kind: 'seven_day', percentUsed: 41 }, NOW).role, 'over half left').toBe('good')
  expect(pieceOf({ kind: 'five_hour', percentUsed: 60 }, NOW).role, 'under half left').toBe('warn')
  expect(pieceOf({ kind: 'five_hour', percentUsed: 87.5 }, NOW).role, 'LOW').toBe('bad')
  expect(pieceOf({ kind: 'spend_limit', percentUsed: 130 }, NOW).left, 'never below 0').toBe(0)
})

test('windows read back from the store: well-formed ones whose reset has not passed', () => {
  const kept = stillCurrent(
    [...WINDOWS, { kind: 'spend_limit', percentUsed: 90, resetsAt: '2098-12-31T00:00:00Z' }, { kind: 'odd' }, 'junk', { kind: 'no_reset', percentUsed: 5 }],
    NOW,
  )
  expect(kept.map(w => w.kind)).toEqual(['five_hour', 'seven_day', 'no_reset'])
  expect(stillCurrent(undefined, NOW)).toEqual([])
  expect(stillCurrent({ not: 'a list' }, NOW)).toEqual([])
})

test('the layout narrows from full to compact to one window per row', () => {
  const pieces = WINDOWS.map(w => pieceOf(w, NOW))
  expect(layoutOf(pieces, 0)).toBe('full')
  expect(layoutOf(pieces, 120)).toBe('full')
  expect(layoutOf(pieces, 40)).toBe('compact')
  expect(layoutOf(pieces, 20)).toBe('stacked')
})

for (const surface of ['desktop', 'terminal'] as const) {
  test(`a wide band: 7D first, then 5H, above the other bands (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    rig(on)
    await $.session.start({ ...begin, surface } as never)
    const v = await $.ui.mount({ plugin: 'usage-left', surface, component: 'AbovePrompt', props: band() })
    expect(await v.find({ text: 'Usage left' })).toBeDefined()
    expect(await v.find({ text: '59%' }), '7D').toBeDefined()
    expect(await v.find({ text: '96%' }), '5H').toBeDefined()
    expect(await v.find({ text: ' · 2h 10m' })).toBeDefined()
    // The terminal draws in Claude Code's theme keys, so an ANSI theme colours the row; the app keeps hex.
    expect(await colourOf(v, '59%'), '7D has over half left').toBe(surface === 'terminal' ? 'success' : '#16a34a')
    expect(await v.find({ text: 'REST' }), 'other bands still draw').toBeDefined()
    const gap = ((await v.find({ key: 'usage' })) as { props: { gap?: unknown } } | undefined)?.props.gap
    expect(gap, 'rows spaced like the other bands').toBe(surface === 'terminal' ? 0 : 'xs')
  })
}

test('a narrow band drops the dot bar, then stacks the windows', { timeoutMs: 30000 }, async ($, on) => {
  rig(on)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  // Keys inside a tree are not searchable in the kit, so the shape is read from the band's children.
  const rows = async (cols: number) => {
    const v = await $.ui.mount({ plugin: 'usage-left', surface: 'terminal', component: 'AbovePrompt', props: band(cols) })
    const usage = (await v.find({ key: 'usage' })) as { children: { type: string }[]; text: string }
    return { types: usage.children.map(c => c.type), text: usage.text }
  }
  // The kit draws the other bands outside usage-left's box, so only its own children are read.
  const compact = await rows(46)
  expect(compact.types, 'one row').toEqual(['Box'])
  expect(compact.text).toBe('7D 59% · 3d 9h5H 96% · 2h 10m')
  const stacked = await rows(26)
  expect(stacked.types, 'one row per window').toEqual(['Text', 'Text'])
  const tiny = await rows(4)
  expect(tiny.types, 'a band narrower than the engine\'s own margin still stacks').toEqual(['Text', 'Text'])
})

test('no windows and no cost: nothing drawn', { timeoutMs: 30000 }, async ($, on) => {
  rig(on, [])
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  const v = await $.ui.mount({ plugin: 'usage-left', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ key: 'usage' })).toBeUndefined()
  expect(await v.find({ text: 'REST' })).toBeDefined()
})

test('a new reading moves the row, and LOW shows under 15% left', { timeoutMs: 30000 }, async ($, on) => {
  rig(on)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.session.measure({
    context: { window: 1_000_000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 90, resetsAt: '2099-01-01T00:10:00Z' }],
    changed: ['rateLimits'],
  } as never)
  const v = await $.ui.mount({ plugin: 'usage-left', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: '10%' })).toBeDefined()
  expect(await v.find({ text: ' LOW' })).toBeDefined()
  expect(await colourOf(v, ' LOW'), 'red, in the terminal\'s own palette').toBe('error')
  expect(await v.find({ text: '59%' }), 'the 7D window left the reading').toBeUndefined()
})

test('a new chat shows the last chat\'s windows until its first reply; a reset that has passed is left out', { timeoutMs: 30000 }, async ($, on) => {
  const { store } = rig(on, [], {
    lastWindows: [...WINDOWS, { kind: 'spend_limit', percentUsed: 90, resetsAt: '2098-12-31T00:00:00Z' }],
  })
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  let v = await $.ui.mount({ plugin: 'usage-left', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: '59%' }), '7D from the last chat').toBeDefined()
  expect(await v.find({ text: '96%' }), '5H from the last chat').toBeDefined()
  expect(await v.find({ text: /Spend/ }), 'reset at midnight, so stale').toBeUndefined()

  // The first reply's figures replace them, and are kept for the next chat.
  const fresh = [{ kind: 'five_hour', percentUsed: 90, resetsAt: '2099-01-01T00:10:00Z' }]
  await $.session.measure({ context: { window: 1_000_000 }, rateLimits: fresh, changed: ['rateLimits'] } as never)
  v = await $.ui.mount({ plugin: 'usage-left', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: '10%' })).toBeDefined()
  expect(await v.find({ text: '59%' }), 'the last chat\'s 7D is gone').toBeUndefined()
  expect(store.lastWindows, 'kept for the next chat').toEqual(fresh)
})

test('the cost text: labelled or bare, and under a cent', () => {
  expect(costText(4.12, true)).toBe('Session cost $4.12')
  expect(costText(4.12, false)).toBe('$4.12')
  expect(costText(0.004, true)).toBe('Session cost under $0.01')
})

test('the cost takes room: a width that fits the windows alone narrows with it', () => {
  const pieces = WINDOWS.map(w => pieceOf(w, NOW))
  // Full without cost: label + 2 windows; find the narrowest width that still fits it.
  let fits = 1
  while (layoutOf(pieces, fits) !== 'full') fits++
  expect(layoutOf(pieces, fits, 4.12)).toBe('compact')
  let compact = 1
  while (layoutOf(pieces, compact) === 'stacked') compact++
  expect(layoutOf(pieces, compact, 4.12)).toBe('stacked')
  expect(layoutOf([], 5, 4.12), 'the cost alone has one form').toBe('full')
})

/** usage-left's own children: their types and the text of each. */
const own = async (v: { find: (q: { key: string }) => Promise<unknown> }) => {
  const usage = (await v.find({ key: 'usage' })) as { children: { type: string; text?: string }[]; text: string } | undefined
  return usage && { types: usage.children.map(c => c.type), text: usage.text }
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`the cost in each layout (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    rig(on, WINDOWS, {}, 4.12)
    await $.session.start({ ...begin, surface } as never)
    const mount = (cols: number) => $.ui.mount({ plugin: 'usage-left', surface, component: 'AbovePrompt', props: band(cols) })
    const full = await own(await mount(200))
    expect(full?.text.endsWith('2h 10mSession cost $4.12'), 'full: labelled, last').toBe(true)
    expect(full?.text.startsWith('Usage left')).toBe(true)
    const compact = await own(await mount(52))
    expect(compact?.types).toEqual(['Box'])
    expect(compact?.text, 'compact: bare').toBe('7D 59% · 3d 9h5H 96% · 2h 10m$4.12')
    const stacked = await own(await mount(26))
    expect(stacked?.types, 'stacked: its own last line').toEqual(['Text', 'Text', 'Text'])
    expect(stacked?.text.endsWith('Session cost $4.12')).toBe(true)
  })

  test(`no windows: the cost alone, labelled (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    rig(on, [], {}, 4.12)
    await $.session.start({ ...begin, surface } as never)
    for (const cols of [200, 30, 10]) {
      const v = await $.ui.mount({ plugin: 'usage-left', surface, component: 'AbovePrompt', props: band(cols) })
      expect((await own(v))?.text, `${cols} columns`).toBe('Session cost $4.12')
      expect(await v.find({ text: 'Usage left' })).toBeUndefined()
    }
  })
}

test('every measurement carries the cost: up, down after /clear, and none leaves it', { timeoutMs: 30000 }, async ($, on) => {
  rig(on, WINDOWS, {}, 1)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  const text = async () =>
    (await own(await $.ui.mount({ plugin: 'usage-left', surface: 'terminal', component: 'AbovePrompt', props: band() })))?.text ?? ''
  expect(await text()).toMatch(/Session cost \$1\.00$/)
  const measure = (cost?: number) =>
    $.session.measure({ context: { window: 1_000_000 }, rateLimits: WINDOWS, changed: [], ...(cost === undefined ? {} : { cost: { usd: cost } }) } as never)
  await measure(2.5)
  expect(await text(), 'higher, though changed is empty').toMatch(/\$2\.50$/)
  await measure(0.1)
  expect(await text(), 'lower, as after /clear').toMatch(/\$0\.10$/)
  await measure()
  expect(await text(), 'no cost: unchanged').toMatch(/\$0\.10$/)
})

test('the minute tick reads the cost again', { timeoutMs: 30000 }, async ($, on) => {
  const { clock, setCost } = rig(on, WINDOWS, {}, 1)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  setCost(5)
  await clock.advance(61_000)
  const v = await $.ui.mount({ plugin: 'usage-left', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect((await own(v))?.text).toMatch(/Session cost \$5\.00$/)
})

test('no cost at the start: no cost piece, and none kept for the next chat', { timeoutMs: 30000 }, async ($, on) => {
  const { store } = rig(on)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  const v = await $.ui.mount({ plugin: 'usage-left', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /Session cost/ })).toBeUndefined()
  await $.session.measure({ context: { window: 1_000_000 }, rateLimits: WINDOWS, changed: ['rateLimits'], cost: { usd: 3 } } as never)
  expect(Object.keys(store), 'the store holds windows only').toEqual(['lastWindows'])
})
