import { expect, test } from 'claude-code/testing'

import { zellij } from './zellij'

const cmd = ['sh', '/x/float.sh', '/x/frame.txt']

test('Zellij runs inside Zellij only', () => {
  expect(zellij.detect({ ZELLIJ: '0' }), 'ZELLIJ set').toBe(true)
  expect(zellij.detect({ TMUX: '/tmp/tmux-501/default,1,0' }), 'tmux').toBe(false)
  expect(zellij.detect({}), 'nothing').toBe(false)
})

test('a pinned float in the bottom right that leaves the keyboard alone', () => {
  const argv = zellij.floatingArgv({ name: 'Helper Desk', argv: cmd, anchor: 'bottom-right', width: '45%', height: '55%', pinned: true, takeFocus: false, closeOnExit: true })
  expect(argv, 'flags').toEqual([
    'zellij', 'run', '--floating', '--pinned', 'true', '--no-focus', '--near-current-pane', '--close-on-exit',
    '--name', 'Helper Desk', '--x', '55%', '--y', '45%', '--width', '45%', '--height', '55%', '--', ...cmd,
  ])
})

test('the corner follows the size; a centred float sets no position', () => {
  const corner = zellij.floatingArgv({ name: 'n', argv: cmd, anchor: 'bottom-right', width: '30%', height: '40%' })
  expect(corner.slice(corner.indexOf('--x'), corner.indexOf('--x') + 4), 'flush right and bottom').toEqual(['--x', '70%', '--y', '60%'])
  const centred = zellij.floatingArgv({ name: 'n', argv: cmd, anchor: 'center', width: '50%', height: '50%' })
  expect(centred.includes('--x') || centred.includes('--y'), 'Zellij centres it').toBe(false)
  expect(centred.includes('--pinned') || centred.includes('--no-focus'), 'only what was asked').toBe(false)
})

test('beside, edit, list and close', () => {
  expect(zellij.besideArgv({ name: 'Handoff', cwd: '/w', argv: ['claude', 'hi'] }), 'beside').toEqual(['zellij', 'run', '--name', 'Handoff', '--cwd', '/w', '--', 'claude', 'hi'])
  expect(zellij.editArgv({ path: '/w/a.md', floating: true }), 'floating editor').toEqual(['zellij', 'edit', '--floating', '/w/a.md'])
  expect(zellij.editArgv({ path: '/w/a.md' }), 'editor in a pane').toEqual(['zellij', 'edit', '/w/a.md'])
  expect(zellij.closeArgv({ mux: 'zellij', id: 'terminal_7' }), 'close').toEqual(['zellij', 'action', 'close-pane', '--pane-id', 'terminal_7'])
})

test('the pane id from `zellij run`, and whether `list-panes` still names it', () => {
  expect(zellij.paneFrom('terminal_7\n'), 'run output').toEqual({ mux: 'zellij', id: 'terminal_7' })
  expect(zellij.paneFrom(''), 'nothing').toBeNull()
  const list = 'PANE_ID  TYPE  TITLE\nterminal_0  terminal  claude\nterminal_7  terminal  Helper Desk\n'
  expect(zellij.listed(list, { mux: 'zellij', id: 'terminal_7' }), 'open').toBe(true)
  expect(zellij.listed(list, { mux: 'zellij', id: 'terminal_70' }), 'not a prefix match').toBe(false)
  expect(zellij.listed('PANE_ID  TYPE  TITLE\n', { mux: 'zellij', id: 'terminal_7' }), 'closed').toBe(false)
})
