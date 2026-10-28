import { expect, test } from 'claude-code/testing'

import { configDirs, configFile, hexOf, paletteOf, parseKdl, pickTheme, themePlan, themesIn } from './zellij-theme'

// A theme in the component format (Zellij 0.42 and later), as a person's ~/.config/zellij/themes
// file: comments, and one 8-bit colour (text_selected's 245 and 238).
const TOKYO = `// Tokyo Night for Zellij, written in the component-based theme format
// (Zellij >= 0.42) so that the text-selection highlight can be set.
//
// Palette reference:
//   fg      169 177 214    bg      26 27 38     black  56 62 90
themes {
    tokyo-night {
        text_unselected {
            base 192 202 245
            background 56 62 90
            emphasis_0 255 158 100
            emphasis_1 42 195 222
            emphasis_2 158 206 106
            emphasis_3 187 154 247
        }
        // Mouse-selection highlight in panes. 238/245 are the 256-colour
        // greys Zellij's default theme uses (#444444 background, #8a8a8a text).
        text_selected {
            base 245
            background 238
            emphasis_0 255 158 100
            emphasis_1 42 195 222
            emphasis_2 158 206 106
            emphasis_3 187 154 247
        }
        ribbon_unselected {
            base 56 62 90
            background 169 177 214
            emphasis_0 249 51 87
            emphasis_1 192 202 245
            emphasis_2 122 162 247
            emphasis_3 187 154 247
        }
        ribbon_selected {
            base 56 62 90
            background 158 206 106
            emphasis_0 249 51 87
            emphasis_1 255 158 100
            emphasis_2 187 154 247
            emphasis_3 122 162 247
        }
        table_title {
            base 158 206 106
            background 0
            emphasis_0 255 158 100
            emphasis_1 42 195 222
            emphasis_2 158 206 106
            emphasis_3 187 154 247
        }
        table_cell_selected {
            base 192 202 245
            background 26 27 38
            emphasis_0 255 158 100
            emphasis_1 42 195 222
            emphasis_2 158 206 106
            emphasis_3 187 154 247
        }
        frame_selected {
            base 158 206 106
            background 0
            emphasis_0 255 158 100
            emphasis_1 42 195 222
            emphasis_2 187 154 247
            emphasis_3 0
        }
        frame_highlight {
            base 255 158 100
            background 0
            emphasis_0 187 154 247
            emphasis_1 0
            emphasis_2 255 158 100
            emphasis_3 255 158 100
        }
        exit_code_success {
            base 158 206 106
            background 0
            emphasis_0 42 195 222
            emphasis_1 56 62 90
            emphasis_2 187 154 247
            emphasis_3 122 162 247
        }
        exit_code_error {
            base 249 51 87
            background 0
            emphasis_0 224 175 104
            emphasis_1 0
            emphasis_2 0
            emphasis_3 0
        }
        multiplayer_user_colors {
            player_1 187 154 247
            player_2 122 162 247
            player_3 0
            player_4 224 175 104
            player_5 42 195 222
            player_6 0
            player_7 249 51 87
            player_8 0
            player_9 0
            player_10 0
        }
    }
}
`

const TOKYO_PALETTE = {
  fg: '#a9b1d6',
  bg: '#1a1b26',
  black: '#383e5a',
  red: '#f93357',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#bb9af7',
  cyan: '#2ac3de',
  white: '#c0caf5',
  orange: '#ff9e64',
}

// A theme in the older palette format, colours as hex strings and as RGB.
const LEGACY = `themes {
    nord {
        fg "#d8dee9"
        bg "#2e3440"
        black 59 66 82
        red 191 97 106
        green 163 190 140
        yellow 235 203 139
        blue 129 161 193
        magenta 180 142 173
        cyan 136 192 208
        white 229 233 240
        orange "#D08770"
    }
}
`

// A config with the shapes Zellij's own uses around the theme lines.
const CONFIG = `// Zellij config
keybinds clear-defaults=true {
    normal {
        bind "Ctrl g" { SwitchToMode "Locked"; }
        /-bind "Ctrl q" { Quit; }
    }
    shared_except "locked" {
        bind "Alt n" { NewPane; }
    }
}
/* a block comment /* nested */ still a comment */
theme "tokyo-night"
default_mode "locked"
pane_frames false
scrollback_lines_to_serialize 10000
`

