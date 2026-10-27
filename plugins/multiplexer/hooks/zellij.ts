// The Zellij backend: every $.mux call as a `zellij run`, `zellij edit` or `zellij action`.
// Zellij sets ZELLIJ in every pane it runs, so a chat inside Zellij sees it.

import type { MuxPane } from '../types'
import { type Backend, lastWord } from './backend'

/** "45%" -> "55%": the offset that puts a pane of that share flush with the far edge. */
const rest = (share: string) => {
  const n = parseFloat(share)
  return Number.isFinite(n) && share.trim().endsWith('%') ? `${Math.max(0, 100 - n)}%` : '0'
}

export const zellij: Backend = {
  name: 'zellij',
  can: { floating: true, beside: true, edit: true },
  detect: env => !!env.ZELLIJ,

  floatingArgv(a) {
    const argv = ['zellij', 'run', '--floating']
    if (a.pinned) argv.push('--pinned', 'true')
    if (a.takeFocus === false) argv.push('--no-focus', '--near-current-pane')
    if (a.closeOnExit) argv.push('--close-on-exit')
    argv.push('--name', a.name)
    if (a.cwd) argv.push('--cwd', a.cwd)
    // Zellij centres a floating pane by itself; bottom right sets x and y to what the size leaves.
    if (a.anchor === 'bottom-right') argv.push('--x', rest(a.width), '--y', rest(a.height))
    argv.push('--width', a.width, '--height', a.height, '--', ...a.argv)
    return argv
  },

  besideArgv: a => ['zellij', 'run', '--name', a.name, ...(a.cwd ? ['--cwd', a.cwd] : []), '--', ...a.argv],

  editArgv: a => ['zellij', 'edit', ...(a.floating ? ['--floating'] : []), a.path],

  listArgv: () => ['zellij', 'action', 'list-panes'],

  // One pane a line, its id first: "terminal_7  terminal  Helper Desk".
  listed: (out, pane) => out.split('\n').some(line => line.trim().split(/\s+/)[0] === pane.id),

  closeArgv: pane => ['zellij', 'action', 'close-pane', '--pane-id', pane.id],

  // `zellij run` and `zellij edit` print the new pane's id: "terminal_7".
  paneFrom(out): MuxPane | null {
    const id = lastWord(out)
    return id ? { mux: 'zellij', id } : null
  },
}
