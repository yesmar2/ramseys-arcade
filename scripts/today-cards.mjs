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
 * card stamped in (the app opens the Today page, useHashRoute.ts), and its card is a picture of the
 * day's ticket, the same for everyone that day: since 2026-10-06 the four races (the track, the marble's
 * course, the cave and the hills), and before then the hole, the bugs wanted and the glasses (empty) too, as
 * each joined. Both are made here, at build, for the days either side of it (a link is sent the day it's
 * played, and unfurled then), so a link costs
 * nothing to open: no function, no API, nothing to wake. A day outside the window falls back to the shell
 * and the site's own card.
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

/**
 * The card's measures: three dailies across it, four from the day Today's Pour joins the ticket (Half
 * Full's TODAY_FROM), five from the day Today's Course does (Marble Run's), six from the day Today's Cave
 * does (Lander's), seven from the day Today's Hills do (Swoop's), each picture narrower and its words
 * smaller, to fit the same width. Each has its picture's box, its kicker's size and spacing, its name's size,
 * and the wanted faces' size and gap.
 */
const THREE = { picW: 344, picH: 206, kicker: 18, spacing: 3, name: 29, face: 58, faceGap: 7 }
const FOUR = { picW: 254, picH: 206, kicker: 14, spacing: 1.5, name: 24, face: 42, faceGap: 5 }
const FIVE = { picW: 202, picH: 190, kicker: 12, spacing: 1, name: 20, face: 34, faceGap: 4 }
const SIX = { picW: 168, picH: 178, kicker: 10, spacing: 0.4, name: 17, face: 28, faceGap: 3 }
const SEVEN = { picW: 144, picH: 170, kicker: 8.5, spacing: 0.1, name: 15, face: 24, faceGap: 2 }
const SIZES = { 3: THREE, 4: FOUR, 5: FIVE, 6: SIX, 7: SEVEN }
const COUNT_WORDS = { 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven' }

const HOLE_ACCENT = '#3ec8cf'
const TRACK_ACCENT = '#f2813a'
const BUG_ACCENT = '#5fd3c4'
const POUR_ACCENT = '#f5b942'
const COURSE_ACCENT = '#d774f0'
const CAVE_ACCENT = '#a48af0'
const HILLS_ACCENT = '#f2706a'

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

/**
 * The track from above as Today's Track draws it, in a picture's box: as the game looks since its neon look
 * (2026-09-28), dark ground ruled in faint cyan with a glow low down, the road dark between edges of light.
 */
function trackSvg(plan, { picW, picH }) {
  const pad = 14
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${picW}" height="${picH}" viewBox="0 0 ${picW} ${picH}">` +
    `<defs><pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="rgba(20,200,236,0.16)" stroke-width="1"/></pattern>` +
    `<radialGradient id="glow" cx="0.5" cy="1.15" r="0.9"><stop offset="0" stop-color="#16d8ff" stop-opacity="0.22"/><stop offset="1" stop-color="#16d8ff" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${picW}" height="${picH}" fill="#01040a"/>` +
    `<rect width="${picW}" height="${picH}" fill="url(#grid)"/>` +
    `<rect width="${picW}" height="${picH}" fill="url(#glow)"/>` +
    `<svg x="${pad}" y="${pad}" width="${picW - pad * 2}" height="${picH - pad * 2}" viewBox="${plan.viewBox}" preserveAspectRatio="xMidYMid meet">` +
    `<path d="${plan.d}" fill="none" stroke="rgba(63,240,255,0.22)" stroke-width="${plan.road * 2.4}" stroke-linejoin="round"/>` +
    `<path d="${plan.d}" fill="none" stroke="#3ff0ff" stroke-width="${plan.road * 1.3}" stroke-linejoin="round"/>` +
    `<path d="${plan.d}" fill="none" stroke="#04070c" stroke-width="${plan.road}" stroke-linejoin="round"/>` +
    `<line x1="${plan.start.x1}" y1="${plan.start.y1}" x2="${plan.start.x2}" y2="${plan.start.y2}" stroke="#ffffff" stroke-width="${plan.road * 0.4}"/>` +
    `<circle cx="${plan.car.x}" cy="${plan.car.y}" r="${plan.car.r}" fill="${TRACK_ACCENT}"/>` +
    `</svg></svg>`
  )
}

