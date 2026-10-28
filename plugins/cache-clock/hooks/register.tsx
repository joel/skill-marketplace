import type { EngineInterface, ModelForkResult, Register } from 'claude-code'

import type { Clock, Warm } from '../types'
import { TAIL_BYTES, ttlFromTail } from './ttl'

const CLOCK = { plugin: 'cache-clock', key: 'clock' } as const
const WARM = { plugin: 'cache-clock', key: 'warm' } as const
const HIDDEN = { plugin: 'cache-clock', key: 'hidden' } as const

const FIVE_MIN = 5 * 60_000
const ONE_HOUR = 60 * 60_000
const DEMO_MS = 60_000
// A cold chat this big gets the handoff button: re-reading it costs the most.
const BIG = 150_000
const BAR = 20
const MIN_BAR = 8
// The handoff mod takes a request within 5 s; one still there after this means it is not running.
const HANDOFF_WAIT_MS = 7_000

// Keep warm: one small background ping about 45 s before the cache would go cold.
// $.model.fork repeats the main thread's last request (same model, system prompt,
// tools, messages) with this one line after it, so the API reads the chat from its
// cache and the cache's timer starts again. The fork never writes the transcript.
const LEAD = 45_000
const MAX_PINGS = 30
const MAX_MS = 2 * 60 * 60_000
const MAX_FAILS = 3
const RETRY_MS = 20_000
const PING_PROMPT = 'Reply with the single word: ok'
const TIP = 'Each ping reads the chat from cache for a small part of the price (5 to 10%). Letting it go cold means writing it all again.'
// Turns that are not the person typing: they do not count as "they are back".
const BACKGROUND = new Set(['task-notification', 'scheduled-trigger', 'peer', 'peer-send-message', 'projects-relay', 'channel', 'coordinator', 'observer', 'observer-activity', 'auto-continuation'])

const GOOD = '#16a34a'
const WARN = '#ca8a04'
const BAD = '#dc2626'
const COLD = '#2563eb'

// Module variables reset on a reload; the clock itself lives in $.state.
let sid = ''
let home = ''
let demo = false
let detected: 'unknown' | '5m' | '1h' = 'unknown'
let working = false
let pinging = false
// When this turn's last main-thread request started: the cache's hour or 5 minutes count from it,
// not from the end of the reply. 0 until a step of this turn has been seen.
let stepAt = 0

// Hide (its button or /cacheclock hide) hides the clock in this chat; /cacheclock shows it.
// Kept in $.state so a reload keeps it. A lasting "off" is /plugin disable cache-clock.
let hidden = false
// The chat's transcript, from the engine's Stop hook, else found once under ~/.claude/projects.
let transcriptPath = ''

async function redraw($: EngineInterface) {
  try {
    const c = await getClock($)
    if (c) await setClock($, { ...c, now: await $.clock.now() })
    $.ui.invalidate('ui.render')
  } catch {
    // The next tick redraws anyway.
  }
}

async function setHidden($: EngineInterface, value: boolean) {
  hidden = value
  await $.state.set(HIDDEN, hidden)
  if (value) await stopWarm($, 'Keep warm stopped: Cache Clock is hidden.')
  await redraw($)
}

const short = (tokens: number) => `${Math.round(tokens / 1000)}k`
/** "at full cost", with the engine's price when it gave one (after a resume). */
const fullCost = (c: Clock) => (c.usd ? `at full cost (about $${c.usd.toFixed(2)})` : 'at full cost')
const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const ago = (ms: number) => {
  const m = Math.floor(ms / 60_000)
  return m < 1 ? 'just now' : m === 1 ? '1 min ago' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`
}

/** Where the cache length comes from: Anthropic's own reply, the demo, or a guess before the first reply. */
function lengthLabel(c: Clock) {
  if (c.ttlSource === 'demo') return '60 s demo cache, this chat only'
  if (c.ttlSource === 'detected') return `${c.ttlMs === ONE_HOUR ? '1 hour' : '5 min'} cache, as Anthropic's last reply set it`
  return '5 min cache, a guess until the first reply'
}

/** The length label in a few words, for a narrow band. */
function shortLabel(c: Clock) {
  if (c.ttlSource === 'demo') return '60 s demo'
  if (c.ttlSource === 'detected') return c.ttlMs === ONE_HOUR ? '1 h cache' : '5 min cache'
  return '5 min cache (a guess)'
}

