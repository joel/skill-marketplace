import { expect, mock, test } from 'claude-code/testing'

import { cleanWhy, fitsRow, footerLabel, infoGlyph, infoLines, parsePick, stepDecision } from './level'

// The model request stream (turn.step) is checked live, not here: this build's test kit runs a
// test's turn.step hook but takes no answer from it. The decisions it makes are in ./level.

/** The `on` a test body is handed. */
type On = Parameters<NonNullable<Parameters<typeof test>[2]>>[1]

const HOME = '/Users/test'
const SHARED = `${HOME}/.claude/mods-state/effort-sid.json`
const BAND = { plugin: 'effort-optimizer', key: 'band' } as const
const OVERRIDE = { plugin: 'effort-optimizer', key: 'override' } as const

// ---------- The decisions ----------

test('the pick is read from the JSON reply; keep, unknown levels and prose give none', () => {
  expect(parsePick('{"level":"high","why":"checking facts"}'), 'a pick').toEqual({ level: 'high', why: 'checking facts' })
  expect(parsePick('Sure! {"level": "Extra high", "why": "a long hand-off"} done')?.level, 'Extra high reads as xhigh').toBe('xhigh')
  expect(parsePick('{"level":"keep","why":"an approval"}'), 'keep').toBeNull()
  expect(parsePick('{"level":"turbo"}'), 'unknown').toBeNull()
  expect(parsePick('no json here'), 'prose').toBeNull()
})

test('the reason is one plain line', () => {
  expect(cleanWhy('  "Quick rewrite — friendlier tone."  '), 'no dash, no quotes').toBe('Quick rewrite, friendlier tone')
  expect(cleanWhy('ready to ship it'), 'never the banned word').toBe('ready to publish it')
  expect(cleanWhy('x'.repeat(200)).length, 'short').toBe(90)
})

test('which effort a request goes out with', () => {
  const hold = { level: 'low', base: 'xhigh' } as const
  expect(stepDecision({ incoming: 'xhigh', hold: null, turnLevel: null, paused: false }), 'nothing held').toEqual({ release: false, send: null })
  expect(stepDecision({ incoming: 'xhigh', hold, turnLevel: null, paused: false }), 'held').toEqual({ release: false, send: 'low' })
  expect(stepDecision({ incoming: 'xhigh', hold: null, turnLevel: 'high', paused: false }), 'this turn').toEqual({ release: false, send: 'high' })
  expect(stepDecision({ incoming: 'high', hold: null, turnLevel: 'high', paused: false }), 'already there').toEqual({ release: false, send: null })
  // The person typed /effort medium: their own level carries the request, and the mod lets go.
  expect(stepDecision({ incoming: 'medium', hold, turnLevel: 'low', paused: false }), 'let go').toEqual({ release: true, send: null })
  expect(stepDecision({ incoming: 'xhigh', hold, turnLevel: null, paused: true }), 'paused').toEqual({ release: false, send: null })
})

test('a band row fits when it leaves the engine its last columns', () => {
  expect(fitsRow(70, 80), '70 in 80').toBe(true)
  expect(fitsRow(75, 80), '75 in 80').toBe(false)
  expect(fitsRow(500, 0), 'unknown width').toBe(true)
})

// ---------- The hooks, without a model request ----------

type Rig = { files: Record<string, string>; sets: { key: string; value: unknown }[]; touched: string[] }