/**
 * The course from above as Marble Run draws it, in a picture's box: the track in magenta light on the dark,
 * over a faint violet grid, from its start (amber) to its goal (white). `point` is the game's sim.ts.
 */
function courseSvg(course, point, { picW, picH }) {
  const [x0, x1, z0, z1] = course.box
  const pad = 16
  const scale = Math.min((picW - pad * 2) / (x1 - x0), (picH - pad * 2) / (z1 - z0))
  const ox = (picW - (x1 - x0) * scale) / 2
  const oz = (picH - (z1 - z0) * scale) / 2
  const at = (x, z) => `${(ox + (x - x0) * scale).toFixed(1)} ${(oz + (z - z0) * scale).toFixed(1)}`
  const paths = []
  for (const p of course.pieces) {
    if (p.gap) continue
    const n = Math.max(2, Math.ceil(p.len / 2))
    const pts = []
    for (let i = 0; i <= n; i++) pts.push(at(...point(p, (p.len * i) / n, 0)))
    paths.push(`M${pts.join(' L')}`)
  }
  const d = paths.join(' ')
  const road = Math.max(3, 5.5 * scale)
  const [sx, sz] = at(...point(course.pieces[0], 0, 0)).split(' ')
  const goal = course.lines[course.lines.length - 1]
  const [gx, gz] = at(...point(goal.p, goal.u, 0)).split(' ')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${picW}" height="${picH}" viewBox="0 0 ${picW} ${picH}">` +
    `<defs><pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="rgba(138,92,255,0.18)" stroke-width="1"/></pattern></defs>` +
    `<rect width="${picW}" height="${picH}" fill="#07040f"/>` +
    `<rect width="${picW}" height="${picH}" fill="url(#grid)"/>` +
    `<path d="${d}" fill="none" stroke="rgba(255,92,225,0.25)" stroke-width="${road * 2.6}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="#ff5ce1" stroke-width="${road}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${sx}" cy="${sz}" r="${road * 1.2}" fill="#f5b942"/>` +
    `<circle cx="${gx}" cy="${gz}" r="${road * 1.3}" fill="#ffffff"/>` +
    `</svg>`
  )
}

/**
 * The cave from the side as Lander draws it (its CaveDrawing.tsx), in a picture's box: its air dark between
 * walls lit violet near the top and magenta deep down, on the rock's dark, the pads in amber. `cave` is the
 * game's sim.ts dig.
 */
