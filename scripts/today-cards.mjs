import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { ImageResponse } from '@vercel/og'
import { h, INK, MUTED, rgba, TEAL, TEXT, wordmark } from '../api/_og/challenge.js'
import { OUTFIT } from '../api/_og/fonts.js'

/**
 * A day's share link, /today/<day>, and the card it unfurls into.
 *
 * Every daily's Share sends that day's link. Its page is the site's shell with the day's title, words and
 * card stamped in (the app opens it at today's ticket, useHashRoute.ts), and its card is a picture of the
 * day: the hole drawn from above, the track, and the five bugs wanted, the same for everyone that day. Both
 * are made here, at build, for the days either side of it (a link is sent the day it's played, and
 * unfurled then), so a link costs nothing to open: no function, no API, nothing to wake. A day outside the
 * window falls back to the shell and the site's own card.
 */

/** The first day all three dailies ran: Find the Bug's Today's Wanted #1. */
const FIRST_DAY = '2026-09-27'
/** Days kept behind the build's, and made ahead of it. */
const BEHIND = 14
const AHEAD = 30

/**
 * Cards already drawn, by what's on them: drawing one takes a second or so, and a build's are mostly the
 * last build's, so each is kept where the host keeps node_modules between builds and drawn again only
 * when something on it changes. Without the cache every card is simply drawn.
 */
const CACHE = 'node_modules/.cache/today-cards'

const W = 1200
const H = 630
/** Each picture's box on the card. */
const PIC_W = 344
const PIC_H = 206

const HOLE_ACCENT = '#3ec8cf'
const TRACK_ACCENT = '#f2813a'
const BUG_ACCENT = '#5fd3c4'

/* ---------- a PNG from pixels, for the hole's shaded green ---------- */

const CRC_TABLE = Array.from({ length: 256 }, (_, k) => {
  let c = k
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length)
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(body))
  return Buffer.concat([head, body, tail])
}

/** RGBA pixels, a row at a time, as a PNG `data:` URL. */
function pngDataUrl(width, height, rgba) {
  const row = width * 4 + 1
  const raw = Buffer.alloc(row * height)
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * row + 1)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  return `data:image/png;base64,${png.toString('base64')}`
}

const svgUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

/* ---------- the days ---------- */

/** The day on the boards' clock, New York time, as YYYY-MM-DD. */
function boardDay(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
}

function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** "Mon, Sep 28". */
function dayWords(day) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** The track from above on its grass, as Today's Track draws it in the dark. */
function trackSvg(plan) {
  const pad = 14
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PIC_W}" height="${PIC_H}" viewBox="0 0 ${PIC_W} ${PIC_H}">` +
    `<defs><linearGradient id="grass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f7134"/><stop offset="1" stop-color="#28502a"/></linearGradient></defs>` +
    `<rect width="${PIC_W}" height="${PIC_H}" fill="url(#grass)"/>` +
    `<svg x="${pad}" y="${pad}" width="${PIC_W - pad * 2}" height="${PIC_H - pad * 2}" viewBox="${plan.viewBox}" preserveAspectRatio="xMidYMid meet">` +
    `<path d="${plan.d}" fill="none" stroke="rgba(236, 241, 236, 0.82)" stroke-width="${plan.road * 1.3}" stroke-linejoin="round"/>` +
    `<path d="${plan.d}" fill="none" stroke="#30353b" stroke-width="${plan.road}" stroke-linejoin="round"/>` +
    `<line x1="${plan.start.x1}" y1="${plan.start.y1}" x2="${plan.start.x2}" y2="${plan.start.y2}" stroke="#ffffff" stroke-width="${plan.road * 0.4}"/>` +
    `<circle cx="${plan.car.x}" cy="${plan.car.y}" r="${plan.car.r}" fill="${TRACK_ACCENT}"/>` +
    `</svg></svg>`
  )
}

/* ---------- the card ---------- */

const text = (style, words) => h('div', { style: { display: 'flex', ...style } }, words)