function rig(on: On) {
  const r: Rig = { files: {}, sets: [], touched: [] }
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  mock.clock(on, { now: 1_000_000 })
  on('session.id', async () => ({ value: 'sid' }) as never)
  on('env.get', async ($, e) => ({ value: (e as { name: string }).name === 'HOME' ? HOME : undefined }) as never)
  on('config.list', async () => ({ value: [] }) as never)
  on('config.set', async ($, e) => {
    const { key, value } = e as { key: string; value: unknown }
    r.sets.push({ key, value })
    return { value } as never
  })
  on('fs.exists', async ($, e) => {
    const p = (e as { path: string }).path
    r.touched.push(p)
    return { value: p in r.files } as never
  })
  on('fs.read', async ($, e) => {
    const p = (e as { path: string }).path
    r.touched.push(p)
    return { value: r.files[p] ?? '' } as never
  })
  on('fs.write', async ($, e) => {
    const { path, text } = e as { path: string; text: string }
    r.files[path] = text
    return { value: undefined } as never
  })
  on('process.run', async ($, e) => {
    const { argv } = e as { argv: string[] }
    if (argv[0] === 'rm') for (const p of argv.slice(1)) delete r.files[p]
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  on('ui.render', async ($, e) => {
    const { Text } = $.ui.resolve(e)
    const modes = (e as { props?: { modes?: string[] } }).props?.modes
    return (<Text>{modes ? `MODES ${modes.join(' | ')}` : 'REST'}</Text>) as never
  })
  return r
}

const begin = { source: 'startup', cwd: '/Users/test/vault', isInteractive: true } as const
const band = (bodyColumns = 200) => ({ isWorking: false, hasSurvey: false, maxRows: 10, bodyColumns }) as never

test('/effort-optimizer auto and suggest write the mode to /config, its one home', { timeoutMs: 30000 }, async ($, on) => {
  const r = rig(on)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  const said = JSON.stringify(await $.command.run({ command: 'effort-optimizer', args: 'auto' } as never))
  expect(said, 'reply').toContain('auto')
  await $.command.run({ command: 'effort-optimizer', args: 'suggest' } as never)
  expect(r.sets, 'both written, nothing else').toEqual([
    { key: 'effort-optimizer.mode', value: 'auto' },
    { key: 'effort-optimizer.mode', value: 'suggest' },
  ])
  const info = JSON.stringify(await $.command.run({ command: 'effort-optimizer', args: '' } as never))
  expect(info, 'never your own setting').toContain('never changes your own effort setting')
  expect(info, 'names the picker').toContain('claude-sonnet-5-5')
  expect(info, 'no /mods').not.toContain('/mods')
  expect(r.touched.some(p => p.includes('/.claude/mods/')), 'no switches.json').toBe(false)
})

test('picker_model shows in the status', { timeoutMs: 30000, options: { picker_model: 'claude-haiku-5-5', mode: 'auto' } }, async ($, on) => {
  rig(on)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  const info = JSON.stringify(await $.command.run({ command: 'effort-optimizer', args: '' } as never))
  expect(info, 'Haiku').toContain('claude-haiku-5-5')
  expect(info, 'auto from /config').toContain('mode: auto (set in /config)')
})

test('/effort-optimizer off pauses it in this chat only, and removes the shared file', { timeoutMs: 30000 }, async ($, on) => {
  const r = rig(on)
  r.files[SHARED] = '{"level":"low"}\n'
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  const said = JSON.stringify(await $.command.run({ command: 'effort-optimizer', args: 'off' } as never))
  expect(said, 'paused in this chat').toContain('paused in this chat')
  expect(said, 'the lasting way').toContain('/plugin disable effort-optimizer')
  expect(SHARED in r.files, 'removed').toBe(false)
  expect(r.sets, 'nothing written to /config').toEqual([])
  const on2 = JSON.stringify(await $.command.run({ command: 'effort-optimizer', args: 'on' } as never))
  expect(on2, 'on again').toContain('is on')
})

// The drawing itself is checked live: this build's test $ has no state noun to seed the band with.

test('the terminal and the apps each get their own words', () => {
  expect(infoGlyph('terminal'), 'a narrow glyph in the terminal').toBe('i')
  expect(infoGlyph('desktop'), 'the app glyph').toBe('ⓘ')
  const term = infoLines('low', 'xhigh', 'terminal').join(' ')
  expect(term, 'the terminal indicator').toContain('effort shown above the prompt')
  expect(term, 'their own level').toContain('(Extra high)')
  expect(term, 'no app menu').not.toContain('menu next to the model name')
  expect(infoLines('low', 'xhigh', 'desktop').join(' '), 'the app menu').toContain('menu next to the model name')
  expect(footerLabel('xhigh'), 'the footer').toBe('Effort XHigh')
})