function caveSvg(cave, { picW, picH }) {
  const [x0, x1, y0, y1] = cave.box
  const pad = 12
  const scale = Math.min((picW - pad * 2) / (x1 - x0), (picH - pad * 2) / (y1 - y0))
  const ox = (picW - (x1 - x0) * scale) / 2
  const oy = (picH - (y1 - y0) * scale) / 2
  const X = (x) => (ox + (x - x0) * scale).toFixed(1)
  const Y = (y) => (oy + (y1 - y) * scale).toFixed(1)
  const N = cave.nodes
  const left = []
  const right = []
  for (let i = 0; i < N.length; i += 2) {
    const a = N[Math.max(0, i - 1)]
    const b = N[Math.min(N.length - 1, i + 1)]
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const nx = -(b.y - a.y) / L
    const ny = (b.x - a.x) / L
    const p = N[i]
    left.push(`${X(p.x + nx * p.r)} ${Y(p.y + ny * p.r)}`)
    right.push(`${X(p.x - nx * p.r)} ${Y(p.y - ny * p.r)}`)
  }
  const ends = [N[0], N[N.length - 1]]
  const air =
    `<path d="M${left.join(' L')} L${right.reverse().join(' L')} Z"/>` +
    ends.map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${(p.r * scale).toFixed(1)}"/>`).join('') +
    cave.rooms.map((m) => `<rect x="${X(m.x0)}" y="${Y(m.y1)}" width="${((m.x1 - m.x0) * scale).toFixed(1)}" height="${((m.y1 - m.y0) * scale).toFixed(1)}"/>`).join('')
  const wall = 'url(#wall)'
  // The walls' light thicker than true scale: a cave this small is a thread otherwise.
  const line = Math.max(1.6, 1.8 * scale)
  const [start, land] = cave.pads
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${picW}" height="${picH}" viewBox="0 0 ${picW} ${picH}">` +
    `<defs><linearGradient id="wall" x1="0" y1="${Y(y1)}" x2="0" y2="${Y(y0)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8a5cff"/><stop offset="1" stop-color="#ff4fd8"/></linearGradient></defs>` +
    `<rect width="${picW}" height="${picH}" fill="#0b0716"/>` +
    `<g fill="${wall}" stroke="${wall}" stroke-width="${(line * 4).toFixed(1)}" stroke-linejoin="round" opacity="0.22">${air}</g>` +
    `<g fill="${wall}" stroke="${wall}" stroke-width="${(line * 1.5).toFixed(1)}" stroke-linejoin="round">${air}</g>` +
    `<g fill="#150d29">${air}</g>` +
    cave.pillars.map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${(p.r * scale).toFixed(1)}" fill="#0b0716" stroke="${wall}" stroke-width="${line.toFixed(1)}"/>`).join('') +
    `<rect x="${X(start.x0)}" y="${(Number(Y(start.y)) - line * 1.6).toFixed(1)}" width="${((start.x1 - start.x0) * scale).toFixed(1)}" height="${(line * 1.6).toFixed(1)}" fill="#ffb347" opacity="0.7"/>` +
    `<rect x="${X(land.x0)}" y="${(Number(Y(land.y)) - line * 2).toFixed(1)}" width="${((land.x1 - land.x0) * scale).toFixed(1)}" height="${(line * 2).toFixed(1)}" fill="#ffb347"/>` +
    `</svg>`
  )
}

/**
 * The hills from the side as Swoop draws them (its HillsDrawing.tsx), in a picture's box: the whole way to the
 * line at dusk, the tops stretched up, washed in the day's colour with a lit edge, the flags and the line.
 * `hills` is the game's sim.ts layHills, with its `heightAt` and `hillsSpan`; `mix` is lib/color's mixColor.
 */