const theme = (text: string, name: string) => themesIn(parseKdl(text))[name]
const throws = (fn: () => unknown) => {
  try {
    fn()
    return false
  } catch {
    return true
  }
}

test('parseKdl: nodes, arguments, properties, children and terminators', () => {
  const [a] = parseKdl('a 1 2 "x" k=true { b; c "y" }')
  expect(a?.name, 'name').toBe('a')
  expect(a?.args, 'arguments').toEqual([1, 2, 'x'])
  expect(a?.props, 'property').toEqual({ k: true })
  expect(a?.children.map(c => [c.name, c.args]), 'children').toEqual([['b', []], ['c', ['y']]])
  const cfg = parseKdl(CONFIG)
  expect(cfg.map(n => n.name), 'top-level nodes').toEqual(['keybinds', 'theme', 'default_mode', 'pane_frames', 'scrollback_lines_to_serialize'])
  expect(cfg[0]?.props, 'clear-defaults').toEqual({ 'clear-defaults': true })
  expect(cfg[0]?.children[0]?.children.map(c => c.args[0]), 'the slashdashed bind is gone').toEqual(['Ctrl g'])
  expect(cfg[1]?.args, 'theme').toEqual(['tokyo-night'])
  expect(cfg[3]?.args, 'a boolean').toEqual([false])
  expect(cfg[4]?.args, 'a number').toEqual([10000])
})

test('parseKdl: comments, slashdash, strings and numbers', () => {
  expect(parseKdl('n "a // not a comment" /* x /* y */ z */ 2')[0]?.args, 'a // in a string, a nested block comment').toEqual(['a // not a comment', 2])
  const [kept] = parseKdl('/-gone 1\nkept /-"no" 2 /-{ child }\n')
  expect(kept?.name, 'the slashdashed node is gone').toBe('kept')
  expect(kept?.args, 'the slashdashed value is gone').toEqual([2])
  expect(kept?.children, 'the slashdashed block is gone').toEqual([])
  expect(parseKdl(String.raw`n r"a\b" r#"q"t"#`)[0]?.args, 'raw strings').toEqual([String.raw`a\b`, 'q"t'])
  expect(parseKdl('n "q\\"t\\n\\u{41}"')[0]?.args, 'escapes').toEqual(['q"t\nA'])
  expect(parseKdl('n 1_000 -2 0x1F 1.5 "a" \\\n  "b"')[0]?.args, 'numbers and a continued line').toEqual([1000, -2, 31, 1.5, 'a', 'b'])
  expect(parseKdl('')).toEqual([])
  expect(throws(() => parseKdl('n "abc')), 'an unterminated string').toBe(true)
  expect(throws(() => parseKdl('n {')), 'an unclosed brace').toBe(true)
  expect(throws(() => parseKdl('}')), 'a stray brace').toBe(true)
  expect(throws(() => parseKdl('n (u8)255')), 'a type annotation').toBe(true)
  expect(throws(() => parseKdl('n /* open')), 'an unterminated block comment').toBe(true)
})

test('hexOf: three numbers, a hex string, and what is not a colour', () => {
  expect(hexOf([255, 158, 100]), 'RGB').toBe('#ff9e64')
  expect(hexOf(['#FF9E64']), 'hex, lower-cased').toBe('#ff9e64')
  expect(hexOf(['#f96']), 'short hex').toBe('#ff9966')
  expect(hexOf([245]), 'an 8-bit index').toBeNull()
  expect(hexOf([256, 0, 0]), 'out of range').toBeNull()
  expect(hexOf([1.5, 2, 3]), 'not integers').toBeNull()
  expect(hexOf([]), 'nothing').toBeNull()
  expect(hexOf(['red']), 'a name').toBeNull()
  expect(hexOf(['ff9e64']), 'no #').toBeNull()
})

test('paletteOf: the legacy palette, key by key', () => {
  expect(theme(LEGACY, 'nord'), 'all eleven').toEqual({
    fg: '#d8dee9', bg: '#2e3440', black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
    blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0', orange: '#d08770',
  })
  const partial = paletteOf(parseKdl('x { fg 1 2 3; red 1 }')[0]!)
  expect(partial.fg, 'given').toBe('#010203')
  expect(partial.red, 'an index is unknown').toBeNull()
  expect(partial.bg, 'left out').toBeNull()
})