function ttl(): { ttlMs: number; ttlSource: Clock['ttlSource'] } {
  if (demo) return { ttlMs: DEMO_MS, ttlSource: 'demo' }
  if (detected === '1h') return { ttlMs: ONE_HOUR, ttlSource: 'detected' }
  if (detected === '5m') return { ttlMs: FIVE_MIN, ttlSource: 'detected' }
  return { ttlMs: FIVE_MIN, ttlSource: 'default' }
}

async function getClock($: EngineInterface): Promise<Clock | null> {
  const { value } = await $.state.get(CLOCK)
  return value ?? null
}

async function setClock($: EngineInterface, c: Clock | null) {
  await $.state.set(CLOCK, c)
}

async function getWarm($: EngineInterface): Promise<Warm | null> {
  const { value } = await $.state.get(WARM)
  return value ?? null
}

async function setWarm($: EngineInterface, w: Warm | null) {
  await $.state.set(WARM, w)
  try {
    $.ui.invalidate('ui.render')
  } catch {
    // The next tick redraws anyway.
  }
}

function toast($: EngineInterface, text: string) {
  try {
    $.ui.toast(text)
  } catch {
    // The toast is only a hint.
  }
}

// Turns keep warm on. 'none' when there is no reply yet whose cache could be kept.
async function startWarm($: EngineInterface): Promise<'on' | 'none'> {
  const c = await getClock($)
  if (!c || !c.lastEnd) return 'none'
  // Keep warm never runs out of sight: it shows the clock first.
  if (hidden) await setHidden($, false)
  await setWarm($, { startedAt: await $.clock.now(), pings: 0, read: 0, write: 0, cold: false, error: '', sending: false, failures: 0, retryAt: 0 })
  await log($, `keep warm on (${c.ttlMs / 1000} s cache, ${short(c.tokens)} tokens)`)
  return 'on'
}

async function stopWarm($: EngineInterface, why: string, shout = true) {
  const w = await getWarm($)
  if (!w) return
  await setWarm($, null)
  await log($, `keep warm off after ${w.pings} pings: ${why}`)
  if (shout) toast($, why)
}

// Once a second: sends the ping when the cache is 45 s from going cold, and keeps the caps.
async function warmTick($: EngineInterface) {
  const w = await getWarm($)
  if (!w || pinging || working) return
  const now = await $.clock.now()
  if (now - w.startedAt >= MAX_MS) return stopWarm($, 'Keep warm stopped after 2 hours. Type /keepwarm to start it again.')
  if (w.pings >= MAX_PINGS) return stopWarm($, `Keep warm stopped after ${MAX_PINGS} pings. Type /keepwarm to start it again.`)
  if (now < w.retryAt) return
  const c = await getClock($)
  if (!c || !c.lastEnd) return
  if (c.lastEnd + c.ttlMs - now > LEAD) return
  pinging = true
  void ping($, now).catch(async err => {
    pinging = false
    await log($, `ping failed: ${String(err)}`)
  })
}

async function ping($: EngineInterface, start: number) {
  const w0 = await getWarm($)
  if (w0) await setWarm($, { ...w0, sending: true })
  let r: ModelForkResult | null = null
  let thrown = ''
  try {
    r = await $.model.fork({ prompt: PING_PROMPT })
  } catch (err) {
    thrown = String(err)
  }
  pinging = false
  const n = (w0?.pings ?? 0) + 1
  if (r && !r.isAnswered && r.reason === 'nothing-to-fork') {
    await log($, `ping ${n}: nothing to fork yet`)
    return stopWarm($, 'Keep warm stopped: there is no reply to keep warm yet.')
  }
  const usage = r && 'usage' in r ? r.usage : null
  const read = usage?.cache_read_input_tokens ?? 0
  const write = usage?.cache_creation_input_tokens ?? 0
  // An answer, or a reply with no words, still read the chat: the cache timer restarted.
  const ok = r !== null && (r.isAnswered || r.reason === 'empty-reply')
  const error = ok ? '' : thrown ? 'error' : r && !r.isAnswered && r.reason === 'api-error' ? `${r.error}${r.status ? ` ${r.status}` : ''}` : r && !r.isAnswered ? r.reason : 'error'
  await log($, `ping ${n}: cache read ${read}, cache write ${write}, error ${error || 'none'}${thrown ? ` (${thrown.slice(0, 200)})` : ''}`)
  const w = await getWarm($)
  // Stopped while the ping was out (a prompt, /keepwarm off): only the log keeps it.
  if (!w) return
  const now = await $.clock.now()
  if (ok) {
    await setWarm($, { ...w, pings: n, read, write, cold: write > read, error: '', sending: false, failures: 0, retryAt: 0 })
    const c = await getClock($)
    if (c) await setClock($, { ...c, lastEnd: Math.max(c.lastEnd, start), now })
  } else {
    const failures = w.failures + 1
    await setWarm($, { ...w, pings: n, error, sending: false, failures, retryAt: now + RETRY_MS })
    if (failures >= MAX_FAILS) return stopWarm($, `Keep warm stopped: ${MAX_FAILS} pings in a row failed (${error}).`)
  }
  if (n >= MAX_PINGS) await stopWarm($, `Keep warm stopped after ${MAX_PINGS} pings. Type /keepwarm to start it again.`)
}

