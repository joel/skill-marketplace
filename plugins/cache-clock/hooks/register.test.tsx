import { expect, mock, test } from 'claude-code/testing'

import { coldUsd, usd, warmUsd } from './price'
import { ttlFromTail } from './ttl'

/** The `on` a test body is handed. */
type On = Parameters<NonNullable<Parameters<typeof test>[2]>>[1]

const HOME = '/Users/test'
const TRANSCRIPT = `${HOME}/.claude/projects/-Users-test-vault/sid.jsonl`
const REQUEST = `${HOME}/.claude/handoffs/.request-sid`

/** One transcript row of a main-thread reply that wrote `n` tokens to the `ttl` cache. */
const reply = (ttl: '5m' | '1h', n = 2000, sidechain = false) =>
  JSON.stringify({
    type: 'assistant',
    isSidechain: sidechain,
    message: { usage: { cache_creation: { ephemeral_5m_input_tokens: ttl === '5m' ? n : 0, ephemeral_1h_input_tokens: ttl === '1h' ? n : 0 } } },
  })
/** A tail as `tail -c` gives it: it starts inside a line. */
const tailOf = (...rows: string[]) => ['nt","isSidechain":false}', ...rows].join('\n')

type Rig = {
  files: Record<string, string>
  store: Record<string, unknown>
  /** What `tail -c` prints; null: no transcript on disk. */
  transcript: string | null
  forks: string[]
  toasts: string[]
  ran: string[][]
  forkUsage: { cache_read_input_tokens: number; cache_creation_input_tokens: number }
}

