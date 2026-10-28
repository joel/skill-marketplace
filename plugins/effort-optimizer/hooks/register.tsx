import type { ConfigRow, EngineInterface, Register, SessionMessage } from 'claude-code'

import type { Band, Hold, Level } from '../types'
import { NAMES, SHORT, asLevel, fitsRow, footerLabel, infoGlyph, infoLines, norm, parsePick, stepDecision, type Pick } from './level'

const BAND = { plugin: 'effort-optimizer', key: 'band' } as const
const OVERRIDE = { plugin: 'effort-optimizer', key: 'override' } as const
const HOLD = { plugin: 'effort-optimizer', key: 'hold' } as const
const PAUSED = { plugin: 'effort-optimizer', key: 'paused' } as const

const APPLIED_MS = 15000
const ACCENT = '#d97757'
const GOOD = '#16a34a'
const BAD = '#dc2626'
type Mode = 'suggest' | 'auto'

const MODEL_DEFAULT = 'claude-sonnet-5-5'
const MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5']

// Module variables reset on a reload; the band, the override and the hold live in $.state.
let home = ''
let sid = ''
// The userConfig switches, set by register: /config changes them and reloads the module.
let mode: Mode = 'suggest'
let pickerModel = MODEL_DEFAULT
// /effort-optimizer off pauses the mod in this chat only; /plugin disable turns it off.
let paused = false
// A mode chosen in the dialog, written to /config once the turn is over (the write reloads the module).
let pendingMode: Mode | null = null
// Bumped on every prompt, so a slow pick for an older prompt is dropped.
let gen = 0
let nextId = 1
// The level the main chat's last request ran at, before this mod touched it.
let seen: Level | '' = ''
// The level for the rest of the running turn, set by a Switch or by auto mode.
let turnLevel: Level | null = null
// The level the mod puts on requests, and the effort the request carried when it took over.
let hold: Hold | null = null
let lastEffort = ''
// The prompt waiting for its pick at the turn's first request.
let held: { text: string; mine: number } | null = null

const enabled = () => !paused

async function log($: EngineInterface, what: string, err: unknown) {
  if (!home) return
  try {
    const path = `${home}/.claude/mods-logs/effort-optimizer.log`
    const old = (await $.fs.exists(path)) ? String(await $.fs.read(path)) : ''
    const msg = err instanceof Error ? err.message : String(err)
    await $.fs.write(path, `${old.slice(-20_000)}${new Date(await $.clock.now()).toISOString()} ${what}: ${msg}\n`)
  } catch {
    // Nowhere left to report it.
  }
}

async function getBand($: EngineInterface): Promise<Band | null> {
  const { value } = await $.state.get(BAND)
  return value ?? null
}

async function setBand($: EngineInterface, b: Band | null) {
  await $.state.set(BAND, b)
}

function isEffortRow(r: ConfigRow) {
  if (!/effort/i.test(`${r.key} ${r.label}`)) return false
  if (r.kind !== 'choice') return false
  return (r.options ?? []).some(o => norm(o) === 'high')
}

// The level the chat runs at now: the last request's, else a /config effort row's, when there is one.
async function currentLevel($: EngineInterface): Promise<Level | ''> {
  if (seen) return seen
  try {
    const row = (await $.config.list()).find(isEffortRow)
    return row ? asLevel(row.value) : ''
  } catch {
    return ''
  }
}

// Puts the level on every main-chat request of this session, until the person changes their
// own effort. The person's effort setting is never written: it is saved for every chat, so a
// pick there would follow them into chats it was never made for.
async function applyLevel($: EngineInterface, level: Level) {
  turnLevel = level
  hold = { level, base: lastEffort }
  await $.state.set(HOLD, hold)
  await $.state.set(OVERRIDE, level)
  redraw($)
}

async function release($: EngineInterface) {
  hold = null
  turnLevel = null
  await $.state.set(HOLD, null)
  await $.state.set(OVERRIDE, null)
  redraw($)
}

function redraw($: EngineInterface) {
  try {
    $.ui.invalidate('ui.render')
  } catch {
    // The next state change redraws anyway.
  }
}

// ---------- The shared file: helper-desk shows the pick from it ----------

const effortPath = () => `${home}/.claude/mods-state/effort-${sid}.json`