function warmLine(w: Warm, left: number): string {
  const parts = ['Keeping warm']
  if (w.sending) parts.push(`sending ping ${w.pings + 1}`)
  else if (w.pings === 0) parts.push(`first ping in ${mmss(left - LEAD)}`)
  else parts.push(`ping ${w.pings}`, `next in ${mmss(left - LEAD)}`)
  if (w.error) parts.push(`last ping failed (${w.error}), trying again`)
  else if (w.pings > 0 && w.cold) parts.push(`the cache had gone cold, so ping ${w.pings} wrote ${short(w.write)} tokens to it again`)
  else if (w.pings > 0) parts.push(`last ping read ${short(w.read)} cached tokens`)
  return parts.join(' · ')
}

async function log($: EngineInterface, line: string) {
  if (!home) return
  try {
    const path = `${home}/.claude/mods-logs/cache-clock.log`
    const old = (await $.fs.exists(path)) ? String(await $.fs.read(path)) : ''
    const lines = old ? old.trimEnd().split('\n').slice(-200) : []
    lines.push(`${new Date(await $.clock.now()).toISOString()} ${sid.slice(0, 8)} ${line}`)
    await $.fs.write(path, `${lines.join('\n')}\n`)
  } catch {
    // The log must never break the clock.
  }
}

/** This chat's transcript: the path the engine gave, else ~/.claude/projects/<any>/<sid>.jsonl. */
async function findTranscript($: EngineInterface) {
  if (transcriptPath || !home || !sid) return transcriptPath
  const root = `${home}/.claude/projects`
  for (const d of await $.fs.list(root).catch(() => [])) {
    if (d.kind !== 'dir') continue
    const path = `${root}/${d.name}/${sid}.jsonl`
    if (await $.fs.exists(path).catch(() => false)) {
      // The Stop hook's path, should it land during the scan, wins.
      transcriptPath ||= path
      break
    }
  }
  return transcriptPath
}

// Reads which cache length this chat's replies were written with (5 min or 1 hour).
async function detect($: EngineInterface) {
  const path = await findTranscript($)
  if (!path) return
  const r = await $.process.run(['tail', '-c', String(TAIL_BYTES), path])
  if (r.exitCode !== 0) return log($, `ttl check failed: ${r.stderr.slice(0, 200)}`)
  const found = ttlFromTail(r.stdout)
  if (found !== 'unknown') detected = found
}

// A main-chat reply just ended: the cache is warm again from its last request, else from now.
async function restart($: EngineInterface) {
  // Read before any await: the next turn's start clears it.
  const at = stepAt
  stepAt = 0
  const now = await $.clock.now()
  const lastEnd = at || now
  const { context } = await $.session.usage()
  await detect($).catch(() => undefined)
  await setClock($, { lastEnd, ...ttl(), tokens: context.tokens ?? 0, now, note: '' })
}

// Once a second: moves the countdown while the band shows.
async function tick($: EngineInterface) {
  const c = await getClock($)
  if (!c || hidden || !c.lastEnd) return
  const now = await $.clock.now()
  // A cold clock only needs a redraw once a minute, for its "went cold" line.
  const cold = now - c.lastEnd >= c.ttlMs
  if (cold && Math.floor((now - c.lastEnd) / 60_000) === Math.floor((c.now - c.lastEnd) / 60_000) && c.now - c.lastEnd >= c.ttlMs) return
  await setClock($, { ...c, now })
}

async function setNote($: EngineInterface, note: string) {
  const c = await getClock($)
  if (c) await setClock($, { ...c, note })
}

