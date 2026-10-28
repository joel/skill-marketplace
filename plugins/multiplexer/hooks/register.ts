import type { EngineInterface, Register } from 'claude-code'

import type { MuxPane, MuxTheme } from '../types'
import type { Backend, Environment, ThemeBackend, ThemeFile } from './backend'
import { zellij } from './zellij'

// The backends, asked in order; the first whose multiplexer this chat runs in answers. A new
// one goes here (see backend.ts); one that should win over Zellij goes above it.
const BACKENDS: readonly Backend[] = [zellij]

// The backend for this session, found on first use; undefined until asked, null for none.
let chosen: Backend | null | undefined
// The environment it was found in, kept for the theme's paths.
let env: Environment = {}
// The theme, read once a process on the first ask (null too): a theme changed in the
// multiplexer shows after a restart of Claude Code.
let theme: Promise<MuxTheme | null> | undefined

/** The variables the backends detect from and find their files by, each read by name (the engine lists what a mod reads). */
async function environment($: EngineInterface): Promise<Environment> {
  const read = (v: Promise<string | undefined>) => v.catch(() => undefined)
  return {
    ZELLIJ: await read($.env.get('ZELLIJ')),
    // No backend reads it yet: it only says that tmux is there.
    TMUX: await read($.env.get('TMUX')),
    // Where a theme is: Zellij's own overrides, and the usual places under HOME and XDG.
    ZELLIJ_CONFIG_DIR: await read($.env.get('ZELLIJ_CONFIG_DIR')),
    ZELLIJ_CONFIG_FILE: await read($.env.get('ZELLIJ_CONFIG_FILE')),
    HOME: await read($.env.get('HOME')),
    XDG_CONFIG_HOME: await read($.env.get('XDG_CONFIG_HOME')),
  }
}

async function backend($: EngineInterface): Promise<Backend | null> {
  if (chosen !== undefined) return chosen
  env = await environment($)
  chosen = BACKENDS.find(b => b.detect(env)) ?? null
  // A multiplexer with no backend yet: say so once, then behave as none.
  if (!chosen && env.TMUX) {
    $.ui.log('multiplexer: tmux found, but there is no tmux backend yet, so this chat behaves as if there were no multiplexer.', { to: 'debug' })
  }
  return chosen
}

/** Runs a backend's command; its output, or null when it failed. */
async function run($: EngineInterface, argv: string[]): Promise<string | null> {
  const r = await $.process.run(argv).catch(() => null)
  return r && r.exitCode === 0 ? r.stdout : null
}

async function open($: EngineInterface, b: Backend, argv: string[]): Promise<MuxPane | null> {
  const out = await run($, argv)
  return out === null ? null : b.paneFrom(out)
}

/** Which scheme the terminal would report, read off Claude Code's own theme row: light when it says so, else dark, the multiplexer's own fallback. */
async function preferred($: EngineInterface): Promise<'dark' | 'light'> {
  const rows = await $.config.list().catch(() => [])
  const v = rows.find(r => r.key === 'theme')?.value
  return typeof v === 'string' && v.startsWith('light') ? 'light' : 'dark'
}

/** The theme the backend's files name, or null, with a debug line saying what was looked for. */
async function readTheme($: EngineInterface, t: ThemeBackend): Promise<MuxTheme | null> {
  let dir: string | undefined
  for (const d of t.dirs(env)) {
    if (await $.fs.exists(d).catch(() => false)) {
      dir = d
      break
    }
  }
  if (!dir) {
    $.ui.log('multiplexer: no config directory, so no theme; mods keep their own colours.', { to: 'debug' })
    return null
  }
  const config = await $.fs.read(t.file(env, dir)).then(String).catch(() => '')
  const plan = t.plan(config, dir)
  const name = plan.dark === plan.light ? plan.dark : (await preferred($)) === 'light' ? plan.light : plan.dark
  const entries = await $.fs.list(plan.dir).catch(() => [])
  const files: ThemeFile[] = []
  for (const en of entries) {
    // A symbolic link lists as `other` with isLink: dotfile managers link theme files, and the multiplexer reads through them.
    if (!en.name.endsWith('.kdl') || !(en.kind === 'file' || en.isLink)) continue
    const text = await $.fs.read(`${plan.dir}/${en.name}`).then(String).catch(() => null)
    if (text !== null) files.push({ name: en.name, text })
  }
  const found = t.pick(name, plan, files)
  if (!found) $.ui.log(`multiplexer: no theme "${name}" in ${plan.dir} or the config (a built-in theme is not on disk), so mods keep their own colours.`, { to: 'debug' })
  return found
}

export const register: Register = on => {
  // Core: the answers with no multiplexer. The hooks below answer in their place when one is found.
  on('engine.create', async ($, e, next) => {
    const built = await next(e)
    return {
      ...built,
      mux: {
        info: async () => null,
        openFloating: async () => null,
        openBeside: async () => null,
        edit: async () => null,
        isOpen: async () => null,
        close: async () => undefined,
        theme: async () => null,
      },
    }
  })

  on('mux.theme', async ($, e, next) => {
    const b = await backend($)
    if (!b?.theme) return next(e)
    theme ??= readTheme($, b.theme).catch(err => {
      $.ui.log(`multiplexer: reading the theme failed, so mods keep their own colours: ${String(err)}`, { to: 'debug' })
      return null
    })
    return { value: await theme }
  })

  on('mux.info', async ($, e, next) => {
    const b = await backend($)
    return b ? { value: { name: b.name, ...b.can } } : next(e)
  })

  on('mux.openFloating', async ($, e, next) => {
    const b = await backend($)
    return b?.can.floating ? { value: await open($, b, b.floatingArgv(e)) } : next(e)
  })

  on('mux.openBeside', async ($, e, next) => {
    const b = await backend($)
    return b?.can.beside ? { value: await open($, b, b.besideArgv(e)) } : next(e)
  })

  on('mux.edit', async ($, e, next) => {
    const b = await backend($)
    return b?.can.edit ? { value: await open($, b, b.editArgv(e)) } : next(e)
  })

  // A pane another multiplexer opened is not this backend's to judge or close.
  on('mux.isOpen', async ($, e, next) => {
    const b = await backend($)
    if (!b || b.name !== e.pane.mux) return next(e)
    const out = await run($, b.listArgv())
    return { value: out === null ? null : b.listed(out, e.pane) }
  })

  on('mux.close', async ($, e, next) => {
    const b = await backend($)
    if (!b || b.name !== e.pane.mux) return next(e)
    await run($, b.closeArgv(e.pane))
    return { value: undefined }
  })
}