function hillsSvg(hills, heightAt, hillsSpan, mix, { picW, picH }) {
  const [lo, hi] = hillsSpan(hills)
  const x0 = -hills.finish * 0.03
  const x1 = hills.finish * 1.04
  const kx = picW / (x1 - x0)
  const X = (x) => ((x - x0) * kx).toFixed(1)
  // Stretched up no more than four times, so the hills still roll rather than spike.
  const ky = Math.min((picH * 0.4) / Math.max(1, hi - lo), kx * 4)
  const Y = (y) => (picH * 0.58 + ((lo + hi) / 2 - y) * ky).toFixed(1)
  const line = []
  for (let i = 0; i <= 160; i++) {
    const x = x0 + ((x1 - x0) * i) / 160
    line.push(`${X(x)} ${Y(heightAt(hills, x))}`)
  }
  const surface = `M${line.join(' L')}`
  const flagH = picH * 0.1
  const flags = hills.flags
    .map((x) => {
      const px = Number(X(x))
      const py = Number(Y(heightAt(hills, x)))
      return (
        `<line x1="${px}" y1="${py}" x2="${px}" y2="${(py - flagH).toFixed(1)}" stroke="#e7eef3" stroke-width="1.2" opacity="0.75"/>` +
        `<path d="M${px} ${(py - flagH).toFixed(1)} L${(px + flagH * 0.5).toFixed(1)} ${(py - flagH * 0.82).toFixed(1)} L${px} ${(py - flagH * 0.64).toFixed(1)} Z" fill="#f5b942"/>`
      )
    })
    .join('')
  const fx = Number(X(hills.finish))
  const fy = Number(Y(heightAt(hills, hills.finish)))
  const cell = flagH * 0.24
  const chequer = [0, 1, 2]
    .flatMap((r) => [0, 1].map((q) => `<rect x="${(fx + q * cell).toFixed(1)}" y="${(fy - flagH * 1.3 + r * cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${(r + q) % 2 === 0 ? '#e7eef3' : '#0e1230'}"/>`))
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${picW}" height="${picH}" viewBox="0 0 ${picW} ${picH}">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0.1" stop-color="#0a0e29"/><stop offset="0.8" stop-color="#47306b"/></linearGradient></defs>` +
    `<rect width="${picW}" height="${picH}" fill="url(#sky)"/>` +
    `<circle cx="${(picW * 0.8).toFixed(1)}" cy="${(picH * 0.2).toFixed(1)}" r="${(picH * 0.06).toFixed(1)}" fill="#f3ecd2"/>` +
    `<path d="${surface} L${picW} ${picH} L0 ${picH} Z" fill="${mix(hills.hue, '#0e1230', 0.45)}"/>` +
    `<path d="${surface}" fill="none" stroke="${mix(hills.hue, '#ffffff', 0.5)}" stroke-width="2" stroke-linejoin="round"/>` +
    flags +
    `<line x1="${fx}" y1="${fy}" x2="${fx}" y2="${(fy - flagH * 1.3).toFixed(1)}" stroke="#e7eef3" stroke-width="1.4"/>` +
    chequer +
    `</svg>`
  )
}

/* ---------- the card ---------- */

const text = (style, words) => h('div', { style: { display: 'flex', ...style } }, words)

/** The hole in its three layers (holePlanSvg.ts): what's under the ground, the ground, what's over it. */
function holePicture(layers, { picW, picH }) {
  const at = { position: 'absolute', left: 0, top: 0 }
  return h(
    'div',
    { style: { display: 'flex', position: 'relative', width: picW, height: picH, overflow: 'hidden' } },
    h('img', { src: svgUrl(layers.under), width: picW, height: picH, style: at }),
    h('img', {
      src: layers.ground.url,
      width: layers.ground.width,
      height: layers.ground.height,
      style: { position: 'absolute', left: layers.ground.x, top: layers.ground.y },
    }),
    h('img', { src: svgUrl(layers.over), width: picW, height: picH, style: at }),
  )
}

function panel(size, { kicker, accent, name, picture }) {
  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: size.picW } },
    h('div', { style: { display: 'flex', width: size.picW, height: size.picH, borderRadius: 22, overflow: 'hidden', backgroundColor: '#18242e' } }, picture),
    text({ marginTop: 18, fontSize: size.kicker, fontWeight: 700, letterSpacing: size.spacing, color: accent }, kicker),
    h(
      'div',
      { style: { display: 'block', marginTop: 6, width: size.picW, fontSize: size.name, fontWeight: 600, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
      name,
    ),
  )
}

function faces(bugs, size) {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        width: size.picW,
        height: size.picH,
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
            width: size.face,
            height: size.face,
            marginLeft: i === 0 ? 0 : size.faceGap,
            borderRadius: size.face / 2,
            backgroundColor: '#f6efdc',
            border: '2px solid rgba(255, 255, 255, 0.55)',
            overflow: 'hidden',
          },
        },
        h('img', { src: face, width: size.face, height: size.face }),
      ),
    ),
  )
}

/** The day's card, in the measures its dailies take (THREE to SEVEN). */
function card(day, size) {
  const panels = []
  if (day.hole) {
    panels.push(
      panel(size, {
        kicker: `ACE CHASE · HOLE #${day.hole.n}`,
        accent: HOLE_ACCENT,
        name: day.hole.name,
        picture: holePicture(day.hole.layers, size),
      }),
    )
  }
  if (day.track) {
    panels.push(
      panel(size, {
        kicker: `HOT LAP · TRACK #${day.track.n}`,
        accent: TRACK_ACCENT,
        name: day.track.name,
        picture: h('img', { src: day.track.picture, width: size.picW, height: size.picH }),
      }),
    )
  }
  if (day.wanted) {
    panels.push(
      panel(size, {
        kicker: `FIND THE BUG · WANTED #${day.wanted.n}`,
        accent: BUG_ACCENT,
        name: day.wanted.names,
        picture: faces(day.wanted.faces, size),
      }),
    )
  }
  if (day.pour) {
    panels.push(
      panel(size, {
        kicker: `HALF FULL · POUR #${day.pour.n}`,
        accent: POUR_ACCENT,
        name: day.pour.names,
        picture: h('img', { src: day.pour.picture, width: size.picW, height: size.picH }),
      }),
    )
  }
  if (day.course) {
    panels.push(
      panel(size, {
        kicker: `MARBLE RUN · COURSE #${day.course.n}`,
        accent: COURSE_ACCENT,
        name: day.course.name,
        picture: h('img', { src: day.course.picture, width: size.picW, height: size.picH }),
      }),
    )
  }
  if (day.cave) {
    panels.push(
      panel(size, {
        kicker: `LANDER · CAVE #${day.cave.n}`,
        accent: CAVE_ACCENT,
        name: day.cave.name,
        picture: h('img', { src: day.cave.picture, width: size.picW, height: size.picH }),
      }),
    )
  }
  if (day.hills) {
    panels.push(
      panel(size, {
        kicker: `SWOOP · HILLS #${day.hills.n}`,
        accent: HILLS_ACCENT,
        name: day.hills.name,
        picture: h('img', { src: day.hills.picture, width: size.picW, height: size.picH }),
      }),
    )
  }
  const count = COUNT_WORDS[panels.length]
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
    text({ marginTop: 22, fontSize: 64, fontWeight: 700, lineHeight: 1, letterSpacing: -1 }, `Today’s ${count}`),
    text({ marginTop: 12, fontSize: 28, color: MUTED }, `${count.charAt(0).toUpperCase()}${count.slice(1)} quick games, the same for everyone. No ads.`),
    h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: 34 } }, ...panels),
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
  const { dayNumber: pourNumber } = await server.ssrLoadModule('/src/games/halffull/daily.ts')
  const { dayPlan } = await server.ssrLoadModule('/src/games/halffull/plan.ts')
  const { glassNames, pourPlanSvg } = await server.ssrLoadModule('/src/games/halffull/planSvg.ts')
  const { dailyCourse, laidNumber } = await server.ssrLoadModule('/src/games/marblerun/daily.ts')
  const { plannedCourse, point } = await server.ssrLoadModule('/src/games/marblerun/sim.ts')
  const { dailyCave, laidNumber: caveLaid } = await server.ssrLoadModule('/src/games/lander/daily.ts')
  const { plannedCave } = await server.ssrLoadModule('/src/games/lander/sim.ts')
  const { dailyHills, laidNumber: hillsLaid } = await server.ssrLoadModule('/src/games/swoop/daily.ts')
  const { heightAt, hillsSpan, plannedHills } = await server.ssrLoadModule('/src/games/swoop/sim.ts')
  const { mixColor } = await server.ssrLoadModule('/src/lib/color.ts')
  const { gamePlayHref } = await server.ssrLoadModule('/src/hooks/useHashRoute.ts')
  // A day's card is that day's ticket (lib/today.ts liveDailies): each daily from the day it joined, while its
  // game is listed, and the puzzles until they came off it, when the Dailies became the four races.
  const { liveDailies } = await server.ssrLoadModule('/src/lib/today.ts')

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
    const live = new Set(liveDailies(day).map((d) => d.key))
    const size = SIZES[live.size]
    const info = { words: dayWords(day) }
    if (live.has('hole')) {
      const hole = todaysHole(day)
      info.hole = { n: hole.n, name: hole.def.name, layers: holePlanLayers(hole.def, hole.def.spots[0], size.picW, size.picH, pngDataUrl) }
    }
    if (live.has('track')) {
      const track = dailyTrack(day)
      info.track = { n: track.n, name: track.name, picture: svgUrl(trackSvg(trackPlan(buildTrack(track.pieces, { heading: track.shape.heading })), size)) }
    }
    if (live.has('wanted')) {
      const wanted = dayWanted(day)
      info.wanted = { n: dayNumber(day), names: wantedNames(wanted), faces: wanted.map((w) => face(w.id)) }
    }
    if (live.has('pour')) {
      // The day's glasses, empty: nothing on the card shows where half is.
      const plan = dayPlan(day)
      info.pour = { n: pourNumber(day), names: glassNames(plan), picture: svgUrl(pourPlanSvg(plan, size.picW, size.picH)) }
    }
    if (live.has('course')) {
      const daily = dailyCourse(day)
      const course = plannedCourse(laidNumber(daily), daily.attempt)
      info.course = { n: daily.n, name: daily.name, picture: svgUrl(courseSvg(course, point, size)) }
    }
    if (live.has('cave')) {
      const daily = dailyCave(day)
      const cave = plannedCave(caveLaid(daily), daily.attempt)
      info.cave = { n: daily.n, name: daily.name, picture: svgUrl(caveSvg(cave, size)) }
    }
    if (live.has('hills')) {
      const daily = dailyHills(day)
      const hills = plannedHills(hillsLaid(daily), daily.attempt)
      info.hills = { n: daily.n, name: daily.name, picture: svgUrl(hillsSvg(hills, heightAt, hillsSpan, mixColor, size)) }
    }
    const tree = card(info, size)
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
    const dailies = []
    const links = []
    if (info.hole) {
      dailies.push(`Today’s Hole #${info.hole.n}, ${info.hole.name}`)
      links.push({ href: gamePlayHref('acechase'), label: `Play Today’s Hole #${info.hole.n}` })
    }
    if (info.track) {
      dailies.push(`Today’s Track #${info.track.n}, ${info.track.name}`)
      links.push({ href: gamePlayHref('hotlap'), label: `Race Today’s Track #${info.track.n}` })
    }
    if (info.wanted) {
      dailies.push(`Today’s Wanted #${info.wanted.n}: ${info.wanted.names}`)
      links.push({ href: gamePlayHref('findbug'), label: `Find Today’s Wanted #${info.wanted.n}` })
    }
    if (info.pour) {
      dailies.push(`Today’s Pour #${info.pour.n}: ${info.pour.names}`)
      links.push({ href: gamePlayHref('halffull'), label: `Pour Today’s Pour #${info.pour.n}` })
    }
    if (info.course) {
      dailies.push(`Today’s Course #${info.course.n}, ${info.course.name}`)
      links.push({ href: gamePlayHref('marblerun'), label: `Roll Today’s Course #${info.course.n}` })
    }
    if (info.cave) {
      dailies.push(`Today’s Cave #${info.cave.n}, ${info.cave.name}`)
      links.push({ href: gamePlayHref('lander'), label: `Fly Today’s Cave #${info.cave.n}` })
    }
    if (info.hills) {
      dailies.push(`Today’s Hills #${info.hills.n}, ${info.hills.name}`)
      links.push({ href: gamePlayHref('swoop'), label: `Swoop Today’s Hills #${info.hills.n}` })
    }
    const count = COUNT_WORDS[dailies.length]
    const description =
      `${dailies.slice(0, -1).join('; ')}; and ${dailies[dailies.length - 1]}. ` +
      `${count.charAt(0).toUpperCase()}${count.slice(1)} quick games, the same for everyone, free in your browser with no ads.`
    const meta = { path: `/today/${day}`, title, description, image: `/og/today/${day}.png` }
    const content = { heading: title, paragraphs: [description], links }
    const file = outFile(meta.path)
    mkdirSync(dirname(file), { recursive: true })
    // Somebody's link to somebody, never a search result.
    writeFileSync(file, pageHtml(meta, content).replace('</head>', '  <meta name="robots" content="noindex" />\n  </head>'))
    made++
  }
  return { made, drawn, from, to }
}
