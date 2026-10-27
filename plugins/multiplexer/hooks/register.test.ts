import { expect, test } from 'claude-code/testing'

/** The `on` a test body is handed. */
type On = Parameters<NonNullable<Parameters<typeof test>[2]>>[1]
/** The `$` a test body is handed. */
type Engine = Parameters<NonNullable<Parameters<typeof test>[2]>>[0]

// A test's own $ is the engine's: plugin nouns are on the plugins' $. So a mod stands in, loaded
// beside this plugin, and calls $.mux for the test through its /probe command.
const consumer = {
  name: 'mux-consumer',
  register(on: On) {
    on('session.start', async ($, e, next) => {
      await $.command.register({ name: 'probe', description: 'calls $.mux for a test', immediate: true })
      return next(e)
    })
    on('command.run', { command: 'probe' }, async ($, e) => {
      const [op, arg] = JSON.parse(e.args) as [string, never]
      const value =
        op === 'info' ? await $.mux.info()
        : op === 'openFloating' ? await $.mux.openFloating(arg)
        : op === 'openBeside' ? await $.mux.openBeside(arg)
        : op === 'edit' ? await $.mux.edit(arg)
        : op === 'isOpen' ? await $.mux.isOpen(arg)
        : op === 'close' ? await $.mux.close(arg)
        : 'unknown op'
      return { text: JSON.stringify(value ?? null) }
    })
  },
}

/** One $.mux call made by a mod, and its answer. */
async function mux($: Engine, op: string, arg?: unknown): Promise<unknown> {
  const r = (await $.command.run({ command: 'probe', args: JSON.stringify([op, arg ?? {}]) } as never)) as { text?: string }
  return JSON.parse(r.text ?? 'null')
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/w', surface: 'terminal', isInteractive: true } as never)

const FLOAT = { name: 'Helper Desk', argv: ['sh', 'f.sh'], anchor: 'bottom-right', width: '45%', height: '55%', pinned: true, takeFocus: false, closeOnExit: true } as const
const PANE = { mux: 'zellij', id: 'terminal_7' }

/** The environment and the multiplexer's command line, mocked; `ran` keeps every argv. */
function rig(on: On, env: Record<string, string>, opts: { listOk?: boolean; panes?: string[] } = {}) {
  const ran: string[][] = []
  const panes = new Set(opts.panes ?? [])
  const logs: string[] = []
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('env.get', async ($, e) => ({ value: env[(e as { name: string }).name] }) as never)
  on('ui.log', async ($, e) => {
    logs.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('process.run', async ($, e) => {
    const { argv } = e as { argv: string[] }
    ran.push(argv)
    let stdout = ''
    let exitCode = 0
    if (argv[1] === 'run' || argv[1] === 'edit') {
      stdout = 'terminal_7\n'
      panes.add('terminal_7')
    }
    if (argv[2] === 'list-panes') {
      if (opts.listOk === false) exitCode = 1
      stdout = ['PANE_ID  TYPE  TITLE', ...[...panes].map(p => `${p}  terminal  x`)].join('\n')
    }
    if (argv[2] === 'close-pane') panes.delete(argv[argv.length - 1]!)
    return { value: { exitCode, stdout, stderr: '' } } as never
  })
  return { ran, logs }
}

test('with no multiplexer every call answers its default, and nothing runs', { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
  const { ran } = rig(on, {})
  await start($)
  expect(await mux($, 'info'), 'info').toBeNull()
  expect(await mux($, 'openFloating', FLOAT), 'float').toBeNull()
  expect(await mux($, 'openBeside', { name: 'Handoff', argv: ['claude'] }), 'beside').toBeNull()
  expect(await mux($, 'edit', { path: '/a.md', floating: true }), 'edit').toBeNull()
  expect(await mux($, 'isOpen', { pane: PANE }), 'cannot tell').toBeNull()
  await mux($, 'close', { pane: PANE })
  expect(ran, 'no command').toEqual([])
})

test('tmux with no backend behaves as none, and says so once in the debug log', { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
  const { ran, logs } = rig(on, { TMUX: '/tmp/tmux-501/default,1,0' })
  await start($)
  expect(await mux($, 'info'), 'none').toBeNull()
  expect(await mux($, 'openFloating', FLOAT), 'no float').toBeNull()
  expect(ran, 'no command').toEqual([])
  expect(logs.filter(l => l.includes('no tmux backend')), 'said once').toHaveLength(1)
})

test('in Zellij: info, a float, whether it is open, and closing it', { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
  const { ran } = rig(on, { ZELLIJ: '0' })
  await start($)
  expect(await mux($, 'info'), 'info').toEqual({ name: 'zellij', floating: true, beside: true, edit: true })
  const pane = await mux($, 'openFloating', FLOAT)
  expect(pane, 'the pane').toEqual(PANE)
  expect(ran[0]?.slice(0, 3), 'a zellij run').toEqual(['zellij', 'run', '--floating'])
  expect(await mux($, 'isOpen', { pane: PANE }), 'open').toBe(true)
  await mux($, 'close', { pane: PANE })
  expect(ran.some(a => a[2] === 'close-pane' && a.includes('terminal_7')), 'closed by id').toBe(true)
  expect(await mux($, 'isOpen', { pane: PANE }), 'gone').toBe(false)
})

test('in Zellij: beside and edit name their panes', { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
  const { ran } = rig(on, { ZELLIJ: '0' })
  await start($)
  expect(await mux($, 'openBeside', { name: 'Handoff', cwd: '/w', argv: ['claude', 'go'] }), 'beside').toEqual(PANE)
  expect(await mux($, 'edit', { path: '/w/a.md', floating: true }), 'edit').toEqual(PANE)
  expect(ran.map(a => a.slice(0, 2).join(' ')), 'commands').toEqual(['zellij run', 'zellij edit'])
})

test('a list that fails cannot tell, and another multiplexer\'s pane is not Zellij\'s', { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
  const { ran } = rig(on, { ZELLIJ: '0' }, { listOk: false, panes: ['terminal_7'] })
  await start($)
  expect(await mux($, 'isOpen', { pane: PANE }), 'cannot tell').toBeNull()
  const other = { mux: 'tmux', id: '%3' }
  expect(await mux($, 'isOpen', { pane: other }), 'not ours').toBeNull()
  await mux($, 'close', { pane: other })
  expect(ran.some(a => a[2] === 'close-pane'), 'not closed').toBe(false)
})
