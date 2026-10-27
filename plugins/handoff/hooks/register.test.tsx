import { expect, mock, test } from 'claude-code/testing'

const HANDOFF = '# Handoff: Build the refresh mod\n\nContinue work in `~/vault`. Goal: finish it.\n\n## Next steps\n1. Test it.'

for (const surface of ['desktop', 'terminal'] as const) {
  test(`offer at 250k, steps, then copy and start (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    let tokens = 120_000
    const files: Record<string, string> = {}
    const store: Record<string, unknown> = {}
    const runs: { argv: readonly string[]; stdin?: string }[] = []
    const copies: { text: string; surface: string }[] = []
    let forkPrompt = ''

    on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
    on('command.register', async () => ({ value: undefined }) as never)
    on('tool.register', async () => ({ value: { tool: 'mcp__handoff__refresh' } }) as never)
    const clock = mock.clock(on, { now: 1_000_000 })
    on('session.id', async () => ({ value: 'sid' }) as never)
    on('env.get', async ($, e) => ({ value: (e as { name: string }).name === 'HOME' ? '/Users/test' : undefined }) as never)
    on('ui.copy', async ($, e) => {
      copies.push(e as { text: string; surface: string })
      return { value: { isCopied: true } } as never
    })
    on('session.cwd', async () => ({ value: '/Users/test/vault' }) as never)
    on('session.usage', async () => ({ value: { context: { tokens, window: 1_000_000 } } }) as never)
    on('session.messages', async () =>
      ({
        value: [
          { role: 'user', text: 'Build a refresh mod', toolUses: [] },
          {
            role: 'assistant',
            text: 'Published https://claude.ai/artifact/abc',
            toolUses: [
              { tool_use_id: 't1', tool: 'Read', input: { file_path: '/Users/test/vault/a.md' } },
              { tool_use_id: 't2', tool: 'Skill', input: { skill: 'plugin-authoring' } },
              { tool_use_id: 't3', tool: 'Bash', input: { command: 'cat ~/notes/b.md /tmp/x' } },
            ],
          },
        ],
      }) as never,
    )
    on('model.fork', async ($, e) => {
      forkPrompt = (e as { prompt: string }).prompt
      return { value: { isAnswered: true, text: `${HANDOFF}\nkey sk-abcdefghijklmnopqrstuvwxyz`, usage: {} } } as never
    })
    on('fs.exists', async ($, e) => {
      const p = (e as { path: string }).path
      return { value: p.endsWith('.md') && !p.includes('/tmp/') ? true : p in files } as never
    })
    on('fs.write', async ($, e) => {
      const { path, text } = e as { path: string; text: string }
      files[path] = text
      return { value: undefined } as never
    })
    on('fs.read', async ($, e) => ({ value: files[(e as { path: string }).path] ?? '' }) as never)
    on('process.run', async ($, e) => {
      const { argv, init } = e as { argv: readonly string[]; init?: { stdin?: string } }
      runs.push({ argv, stdin: init?.stdin })
      return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
    })
    on('store.get', async ($, e) => ({ value: store[(e as { key: string }).key] }) as never)
    on('store.set', async ($, e) => {
      const { key, value } = e as { key: string; value: unknown }
      store[key] = value
      return { value: undefined } as never
    })
    on('turn.complete', async () => ({ text: '' }) as never)
    on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>REST</Text>
    })

    const props = { isWorking: false, hasSurvey: false } as never
    await $.session.start({ source: 'startup', cwd: '/Users/test/vault', surface, isInteractive: true } as never)

    let v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props })
    expect(await v.find({ key: 'refresh' }), 'no offer below 250k').toBeUndefined()

    tokens = 262_000
    await $.turn.complete({ answer: '' } as never)
    // checkOffer runs after the turn's answer, unawaited.
    await clock.settle()
    v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props })
    expect(await v.find({ key: 'refresh' }), 'offer at 262k').toBeDefined()

    await v.press({ key: 'refresh' })
    v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props })
    expect(await v.find({ key: 'row0' }), 'working: the step rows show').toBeDefined()
    // The run goes on after the press; give it its awaited steps.
    await clock.advance(10_000)
    v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props })
    expect(await v.find({ key: 'copy' }), 'ready: copy button').toBeDefined()
    expect(await v.find({ key: 'start' }), 'ready: start button').toBeDefined()

    const saved = Object.entries(files).find(([k]) => k.startsWith('/Users/test/.claude/handoffs/') && k.endsWith('.md') && !k.endsWith('-draft.md'))
    const logged = Object.entries(files).find(([k]) => k.endsWith('/handoff.log'))
    expect(logged?.[1] ?? '', 'the run is logged').toContain(' ok ')
    expect(Object.keys(files).some(k => k.endsWith('-draft.md')), 'a draft was saved before the model step').toBe(true)
    expect(saved?.[0] ?? '', 'saved under ~/.claude/handoffs with the title slug').toContain('build-the-refresh-mod.md')
    expect(saved?.[1] ?? '', 'secret removed').not.toContain('sk-abcdefghij')
    expect(forkPrompt, 'fork prompt lists the read file, under ~').toContain('~/vault/a.md')
    expect(forkPrompt, 'fork prompt lists the skill').toContain('/plugin-authoring')
    expect(forkPrompt, 'fork prompt lists the link').toContain('https://claude.ai/artifact/abc')
    expect(forkPrompt, 'tmp paths dropped').not.toContain('/tmp/x')

    await v.press({ key: 'copy' })
    expect(copies[0]?.text ?? '', 'copy goes through the surface clipboard').toContain('# Handoff: Build the refresh mod')
    expect(copies[0]?.surface, 'on the surface that pressed').toBe(surface)
    expect(runs.some(r => r.argv[0] === 'pbcopy'), 'no pbcopy').toBe(false)

    await v.press({ key: 'start' })
    await clock.advance(2_000)
    v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props })
    if (surface === 'desktop') {
      const opened = runs.find(r => r.argv[0] === 'open')?.argv[1] ?? ''
      expect(opened.startsWith('claude://code/new?q='), 'the app fills a new chat').toBe(true)
    } else {
      // A plain terminal, not Zellij: copied, with the command to run.
      expect(copies.length, 'copied again').toBe(2)
      expect(await v.find({ text: /claude "\$\(cat ~\/\.claude\/handoffs\// }), 'the command to run').toBeDefined()
    }
    expect(Object.keys(files).some(k => k.includes('/.claude/pet/')), 'no Claude Pet request').toBe(false)

    await v.press({ key: 'close' })
    v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props })
    expect(await v.find({ key: 'copy' }), 'closed').toBeUndefined()
  })
}

for (const surface of ['desktop', 'terminal'] as const) {
  test(`Cache Clock request runs it; a failed model step keeps the draft and logs (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    // Cache Clock left a request file for this chat.
    let requested = true
    const files: Record<string, string> = {}
    on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
    on('command.register', async () => ({ value: undefined }) as never)
    on('tool.register', async () => ({ value: { tool: 'mcp__handoff__refresh' } }) as never)
    const clock = mock.clock(on, { now: 1_000_000 })
    on('session.id', async () => ({ value: 'sid' }) as never)
    on('env.get', async ($, e) => ({ value: (e as { name: string }).name === 'HOME' ? '/Users/test' : undefined }) as never)
    on('session.cwd', async () => ({ value: '/Users/test/vault' }) as never)
    on('session.usage', async () => ({ value: { context: { tokens: 90_000, window: 1_000_000 } } }) as never)
    on('session.messages', async () => ({ value: [{ role: 'user', text: 'Write the newsletter', toolUses: [] }] }) as never)
    on('model.fork', async () => ({ value: { isAnswered: false, reason: 'api-error', status: 529 } }) as never)
    on('fs.exists', async ($, e) => {
      const p = (e as { path: string }).path
      return { value: p.endsWith('/.request-sid') ? requested : p in files } as never
    })
    on('fs.write', async ($, e) => {
      const { path, text } = e as { path: string; text: string }
      files[path] = text
      return { value: undefined } as never
    })
    on('fs.read', async ($, e) => ({ value: files[(e as { path: string }).path] ?? '' }) as never)
    on('process.run', async ($, e) => {
      const { argv } = e as { argv: readonly string[] }
      if (argv[0] === 'rm' && argv.some(a => a.endsWith('/.request-sid'))) requested = false
      return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
    })
    on('store.get', async () => ({ value: undefined }) as never)
    on('store.set', async () => ({ value: undefined }) as never)
    on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>REST</Text>
    })
    await $.session.start({ source: 'startup', cwd: '/Users/test/vault', surface, isInteractive: true } as never)
    await clock.advance(20_000)
    const props = { isWorking: false, hasSurvey: false } as never
    const v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props })
    const log = Object.entries(files).find(([k]) => k.endsWith('/handoff.log'))?.[1] ?? ''
    expect(log, 'the request is logged').toContain('asked by Cache Clock')
    expect(log, 'the failure is logged').toContain('failed at step 4')
    expect(requested, 'the request file is removed').toBe(false)
    expect(await v.find({ key: 'retry' }), 'failed: try again').toBeDefined()
    expect(await v.find({ key: 'open' }), 'failed: the draft can be opened').toBeDefined()
    const draft = Object.entries(files).find(([k]) => k.endsWith('-draft.md'))?.[1] ?? ''
    expect(draft, 'the draft holds the request').toContain('Write the newsletter')
  })
}