async function handoff($: EngineInterface) {
  const c = await getClock($)
  const request = `${home}/.claude/handoffs/.request-${sid}`
  // The handoff mod picks this file up within 5 seconds.
  await $.fs.write(request, String(await $.clock.now()))
  await log($, `asked for a handoff at ${short(c?.tokens ?? 0)}`)
  await setNote($, 'Handoff asked for. Watch the Refresh panel.')
  // Nobody took it: the handoff mod is not running in this chat.
  $.clock.after(HANDOFF_WAIT_MS, () => {
    void (async () => {
      if (!(await $.fs.exists(request).catch(() => false))) return
      await $.process.run(['rm', '-f', request])
      await log($, 'handoff request not taken: the handoff mod is not running')
      await setNote($, "Handoff isn't running: install handoff@joel-skills.")
    })().catch(() => undefined)
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    sid = await $.session.id()
    home = (await $.env.get('HOME').catch(() => undefined)) ?? ''
    const { value: wasHidden = false } = await $.state.get(HIDDEN)
    hidden = wasHidden
    // The 60 s demo is for one chat only. Older versions saved it for every chat, so clear that.
    demo = false
    if ((await $.store.get('demo').catch(() => undefined)) === true) {
      await $.store.set('demo', false).catch(() => undefined)
      await log($, 'cleared a demo setting saved by an older version')
    }
    await $.command.register({
      name: 'cacheclock',
      description: 'Cache Clock: show or hide it. "/cacheclock hide" hides it, "/cacheclock demo" uses a 60 s cache for filming, "/cacheclock auto" goes back',
      argumentHint: '[hide|demo|auto]',
      immediate: true,
    })
    await $.command.register({
      name: 'keepwarm',
      description: 'Cache Clock: keep the cache warm with a small background ping 45 s before it goes cold. "/keepwarm off" stops it',
      argumentHint: '[off]',
      immediate: true,
    })
    $.clock.every(1000, () => {
      void tick($).catch(() => undefined)
      void warmTick($).catch(err => log($, `keep warm tick failed: ${String(err)}`))
    })
    void detect($).catch(() => undefined)
    return next(e)
  })

  // A resumed or forked chat starts with no clock: seed it from how long ago its last reply was.
  // A cleared or compacted chat sends a new prefix, so the old clock no longer applies.
  on('classic.SessionStart', async ($, e, next) => {
    const r = await next(e)
    if (e.source !== 'clear' && e.source !== 'compact' && e.source !== 'resume' && e.source !== 'fork') return r
    sid = await $.session.id()
    transcriptPath = typeof e.transcript_path === 'string' ? e.transcript_path : ''
    detected = 'unknown'
    stepAt = 0
    // The old chat's clock and keep warm never carry over, seeded or not.
    await stopWarm($, `Keep warm stopped: the chat was ${e.source === 'clear' ? 'cleared' : e.source === 'compact' ? 'compacted' : 'switched'}.`, false)
    await setClock($, null)
    if ((e.source === 'resume' || e.source === 'fork') && typeof e.seconds_since_last_response === 'number') {
      await detect($).catch(() => undefined)
      const now = await $.clock.now()
      const usd = e.estimated_cache_write_usd
      await setClock($, {
        lastEnd: now - e.seconds_since_last_response * 1000,
        ...ttl(),
        tokens: e.context_tokens ?? 0,
        now,
        note: '',
        ...(typeof usd === 'number' && usd > 0 ? { usd } : {}),
      })
    }
    $.ui.invalidate('ui.render')
    return r
  }).catch(($, e, next) => next(e)) // a clock that fails to seed never holds up the session

  // The engine's own answer to where this chat's transcript is.
  on('classic.Stop', async ($, e, next) => {
    if (typeof e.transcript_path === 'string' && e.transcript_path) transcriptPath = e.transcript_path
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    // Should the engine ever raise a turn for the ping's own fork, it is not the person's turn.
    if (!(pinging && e.text === PING_PROMPT)) working = true
    // A subagent starting mid-turn must not wipe the main thread's stamp.
    if (e.agentId === undefined) stepAt = 0
    return next(e)
  })

  // Each main-thread request reads or writes the cache, so the cache's timer starts at the request.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined && !pinging) stepAt = await $.clock.now()
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // A helper's turn does not touch the main chat's cache.
    if (e.agentId === undefined) {
      working = false
      void restart($).catch(err => log($, `restart failed: ${String(err)}`))
    }
    return result
  })

  // The person is back: a prompt of theirs ends keep warm. Its own commands do not.
  on('prompt.submit', async ($, e, next) => {
    const text = e.text.trim().toLowerCase()
    const own = text.startsWith('/keepwarm') || text.startsWith('/cacheclock') || text === PING_PROMPT.toLowerCase()
    if (!own && !BACKGROUND.has(e.origin?.kind ?? '')) {
      void stopWarm($, 'Keep warm stopped: you sent a message.').catch(() => undefined)
    }
    return next(e)
  })

  on('command.run', { command: 'keepwarm' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const w = await getWarm($)
    if (arg === 'off' || (arg !== 'on' && w)) {
      await stopWarm($, 'Keep warm is off.', false)
      return { text: 'Keep warm is off. Type /keepwarm to start it again.' }
    }
    if (w) return { text: 'Keep warm is already on. Type /keepwarm off to stop it.' }
    if ((await startWarm($)) === 'none') return { text: "Nothing to keep warm yet. Keep warm works after Claude's first reply." }
    return { text: 'Keep warm is on: one small background ping about 45 s before the cache goes cold. It stops after 2 hours, 30 pings, or when you send a message. Type /keepwarm off to stop it.' }
  })

  on('ui.press', { plugin: 'cache-clock', element: 'keepwarm' }, async ($, e) => {
    if (await getWarm($)) await stopWarm($, 'Keep warm is off.')
    else if ((await startWarm($)) === 'on') toast($, 'Keep warm is on. Type /keepwarm off to stop it.')
    return { element: e.element }
  })

  on('command.run', { command: 'cacheclock' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const hide = arg === 'hide' || (arg !== 'demo' && arg !== 'auto' && arg !== 'show' && !hidden)
    if (arg === 'demo' || arg === 'auto') {
      // This chat only: a new chat starts with the real cache length again.
      demo = arg === 'demo'
    }
    await setHidden($, hide)
    const c = await getClock($)
    if (c) await setClock($, { ...c, ...ttl(), now: await $.clock.now() })
    if (hide) return { text: 'Cache Clock hidden in this chat. Type /cacheclock to show it, or /plugin disable cache-clock to turn it off.' }
    const t = ttl()
    const how = lengthLabel({ ttlMs: t.ttlMs, ttlSource: t.ttlSource } as Clock)
    return { text: `Cache Clock is on: ${how}. Type /cacheclock hide to hide it.` }
  })

  on('ui.press', { plugin: 'cache-clock', element: 'handoff' }, async ($, e) => {
    await handoff($)
    return { element: e.element }
  })
  on('ui.press', { plugin: 'cache-clock', element: 'hide' }, async ($, e) => {
    const wasWarm = (await getWarm($)) !== null
    await stopWarm($, 'Keep warm stopped: Cache Clock is hidden.', false)
    await setHidden($, true)
    toast($, `Cache Clock hidden in this chat${wasWarm ? ' and keep warm stopped' : ''}. Type /cacheclock to show it.`)
    return { element: e.element }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const c = await getClock($)
    if (hidden || !c || !c.lastEnd || working || e.props.isWorking || e.props.hasSurvey) return next(e)
    // Claude Code's own placeholder draws nothing but would take a gap above the band.
    const drawn = await next(e)
    const rest = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null
    const { Box, Text, Button } = $.ui.resolve(e)
    const noop = () => undefined
    const left = c.lastEnd + c.ttlMs - c.now
    const cost = `${short(c.tokens)} tokens`
    const w = await getWarm($)
    // When the one-row band (its text, then its buttons) would not fit, it becomes three rows
    // (clock, cost, buttons), so nothing wraps; the tip costs two more rows, so it shows there
    // only while keeping warm. Widths are counted in characters: each glyph here is one cell.
    const cols = typeof e.props.bodyColumns === 'number' && e.props.bodyColumns > 0 ? Math.floor(e.props.bodyColumns) : 0
    const big = c.tokens >= BIG || c.ttlSource === 'demo'
    const labels = [left > 0 ? '' : big ? 'Hand off to a fresh chat' : '', w ? 'Stop keeping warm' : 'Keep warm', 'Hide'].filter(Boolean)
    const buttonsW = labels.reduce((n, l) => n + l.length + 5, 0)
    const oneRow =
      left > 0
        ? `◷ Cache warm ${mmss(left)} ${'━'.repeat(BAR)} ${lengthLabel(c)}. Reply now and ${cost} cost 5 to 10% as much.`
        : `❄ Cache cold since ${ago(-left)}. Your next message re-reads ${cost} ${fullCost(c)}.`
    // The engine keeps the last few columns for its own [-] control.
    const narrow = cols > 0 && cols < oneRow.length + buttonsW + 6
    const roomy = typeof e.props.maxRows !== 'number' || e.props.maxRows >= 6
    const warmButton = w ? <Button key="keepwarm" label="Stop keeping warm" onPress={noop} /> : <Button key="keepwarm" label="Keep warm" onPress={noop} />
    const warmRow = w ? (
      <Text color={w.cold || w.error ? BAD : COLD} wrap={narrow ? 'truncate-end' : undefined}>
        {warmLine(w, left)}
      </Text>
    ) : null
    const tip = roomy && (!narrow || w) ? <Text dimColor wrap={narrow ? 'truncate-end' : undefined}>{TIP}</Text> : null
    const fit = (node: unknown) => (narrow ? <Box width={cols}>{node as never}</Box> : node) as never
    // The app draws buttons taller than a line of text, so its rows need a gap or the buttons
    // sit on the line above: its smallest step, the same between every row. A terminal row is
    // one cell high and the band is short of rows there.
    const rowGap = e.surface === 'terminal' ? 0 : 'xs'

    if (left > 0) {
      const share = left / c.ttlMs
      const color = left <= 60_000 ? BAD : share < 0.5 ? WARN : GOOD
      // "◷ Cache warm 4:30 " and "  5 min cache" take about 32 columns beside the bar.
      const bar = narrow ? Math.max(MIN_BAR, Math.min(BAR, cols - 34)) : BAR
      const filled = Math.max(1, Math.round(share * bar))
      const clock = (
        <Text>
          <Text color={color}>◷ Cache warm </Text>
          <Text bold color={color}>
            {mmss(left)}
          </Text>
          <Text> </Text>
          <Text color={color}>{'━'.repeat(filled)}</Text>
          <Text dimColor>{'━'.repeat(bar - filled)}</Text>
          {narrow ? <Text dimColor>{`  ${shortLabel(c)}`}</Text> : <Text dimColor>{` ${lengthLabel(c)}.`}</Text>}
          {narrow ? null : <Text dimColor> Reply now and {cost} cost 5 to 10% as much.</Text>}
        </Text>
      )
      const buttons = (
        <Box key="buttons" flexDirection="row" gap={1}>
          {warmButton}
          <Button key="hide" label="Hide" role="dismiss" onPress={noop} />
        </Box>
      )
      if (narrow) {
        return (
          <Box key="band" flexDirection="column" gap={rowGap}>
            {rest as never}
            {fit(clock)}
            {roomy ? fit(<Text dimColor wrap="truncate-end">{`Reply now and ${cost} cost 5 to 10% as much.`}</Text>) : null}
            {buttons}
            {warmRow ? fit(warmRow) : null}
            {tip ? fit(tip) : null}
          </Box>
        )
      }
      return (
        <Box key="band" flexDirection="column" gap={rowGap}>
          {rest as never}
          <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={1}>
            {clock}
            {buttons}
          </Box>
          {warmRow}
          {tip}
        </Box>
      )
    }

    // The 60 s demo always shows the button (big, above), so it can be filmed in a small chat.
    const coldButtons = (
      <Box key="buttons" flexDirection="row" gap={1}>
        {big ? <Button key="handoff" label="Hand off to a fresh chat" variant="primary" onPress={noop} /> : null}
        {warmButton}
        <Button key="hide" label="Hide" role="dismiss" onPress={noop} />
      </Box>
    )
    const note = c.note ? <Text dimColor wrap={narrow ? 'truncate-end' : undefined}>{c.note}</Text> : null
    if (narrow) {
      return (
        <Box key="band" flexDirection="column" gap={rowGap}>
          {rest as never}
          {fit(
            <Text wrap="truncate-end">
              <Text color={COLD}>❄ Cache cold</Text>
              <Text dimColor> since {ago(-left)}.</Text>
            </Text>,
          )}
          {roomy ? fit(<Text dimColor wrap="truncate-end">{`Your next message re-reads ${cost} ${fullCost(c)}.`}</Text>) : null}
          {coldButtons}
          {warmRow ? fit(warmRow) : null}
          {note ? fit(note) : null}
          {tip ? fit(tip) : null}
        </Box>
      )
    }
    return (
      <Box key="band" flexDirection="column" gap={rowGap}>
        {rest as never}
        <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Text>
            <Text color={COLD}>❄ Cache cold</Text>
            <Text dimColor> since {ago(-left)}. Your next message re-reads {cost} {fullCost(c)}.</Text>
          </Text>
          {coldButtons}
        </Box>
        {warmRow}
        {note}
        {tip}
      </Box>
    )
  })
}
