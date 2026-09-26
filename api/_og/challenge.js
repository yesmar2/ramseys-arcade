/*
 * A friend's challenge, told to whatever unfurls its link: the words for the
 * page's tags (challenge-page.js) and the card for its image
 * (challenge-card.js). Both read the challenge from the arcade's API and the
 * games from the list the build writes (scripts/prerender.mjs). When either
 * can't be read in time they fall back to the game's own challenge card: a
 * chat app waits a few seconds for a preview, not for a server to wake.
 */

import { WORDMARK } from './wordmark.js'

/**
 * @typedef {{ id: string, game: string, name: string, score: number, createdAt: number, replyTo: string | null }} Challenge
 * @typedef {{ name: string, accent: string, unit: [string, string] | null, clock: 'tenths' | 'seconds' | null, base: number }} GameInfo
 * @typedef {{ headers: Record<string, string | string[] | undefined>, url?: string }} Req
 */

export const API = (process.env.VITE_API_URL || 'https://ramseys-arcade-api.onrender.com').replace(/\/$/, '')

/** How long a link preview waits on the arcade's server before settling for the game's card. */
const WAIT_MS = 3000

export const SLUG = /^[a-z0-9-]{1,32}$/
export const ID = /^[A-Za-z0-9]{4,16}$/

/** @param {Req} req The site's own address, as this request reached it. */
export function originOf(req) {
  const header = (/** @type {string} */ name) => String([req.headers[name]].flat()[0] ?? '').split(',')[0].trim()
  return `${header('x-forwarded-proto') || 'https'}://${header('x-forwarded-host') || header('host')}`
}

/** @param {Req} req The query the rewrite handed over: game and id. */
export function queryOf(req) {
  return new URL(req.url ?? '/', 'http://localhost').searchParams
}

