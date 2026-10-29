// What re-sending the chat costs, in USD. List prices per million tokens for the models
// Claude Code runs now (Anthropic's published prices, October 2026). A model not listed
// gets no price, and the band keeps its token wording. Edit this table when prices change.

type Price = { input: number; read: number }

// A cache read is 0.025x the input price on Fable and Mythos 5.1, 0.05x on Opus and Sonnet 5.5.
const PRICES: readonly [string, Price][] = [
  ['fable-5-1', { input: 10, read: 0.25 }],
  ['mythos-5-1', { input: 10, read: 0.25 }],
  ['opus-5-5', { input: 4, read: 0.2 }],
  ['sonnet-5-5', { input: 2, read: 0.1 }],
]
/** Haiku 5.5 is $0.10 up to 100K tokens of prompt and $0.50 above; a cache read is a tenth. */
const HAIKU = 'haiku-5-5'
const HAIKU_TIER = 100_000

/** A cache write costs this many times the input price: 1.25 for the 5 min cache, 2 for 1 hour. */
const WRITE_5M = 1.25
const WRITE_1H = 2
const ONE_HOUR = 60 * 60_000

function priceOf(model: string, tokens: number): Price | null {
  const m = model.toLowerCase()
  if (m.includes(HAIKU)) {
    const input = tokens > HAIKU_TIER ? 0.5 : 0.1
    return { input, read: input / 10 }
  }
  return PRICES.find(([id]) => m.includes(id))?.[1] ?? null
}

/** The next message's prompt while the cache is warm: a cache read. Null for an unpriced model. */
export function warmUsd(model: string, tokens: number): number | null {
  const p = priceOf(model, tokens)
  return p && tokens > 0 ? (tokens / 1e6) * p.read : null
}

/** The next message's prompt once the cache is cold: written to the cache again. */
export function coldUsd(model: string, tokens: number, ttlMs: number): number | null {
  const p = priceOf(model, tokens)
  return p && tokens > 0 ? (tokens / 1e6) * p.input * (ttlMs >= ONE_HOUR ? WRITE_1H : WRITE_5M) : null
}

export const usd = (n: number) => (n < 0.01 ? 'under $0.01' : `$${n.toFixed(2)}`)