async function shareEffort($: EngineInterface, p: Pick, from: Level | '', applied: boolean) {
  if (!home || !sid) return
  try {
    const body = { level: p.level, from, why: p.why, mode, applied, at: new Date(await $.clock.now()).toISOString() }
    // Written beside it, then moved over it, so a reader never sees half a file.
    const tmp = `${effortPath()}.tmp`
    await $.fs.write(tmp, `${JSON.stringify(body)}\n`)
    await $.process.run(['mv', '-f', tmp, effortPath()])
  } catch (err) {
    await log($, 'share', err)
  }
}

async function unshare($: EngineInterface) {
  if (!home || !sid) return
  await $.process.run(['rm', '-f', effortPath()]).catch(() => undefined)
}

// ---------- The pick ----------

function lastAssistantText(messages: readonly SessionMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]!
    if (m.role === 'assistant' && m.text.trim()) return m.text
  }
  return ''
}

// Ben's framework from the effort levels video: four questions, stop at the first yes.
function pickPrompt(text: string, lastReply: string, now: Level | '') {
  return `You pick the effort level an AI assistant (Claude) should use for one prompt. Effort sets how much time, reading and checking Claude spends, and how many decisions it makes alone. It is not how smart Claude is.

Ask these four questions in this order and stop at the first yes:

1. Will the person go back and forth with Claude on this, or is it a simple task? Then low.
   Examples: brainstorming options, quick rewrites (friendlier, shorter), sorting or tagging items, short summaries, rough first drafts or outlines, small tweaks to something already made, simple questions.
2. Would a hidden mistake cost money, a client, trust or a wrong decision? Then high.
   Examples: checking numbers across sources, open-ended analysis with no set path (why did churn go up), reviewing a contract for risk, fact-checking, going through long documents, verifying and testing work made at a lower level, building or fixing a skill.
3. Is the person handing off a long, hard and critical job and walking away, with no time to answer questions? All three must be true. Then xhigh.
   Examples: a full research report from a year of calls and tickets, reviewing a 50 page agreement before signing, an investor pitch deck as the best one shot. Answer max only when the prompt asks for the deepest possible work and says it is critical; otherwise xhigh.
4. Everything else is medium: everyday writing, repurposing content, meeting summaries with decisions and next steps, standard reports in a set format, quick research before a call. If you are not sure, medium.

A task being long does not make it high. Rule-following work stays low or medium.
If the prompt only approves, answers a question, or says to go on with earlier work (yes, go, ok, do it, option 2), answer keep.

The chat runs at: ${now || 'unknown'}

Claude's last reply (first 600 characters, for context):
<reply>
${lastReply || '(none, this is the first prompt)'}
</reply>

The new prompt:
<prompt>
${text}
</prompt>

Reply with JSON only: {"level": "low|medium|high|xhigh|max|keep", "why": "the reason in under 12 plain words"}`
}

async function pick($: EngineInterface, text: string, now: Level | ''): Promise<Pick | null> {
  const messages = await $.session.messages()
  const lastReply = lastAssistantText(messages).slice(0, 600)
  const r = await $.model.complete({
    model: pickerModel,
    prompt: pickPrompt(text.slice(0, 4000), lastReply, now),
    maxTokens: 120,
    effort: 'low',
    timeoutMs: 20_000,
  })
  if (!r.isAnswered) throw new Error(`pick failed: ${r.reason}`)
  return parsePick(r.text)
}

async function hideLater($: EngineInterface, id: number) {
  await $.clock.sleep(APPLIED_MS)
  const b = await getBand($)
  if (b && b.id === id && b.phase === 'applied') await setBand($, null)
}

async function showApplied($: EngineInterface, p: Pick, from: Level | '') {
  const id = nextId++
  await setBand($, { phase: 'applied', id, level: p.level, from, why: p.why, note: '' })
  void hideLater($, id).catch(err => log($, 'hide', err))
}

/** Writes the mode to /config, the one place it lives; /config then reloads the module. */
async function saveMode($: EngineInterface, m: Mode) {
  mode = m
  const r = await $.config.set({ key: 'effort-optimizer.mode', value: m }).catch(err => ({ deny: String(err) }))
  if (r.deny) await log($, 'save mode', r.deny)
  return !r.deny
}

async function status($: EngineInterface, text: string | undefined) {
  try {
    await $.ui.status(text)
  } catch {
    // The status line is a nicety.
  }
}