/** @param {string} url */
export async function fetchWithin(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WAIT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The challenge; null when there is no such challenge, undefined when the API
 * couldn't say in time.
 * @param {string} id
 * @returns {Promise<Challenge | null | undefined>}
 */
export async function readChallenge(id) {
  if (!ID.test(id)) return null
  try {
    const res = await fetchWithin(`${API}/challenges/${id}`)
    if (res.status === 404) return null
    if (!res.ok) return undefined
    const body = /** @type {any} */ (await res.json())
    const ok = typeof body?.name === 'string' && typeof body?.game === 'string' && Number.isFinite(body?.score)
    return ok ? /** @type {Challenge} */ (body) : undefined
  } catch {
    return undefined
  }
}

/** @type {Promise<Record<string, GameInfo>> | null} */
let games = null

/**
 * Every game's name, colour and units, as the build listed them. Kept for as
 * long as this instance lives: an instance belongs to one deployment.
 * @param {string} origin
 * @returns {Promise<Record<string, GameInfo>>}
 */
export function readGames(origin) {
  if (games) return games
  const pending = fetchWithin(`${origin}/og/challenge/games.json`).then((res) => {
    if (!res.ok) throw new Error(`games.json: ${res.status}`)
    return /** @type {Promise<Record<string, GameInfo>>} */ (res.json())
  })
  // A failed read isn't kept: the next request asks again.
  pending.catch(() => {
    if (games === pending) games = null
  })
  games = pending
  return pending
}

/**
 * A score as the board shows it: 447, 14,310, 47.5s.
 * @param {GameInfo | undefined} info
 * @param {number} score
 */
export function figure(info, score) {
  if (info?.clock) {
    const ms = Math.max(0, info.base - score)
    if (info.clock === 'seconds') {
      const total = Math.round(ms / 1000)
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
    }
    const total = ms / 1000
    const m = Math.floor(total / 60)
    const s = total - m * 60
    return m > 0 ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)}s`
  }
  return score.toLocaleString('en-US')
}

/**
 * What a score counts, to set after it: rows, points; nothing for a time.
 * @param {GameInfo | undefined} info
 * @param {number} score
 */
export function unitOf(info, score) {
  if (info?.clock) return ''
  const [one, many] = info?.unit ?? ['point', 'points']
  return score === 1 ? one : many
}

/**
 * What the link says about itself.
 * @param {Challenge} challenge
 * @param {GameInfo | undefined} info
 */
export function challengeWords(challenge, info) {
  const game = info?.name ?? challenge.game
  const score = figure(info, challenge.score)
  const unit = unitOf(info, challenge.score)
  return {
    game,
    score,
    unit,
    title: `${challenge.name} challenges you on ${game}`,
    description: `Beat ${score}${unit ? ` ${unit}` : ''}. It plays right here in your browser, no account needed.`,
  }
}

/* ---------- the card ---------- */

// The static cards' colours and flag (scripts/gen-og-images.mjs), so the two look like one set.
export const INK = '#0f1c1a'
export const TEAL = '#2eb8a0'
export const TEXT = '#f4faf8'
export const MUTED = '#a9c4be'
const FLAG = 'M196 390 V240 M196 240 H306 L286 280 L306 320 H196'

/**
 * An element for Satori, which takes React's shape without React.
 * @param {string} type
 * @param {Record<string, unknown>} props
 * @param {...unknown} children
 * @returns {any}
 */
export function h(type, props, ...children) {
  return { type, props: { ...props, children: children.length > 1 ? children : children[0] } }
}

/** @param {string} hex @param {number} alpha */
export function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** @param {string} hex A shade toward white, for a figure that has to read on the dark ground. */
export function lift(hex) {
  const n = parseInt(hex.slice(1), 16)
  const up = (/** @type {number} */ c) => Math.round(c + (255 - c) * 0.12)
  return `rgb(${up((n >> 16) & 255)}, ${up((n >> 8) & 255)}, ${up(n & 255)})`
}

/** The column the words sit in, right of the tile: from x 454 to a 46px margin. */
export const COLUMN = 700

/** Where the line along the foot of the card sits: the wordmark and what follows it. */
export const FOOT = 552

/**
 * The wordmark, `size` pixels to the em, in a box whose foot is its baseline,
 * so it lines up with the words after it; `lift` is that box's height. The p
 * hangs out below it.
 * @param {number} size
 */
export function wordmark(size) {
  const { letters, blip, box, shine } = WORDMARK
  const s = size / 1000
  const reach = blip.r * shine.dark.reach
  // The top of the blip's glow, which rises past the letters.
  const top = Math.min(box.y, blip.cy - reach)
  const bottom = box.y + box.height
  const lift = -top * s
  const element = h(
    'div',
    { style: { display: 'flex', position: 'relative', width: box.width * s, height: lift } },
    h(
      'svg',
      {
        width: box.width * s,
        height: (bottom - top) * s,
        viewBox: `${box.x} ${top} ${box.width} ${bottom - top}`,
        style: { position: 'absolute', left: 0, top: 0 },
      },
      h(
        'defs',
        {},
        h(
          'radialGradient',
          { id: 'glow' },
          ...shine.dark.stops.map(([offset, opacity]) => h('stop', { offset, stopColor: shine.dark.glow, stopOpacity: opacity })),
        ),
      ),
      h('path', { d: letters, fill: TEXT }),
      h('circle', { cx: blip.cx, cy: blip.cy, r: reach, fill: 'url(#glow)' }),
      h('circle', { cx: blip.cx, cy: blip.cy, r: blip.r, fill: shine.dark.core }),
    ),
  )
  return { element, lift }
}

/**
 * The card a challenge link unfurls into: whose challenge, the score to beat
 * and on what. Without a challenge (unknown, or the API didn't answer), the
 * game's own "Can you beat it?" card.
 * @param {Challenge | null} challenge
 * @param {GameInfo | undefined} info
 */
export function challengeCard(challenge, info) {
  const accent = info?.accent && /^#[0-9a-f]{6}$/i.test(info.accent) ? info.accent : TEAL
  const text = (/** @type {Record<string, unknown>} */ style, /** @type {string} */ words) => h('div', { style: { display: 'flex', ...style } }, words)
  const mark = wordmark(40)

  let column
  if (challenge) {
    const words = challengeWords(challenge, info)
    // "Beat " and the figure on one line, as large as the column allows.
    const size = Math.min(128, Math.floor(COLUMN / ((5 + words.score.length) * 0.6)))
    column = [
      text({ fontSize: 26, fontWeight: 700, letterSpacing: 5, color: accent }, `${challenge.name.toUpperCase()} CHALLENGES YOU`),
      h(
        'div',
        { style: { display: 'flex', marginTop: 22, fontSize: size, fontWeight: 700, lineHeight: 1, letterSpacing: -2 } },
        h('span', { style: { marginRight: size * 0.24 } }, 'Beat'),
        h('span', { style: { color: lift(accent) } }, words.score),
      ),
      text({ marginTop: 22, fontSize: 40, color: MUTED }, words.unit ? `${words.unit} on ${words.game}` : `on ${words.game}`),
    ]
  } else {
    column = [
      text({ fontSize: 26, fontWeight: 700, letterSpacing: 5, color: accent }, 'CHALLENGE'),
      text({ marginTop: 14, fontSize: 96, fontWeight: 700, lineHeight: 1 }, 'Can you'),
      text({ fontSize: 96, fontWeight: 700, lineHeight: 1 }, 'beat it?'),
      text({ marginTop: 26, fontSize: 34, color: MUTED }, info ? `A friend’s score to beat on ${info.name}` : 'A friend’s score to beat'),
    ]
  }

  return h(
    'div',
    {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        position: 'relative',
        backgroundColor: INK,
        backgroundImage: `radial-gradient(ellipse 85% 85% at 15% 25%, ${rgba(accent, 0.32)}, ${rgba(accent, 0)})`,
        fontFamily: 'Outfit',
        color: TEXT,
      },
    },
    h(
      'div',
      { style: { position: 'absolute', left: 96, top: 165, width: 300, height: 300, display: 'flex', borderRadius: 56, backgroundColor: accent } },
      h(
        'svg',
        { width: 300, height: 300, viewBox: '96 165 300 300' },
        h('path', { d: FLAG, fill: 'none', stroke: TEXT, strokeWidth: 20, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.96 }),
      ),
    ),
    h('div', { style: { position: 'absolute', left: 454, top: 170, width: COLUMN, display: 'flex', flexDirection: 'column' } }, ...column),
    h(
      'div',
      { style: { position: 'absolute', left: 456, top: FOOT - mark.lift, display: 'flex', alignItems: 'baseline' } },
      mark.element,
      h('span', { style: { marginLeft: 18, fontSize: 30, color: MUTED } }, '· plays in your browser'),
    ),
  )
}