/** The hole in its three layers (holePlanSvg.ts): what's under the ground, the ground, what's over it. */
function holePicture(layers) {
  const at = { position: 'absolute', left: 0, top: 0 }
  return h(
    'div',
    { style: { display: 'flex', position: 'relative', width: PIC_W, height: PIC_H, overflow: 'hidden' } },
    h('img', { src: svgUrl(layers.under), width: PIC_W, height: PIC_H, style: at }),
    h('img', {
      src: layers.ground.url,
      width: layers.ground.width,
      height: layers.ground.height,
      style: { position: 'absolute', left: layers.ground.x, top: layers.ground.y },
    }),
    h('img', { src: svgUrl(layers.over), width: PIC_W, height: PIC_H, style: at }),
  )
}

function panel({ kicker, accent, name, picture }) {
  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: PIC_W } },
    h('div', { style: { display: 'flex', width: PIC_W, height: PIC_H, borderRadius: 22, overflow: 'hidden', backgroundColor: '#18242e' } }, picture),
    text({ marginTop: 18, fontSize: 18, fontWeight: 700, letterSpacing: 3, color: accent }, kicker),
    h(
      'div',
      { style: { display: 'block', marginTop: 6, width: PIC_W, fontSize: 29, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
      name,
    ),
  )
}

function faces(bugs) {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        width: PIC_W,
        height: PIC_H,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'linear-gradient(160deg, #2a7470 0%, #153f3e 100%)',
      },
    },
    ...bugs.map((face, i) =>
      h(
        'div',
        {
          style: {
            display: 'flex',
            width: 58,
            height: 58,
            marginLeft: i === 0 ? 0 : 7,
            borderRadius: 29,
            backgroundColor: '#f6efdc',
            border: '2px solid rgba(255, 255, 255, 0.55)',
            overflow: 'hidden',
          },
        },
        h('img', { src: face, width: 58, height: 58 }),
      ),
    ),
  )
}

function card(day) {
  const mark = wordmark(38)
  return h(
    'div',
    {
      style: {
        width: W,
        height: H,
        display: 'flex',
        flexDirection: 'column',
        padding: '46px 56px 0',
        backgroundColor: INK,
        backgroundImage: `radial-gradient(ellipse 80% 70% at 12% 0%, ${rgba(TEAL, 0.3)}, ${rgba(TEAL, 0)})`,
        fontFamily: 'Outfit',
        color: TEXT,
      },
    },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 } },
      h('div', { style: { display: 'flex', alignItems: 'flex-end', height: mark.lift } }, mark.element),
      text(
        { fontSize: 22, fontWeight: 700, letterSpacing: 4, color: TEAL, padding: '9px 20px', borderRadius: 999, backgroundColor: rgba(TEAL, 0.16) },
        `TODAY · ${day.words.toUpperCase()}`,
      ),
    ),
    text({ marginTop: 22, fontSize: 64, fontWeight: 700, lineHeight: 1, letterSpacing: -1 }, 'Today’s three'),
    text({ marginTop: 12, fontSize: 28, color: MUTED }, 'Three quick games, the same for everyone. No ads.'),
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', marginTop: 34 } },
      panel({
        kicker: `ACE CHASE · HOLE #${day.hole.n}`,
        accent: HOLE_ACCENT,
        name: day.hole.name,
        picture: holePicture(day.hole.layers),
      }),
      panel({
        kicker: `HOT LAP · TRACK #${day.track.n}`,
        accent: TRACK_ACCENT,
        name: day.track.name,
        picture: h('img', { src: day.track.picture, width: PIC_W, height: PIC_H }),
      }),
      panel({
        kicker: `FIND THE BUG · WANTED #${day.wanted.n}`,
        accent: BUG_ACCENT,
        name: day.wanted.names,
        picture: faces(day.wanted.faces),
      }),
    ),
  )
}

/* ---------- the build's part ---------- */

/**
 * Write each day's card, dist/og/today/<day>.png, and its page, dist/today/<day>/index.html, for the days
 * either side of the build's. `pageHtml` and `outFile` are the prerender's own.
 */