// Suggest mode: pick before the prompt goes in and, when the level differs, hold the prompt until the person answers.
async function suggest($: EngineInterface, text: string, mine: number) {
  const now = await currentLevel($)
  await status($, 'checking effort…')
  let p: Pick | null = null
  try {
    p = await pick($, text, now)
  } finally {
    await status($, undefined)
  }
  if (!p || mine !== gen) return
  if (p.level === now) {
    await shareEffort($, p, now, false)
    return
  }
  const go = `Switch to ${NAMES[p.level]}`
  const auto = 'Switch, and auto-adjust from now'
  const keep = now ? `Keep ${NAMES[now]}` : 'Keep it as it is'
  let answer = ''
  try {
    answer = await $.ui.ask(`This looks like a ${NAMES[p.level]} effort task${p.why ? `: ${p.why}` : ''}. Switch before Claude starts?`, {
      options: [go, auto, keep],
      header: 'Effort',
    })
  } catch {
    // A dismissed dialog keeps the level and sends the prompt.
    return
  }
  if (answer !== go && answer !== auto) return
  if (answer === auto) {
    // Auto from this turn on; /config learns it once the turn is over.
    mode = 'auto'
    pendingMode = 'auto'
  }
  await applyLevel($, p.level)
  await shareEffort($, p, now, true)
  await showApplied($, p, now)
}

// Auto mode: pick before the prompt goes in, so the first request already runs at the right level.
async function autoAdjust($: EngineInterface, text: string, mine: number) {
  const now = await currentLevel($)
  await status($, 'picking effort…')
  try {
    const p = await pick($, text, now)
    if (!p || mine !== gen) return
    if (p.level === now) {
      turnLevel = p.level
      await shareEffort($, p, now, false)
      return
    }
    await applyLevel($, p.level)
    await shareEffort($, p, now, true)
    await showApplied($, p, now)
  } finally {
    await status($, undefined)
  }
}

// ---------- Drawing ----------

const cutTo = (t: string, n: number) => (n <= 0 ? '' : t.length > n ? `${t.slice(0, Math.max(0, n - 1))}…` : t)

