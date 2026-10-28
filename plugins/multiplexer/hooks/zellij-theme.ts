// Zellij's themes, read from its files: where Zellij looks, what its config says, a theme's
// palette in either of its two formats, and the KDL subset all of that is written in. Pure, as
// the rest of the backend: register.ts reads the files between the steps.
//
// The KDL this reads is what Zellij configs and themes use (KDL 1): `//` and nestable `/* */`
// comments; `/-` on a node, a value or a `{}` block; "..." strings with \" \\ \n \t \r \/ \b \f
// and \u{...}; raw strings r"..." and r#"..."#; integers and floats with a sign, `_`, 0x 0o 0b;
// bare node names; true, false and null; key=value properties; `;`, a newline and `}` end a
// node; a `\` continues a line. Not read, the parser throws and the caller answers null: type
// annotations like (u8)255, and KDL 2 syntax (#true, """ strings, bare values).

import type { MuxPalette, MuxTheme } from '../types'
import type { Environment, ThemeBackend, ThemeFile, ThemePlan } from './backend'

export type KdlValue = string | number | boolean | null
export type KdlNode = { name: string; args: KdlValue[]; props: Record<string, KdlValue>; children: KdlNode[] }

// ---------- The KDL subset ----------

type Tok =
  | { kind: 'word'; text: string }
  | { kind: 'str'; text: string }
  | { kind: 'num'; value: number }
  | { kind: '{' | '}' | '=' | '/-' | 'end' }

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f' }
const NUMBER = /^[+-]?(0x[0-9a-f_]+|0o[0-7_]+|0b[01_]+|\d[\d_]*(\.\d[\d_]*)?(e[+-]?\d+)?)$/i

// A function declaration, so a call to it narrows what follows (an arrow's never does not).
function fail(what: string): never {
  throw new Error(`KDL: ${what}`)
}

/** A comment start, a brace, a separator or whitespace: what ends a bare word. */
const ends = (src: string, i: number) => {
  const c = src[i]!
  return ' \t\r\n;{}='.includes(c) || (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*' || src[i + 1] === '-'))
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  const n = src.length
  let i = 0
  while (i < n) {
    const c = src[i]!
    if (c === ' ' || c === '\t' || c === '\r' || c === '﻿') {
      i++
    } else if (c === '\n' || c === ';') {
      out.push({ kind: 'end' })
      i++
    } else if (c === '\\') {
      // A line continuation: the rest of the line (a comment, say) and its newline are whitespace.
      while (i < n && src[i] !== '\n') i++
      i++
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++
    } else if (c === '/' && src[i + 1] === '*') {
      let depth = 1
      i += 2
      while (i < n && depth) {
        if (src[i] === '/' && src[i + 1] === '*') {
          depth++
          i += 2
        } else if (src[i] === '*' && src[i + 1] === '/') {
          depth--
          i += 2
        } else i++
      }
      if (depth) fail('an unterminated /* comment')
    } else if (c === '/' && src[i + 1] === '-') {
      out.push({ kind: '/-' })
      i += 2
    } else if (c === '{' || c === '}' || c === '=') {
      out.push({ kind: c })
      i++
    } else if (c === '"') {
      let s = ''
      let j = i + 1
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\') {
          const e = src[j + 1] ?? ''
          if (e === 'u' && src[j + 2] === '{') {
            const close = src.indexOf('}', j + 3)
            if (close < 0) fail('an unterminated \\u{ escape')
            s += String.fromCodePoint(parseInt(src.slice(j + 3, close), 16))
            j = close + 1
          } else if (e in ESCAPES) {
            s += ESCAPES[e]
            j += 2
          } else fail(`an escape it does not know, \\${e}`)
        } else s += src[j++]
      }
      if (j >= n) fail('an unterminated string')
      out.push({ kind: 'str', text: s })
      i = j + 1
    } else if (c === 'r' && (src[i + 1] === '"' || src[i + 1] === '#')) {
      let j = i + 1
      let hashes = 0
      while (src[j] === '#') {
        hashes++
        j++
      }
      if (src[j] !== '"') fail(`a bare word it does not know, ${src.slice(i, j + 1)}`)
      const close = `"${'#'.repeat(hashes)}`
      const end = src.indexOf(close, j + 1)
      if (end < 0) fail('an unterminated raw string')
      out.push({ kind: 'str', text: src.slice(j + 1, end) })
      i = end + close.length
    } else {
      let j = i
      while (j < n && !ends(src, j)) j++
      const word = src.slice(i, j)
      if (!word) fail(`a character out of place, ${c}`)
      if (NUMBER.test(word)) {
        const plain = word.replace(/_/g, '')
        const value = /^[+-]?0[xob]/i.test(plain) ? (plain.startsWith('-') ? -Number(plain.slice(1)) : Number(plain.replace(/^\+/, ''))) : Number(plain)
        if (Number.isNaN(value)) fail(`a number it cannot read, ${word}`)
        out.push({ kind: 'num', value })
      } else out.push({ kind: 'word', text: word })
      i = j
    }
  }
  return out
}