/** The `on` a test body is handed. */
type On = Parameters<NonNullable<Parameters<typeof test>[2]>>[1]

/** Mocks every $ call the offer and the buttons make; `files` stands in for the disk, `env` adds variables beside HOME. */
function rig(on: On, files: Record<string, string>, tokens: { value: number }, env: Record<string, string> = {}) {
  const toasts: string[] = []
  const runs: string[][] = []
  const copies: string[] = []
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('tool.register', async () => ({ value: { tool: 'mcp__handoff__refresh' } }) as never)
  const clock = mock.clock(on, { now: 1_000_000 })
  on('session.id', async () => ({ value: 'sid' }) as never)
  on('env.get', async ($, e) => {
    const { name } = e as { name: string }
    return { value: name === 'HOME' ? '/Users/test' : env[name] } as never
  })
  on('session.cwd', async () => ({ value: '/Users/test/vault' }) as never)
  on('session.usage', async () => ({ value: { context: { tokens: tokens.value, window: 1_000_000 } } }) as never)
  on('session.messages', async () => ({ value: [{ role: 'user', text: 'Write the newsletter', toolUses: [] }] }) as never)
  on('model.fork', async () => ({ value: { isAnswered: true, text: HANDOFF, usage: {} } }) as never)
  on('fs.exists', async ($, e) => ({ value: (e as { path: string }).path in files }) as never)
  on('fs.read', async ($, e) => ({ value: files[(e as { path: string }).path] ?? '' }) as never)
  on('fs.write', async ($, e) => {
    const { path, text } = e as { path: string; text: string }
    files[path] = text
    return { value: undefined } as never
  })
  on('process.run', async ($, e) => {
    const { argv } = e as { argv: string[] }
    runs.push(argv)
    if (argv[0] === 'rm') for (const path of argv.slice(1)) delete files[path]
    return { value: { exitCode: 0, stdout: argv[0] === 'zellij' ? 'terminal_9\n' : '', stderr: '' } } as never
  })
  on('ui.copy', async ($, e) => {
    copies.push((e as { text: string }).text)
    return { value: { isCopied: true } } as never
  })
  on('store.get', async () => ({ value: undefined }) as never)
  on('store.set', async () => ({ value: undefined }) as never)
  on('ui.toast', async ($, e) => {
    toasts.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('turn.complete', async () => ({ text: '' }) as never)
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>REST</Text>
  })
  return { clock, toasts, runs, copies }
}