export const register: Register = (on, options) => {
  mode = options.mode === 'auto' ? 'auto' : 'suggest'
  pickerModel = typeof options.picker_model === 'string' && MODELS.includes(options.picker_model) ? options.picker_model : MODEL_DEFAULT

  on('session.start', async ($, e, next) => {
    home = (await $.env.get('HOME').catch(() => undefined)) ?? ''
    sid = await $.session.id().catch(() => '')
    await $.command.register({
      name: 'effort-optimizer',
      description: 'Effort Optimizer. auto: set effort by itself. suggest: offer a switch. off or on: pause it in this chat',
      argumentHint: '[auto|suggest|off|on]',
    })
    // A reload (a /config change) keeps the level the mod holds.
    const { value: wasPaused = false } = await $.state.get(PAUSED)
    paused = wasPaused
    const { value: held0 = null } = await $.state.get(HOLD)
    hold = held0
    void (async () => {
      const row = (await $.config.list()).find(isEffortRow)
      await log($, 'effort row', row ? `${row.key} = ${String(row.value)} [${(row.options ?? []).join(', ')}], read only` : 'none found')
    })().catch(err => log($, 'find row', err))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (!enabled()) return next(e)
    if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') return next(e)
    const text = e.text.trim()
    if (!text || text.startsWith('/')) return next(e)
    gen += 1
    turnLevel = null
    const mine = gen
    // A new prompt makes an unanswered offer stale.
    const b = await getBand($).catch(() => null)
    if (b?.phase === 'offer') await setBand($, null).catch(() => undefined)
    // The pick waits for the turn's first request, which carries the level the chat really runs at.
    held = { text, mine }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Every main-chat request: note its level, and put the chosen one on it.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined || typeof e.effort !== 'string') return yield* next(e)
    lastEffort = e.effort
    const state = () => ({ incoming: e.effort as string, hold, turnLevel, paused })
    // The person changed their own effort (/effort, the menu): the mod lets go.
    if (stepDecision(state()).release) await release($)
    if (!hold && (await $.state.get(OVERRIDE)).value) {
      await $.state.set(OVERRIDE, null)
      redraw($)
    }
    // What the chat runs at now: the level the mod holds, else the person's.
    seen = (enabled() && hold ? hold.level : null) ?? (asLevel(e.effort) || seen)
    if (held && e.index === 0 && enabled()) {
      const h = held
      held = null
      if (mode === 'auto') await autoAdjust($, h.text, h.mine).catch(err => log($, 'auto', err))
      else await suggest($, h.text, h.mine).catch(err => log($, 'suggest', err))
    }
    const { send } = stepDecision(state())
    if (!send) return yield* next(e)
    void log($, 'request', `${e.effort} -> ${send}`)
    return yield* next({ ...e, effort: send })
  })

  // A mode picked in the dialog reaches /config once the turn is over.
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && pendingMode) {
      const m = pendingMode
      pendingMode = null
      void saveMode($, m).catch(err => log($, 'save mode', err))
    }
    return r
  })

  // The shared file goes with the chat; after /clear or a resume the process carries on.
  on('session.end', async ($, e, next) => {
    if (e.reason !== 'clear' && e.reason !== 'resume') await unshare($)
    return next(e)
  })

  on('command.run', { command: 'effort-optimizer' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'auto' || arg === 'suggest') {
      const saved = await saveMode($, arg)
      const how = saved ? '' : ' (for this chat: /config did not take it, see the log)'
      return {
        text:
          arg === 'auto'
            ? `Effort Optimizer: auto${how}. Every prompt now gets the effort level it needs, set by itself.`
            : `Effort Optimizer: suggest${how}. When a prompt needs another level, a question offers the switch.`,
      }
    }
    if (arg === 'off' || arg === 'on') {
      paused = arg === 'off'
      await $.state.set(PAUSED, paused)
      if (paused) {
        await release($)
        await setBand($, null)
        await unshare($)
      }
      return {
        text: paused
          ? 'Effort Optimizer is paused in this chat. Type /effort-optimizer on to resume it, or /plugin disable effort-optimizer to turn it off.'
          : `Effort Optimizer is on (${mode}).`,
      }
    }
    const now = await currentLevel($)
    const { value } = await $.state.get(OVERRIDE)
    return {
      text: [
        `Effort Optimizer is ${paused ? 'paused in this chat' : 'on'}, mode: ${mode} (set in /config), picks with ${pickerModel}.`,
        `This chat runs at: ${now ? NAMES[now] : 'unknown yet'}${value ? ` (held by the mod: ${NAMES[value]}, on every request)` : ''}.`,
        'The mod never changes your own effort setting; /effort does.',
        'Type /effort-optimizer auto, suggest, off or on.',
      ].join('\n'),
    }
  })

  on('ui.press', { plugin: 'effort-optimizer', element: 'switch' }, async ($, e) => {
    const b = await getBand($)
    if (!b || b.phase !== 'offer') return { element: e.element }
    try {
      await applyLevel($, b.level)
      await shareEffort($, { level: b.level, why: b.why }, b.from, true)
      await showApplied($, { level: b.level, why: b.why }, b.from)
    } catch (err) {
      await log($, 'switch', err)
      await setBand($, { ...b, note: `Could not switch: ${(err instanceof Error ? err.message : String(err)).slice(0, 100)}` })
    }
    return { element: e.element }
  })

  on('ui.press', { plugin: 'effort-optimizer', element: 'auto' }, async ($, e) => {
    const b = await getBand($)
    if (b?.phase === 'offer') {
      await applyLevel($, b.level).catch(err => log($, 'auto', err))
      await shareEffort($, { level: b.level, why: b.why }, b.from, true)
      await showApplied($, { level: b.level, why: 'Auto-adjust is on for every prompt' }, b.from)
    }
    await saveMode($, 'auto')
    return { element: e.element }
  })

  on('ui.press', { plugin: 'effort-optimizer', element: 'info' }, async ($, e) => {
    const b = await getBand($)
    if (b) await setBand($, { ...b, phase: 'info' })
    return { element: e.element }
  })

  on('ui.press', { plugin: 'effort-optimizer', element: 'info-close' }, async ($, e) => {
    await setBand($, null)
    return { element: e.element }
  })

  on('ui.press', { plugin: 'effort-optimizer', element: 'skip' }, async ($, e) => {
    await setBand($, null)
    return { element: e.element }
  })

  // Neither the app's model menu nor the terminal's effort indicator shows a level the mod puts
  // on requests, so the footer slot names the level it really sends.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (!enabled()) return next(e)
    const { value } = await $.state.get(OVERRIDE)
    if (!value) return next(e)
    const label = footerLabel(value)
    if (e.surface === 'desktop' || e.surface === 'vscode') {
      const { Text } = $.ui.resolve(e)
      return <Text color="#d97757">{label}</Text>
    }
    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, label] } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!enabled() || e.props.hasSurvey) return next(e)
    const b = await getBand($)
    if (!b) return next(e)
    // Claude Code's own placeholder draws nothing but would take a gap above the band.
    const drawn = await next(e)
    const rest = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null
    const { Box, Text, Button } = $.ui.resolve(e)
    // The app draws buttons taller than a line of text, so its rows need a gap or the buttons
    // sit on the line above: its smallest step, the same between every row. The terminal keeps 0.
    const rowGap = e.surface === 'terminal' ? 0 : 'xs'
    const noop = () => undefined
    const glyph = infoGlyph(e.surface)
    const cols = typeof e.props.bodyColumns === 'number' && e.props.bodyColumns > 0 ? Math.floor(e.props.bodyColumns) : 0
    const room = cols ? cols - 6 : 0
    const short = typeof e.props.maxRows === 'number' && e.props.maxRows < 5
    const fits = (len: number) => fitsRow(len, cols)
    const fit = (node: unknown) => (cols ? <Box width={room}>{node as never}</Box> : node) as never

    if (b.phase === 'applied') {
      const learn = `${glyph} Learn more`
      const line = `✓ Effort set to ${NAMES[b.level]}${b.from ? ` (was ${NAMES[b.from]})` : ''}${b.why ? ` · ${b.why}` : ''}`
      const text = (
        <Text wrap="truncate-end">
          <Text color={GOOD}>✓</Text>
          <Text> Effort set to </Text>
          <Text bold>{NAMES[b.level]}</Text>
          {b.from ? <Text dimColor> (was {NAMES[b.from]})</Text> : null}
          {b.why ? <Text dimColor> · {b.why}</Text> : null}
        </Text>
      )
      const button = <Button key="info" label={learn} variant="secondary" onPress={noop} />
      // One row when the line and its button fit; else the line, cut, above the button.
      if (fits(line.length + learn.length + 5)) {
        return (
          <Box flexDirection="column" gap={rowGap}>
            {rest as never}
            <Box flexDirection="row" gap={1}>
              {text}
              {button}
            </Box>
          </Box>
        )
      }
      return (
        <Box flexDirection="column" gap={rowGap}>
          {rest as never}
          {fit(text)}
          {short ? null : <Box flexDirection="row">{button}</Box>}
        </Box>
      )
    }

    if (b.phase === 'info') {
      const lines = infoLines(b.level, b.from, e.surface)
      const shown = short ? [] : lines
      return (
        <Box flexDirection="column" gap={rowGap}>
          {rest as never}
          <Box flexDirection="column" gap={rowGap}>
            {fit(
              <Text wrap="truncate-end">
                <Text color={ACCENT}>{glyph}</Text>
                <Text bold> Claude now works at {NAMES[b.level]} effort</Text>
              </Text>,
            )}
            {shown.map((l, i) =>
              fit(
                <Text key={`info-${i}`} dimColor wrap={cols ? 'truncate-end' : undefined}>
                  {cols ? cutTo(l, room) : l}
                </Text>,
              ),
            )}
            <Box flexDirection="row" gap={1}>
              <Button key="info-close" label="Got it" role="dismiss" onPress={noop} />
            </Box>
          </Box>
        </Box>
      )
    }

    // The offer: three buttons, about 60 columns; on a narrow band the last one drops to a row of its own.
    const switchLabel = `Switch to ${NAMES[b.level]}`
    const wide = fits(switchLabel.length + 'Auto-adjust every prompt'.length + 'Skip'.length + 3 * 5)
    const sw = <Button key="switch" label={switchLabel} variant="primary" onPress={noop} />
    const au = <Button key="auto" label="Auto-adjust every prompt" variant="secondary" onPress={noop} />
    const sk = <Button key="skip" label="Skip" role="dismiss" onPress={noop} />
    return (
      <Box flexDirection="column" gap={rowGap}>
        {rest as never}
        <Box flexDirection="column" gap={rowGap}>
          {fit(
            <Text wrap="truncate-end">
              <Text color={ACCENT}>●</Text>
              <Text bold> This looks like a {NAMES[b.level]} effort task</Text>
              {b.from ? <Text dimColor> (you are on {NAMES[b.from]})</Text> : null}
            </Text>,
          )}
          {b.why && !short ? fit(<Text dimColor wrap="truncate-end">{b.why}</Text>) : null}
          {wide ? (
            <Box flexDirection="row" gap={1}>
              {sw}
              {au}
              {sk}
            </Box>
          ) : (
            <Box flexDirection="column" gap={rowGap}>
              <Box flexDirection="row" gap={1}>
                {sw}
                {sk}
              </Box>
              <Box flexDirection="row">{au}</Box>
            </Box>
          )}
          {b.note ? fit(<Text color={BAD} wrap="truncate-end">{b.note}</Text>) : null}
        </Box>
      </Box>
    )
  })
}