/** The nodes of a KDL document in the subset above; throws on anything outside it. */
export function parseKdl(text: string): KdlNode[] {
  const toks = tokenize(text)
  let i = 0
  const value = (t: Tok | undefined): KdlValue => {
    if (!t) return fail('a value missing at the end')
    if (t.kind === 'str') return t.text
    if (t.kind === 'num') return t.value
    if (t.kind === 'word') {
      if (t.text === 'true') return true
      if (t.text === 'false') return false
      if (t.text === 'null') return null
      return fail(`a bare value, ${t.text}`)
    }
    return fail('a value expected')
  }
  const block = (): KdlNode[] => {
    // Past the `{`: the nodes up to the matching `}`.
    const out = nodes(false)
    if (toks[i]?.kind !== '}') fail('an unclosed {')
    i++
    return out
  }
  const node = (): KdlNode => {
    const t = toks[i]
    if (!t || (t.kind !== 'word' && t.kind !== 'str')) return fail('a node name expected')
    i++
    const n: KdlNode = { name: t.text, args: [], props: {}, children: [] }
    while (i < toks.length) {
      const u = toks[i]!
      if (u.kind === 'end') {
        i++
        break
      }
      if (u.kind === '}') break
      let drop = false
      let v: Tok | undefined = u
      if (u.kind === '/-') {
        drop = true
        i++
        v = toks[i]
      }
      if (!v) fail('a node cut short')
      if (v.kind === '{') {
        i++
        const kids = block()
        if (!drop) n.children = kids
        if (drop) continue
        break
      }
      if ((v.kind === 'word' || v.kind === 'str') && toks[i + 1]?.kind === '=') {
        const val = value(toks[i + 2])
        i += 3
        if (!drop) n.props[v.text] = val
        continue
      }
      const val = value(v)
      i++
      if (!drop) n.args.push(val)
    }
    return n
  }
  const nodes = (top: boolean): KdlNode[] => {
    const out: KdlNode[] = []
    while (i < toks.length) {
      const t = toks[i]!
      if (t.kind === 'end') {
        i++
        continue
      }
      if (t.kind === '}') {
        if (top) fail('a } with no {')
        return out
      }
      let drop = false
      if (t.kind === '/-') {
        drop = true
        i++
        while (toks[i]?.kind === 'end') i++
      }
      const n = node()
      if (!drop) out.push(n)
    }
    return out
  }
  return nodes(true)
}

// ---------- Colours and palettes ----------

export const PALETTE_KEYS = ['fg', 'bg', 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'orange'] as const

/** "#rrggbb" from a colour node's arguments: three 0-255 integers, or one "#rrggbb" / "#rgb" string; null for one integer (an 8-bit terminal index) or anything else. */
export function hexOf(args: readonly KdlValue[]): string | null {
  if (args.length === 3 && args.every(a => typeof a === 'number' && Number.isInteger(a) && a >= 0 && a <= 255)) {
    return `#${args.map(a => (a as number).toString(16).padStart(2, '0')).join('')}`
  }
  if (args.length === 1 && typeof args[0] === 'string') {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(args[0].trim())
    if (!m) return null
    const hex = m[1]!.toLowerCase()
    return `#${hex.length === 3 ? [...hex].map(ch => ch + ch).join('') : hex}`
  }
  return null
}

// The component format's nodes (Zellij 0.42 and later); a theme with any of them is in it.
const COMPONENTS = new Set([
  'text_unselected', 'text_selected', 'ribbon_unselected', 'ribbon_selected', 'table_title', 'table_cell_unselected',
  'table_cell_selected', 'list_unselected', 'list_selected', 'frame_unselected', 'frame_selected', 'frame_highlight',
  'exit_code_success', 'exit_code_error', 'multiplayer_user_colors',
])

// Where each palette colour sits in a component theme, in order of trust: Zellij derives the
// components from a palette (zellij-utils data.rs, From<Palette> for Styling), and this walks
// that derivation backwards, taking the first slot that holds an RGB colour. `black` starts with
// the ribbon's ink, the dark text Zellij paints on its green ribbon.
const CHAINS: Record<(typeof PALETTE_KEYS)[number], readonly string[]> = {
  orange: ['text_unselected.emphasis_0', 'frame_highlight.base', 'ribbon_selected.emphasis_1', 'table_title.emphasis_0'],
  cyan: ['text_unselected.emphasis_1', 'exit_code_success.emphasis_0', 'frame_selected.emphasis_1'],
  green: ['text_unselected.emphasis_2', 'ribbon_selected.background', 'frame_selected.base', 'exit_code_success.base', 'table_title.base'],
  magenta: ['text_unselected.emphasis_3', 'frame_highlight.emphasis_0', 'ribbon_selected.emphasis_2', 'frame_selected.emphasis_2', 'multiplayer_user_colors.player_1'],
  red: ['ribbon_unselected.emphasis_0', 'ribbon_selected.emphasis_0', 'exit_code_error.base', 'multiplayer_user_colors.player_7'],
  blue: ['ribbon_unselected.emphasis_2', 'ribbon_selected.emphasis_3', 'exit_code_success.emphasis_3', 'multiplayer_user_colors.player_2'],
  yellow: ['exit_code_error.emphasis_0', 'multiplayer_user_colors.player_4'],
  fg: ['ribbon_unselected.background'],
  white: ['text_unselected.base', 'ribbon_unselected.emphasis_1', 'list_unselected.base', 'table_cell_unselected.base'],
  black: ['ribbon_selected.base', 'ribbon_unselected.base', 'text_unselected.background', 'exit_code_success.emphasis_1', 'list_unselected.background'],
  bg: ['text_selected.background', 'table_cell_selected.background', 'list_selected.background'],
}