const offerProps = { isWorking: false, hasSurvey: false } as never
const begin = { source: 'startup', cwd: '/Users/test/vault', isInteractive: true } as const
const ZELLIJ = { ZELLIJ: '0' }

for (const surface of ['desktop', 'terminal'] as const) {
  test(`Hide on the offer keeps it away in this chat and writes no file (${surface})`, { timeoutMs: 30000 }, async ($, on) => {
    const files: Record<string, string> = {}
    const tokens = { value: 262_000 }
    const { clock, toasts } = rig(on, files, tokens)
    await $.session.start({ ...begin, surface } as never)
    await clock.settle()
    let v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props: offerProps })
    expect(await v.find({ key: 'refresh' }), 'offer at 262k').toBeDefined()

    await v.press({ key: 'close' })
    expect(Object.keys(files).filter(k => k.includes('/.claude/mods/')), 'no switches file').toEqual([])
    expect(toasts.join(' '), 'the toast names the way back').toContain('/refresh')
    v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props: offerProps })
    expect(await v.find({ key: 'refresh' }), 'offer gone').toBeUndefined()

    // More tokens and more turns: the offer does not pop up while hidden.
    tokens.value = 420_000
    await $.turn.complete({ answer: '' } as never)
    await clock.advance(10_000)
    v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props: offerProps })
    expect(await v.find({ key: 'refresh' }), 'still hidden').toBeUndefined()
    expect(await v.find({ text: 'REST' }), 'other bands still draw').toBeDefined()

    // /refresh clears the hide and shows it now, at any size.
    tokens.value = 40_000
    const said = JSON.stringify(await $.command.run({ command: 'refresh', args: '' } as never))
    expect(said, '/refresh reply').toContain('Refresh panel shown')
    v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props: offerProps })
    expect(await v.find({ key: 'refresh' }), '/refresh shows the panel').toBeDefined()
    await clock.advance(10_000)
    v = await $.ui.mount({ plugin: 'handoff', surface, component: 'AbovePrompt', props: offerProps })
    expect(await v.find({ key: 'refresh' }), 'a shown offer stays under the threshold').toBeDefined()
  })
}