/** Mocks every $ call the mod makes; the disk is `files`, the chat's transcript `transcript`. */
function rig(on: On, seed: Partial<Rig> = {}) {
  const r: Rig = {
    files: {},
    store: {},
    transcript: tailOf(reply('5m')),
    forks: [],
    toasts: [],
    ran: [],
    forkUsage: { cache_read_input_tokens: 182_000, cache_creation_input_tokens: 0 },
    ...seed,
  }
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('turn.start', async () => ({ turnId: 't1' }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  const clock = mock.clock(on, { now: 1_000_000 })
  on('session.id', async () => ({ value: 'sid' }) as never)
  on('env.get', async ($, e) => ({ value: (e as { name: string }).name === 'HOME' ? HOME : undefined }) as never)
  on('session.usage', async () => ({ value: { context: { tokens: 182_000, window: 1_000_000 } } }) as never)
  on('fs.list', async ($, e) =>
    ({ value: (e as { path: string }).path === `${HOME}/.claude/projects` ? [{ name: 'other', kind: 'dir' }, { name: '-Users-test-vault', kind: 'dir' }] : [] }) as never,
  )
  on('fs.exists', async ($, e) => {
    const p = (e as { path: string }).path
    return { value: p === TRANSCRIPT ? r.transcript !== null : p in r.files } as never
  })
  on('fs.read', async ($, e) => ({ value: r.files[(e as { path: string }).path] ?? '' }) as never)
  on('fs.write', async ($, e) => {
    const { path, text } = e as { path: string; text: string }
    r.files[path] = text
    return { value: undefined } as never
  })
  on('process.run', async ($, e) => {
    const { argv } = e as { argv: string[] }
    r.ran.push(argv)
    if (argv[0] === 'rm') for (const path of argv.slice(1)) delete r.files[path]
    const stdout = argv[0] === 'tail' ? (r.transcript ?? '') : ''
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  on('store.get', async ($, e) => ({ value: r.store[(e as { key: string }).key] }) as never)
  on('store.set', async ($, e) => {
    const { key, value } = e as { key: string; value: unknown }
    r.store[key] = value
    return { value: undefined } as never
  })
  on('ui.toast', async ($, e) => {
    r.toasts.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('model.fork', async ($, e) => {
    r.forks.push((e as { prompt: string }).prompt)
    return { value: { isAnswered: true, text: 'ok', usage: { input_tokens: 12, output_tokens: 1, ...r.forkUsage } } } as never
  })
  on('prompt.submit', async ($, e) => ({ text: (e as { text: string }).text }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('classic.SessionStart', async () => ({}) as never)
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>REST</Text>
  })
  return { r, clock }
}

const band = (bodyColumns = 200, maxRows = 10) => ({ isWorking: false, hasSurvey: false, maxRows, bodyColumns }) as never
const begin = { source: 'startup', cwd: '/Users/test/vault', isInteractive: true } as const

for (const surface of ['desktop', 'terminal'] as const) {
  test(`counts down, goes cold, offers a handoff on a big chat (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    // An older version saved the 60 s demo for every chat; a new chat must not use it.
    const { r, clock } = rig(on, { store: { demo: true } })
    await $.session.start({ ...begin, surface } as never)

    let v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props: band() })
    expect(await v.find({ key: 'hide' }), 'nothing before the first reply').toBeUndefined()

    await $.turn.complete({ answer: '' } as never)
    await clock.settle()
    await clock.advance(30_000)
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props: band() })
    expect(await v.find({ text: /Cache\ warm/ }), 'warm with time left').toBeDefined()
    expect(await v.find({ text: /4:30/ }), '4:30 left after 30 s of a 5 min cache').toBeDefined()
    expect(await v.find({ text: /5 min cache, as Anthropic's last reply set it/ }), 'read from the transcript').toBeDefined()
    expect(r.ran.find(a => a[0] === 'tail'), 'the transcript tail, no python').toEqual(['tail', '-c', '3000000', TRANSCRIPT])
    expect(r.ran.some(a => a[0] === 'python3'), 'no python3').toBe(false)
    expect(r.store.demo, 'the old demo setting is cleared').toBe(false)
    expect(await v.find({ key: 'handoff' }), 'no handoff while warm').toBeUndefined()

    await clock.advance(5 * 60_000)
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props: band() })
    expect(await v.find({ text: /Cache\ cold/ }), 'cold after 5 min').toBeDefined()
    expect(await v.find({ text: /182k tokens/ }), '182k tokens').toBeDefined()
    await v.press({ key: 'handoff' })
    expect(REQUEST in r.files, 'handoff request file written').toBe(true)

    await v.press({ key: 'hide' })
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props: band() })
    expect(await v.find({ key: 'hide' }), 'hidden').toBeUndefined()
    expect(Object.keys(r.files).filter(k => k.includes('/.claude/mods/')), 'no switches file').toEqual([])
    expect(r.toasts.join(' '), 'the toast names the way back').toContain('/cacheclock')

    // A new reply does not bring it back in this chat: only /cacheclock does.
    await $.turn.complete({ answer: '' } as never)
    await clock.settle()
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props: band() })
    expect(await v.find({ text: /Cache\ warm/ }), 'still hidden after a reply').toBeUndefined()
    expect(await v.find({ text: 'REST' }), 'other bands still draw').toBeDefined()
    const said = JSON.stringify(await $.command.run({ command: 'cacheclock', args: '' } as never))
    expect(said, 'show reply').toContain('Cache Clock is on')
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props: band() })
    expect(await v.find({ text: /Cache\ warm/ }), 'shown by the command').toBeDefined()
  })
}

test('the countdown starts at the last request, not at the end of the reply', { timeoutMs: 30000 }, async ($, on) => {
  const { clock } = rig(on)
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [] } as never
  })
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.turn.start({ turnId: 't1', text: 'hi' } as never)
  await clock.advance(10_000)
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'opus', messageCount: 1 } as never));
  // A helper's request does not touch the main chat's cache.
  await clock.advance(20_000)
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'opus', messageCount: 1, agentId: 'a1' } as never));
  // Nor does a subagent's turn starting before the main one ends.
  await $.turn.start({ turnId: 't2', text: 'task', agentId: 'a2' } as never)
  // The reply then takes 90 s to finish.
  await clock.advance(90_000)
  await $.turn.complete({ answer: '' } as never)
  await clock.settle()
  const v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /3:10/ }), '5:00 less the 110 s since the main request').toBeDefined()
})

test('a resumed chat shows its clock at once: warm with the time left, or cold with the engine\'s price', { timeoutMs: 30000 }, async ($, on) => {
  rig(on)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 180, context_tokens: 120_000, transcript_path: TRANSCRIPT } as never)
  let v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /2:00/ }), '5 min cache, 3 min ago').toBeDefined()

  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 7200, context_tokens: 120_000, estimated_cache_write_usd: 0.6, transcript_path: TRANSCRIPT } as never)
  v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /Cache\ cold/ })).toBeDefined()
  expect(await v.find({ text: /re-reads 120k tokens at full cost \(about \$0\.60\)/ }), 'the engine\'s estimate').toBeDefined()

  // A resume the engine gives no age for drops the old clock rather than showing it.
  await $.classic.SessionStart({ source: 'resume', transcript_path: TRANSCRIPT } as never)
  v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ key: 'hide' }), 'no clock').toBeUndefined()
})

for (const source of ['clear', 'compact'] as const) {
  test(`/${source} drops the clock until the next reply`, { timeoutMs: 30000 }, async ($, on) => {
    const { clock } = rig(on)
    await $.session.start({ ...begin, surface: 'terminal' } as never)
    await $.turn.complete({ answer: '' } as never)
    await clock.settle()
    await $.classic.SessionStart({ source } as never)
    let v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
    expect(await v.find({ key: 'hide' }), 'no clock').toBeUndefined()
    expect(await v.find({ text: 'REST' }), 'other bands still draw').toBeDefined()
    await $.turn.complete({ answer: '' } as never)
    await clock.settle()
    v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
    expect(await v.find({ text: /Cache\ warm/ }), 'back after a reply').toBeDefined()
  })
}

/** Rounded to a hundredth of a cent, so float noise does not fail the test. */
const r4 = (n: number | null) => (n === null ? null : Math.round(n * 10_000) / 10_000)

test('prices: a cache read while warm, a 1.25x or 2x write once cold, nothing for an unlisted model', () => {
  expect(r4(warmUsd('claude-opus-5-5', 182_000))).toBe(0.0364)
  expect(r4(coldUsd('claude-opus-5-5', 182_000, 5 * 60_000))).toBe(0.91)
  expect(r4(coldUsd('claude-opus-5-5[1m]', 182_000, 60 * 60_000)), '1 hour cache, long-context id').toBe(1.456)
  expect(r4(coldUsd('claude-fable-5-1', 1_000_000, 60 * 60_000))).toBe(20)
  expect(r4(warmUsd('claude-haiku-5-5', 50_000)), 'Haiku under 100K').toBe(0.0005)
  expect(r4(coldUsd('claude-haiku-5-5', 200_000, 5 * 60_000)), 'Haiku over 100K').toBe(0.125)
  expect(warmUsd('claude-opus-5', 182_000), 'an older model is not priced').toBeNull()
  expect(warmUsd('claude-opus-5-5', 0), 'no tokens, no price').toBeNull()
  expect(usd(0.0036)).toBe('under $0.01')
  expect(usd(0.91)).toBe('$0.91')
})

test('a priced model shows dollars, warm then cold', { timeoutMs: 30000 }, async ($, on) => {
  const { clock } = rig(on)
  on('session.model', async () => ({ value: 'claude-opus-5-5' }) as never)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.turn.complete({ answer: '' } as never)
  await clock.settle()
  let v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /182k tokens cost about \$0\.04, not \$0\.91/ }), 'warm').toBeDefined()
  await clock.advance(6 * 60_000)
  v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /re-reads 182k tokens at full cost \(about \$0\.91\)/ }), 'cold').toBeDefined()

  // After a resume the engine's estimate is the full price on both lines.
  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 60, context_tokens: 182_000, estimated_cache_write_usd: 1.5, model: 'claude-opus-5-5', transcript_path: TRANSCRIPT } as never)
  v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /cost about \$0\.04, not \$1\.50/ }), 'warm uses the engine estimate').toBeDefined()
})

test('the app spaces the band rows so its buttons do not sit on the text; the terminal does not', { timeoutMs: 30000 }, async ($, on) => {
  const { clock } = rig(on)
  for (const [surface, gap] of [['desktop', 'xs'], ['terminal', 0]] as const) {
    await $.session.start({ ...begin, surface } as never)
    await $.turn.complete({ answer: '' } as never)
    await clock.settle()
    for (const cols of [200, 80]) {
      const v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props: band(cols) })
      const b = (await v.find({ key: 'band' })) as { props: { gap?: number | string } } | undefined
      expect(b?.props.gap, `${surface} at ${cols} columns`).toBe(gap)
    }
  }
})

test('/cacheclock hide hides it in this chat and stops keep warm', { timeoutMs: 30000 }, async ($, on) => {
  const { r, clock } = rig(on)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.turn.complete({ answer: '' } as never)
  await clock.settle()
  await $.command.run({ command: 'keepwarm', args: '' } as never)
  const said = JSON.stringify(await $.command.run({ command: 'cacheclock', args: 'hide' } as never))
  expect(said, 'hide reply').toContain('hidden in this chat')
  expect(said, 'names the way back').toContain('/cacheclock')
  expect(said, 'no /mods').not.toContain('/mods')
  expect(r.toasts.join(' '), 'keep warm stopped').toContain('Keep warm stopped')
  await clock.advance(10 * 60_000)
  expect(r.forks, 'no ping while hidden').toEqual([])
})

test('the cache length comes from the last main-thread reply in the transcript tail', () => {
  expect(ttlFromTail(tailOf(reply('5m'), reply('1h'))), 'the last reply wins').toBe('1h')
  expect(ttlFromTail(tailOf(reply('1h'), reply('5m'))), 'the last reply wins').toBe('5m')
  expect(ttlFromTail(tailOf(reply('5m'), reply('1h', 900, true))), 'a subagent row is skipped').toBe('5m')
  expect(ttlFromTail(tailOf(reply('1h'), reply('5m', 0))), 'a reply that wrote nothing is skipped').toBe('1h')
  expect(ttlFromTail(tailOf('{"type":"user"}', 'not json "assistant"')), 'nothing to go on').toBe('unknown')
  // The first line of a tail is cut: a full reply row there is not read.
  expect(ttlFromTail(reply('1h')), 'the first line is dropped').toBe('unknown')
})

test('the transcript path comes from the Stop hook when the engine gives it', { timeoutMs: 30000 }, async ($, on) => {
  const { r, clock } = rig(on, { transcript: tailOf(reply('1h')) })
  const classic = $.classic as unknown as { Stop: (input: Record<string, unknown>) => Promise<unknown> }
  on('classic.Stop', async () => ({}) as never)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await classic.Stop({ stop_hook_active: false, transcript_path: '/elsewhere/sid.jsonl' })
  await $.turn.complete({ answer: '' } as never)
  await clock.settle()
  const tails = r.ran.filter(a => a[0] === 'tail').map(a => a[3])
  expect(tails[tails.length - 1], 'the engine path is read').toBe('/elsewhere/sid.jsonl')
  const v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /1 hour cache/ }), 'a 1 hour cache').toBeDefined()
})

test('no transcript: the clock says its 5 min length is a guess', { timeoutMs: 30000 }, async ($, on) => {
  const { clock } = rig(on, { transcript: null })
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.turn.complete({ answer: '' } as never)
  await clock.settle()
  const v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /a guess until the first reply/ }), 'the guess is said').toBeDefined()
})

test('a handoff request nobody takes says the handoff mod is not running', { timeoutMs: 30000 }, async ($, on) => {
  const { r, clock } = rig(on)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.command.run({ command: 'cacheclock', args: 'demo' } as never)
  await $.turn.complete({ answer: '' } as never)
  await clock.settle()
  await clock.advance(61_000)
  let v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  await v.press({ key: 'handoff' })
  expect(REQUEST in r.files, 'asked').toBe(true)
  await clock.advance(8_000)
  await clock.settle()
  expect(REQUEST in r.files, 'the stale request is removed').toBe(false)
  v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /Handoff isn't running: install handoff@joel-skills/ }), 'says so').toBeDefined()
})

test('a handoff request the handoff mod takes leaves no warning', { timeoutMs: 30000 }, async ($, on) => {
  const { r, clock } = rig(on)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.command.run({ command: 'cacheclock', args: 'demo' } as never)
  await $.turn.complete({ answer: '' } as never)
  await clock.settle()
  await clock.advance(61_000)
  let v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  await v.press({ key: 'handoff' })
  // The handoff mod picks the file up.
  delete r.files[REQUEST]
  await clock.advance(8_000)
  await clock.settle()
  v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band() })
  expect(await v.find({ text: /isn't running/ }), 'no warning').toBeUndefined()
  expect(await v.find({ text: /Watch the Refresh panel/ }), 'the asked note stays').toBeDefined()
})

for (const surface of ['desktop', 'terminal'] as const) {
  test(`a narrow band splits into rows that fit, with the buttons on their own row (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const { clock } = rig(on)
    await $.session.start({ ...begin, surface } as never)
    await $.turn.complete({ answer: '' } as never)
    await clock.settle()
    const v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props: band(80) })
    expect(await v.find({ text: /Cache\ warm/ }), 'the clock').toBeDefined()
    expect(await v.find({ text: /5 min cache$/ }), 'the short label').toBeDefined()
    expect(await v.find({ text: /as Anthropic's last reply set it/ }), 'no long label').toBeUndefined()
    expect(await v.find({ text: /^Reply now and 182k tokens cost 5 to 10% as much\.$/ }), 'the cost on its own row').toBeDefined()
    expect(await v.find({ text: /Each ping reads the chat from cache/ }), 'no tip when narrow and not warming').toBeUndefined()
    expect(await v.find({ key: 'keepwarm' }), 'the buttons').toBeDefined()
    const bar = await v.find({ text: /^━+$/ })
    expect(bar, 'a bar').toBeDefined()

    // Keeping warm, the tip comes back.
    await v.press({ key: 'keepwarm' })
    const w = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props: band(80) })
    expect(await w.find({ text: /Each ping reads the chat from cache/ }), 'tip while warming').toBeDefined()
  })
}

test('a short band drops the cost line and the tip first', { timeoutMs: 30000 }, async ($, on) => {
  const { clock } = rig(on)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.turn.complete({ answer: '' } as never)
  await clock.settle()
  const v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band(80, 3) })
  expect(await v.find({ text: /Cache\ warm/ }), 'the clock').toBeDefined()
  expect(await v.find({ text: /Reply now and/ }), 'no cost row').toBeUndefined()
  expect(await v.find({ key: 'keepwarm' }), 'the buttons').toBeDefined()
})

for (const surface of ['desktop', 'terminal'] as const) {
  test(`keep warm: the button turns it on, a ping fires before expiry, a prompt stops it (${surface})`, { timeoutMs: 60000 }, async ($, on) => {
    const { r, clock } = rig(on)
    const props = band(200)
    await $.session.start({ ...begin, surface } as never)
    await $.turn.complete({ answer: '' } as never)
    await clock.settle()

    let v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props })
    expect(await v.find({ text: /Each ping reads the chat from cache/ }), 'the tip line shows').toBeDefined()
    expect(await v.find({ text: /\$/ }), 'no money amounts').toBeUndefined()
    await v.press({ key: 'keepwarm' })
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props })
    expect(await v.find({ text: /Keeping warm · first ping in 4:15/ }), 'on, first ping 45 s before the end').toBeDefined()

    // 4 min in: 60 s left, still too early.
    await clock.advance(4 * 60_000)
    expect(r.forks.length, 'no ping with 60 s left').toBe(0)
    // 45 s before the end: one ping, with the tiny prompt.
    await clock.advance(16_000)
    await clock.settle()
    expect(r.forks.length, 'one ping before expiry').toBe(1)
    expect(r.forks[0], 'the tiny prompt').toBe('Reply with the single word: ok')
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props })
    expect(await v.find({ text: /Keeping warm · ping 1 · next in 4:1\d · last ping read 182k cached tokens/ }), 'band after the ping').toBeDefined()
    expect(await v.find({ text: /Cache warm/ }), 'the clock went back to a full cache').toBeDefined()
    expect(await v.find({ text: /4:[45]\d/ }), 'close to 5:00 left again').toBeDefined()
    expect(r.files[`${HOME}/.claude/mods-logs/cache-clock.log`] ?? '', 'the ping is logged under HOME').toContain('ping 1: cache read 182000, cache write 0, error none')

    // The next ping comes one cycle later: about 4:15 after the first.
    await clock.advance(4 * 60_000 + 16_000)
    await clock.settle()
    expect(r.forks.length, 'a second ping one cycle later').toBe(2)

    // Its own command does not stop it; a real prompt does.
    await $.prompt.submit({ text: '/keepwarm' } as never)
    await clock.settle()
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props })
    expect(await v.find({ text: /Keeping warm/ }), 'still on after its own command').toBeDefined()
    await $.prompt.submit({ text: 'back again' } as never)
    await clock.settle()
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props })
    expect(await v.find({ text: /Keeping warm/ }), 'stopped by a prompt').toBeUndefined()
    expect(r.toasts.join(' '), 'the toast says why').toContain('you sent a message')
    await clock.advance(10 * 60_000)
    expect(r.forks.length, 'no more pings once stopped').toBe(2)
  })
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`keep warm stops by itself after 30 pings, and says when the cache had gone cold (${surface})`, { timeoutMs: 120000 }, async ($, on) => {
    const { r, clock } = rig(on)
    const props = band(200)
    await $.session.start({ ...begin, surface } as never)
    // The 60 s demo cache pings every 15 s, so 30 pings fit well inside the 2 hour cap.
    await $.command.run({ command: 'cacheclock', args: 'demo' } as never)
    const early = JSON.stringify(await $.command.run({ command: 'keepwarm', args: '' } as never))
    expect(early, 'nothing to keep warm before the first reply').toContain('Nothing to keep warm yet')
    await $.turn.complete({ answer: '' } as never)
    await clock.settle()
    const said = JSON.stringify(await $.command.run({ command: 'keepwarm', args: '' } as never))
    expect(said, '/keepwarm turns it on').toContain('Keep warm is on')

    // A cache write in place of a read is said plainly.
    r.forkUsage = { cache_read_input_tokens: 0, cache_creation_input_tokens: 182_000 }
    for (let i = 0; i < 16; i++) await clock.advance(1000)
    await clock.settle()
    expect(r.forks.length, 'first ping').toBe(1)
    let v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props })
    expect(await v.find({ text: /the cache had gone cold, so ping 1 wrote 182k tokens to it again/ }), 'cold write said plainly').toBeDefined()
    r.forkUsage = { cache_read_input_tokens: 182_000, cache_creation_input_tokens: 0 }

    for (let i = 0; i < 600 && r.forks.length < 31; i++) await clock.advance(1000)
    await clock.settle()
    expect(r.forks.length, 'exactly 30 pings').toBe(30)
    expect(r.toasts.join(' '), 'the stop toast names the cap').toContain('after 30 pings')
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props })
    expect(await v.find({ text: /Keeping warm/ }), 'off after the cap').toBeUndefined()
    expect(await v.find({ key: 'keepwarm' }), 'the button is back to Keep warm').toBeDefined()

    // /keepwarm toggles; /keepwarm off stops it.
    await $.command.run({ command: 'keepwarm', args: '' } as never)
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props })
    expect(await v.find({ text: /Keeping warm/ }), 'on again').toBeDefined()
    const offSaid = JSON.stringify(await $.command.run({ command: 'keepwarm', args: 'off' } as never))
    expect(offSaid, '/keepwarm off').toContain('Keep warm is off')
    v = await $.ui.mount({ plugin: 'cache-clock', surface, component: 'AbovePrompt', props })
    expect(await v.find({ text: /Keeping warm/ }), 'off by the command').toBeUndefined()
  })
}

test('a band whose one row would wrap at 160 columns splits instead', { timeoutMs: 30000 }, async ($, on) => {
  // A 1 hour cache has the longest label: its one row and buttons need about 165 columns.
  const { clock } = rig(on, { transcript: tailOf(reply('1h')) })
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.turn.complete({ answer: '' } as never)
  await clock.settle()
  let v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band(160) })
  expect(await v.find({ text: /1 h cache$/ }), 'three rows at 160').toBeDefined()
  v = await $.ui.mount({ plugin: 'cache-clock', surface: 'terminal', component: 'AbovePrompt', props: band(200) })
  expect(await v.find({ text: /1 hour cache, as Anthropic's last reply set it/ }), 'one row at 200').toBeDefined()
})