const emptyPalette = (): MuxPalette => Object.fromEntries(PALETTE_KEYS.map(k => [k, null])) as MuxPalette

/** A theme node's palette: a legacy palette read key by key, a component theme walked back through Zellij's derivation. */
export function paletteOf(theme: KdlNode): MuxPalette {
  const byName = new Map(theme.children.map(c => [c.name, c] as const))
  const out = emptyPalette()
  if (!theme.children.some(c => COMPONENTS.has(c.name))) {
    for (const k of PALETTE_KEYS) {
      const c = byName.get(k)
      out[k] = c ? hexOf(c.args) : null
    }
    return out
  }
  for (const k of PALETTE_KEYS) {
    for (const slot of CHAINS[k]) {
      const [component, field] = slot.split('.') as [string, string]
      const node = byName.get(component)?.children.find(c => c.name === field)
      const hex = node ? hexOf(node.args) : null
      if (hex) {
        out[k] = hex
        break
      }
    }
  }
  return out
}

/** Every theme a document defines, by name: the children of each top-level `themes` node; a later one of the same name wins. */
export function themesIn(nodes: readonly KdlNode[]): Record<string, MuxPalette> {
  const out: Record<string, MuxPalette> = {}
  for (const n of nodes) if (n.name === 'themes') for (const t of n.children) out[t.name] = paletteOf(t)
  return out
}

// ---------- Where Zellij looks ----------

const DEFAULT_THEME = 'default'

/** Zellij's config directories, in its order; the first that exists is the one. Both XDG spellings are listed, as nothing here says which OS this is. */
export function configDirs(env: Environment): string[] {
  const home = env.HOME
  const dirs = [
    env.ZELLIJ_CONFIG_DIR,
    home ? `${home}/.config/zellij` : undefined,
    env.XDG_CONFIG_HOME ? `${env.XDG_CONFIG_HOME}/zellij` : undefined,
    home ? `${home}/Library/Application Support/org.Zellij-Contributors.Zellij` : undefined,
    '/etc/zellij',
  ]
  return [...new Set(dirs.filter((d): d is string => !!d))]
}

/** The config file: ZELLIJ_CONFIG_FILE, else config.kdl in the directory found. */
export const configFile = (env: Environment, dir: string) => env.ZELLIJ_CONFIG_FILE || `${dir}/config.kdl`

/**
 * What the config says: `theme`, or `theme_dark` and `theme_light` when both are set (Zellij then
 * picks by what the terminal reports); `theme_dir`, else the config directory's themes folder;
 * and the themes the config defines in its own `themes {}` block.
 */
export function themePlan(config: string, dir: string): ThemePlan {
  const nodes = parseKdl(config)
  const str = (name: string) => {
    const v = nodes.find(n => n.name === name)?.args[0]
    return typeof v === 'string' ? v : undefined
  }
  const theme = str('theme') ?? DEFAULT_THEME
  const dark = str('theme_dark')
  const light = str('theme_light')
  const both = dark !== undefined && light !== undefined
  return { dark: both ? dark : theme, light: both ? light : theme, dir: str('theme_dir') ?? `${dir}/themes`, inline: themesIn(nodes) }
}

/**
 * The theme named: the theme files win (sorted by name, a later one of the same name wins, as
 * Zellij merges them last; one the parser refuses is skipped, so it hides no other), then the
 * config's own block. Zellij's built-in themes are compiled into it, not on disk, so one of those
 * names answers null.
 */
export function pickTheme(name: string, plan: ThemePlan, files: readonly ThemeFile[]): MuxTheme | null {
  let found: MuxPalette | undefined
  for (const f of [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    let nodes: KdlNode[]
    try {
      nodes = parseKdl(f.text)
    } catch {
      continue
    }
    const t = themesIn(nodes)[name]
    if (t) found = t
  }
  found ??= plan.inline[name]
  return found ? { name, ...found } : null
}

export const zellijTheme: ThemeBackend = { dirs: configDirs, file: configFile, plan: themePlan, pick: pickTheme }
