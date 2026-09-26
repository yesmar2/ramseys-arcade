/*
 * Where somebody stands in an event, told to whatever unfurls their link: the
 * words for the page's tags (event-page.js) and the card for its image
 * (event-card.js). Both read the event from the arcade's API with that
 * player's own row in it, so the score and place are what the standings say
 * now, not anything the link claims. A private event, a bracket, or one the
 * API can't find unfurls as the site itself.
 */

import { API, COLUMN, fetchWithin, figure, FOOT, h, INK, lift, MUTED, rgba, TEAL, TEXT, unitOf, wordmark } from './challenge.js'

/**
 * @typedef {import('./challenge.js').GameInfo} GameInfo
 * @typedef {{ score: number | null, place: number | null, points: number }} Cell
 * @typedef {{ name: string, place?: number, totalPoints: number, byGame: Record<string, Cell> }} Row
 * @typedef {{ id: string, title: string, games: string[], official: boolean, cadence?: string | null, status: string, private: boolean, kind?: string, standings: Row[], standingsTotal?: number, fieldByGame?: Record<string, number> }} EventDetail
 * @typedef {{ name: string, title: string, score: string, line: string, place: number, field: number, over: boolean, heading: string, description: string }} EventWords
 */

export const EVENT_ID = /^[A-Za-z0-9-]{3,64}$/

/** A gamer tag as the boards keep it (normalizePlayerName): trimmed, capitals. */
function tagOf(/** @type {string} */ name) {
  return name.trim().slice(0, 24).toUpperCase()
}

/** 1st, 2nd, 3rd, 11th, 22nd. */
function ordinal(/** @type {number} */ n) {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`
}

/** "Putt, Snake and Bop". */
function list(/** @type {string[]} */ names) {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '')
}

/**
 * The event, with the player's row in its standings; null when there is no
 * such public event of scores, undefined when the API couldn't say in time.
 * @param {string} id
 * @param {string} name
 * @returns {Promise<EventDetail | null | undefined>}
 */
export async function readEvent(id, name) {
  if (!EVENT_ID.test(id) || !tagOf(name)) return null
  try {
    const res = await fetchWithin(`${API}/tournaments/${encodeURIComponent(id)}?playerName=${encodeURIComponent(tagOf(name))}`)
    if (res.status === 404 || res.status === 403) return null
    if (!res.ok) return undefined
    const body = /** @type {any} */ (await res.json())
    if (!body || typeof body.title !== 'string' || !Array.isArray(body.games) || !Array.isArray(body.standings)) return undefined
    if (body.private || body.kind === 'bracket') return null
    return /** @type {EventDetail} */ (body)
  } catch {
    return undefined
  }
}

/**
 * What a shared result says: who, where they stand and with what. Null when
 * the player has nothing on the standings.
 * @param {EventDetail} event
 * @param {string} name
 * @param {Record<string, GameInfo>} games
 * @returns {EventWords | null}
 */
export function eventWords(event, name, games) {
  const tag = tagOf(name)
  const row = event.standings.find((r) => tagOf(r.name) === tag)
  if (!row) return null
  const single = event.games.length === 1 ? (event.games[0] ?? null) : null
  const info = single ? games[single] : undefined
  const cell = single ? row.byGame[single] : null
  const score = single ? (cell?.score ?? null) : row.totalPoints
  const place = single ? (cell?.place ?? null) : (row.place ?? null)
  if (score == null || place == null) return null
  const field = (single ? event.fieldByGame?.[single] : undefined) ?? event.standingsTotal ?? event.standings.length
  const over = event.status === 'ended'
  const figureText = single ? figure(info, score) : score.toLocaleString('en-US')
  const unit = single ? unitOf(info, score) : score === 1 ? 'point' : 'points'
  const on = single ? (info?.name ?? single) : list(event.games.map((g) => games[g]?.name ?? g))
  // What the figure counts and where: "points on Frenzy", "on Find the Bug" for a time, "points across Putt, Snake and Bop".
  const line = `${unit ? `${unit} ` : ''}${single ? 'on' : 'across'} ${on}`
  const standing = `${ordinal(place)} of ${field}${over ? '' : ' so far'}`
  const again =
    event.official && (event.cadence === 'daily' || event.cadence === 'oneshot')
      ? 'There’s a new one every day.'
      : event.official && event.cadence === 'weekly'
        ? 'There’s a new one every week.'
        : ''
  return {
    name: row.name,
    title: event.title,
    score: figureText,
    line,
    place,
    field,
    over,
    heading: over ? `${row.name} finished ${ordinal(place)} on ${event.title}` : `${row.name} is ${ordinal(place)} on ${event.title}`,
    description: `${figureText} ${line}, ${standing}. ${
      over ? again : 'Can you beat it? It plays right here in your browser.'
    }`.trim(),
  }
}

/**
 * The card a shared result unfurls into: the place in the game's tile, the
 * score and the event beside it. Without a result, the event's "Can you beat
 * it?", or the site's.
 * @param {EventWords | null} words
 * @param {GameInfo | undefined} info
 * @param {string | null} title
 */
export function eventCard(words, info, title) {
  const accent = info?.accent && /^#[0-9a-f]{6}$/i.test(info.accent) ? info.accent : TEAL
  const text = (/** @type {Record<string, unknown>} */ style, /** @type {string} */ content) => h('div', { style: { display: 'flex', ...style } }, content)
  const mark = wordmark(40)

  let tile
  let column
  if (words) {
    const place = ordinal(words.place)
    const placeSize = Math.min(128, Math.floor(250 / (place.length * 0.58)))
    const scoreSize = Math.min(150, Math.floor(COLUMN / (words.score.length * 0.62)))
    tile = [
      text({ fontSize: placeSize, fontWeight: 700, lineHeight: 1, letterSpacing: -2, color: TEXT }, place),
      text({ marginTop: 14, fontSize: 36, color: rgba('#ffffff', 0.85) }, `of ${words.field.toLocaleString('en-US')}`),
    ]
    column = [
      text({ fontSize: 26, fontWeight: 700, letterSpacing: 5, color: accent }, `${words.name} · ${words.title}`.toUpperCase()),
      text({ marginTop: 18, fontSize: scoreSize, fontWeight: 700, lineHeight: 1, letterSpacing: -2, color: lift(accent) }, words.score),
      text({ marginTop: 20, fontSize: 40, color: MUTED }, words.line),
      text({ marginTop: 16, fontSize: 34, fontWeight: 700 }, words.over ? 'Final standings' : 'Can you beat it?'),
    ]
  } else {
    tile = [text({ fontSize: 150, fontWeight: 700, lineHeight: 1, color: TEXT }, '?')]
    column = [
      text({ fontSize: 26, fontWeight: 700, letterSpacing: 5, color: accent }, (title ?? 'Event').toUpperCase()),
      text({ marginTop: 14, fontSize: 96, fontWeight: 700, lineHeight: 1 }, 'Can you'),
      text({ fontSize: 96, fontWeight: 700, lineHeight: 1 }, 'beat it?'),
      text({ marginTop: 26, fontSize: 34, color: MUTED }, 'Play it and see where you land'),
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
      {
        style: {
          position: 'absolute',
          left: 96,
          top: 165,
          width: 300,
          height: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 56,
          backgroundColor: accent,
        },
      },
      ...tile,
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