export async function writeTodayCards({ server, dist, pageHtml, outFile, appName }) {
  const { todaysHole } = await server.ssrLoadModule('/src/lib/dailyHole.ts')
  const { holePlanLayers } = await server.ssrLoadModule('/src/games/acechase/holePlanSvg.ts')
  const { dailyTrack } = await server.ssrLoadModule('/src/games/hotlap/daily.ts')
  const { buildTrack } = await server.ssrLoadModule('/src/games/hotlap/sim.ts')
  const { trackPlan } = await server.ssrLoadModule('/src/games/hotlap/trackPlan.ts')
  const { dayNumber, dayWanted, wantedNames } = await server.ssrLoadModule('/src/games/findbug/daily.ts')
  const { gamePlayHref } = await server.ssrLoadModule('/src/hooks/useHashRoute.ts')

  const fonts = OUTFIT.map(({ weight, base64 }) => ({ name: 'Outfit', data: Buffer.from(base64, 'base64'), weight, style: 'normal' }))
  const faceOf = new Map()
  const face = (id) => {
    if (!faceOf.has(id)) faceOf.set(id, `data:image/png;base64,${readFileSync(join('public/og/bugs', `${id}.png`)).toString('base64')}`)
    return faceOf.get(id)
  }

  const today = boardDay(Date.now())
  let from = addDays(today, -BEHIND)
  if (from < FIRST_DAY) from = FIRST_DAY
  const to = addDays(today, AHEAD)
  mkdirSync(join(dist, 'og/today'), { recursive: true })
  mkdirSync(CACHE, { recursive: true })
  let made = 0
  let drawn = 0
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const hole = todaysHole(day)
    const spot = hole.def.spots[0]
    const track = dailyTrack(day)
    const wanted = dayWanted(day)
    const info = {
      words: dayWords(day),
      hole: {
        n: hole.n,
        name: hole.def.name,
        layers: holePlanLayers(hole.def, spot, PIC_W, PIC_H, pngDataUrl),
      },
      track: {
        n: track.n,
        name: track.name,
        picture: svgUrl(trackSvg(trackPlan(buildTrack(track.pieces, { heading: track.shape.heading })))),
      },
      wanted: { n: dayNumber(day), names: wantedNames(wanted), faces: wanted.map((w) => face(w.id)) },
    }
    const tree = card(info)
    const kept = join(CACHE, `${createHash('sha256').update(JSON.stringify(tree)).digest('hex').slice(0, 24)}.png`)
    let png
    if (existsSync(kept)) {
      png = readFileSync(kept)
    } else {
      png = Buffer.from(await new ImageResponse(tree, { width: W, height: H, fonts }).arrayBuffer())
      writeFileSync(kept, png)
      drawn++
    }
    writeFileSync(join(dist, 'og/today', `${day}.png`), png)

    const title = `Today on ${appName} · ${info.words}`
    const description =
      `Today’s Hole #${info.hole.n}, ${info.hole.name}; Today’s Track #${info.track.n}, ${info.track.name}; ` +
      `and Today’s Wanted #${info.wanted.n}: ${info.wanted.names}. Three quick games, the same for everyone, free in your browser with no ads.`
    const meta = { path: `/today/${day}`, title, description, image: `/og/today/${day}.png` }
    const content = {
      heading: title,
      paragraphs: [description],
      links: [
        { href: gamePlayHref('acechase'), label: `Play Today’s Hole #${info.hole.n}` },
        { href: gamePlayHref('hotlap'), label: `Race Today’s Track #${info.track.n}` },
        { href: gamePlayHref('findbug'), label: `Find Today’s Wanted #${info.wanted.n}` },
      ],
    }
    const file = outFile(meta.path)
    mkdirSync(dirname(file), { recursive: true })
    // Somebody's link to somebody, never a search result.
    writeFileSync(file, pageHtml(meta, content).replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>'))
    made++
  }
  return { made, drawn, from, to }
}
