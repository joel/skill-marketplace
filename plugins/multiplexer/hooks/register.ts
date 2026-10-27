import type { EngineInterface, Register } from 'claude-code'

import type { MuxPane } from '../types'
import type { Backend, Environment } from './backend'
import { zellij } from './zellij'

// The backends, asked in order; the first whose multiplexer this chat runs in answers. A new
// one goes here (see backend.ts); one that should win over Zellij goes above it.
const BACKENDS: readonly Backend[] = [zellij]

// The backend for this session, found on first use; undefined until asked, null for none.
let chosen: Backend | null | undefined

/** The variables the backends detect from, each read by name (the engine lists what a mod reads). */
async function environment($: EngineInterface): Promise<Environment> {
  const read = (v: Promise<string | undefined>) => v.catch(() => undefined)
  return {
    ZELLIJ: await read($.env.get('ZELLIJ')),
    // No backend reads it yet: it only says that tmux is there.
    TMUX: await read($.env.get('TMUX')),
  }
}

async function backend($: EngineInterface): Promise<Backend | null> {
  if (chosen !== undefined) return chosen
  const env = await environment($)
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
      },
    }
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
