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
        : op === 'theme' ? await $.mux.theme()
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

// A Zellij theme file in the component format, the two components the pane's colours come from.
const TOKYO = `themes {
  tokyo-night {
    text_unselected { base 192 202 245; background 56 62 90; emphasis_0 255 158 100; emphasis_1 42 195 222; emphasis_2 158 206 106; emphasis_3 187 154 247 }
    ribbon_selected { base 56 62 90; background 158 206 106; emphasis_0 249 51 87; emphasis_1 255 158 100; emphasis_2 187 154 247; emphasis_3 122 162 247 }
  }
}
`
const HOME = '/Users/test'
const CONFIG_DIR = `${HOME}/.config/zellij`

type Rig = { listOk?: boolean; panes?: string[]; dirs?: string[]; files?: Record<string, string>; claudeTheme?: string }

/**
 * The environment, the disk and the multiplexer's command line, mocked; `ran` keeps every argv,
 * `reads` every file read. `dirs` are the directories that exist, `files` the files and their text.
 */
function rig(on: On, env: Record<string, string>, opts: Rig = {}) {
  const ran: string[][] = []
  const panes = new Set(opts.panes ?? [])
  const logs: string[] = []
  const reads: string[] = []
  const dirs = opts.dirs ?? []
  const files = opts.files ?? {}
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('env.get', async ($, e) => ({ value: env[(e as { name: string }).name] }) as never)
  on('fs.exists', async ($, e) => {
    const { path } = e as { path: string }
    return { value: dirs.includes(path) || path in files } as never
  })
  on('fs.read', async ($, e) => {
    const { path } = e as { path: string }
    reads.push(path)
    if (!(path in files)) throw new Error(`ENOENT: ${path}`)
    return { value: files[path] } as never
  })
  on('fs.list', async ($, e) => {
    const { path } = e as { path: string }
    if (!dirs.includes(path)) throw new Error(`ENOENT: ${path}`)
    const names = Object.keys(files)
      .filter(p => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/'))
      .map(p => p.slice(path.length + 1))
    return { value: names.map(name => ({ name, kind: 'file', size: 0, mtimeMs: 0, isLink: false })) } as never
  })
  on('config.list', async () => ({ value: [{ key: 'theme', value: opts.claudeTheme ?? 'dark' }] }) as never)
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
  return { ran, logs, reads }
}

test('with no multiplexer every call answers its default, and nothing runs', { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
  const { ran, reads } = rig(on, {})
  await start($)
  expect(await mux($, 'info'), 'info').toBeNull()
  expect(await mux($, 'openFloating', FLOAT), 'float').toBeNull()
  expect(await mux($, 'openBeside', { name: 'Handoff', argv: ['claude'] }), 'beside').toBeNull()
  expect(await mux($, 'edit', { path: '/a.md', floating: true }), 'edit').toBeNull()
  expect(await mux($, 'isOpen', { pane: PANE }), 'cannot tell').toBeNull()
  await mux($, 'close', { pane: PANE })
  expect(await mux($, 'theme'), 'no theme').toBeNull()
  expect(ran, 'no command').toEqual([])
  expect(reads, 'nothing read').toEqual([])
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

test('in Zellij: the theme config.kdl names is read from the themes folder, once', { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
  const { reads, logs } = rig(on, { ZELLIJ: '0', HOME }, {
    dirs: [CONFIG_DIR, `${CONFIG_DIR}/themes`],
    files: { [`${CONFIG_DIR}/config.kdl`]: 'theme "tokyo-night"\n', [`${CONFIG_DIR}/themes/tokyo-night.kdl`]: TOKYO, [`${CONFIG_DIR}/themes/notes.txt`]: 'not a theme' },
  })
  await start($)
  expect(await mux($, 'theme'), 'the theme, by name and colour').toMatchObject({ name: 'tokyo-night', orange: '#ff9e64', green: '#9ece6a', black: '#383e5a', white: '#c0caf5', yellow: null })
  expect(reads, 'the config and the theme files, not the note').toEqual([`${CONFIG_DIR}/config.kdl`, `${CONFIG_DIR}/themes/tokyo-night.kdl`])
  await mux($, 'theme')
  expect(reads, 'read once').toHaveLength(2)
  expect(logs, 'nothing to say').toEqual([])
})

test('in Zellij: no config directory, or a theme no file defines, answers null and says so in the debug log', { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
  const { reads, logs } = rig(on, { ZELLIJ: '0', HOME })
  await start($)
  expect(await mux($, 'theme'), 'no directory').toBeNull()
  expect(reads, 'nothing read').toEqual([])
  expect(logs.some(l => l.includes('no config directory')), 'said why').toBe(true)
})

test('in Zellij: a built-in theme is not on disk, so it answers null', { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
  const { logs } = rig(on, { ZELLIJ: '0', HOME }, {
    dirs: [CONFIG_DIR, `${CONFIG_DIR}/themes`],
    files: { [`${CONFIG_DIR}/config.kdl`]: 'theme "dracula"', [`${CONFIG_DIR}/themes/tokyo-night.kdl`]: TOKYO },
  })
  await start($)
  expect(await mux($, 'theme'), 'dracula').toBeNull()
  expect(logs.some(l => l.includes('no theme "dracula"')), 'said which').toBe(true)
})

test('in Zellij: ZELLIJ_CONFIG_DIR and ZELLIJ_CONFIG_FILE win over the usual places', { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
  const { reads } = rig(on, { ZELLIJ: '0', HOME, ZELLIJ_CONFIG_DIR: '/z', ZELLIJ_CONFIG_FILE: '/c/my.kdl' }, {
    dirs: ['/z', '/z/themes', CONFIG_DIR],
    files: { '/c/my.kdl': 'theme "mine"', '/z/themes/mine.kdl': 'themes { mine { red 1 1 1 } }', [`${CONFIG_DIR}/config.kdl`]: 'theme "tokyo-night"' },
  })
  await start($)
  expect(await mux($, 'theme'), 'from /z').toMatchObject({ name: 'mine', red: '#010101' })
  expect(reads[0], 'the file named').toBe('/c/my.kdl')
})

for (const scheme of ['dark', 'light'] as const) {
  test(`in Zellij: theme_dark and theme_light both set, Claude Code's ${scheme} theme picks`, { timeoutMs: 30000, plugins: [consumer] }, async ($, on) => {
    rig(on, { ZELLIJ: '0', HOME }, {
      dirs: [CONFIG_DIR, `${CONFIG_DIR}/themes`],
      claudeTheme: scheme === 'light' ? 'light-ansi' : 'dark',
      files: {
        [`${CONFIG_DIR}/config.kdl`]: 'theme "neither"\ntheme_dark "night"\ntheme_light "day"',
        [`${CONFIG_DIR}/themes/both.kdl`]: 'themes { night { fg 1 1 1 }; day { fg 2 2 2 }; neither { fg 3 3 3 } }',
      },
    })
    await start($)
    expect(await mux($, 'theme'), scheme).toMatchObject({ name: scheme === 'light' ? 'day' : 'night', fg: scheme === 'light' ? '#020202' : '#010101' })
  })
}