test('offer: off never offers by itself, but /refresh and the tool still work', { timeoutMs: 30000, options: { offer: 'off' } }, async ($, on) => {
  const tokens = { value: 400_000 }
  const { clock } = rig(on, {}, tokens)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.turn.complete({ answer: '' } as never)
  await clock.advance(10_000)
  let v = await $.ui.mount({ plugin: 'handoff', surface: 'terminal', component: 'AbovePrompt', props: offerProps })
  expect(await v.find({ key: 'refresh' }), 'no offer at 400k').toBeUndefined()
  await $.command.run({ command: 'refresh', args: '' } as never)
  v = await $.ui.mount({ plugin: 'handoff', surface: 'terminal', component: 'AbovePrompt', props: offerProps })
  expect(await v.find({ key: 'refresh' }), '/refresh still shows it').toBeDefined()
  // Typed loosely: tsc runs out of memory resolving $.tool.call's overloads over every tool.
  const tools = $.tool as unknown as { call: (input: Record<string, unknown>) => Promise<unknown> }
  const said = JSON.stringify(await tools.call({ tool: 'mcp__handoff__refresh' }))
  expect(said, 'the tool answers').toContain('opens above the prompt')
})

test('offer_at moves the threshold', { timeoutMs: 30000, options: { offer_at: 100_000 } }, async ($, on) => {
  const tokens = { value: 90_000 }
  const { clock } = rig(on, {}, tokens)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await clock.settle()
  let v = await $.ui.mount({ plugin: 'handoff', surface: 'terminal', component: 'AbovePrompt', props: offerProps })
  expect(await v.find({ key: 'refresh' }), 'none at 90k').toBeUndefined()
  tokens.value = 110_000
  await $.turn.complete({ answer: '' } as never)
  await clock.settle()
  v = await $.ui.mount({ plugin: 'handoff', surface: 'terminal', component: 'AbovePrompt', props: offerProps })
  expect(await v.find({ key: 'refresh' }), 'offered at 110k').toBeDefined()
})

test('in Zellij, Start new chat opens a pane beside this one running claude on the handoff', { timeoutMs: 30000 }, async ($, on) => {
  const files: Record<string, string> = {}
  const { clock, runs, copies } = rig(on, files, { value: 10_000 }, ZELLIJ)
  await $.session.start({ ...begin, surface: 'terminal' } as never)
  await $.command.run({ command: 'handoff', args: '' } as never)
  await clock.advance(10_000)
  let v = await $.ui.mount({ plugin: 'handoff', surface: 'terminal', component: 'AbovePrompt', props: offerProps })
  expect(await v.find({ key: 'start' }), 'ready').toBeDefined()

  await v.press({ key: 'start' })
  const argv = runs.find(a => a[0] === 'zellij' && a[1] === 'run') ?? []
  expect(argv.slice(0, 6), 'a named pane in the chat folder').toEqual(['zellij', 'run', '--name', 'Handoff', '--cwd', '/Users/test/vault'])
  expect(argv.includes('--floating'), 'beside, not floating').toBe(false)
  expect(argv.slice(6, 11), 'claude without the child-session marker').toEqual(['--', 'env', '-u', 'CLAUDE_CODE_CHILD_SESSION', 'claude'])
  const prompt = argv[11] ?? ''
  expect(prompt.startsWith('#'), 'the first prompt never starts with #').toBe(false)
  expect(prompt, 'the handoff is the first prompt').toContain('# Handoff: Build the refresh mod')
  expect(copies, 'nothing copied').toEqual([])
  v = await $.ui.mount({ plugin: 'handoff', surface: 'terminal', component: 'AbovePrompt', props: offerProps })
  expect(await v.find({ text: /Zellij pane beside this one/ }), 'the note says where').toBeDefined()

  await v.press({ key: 'open' })
  const edit = runs.find(a => a[0] === 'zellij' && a[1] === 'edit') ?? []
  expect(edit.slice(0, 3), 'Open file floats an editor').toEqual(['zellij', 'edit', '--floating'])
  expect(edit[3]?.startsWith('/Users/test/.claude/handoffs/'), 'the saved handoff').toBe(true)
})