test('paletteOf: a component theme walked back to the palette', () => {
  expect(theme(TOKYO, 'tokyo-night'), 'Tokyo Night').toEqual(TOKYO_PALETTE)
  // text_selected.background is 8-bit (238): bg comes from the next slot in its chain.
  expect(theme(TOKYO, 'tokyo-night')?.bg, 'bg past the 8-bit slot').toBe('#1a1b26')
  const only = theme('themes { t { text_unselected { base 1 1 1; background 2 2 2; emphasis_0 3 3 3; emphasis_1 4 4 4; emphasis_2 5 5 5; emphasis_3 6 6 6 } } }', 't')
  expect(only, 'text_unselected alone').toEqual({
    white: '#010101', black: '#020202', orange: '#030303', cyan: '#040404', green: '#050505', magenta: '#060606',
    fg: null, bg: null, red: null, blue: null, yellow: null,
  })
})

test('themePlan: the names, the themes folder and the inline themes', () => {
  expect(themePlan('theme "tokyo-night"', '/h/.config/zellij'), 'one theme').toEqual({ dark: 'tokyo-night', light: 'tokyo-night', dir: '/h/.config/zellij/themes', inline: {} })
  expect(themePlan('', '/d'), 'nothing said').toEqual({ dark: 'default', light: 'default', dir: '/d/themes', inline: {} })
  const both = themePlan('theme "a"\ntheme_dark "d"\ntheme_light "l"', '/d')
  expect([both.dark, both.light], 'dark and light both set').toEqual(['d', 'l'])
  const one = themePlan('theme "a"\ntheme_dark "d"', '/d')
  expect([one.dark, one.light], 'only one of them set: theme stays').toEqual(['a', 'a'])
  expect(themePlan('theme_dir "/x"', '/d').dir, 'theme_dir').toBe('/x')
  expect(themePlan(`${LEGACY}\ntheme "nord"`, '/d').inline.nord?.red, 'an inline theme').toBe('#bf616a')
  expect(themePlan(CONFIG, '/d').dark, 'a real config').toBe('tokyo-night')
  expect(throws(() => themePlan('theme "x', '/d')), 'a broken config throws').toBe(true)
})

test('pickTheme: the files first, then the config, else null', () => {
  const plan = themePlan('', '/d')
  const tokyo = pickTheme('tokyo-night', plan, [{ name: 'tokyo-night.kdl', text: TOKYO }])
  expect(tokyo, 'from a file').toEqual({ name: 'tokyo-night', ...TOKYO_PALETTE })
  const a = { name: 'a.kdl', text: 'themes { x { red 1 1 1 } }' }
  const b = { name: 'b.kdl', text: 'themes { x { red 2 2 2 } }' }
  expect(pickTheme('x', plan, [b, a])?.red, 'two files: the later by name wins').toBe('#020202')
  const inline = themePlan('themes { x { red 9 9 9 } }', '/d')
  expect(pickTheme('x', inline, [a])?.red, 'a file beats the config').toBe('#010101')
  expect(pickTheme('x', inline, [])?.red, 'the config alone').toBe('#090909')
  expect(pickTheme('dracula', inline, [a]), 'a name no file defines (a built-in)').toBeNull()
  expect(pickTheme('x', plan, [{ name: 'bad.kdl', text: 'themes { x {' }, a])?.red, 'a broken file is skipped').toBe('#010101')
})

test('configDirs and configFile: Zellij\'s places, in its order', () => {
  expect(configDirs({ HOME: '/h', XDG_CONFIG_HOME: '/x', ZELLIJ_CONFIG_DIR: '/z' }), 'everything set').toEqual([
    '/z', '/h/.config/zellij', '/x/zellij', '/h/Library/Application Support/org.Zellij-Contributors.Zellij', '/etc/zellij',
  ])
  expect(configDirs({}), 'no home').toEqual(['/etc/zellij'])
  expect(configDirs({ HOME: '/h', XDG_CONFIG_HOME: '/h/.config' }).filter(d => d === '/h/.config/zellij'), 'no duplicate').toHaveLength(1)
  expect(configFile({ ZELLIJ_CONFIG_FILE: '/c.kdl' }, '/d'), 'the file override').toBe('/c.kdl')
  expect(configFile({}, '/d'), 'the usual file').toBe('/d/config.kdl')
})
