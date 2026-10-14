import { paintFruit, type FruitArt } from '../fruitArt'
import { paintBug, type BugName } from '../mazeBugs'
import { drawBlip, drawBlipCaught } from '../pellets/blip'
import { inkColor, isDarkTheme, playfieldColor } from '../../lib/theme'
import {
  bufferRowOf,
  MILESTONE_ROWS,
  tidePressure,
  worldRowAt,
  type Dir,
  type GameState,
  type Ghost,
  type GhostKind,
  type PopTone,
} from './game'

/*
 * Drawn the house way, and the same way as Glowberry, whose maze this is with
 * the exit taken out: Blip (pellets/blip.ts) climbing a garden of leafy
 * hedges, gold crumbs, violet glowberries, and the bad bugs of
 * games/mazeBugs.ts after him, their eyes on the way they're going, with the
 * rainwater rising under them all. Ramsey picked the cast for both games from
 * the "Look-alikes to fix" canvas (2026-10-14), so neither is the chomper and
 * the ghosts they began as.
 *
 * Besides Glowberry's four bugs, the herder is Pester, a pink moth in a
 * propeller cap, and a train is a caterpillar in a work visor, a car to each
 * of its segments.
 */

/** Blip's mint: his lamp, the row markers and the rows-climbed pops. */
const ACCENT = 168
const GOLD = 42
const BERRY = 276
const HEDGE_HUE = 138
const WATER_HUE = 205

/** Which bug each chaser is. */
const BUG_OF: Record<GhostKind, BugName> = { blink: 'snatch', pink: 'sly', herd: 'pester', inky: 'shady', clyde: 'grumble', train: 'car' }
/** A bug's height, in tiles, and a caterpillar car's: a car is one round segment. */
const BUG_SIZE = 1.05
const CAR_SIZE = 0.95
/** The site's own face, at a weight it loads; a canvas can't read the CSS variable. */
const FONT = '"Outfit", system-ui, sans-serif'
const TAU = Math.PI * 2
const LOOK: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
/** Fruit by tier, lowest first: the same fruit Glowberry offers. */
const FRUIT_ART: FruitArt[] = ['cherry', 'berry', 'orange', 'apple', 'melon', 'bell', 'key']

function hsla(hue: number, sat: number, light: number, alpha = 1) {
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`
}

/** Outline lightness: bright over the dark theme's ground, deeper over the light one. */
const lineL = (dark: boolean) => (dark ? 66 : 42)

function frac(v: number) {
  return v - Math.floor(v)
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

export type Layout = {
  cell: number
  /** Screen y of the top edge of buffer row `y`. */
  rowY: (y: number) => number
}

/**
 * Everything hangs off the camera, which is a world row rather than a buffer
 * index: the row it names is drawn along the bottom of the view, and the rest
 * of the strip stacks up from there. Because the camera is a float that tracks
 * the player continuously, the climb is smooth even though the buffer itself
 * only ever shifts in whole rows.
 */
export function computeLayout(w: number, h: number, state: GameState): Layout {
  const cell = w / state.cols
  const cameraBuf = bufferRowOf(state, state.camera)
  return {
    cell,
    rowY: (y: number) => h - (cameraBuf - y + 1) * cell,
  }
}

type Gfx = {
  ctx: CanvasRenderingContext2D
  s: GameState
  dark: boolean
  cell: number
  w: number
  h: number
  t: number
  /** Screen y of a buffer position, in tiles (a tile's centre is y + 0.5). */
  Y: (y: number) => number
}

// ————————————————————————————————————————————————————————— sky

/**
 * Two layers of stars that slide down as you climb, slower than the maze does,
 * the far ones slowest. It is the only thing on screen that says how high up
 * you are rather than what is in front of you.
 */
function drawSky(g: Gfx) {
  const { ctx, s, dark, cell, w, h } = g
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  // Each layer goes down in three brightnesses, one path apiece: a hundred and
  // fifty separate little fills cost more than the whole maze.
  const climbed = s.camera * cell
  ctx.fillStyle = inkColor()
  for (const [layer, pace, density] of [
    [0, 0.16, 9000],
    [1, 0.38, 17000],
  ] as const) {
    const count = Math.round((w * h) / density)
    for (let band = 0; band < 3; band++) {
      ctx.beginPath()
      for (let i = 1 + band; i <= count; i += 3) {
        const a = frac(Math.sin(i * 12.9898 + layer * 7.13) * 43758.5453)
        const b = frac(Math.sin(i * 78.233 + layer * 3.31) * 12345.6789)
        const c = frac(Math.sin(i * 3.7137 + layer) * 9973.113)
        const x = a * w
        const y = (((b * h + climbed * pace) % h) + h) % h
        const r = (0.4 + c * 0.9) * (layer ? 1.35 : 1)
        ctx.moveTo(x + r, y)
        ctx.arc(x, y, r, 0, TAU)
      }
      const k = (band + 0.5) / 3
      ctx.globalAlpha = dark ? (0.05 + k * 0.13) * (layer ? 1.25 : 0.85) : (0.035 + k * 0.07) * (layer ? 1.2 : 0.9)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

/**
 * Every fiftieth row: a line across the board and its number, faint, so the
 * climb has landmarks you can see coming.
 */
function drawMilestones(g: Gfx) {
  const { ctx, s, dark, cell, w, h, Y } = g
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.max(14, Math.round(cell * 1.5))}px ${FONT}`
  for (let y = 0; y < s.rows; y++) {
    const world = worldRowAt(s, y) - s.baseRow
    if (world <= 0 || world % MILESTONE_ROWS !== 0) continue
    const cy = Y(y + 0.5)
    if (cy < -cell || cy > h + cell) continue
    ctx.setLineDash([cell * 0.28, cell * 0.22])
    ctx.strokeStyle = hsla(ACCENT, 60, dark ? 66 : 38, 0.22)
    ctx.lineWidth = Math.max(1, cell * 0.035)
    ctx.beginPath()
    ctx.moveTo(0, cy)
    ctx.lineTo(w, cy)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = dark ? 'rgba(231, 238, 243, 0.08)' : 'rgba(26, 43, 60, 0.08)'
    ctx.fillText(String(world), w / 2, cy)
  }
  ctx.restore()
}

// ——————————————————————————————————————————————————————— walls

type Pt = { x: number; y: number }

/** Lane or off the buffer — both get an outline edge. */
function openOrOutside(s: GameState, x: number, y: number) {
  if (y < 0 || y >= s.rows || x < 0 || x >= s.cols) return true
  return s.open[y][x]
}

/**
 * The outline of every wall region as closed loops of corners, walked so the
 * wall is always on the right. Where two regions only touch at a corner, the
 * walk turns right first, which keeps it on the region it started round. The
 * loops close along the buffer's top and bottom, which are off screen.
 */
function wallLoops(s: GameState): Pt[][] {
  const W = s.cols + 1
  const key = (x: number, y: number) => y * W + x
  const edges = new Map<number, Pt[]>()
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = key(x0, y0)
    const list = edges.get(k)
    if (list) list.push({ x: x1, y: y1 })
    else edges.set(k, [{ x: x1, y: y1 }])
  }
  for (let y = 0; y < s.rows; y++) {
    for (let x = 0; x < s.cols; x++) {
      if (s.open[y][x]) continue
      if (openOrOutside(s, x, y - 1)) add(x, y, x + 1, y)
      if (openOrOutside(s, x + 1, y)) add(x + 1, y, x + 1, y + 1)
      if (openOrOutside(s, x, y + 1)) add(x + 1, y + 1, x, y + 1)
      if (openOrOutside(s, x - 1, y)) add(x, y + 1, x, y)
    }
  }

  const loops: Pt[][] = []
  while (edges.size) {
    const [k0, list0] = edges.entries().next().value as [number, Pt[]]
    const x0 = k0 % W
    const y0 = (k0 - x0) / W
    const first = list0.pop()!
    if (!list0.length) edges.delete(k0)
    const loop: Pt[] = [{ x: x0, y: y0 }]
    let px = x0
    let py = y0
    let cx = first.x
    let cy = first.y
    for (let guard = 0; guard < 100000 && !(cx === x0 && cy === y0); guard++) {
      loop.push({ x: cx, y: cy })
      const k = key(cx, cy)
      const list = edges.get(k)
      if (!list?.length) break
      const dx = cx - px
      const dy = cy - py
      let pick = -1
      for (const [ex, ey] of [
        [-dy, dx],
        [dx, dy],
        [dy, -dx],
      ]) {
        pick = list.findIndex((q) => q.x - cx === ex && q.y - cy === ey)
        if (pick >= 0) break
      }
      const nextPt = list.splice(Math.max(0, pick), 1)[0]!
      if (!list.length) edges.delete(k)
      px = cx
      py = cy
      cx = nextPt.x
      cy = nextPt.y
    }
    const corners = loop.filter((v, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length]!
      const b = loop[(i + 1) % loop.length]!
      return (v.x - a.x) * (b.y - v.y) - (v.y - a.y) * (b.x - v.x) !== 0
    })
    if (corners.length >= 4) loops.push(corners)
  }
  return loops
}

/** Pull a loop in toward the wall by `d` tiles: every corner moves along both edges' normals. */
function insetLoop(loop: Pt[], d: number): Pt[] {
  const n = loop.length
  return loop.map((v, i) => {
    const a = loop[(i - 1 + n) % n]!
    const b = loop[(i + 1) % n]!
    const d1x = Math.sign(v.x - a.x)
    const d1y = Math.sign(v.y - a.y)
    const d2x = Math.sign(b.x - v.x)
    const d2y = Math.sign(b.y - v.y)
    return { x: v.x + (-d1y - d2y) * d, y: v.y + (d1x + d2x) * d }
  })
}

function roundedLoop(path: Path2D, pts: Pt[], r: number) {
  const n = pts.length
  const last = pts[n - 1]!
  const first = pts[0]!
  path.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
  for (let i = 0; i < n; i++) {
    const cur = pts[i]!
    const nxt = pts[(i + 1) % n]!
    const prv = pts[(i - 1 + n) % n]!
    const rr = Math.min(
      r,
      Math.hypot(cur.x - prv.x, cur.y - prv.y) / 2,
      Math.hypot(nxt.x - cur.x, nxt.y - cur.y) / 2,
    )
    path.arcTo(cur.x, cur.y, nxt.x, nxt.y, rr)
  }
  path.closePath()
}

type WallPaths = { key: string; outer: Path2D; inner: Path2D; leaves: Path2D }
let wallCache: WallPaths | null = null

/**
 * The hedges as paths in the buffer's own space — the tube, the line inside
 * it and its leaves — rebuilt only when the board shifts a row. The camera
 * moves them with a translate, so the climb stays smooth between shifts.
 */
function wallPaths(g: Gfx): WallPaths {
  const { s, cell } = g
  const key = `${s.originRow}:${s.cols}x${s.rows}:${cell}:${s.seed}`
  if (wallCache && wallCache.key === key) return wallCache
  const outer = new Path2D()
  const inner = new Path2D()
  const leaves = new Path2D()
  const toPx = (p: Pt) => ({ x: p.x * cell, y: p.y * cell })
  for (const loop of wallLoops(s)) {
    roundedLoop(outer, insetLoop(loop, 0.18).map(toPx), cell * 0.26)
    roundedLoop(inner, insetLoop(loop, 0.32).map(toPx), cell * 0.14)
  }
  // A few leaves to every hedge tile, placed by its row in the world, so they climb with the hedge.
  for (let y = 0; y < s.rows; y++) {
    const world = worldRowAt(s, y)
    for (let x = 0; x < s.cols; x++) {
      if (s.open[y][x]) continue
      for (let k = 0; k < 2; k++) {
        const lx = (x + 0.22 + frac(Math.sin((x * 7.1 + world * 3.3 + k * 1.7) * 12.9898) * 43758.5453) * 0.56) * cell
        const ly = (y + 0.22 + frac(Math.sin((x * 2.9 + world * 8.3 + k * 4.1) * 78.233) * 12345.6789) * 0.56) * cell
        const turn = frac(Math.sin((x + world * 5 + k) * 3.7137) * 9973.113) * Math.PI
        leaves.moveTo(lx + Math.cos(turn) * cell * 0.12, ly + Math.sin(turn) * cell * 0.12)
        leaves.ellipse(lx, ly, cell * 0.12, cell * 0.06, turn, 0, TAU)
      }
    }
  }
  wallCache = { key, outer, inner, leaves }
  return wallCache
}

function drawWalls(g: Gfx) {
  const { ctx, dark, cell, Y } = g
  const walls = wallPaths(g)
  ctx.save()
  ctx.translate(0, Y(0))
  ctx.fillStyle = hsla(HEDGE_HUE, 55, 42, dark ? 0.32 : 0.26)
  ctx.fill(walls.outer)
  ctx.save()
  ctx.clip(walls.outer)
  ctx.fillStyle = hsla(HEDGE_HUE, 60, dark ? 62 : 40, dark ? 0.26 : 0.24)
  ctx.fill(walls.leaves)
  ctx.restore()
  ctx.lineJoin = 'round'
  ctx.strokeStyle = hsla(HEDGE_HUE, dark ? 62 : 58, dark ? 60 : 32, 0.95)
  ctx.lineWidth = Math.max(1.5, cell * 0.07)
  ctx.stroke(walls.outer)
  ctx.strokeStyle = hsla(HEDGE_HUE, dark ? 62 : 58, dark ? 60 : 32, dark ? 0.36 : 0.32)
  ctx.lineWidth = Math.max(1, cell * 0.035)
  ctx.stroke(walls.inner)
  ctx.restore()
}

// —————————————————————————————————————————————————————— crumbs

function drawCrumbs(g: Gfx) {
  const { ctx, s, dark, cell, h, Y, t } = g
  const r = Math.max(1.4, cell * 0.095)
  ctx.fillStyle = hsla(GOLD, 92, dark ? 64 : 46)
  ctx.beginPath()
  for (let y = 0; y < s.rows; y++) {
    const cy = Y(y + 0.5)
    if (cy < -cell || cy > h + cell) continue
    for (let x = 0; x < s.cols; x++) {
      if (!s.crumbs[y][x]) continue
      const cx = (x + 0.5) * cell
      ctx.moveTo(cx + r, cy)
      ctx.arc(cx, cy, r, 0, TAU)
    }
  }
  ctx.fill()

  // The glowberries: round and violet, a leaf on top, glowing as they breathe.
  const pulse = 0.9 + Math.sin(t * 6) * 0.1
  for (let y = 0; y < s.rows; y++) {
    const cy = Y(y + 0.52)
    if (cy < -cell || cy > h + cell) continue
    for (let x = 0; x < s.cols; x++) {
      if (!s.power[y][x]) continue
      const cx = (x + 0.5) * cell
      const pr = cell * 0.24 * pulse
      const glow = ctx.createRadialGradient(cx, cy, pr * 0.4, cx, cy, pr * 2.6)
      glow.addColorStop(0, hsla(BERRY, 95, 66, dark ? 0.46 : 0.36))
      glow.addColorStop(1, hsla(BERRY, 95, 66, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, pr * 2.6, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(cx + pr * 0.42, cy - pr * 1.02, pr * 0.52, pr * 0.24, -0.5, 0, TAU)
      ctx.fillStyle = hsla(HEDGE_HUE, 62, dark ? 56 : 40)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, pr, 0, TAU)
      ctx.fillStyle = hsla(BERRY, 82, dark ? 66 : 58, 0.95)
      ctx.fill()
      ctx.strokeStyle = hsla(BERRY, 70, dark ? 82 : 36, 0.95)
      ctx.lineWidth = Math.max(1.2, cell * 0.045)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx - pr * 0.32, cy - pr * 0.34, pr * 0.26, 0, TAU)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
      ctx.fill()
    }
  }
}

/**
 * A crumb, just eaten: its ring opens out and fades where it was, a fifth of a
 * second each. At a crumb a tile it is a steady patter behind Blip rather
 * than a burst, which is what eating the trail should feel like.
 */
function drawBites(g: Gfx) {
  const { ctx, s, dark, cell, Y } = g
  if (!s.bites.length) return
  ctx.lineWidth = Math.max(1, cell * 0.04)
  ctx.strokeStyle = hsla(GOLD, 90, dark ? 68 : 44)
  for (const bite of s.bites) {
    const k = 1 - bite.life
    ctx.globalAlpha = Math.max(0, bite.life) * 0.75
    ctx.beginPath()
    ctx.arc(bite.x * cell, Y(bite.y), cell * 0.095 * (1.2 + k * 1.8), 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ————————————————————————————————————————————————— fruit & charms

/** A ring that empties as an offer's time runs out, so a clock reads as a clock. */
function timerRing(g: Gfx, cx: number, cy: number, r: number, left: number, hue: number) {
  const { ctx, dark, cell } = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp01(left))
  ctx.strokeStyle = hsla(hue, 85, dark ? 66 : 44, 0.8)
  ctx.lineWidth = Math.max(1, cell * 0.05)
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.lineCap = 'butt'
}

function glowAt(g: Gfx, cx: number, cy: number, r: number, hue: number, a: number) {
  const { ctx } = g
  const glow = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r)
  glow.addColorStop(0, hsla(hue, 90, 62, a))
  glow.addColorStop(1, hsla(hue, 90, 62, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, TAU)
  ctx.fill()
}

/**
 * The fruit: the same ones Glowberry offers, a kind to each tier, so a better
 * one is worth more at a glance. The last two seconds blink, because an offer
 * you cannot see expiring is a prize that was taken away from you.
 */
function drawFruit(g: Gfx) {
  const { ctx, s, dark, cell, Y, t } = g
  const fruit = s.fruit
  if (!fruit) return
  if (fruit.life < 2 && Math.floor(t * 7) % 2 === 0) return
  const cx = fruit.x * cell
  const cy = Y(fruit.y)
  glowAt(g, cx, cy, cell * 0.8, GOLD, dark ? 0.3 : 0.26)
  const kind = FRUIT_ART[Math.min(FRUIT_ART.length - 1, fruit.tier)]!
  paintFruit(ctx, kind, cx, cy + Math.sin(t * 3) * cell * 0.04, cell * 0.4, dark)
  timerRing(g, cx, cy, cell * 0.56, fruit.life / fruit.maxLife, GOLD)
}

/**
 * A charm, drawn as a ring with a mark rather than a fruit, so the two offers
 * never read as the same thing. Freeze is a frost crystal in the cold blue of
 * the state it causes; the laser is red and wears the bolt it fires.
 */
function drawCharm(g: Gfx) {
  const { ctx, s, dark, cell, Y, t } = g
  const charm = s.charm
  if (!charm) return
  if (charm.life < 2 && Math.floor(t * 7) % 2 === 0) return
  const cx = charm.x * cell
  const cy = Y(charm.y)
  const hue = charm.kind === 'freeze' ? 196 : 4
  const r = cell * 0.3 * (0.94 + Math.sin(t * 5) * 0.06)
  glowAt(g, cx, cy, r * 2.4, hue, dark ? 0.4 : 0.32)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, TAU)
  ctx.fillStyle = hsla(hue, 75, 58, dark ? 0.32 : 0.4)
  ctx.fill()
  ctx.strokeStyle = hsla(hue, 75, lineL(dark), 0.95)
  ctx.lineWidth = Math.max(1.2, cell * 0.055)
  ctx.stroke()

  ctx.strokeStyle = hsla(hue, 70, dark ? 88 : 30, 0.95)
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = Math.max(1, cell * 0.045)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (charm.kind === 'freeze') {
    // Six spokes, each with a little fork near its tip, turning slowly.
    const spin = t * 0.6
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * Math.PI) / 3
      const ex = cx + Math.cos(a) * r * 0.66
      const ey = cy + Math.sin(a) * r * 0.66
      ctx.moveTo(cx, cy)
      ctx.lineTo(ex, ey)
      const fx = cx + Math.cos(a) * r * 0.42
      const fy = cy + Math.sin(a) * r * 0.42
      for (const side of [-1, 1]) {
        ctx.moveTo(fx, fy)
        ctx.lineTo(fx + Math.cos(a + side * 0.7) * r * 0.2, fy + Math.sin(a + side * 0.7) * r * 0.2)
      }
    }
    ctx.stroke()
  } else {
    // A bolt.
    ctx.moveTo(cx + r * 0.12, cy - r * 0.62)
    ctx.lineTo(cx - r * 0.28, cy + r * 0.06)
    ctx.lineTo(cx + r * 0.06, cy + r * 0.06)
    ctx.lineTo(cx - r * 0.14, cy + r * 0.62)
    ctx.lineTo(cx + r * 0.32, cy - r * 0.1)
    ctx.lineTo(cx - r * 0.02, cy - r * 0.1)
    ctx.closePath()
    ctx.fill()
  }
  ctx.lineCap = 'butt'
  timerRing(g, cx, cy, r * 1.5, charm.life / charm.maxLife, hue)
}

/**
 * The shot itself, for the sixth of a second it exists: from the player to the
 * face of the wall that stopped it, bright core over a wide soft pass, with a
 * flare where it lands.
 */
function drawBeam(g: Gfx) {
  const { ctx, s, cell, Y, t } = g
  const beam = s.beam
  if (!beam || beam.reach <= 0) return
  const fade = Math.max(0, beam.life / 0.14)
  const v = LOOK[beam.dir]
  const x0 = beam.x * cell
  const y0 = Y(beam.y)
  const x1 = (beam.x + v.x * beam.reach) * cell
  const y1 = Y(beam.y + v.y * beam.reach)
  const flick = 0.85 + 0.15 * Math.sin(t * 60)

  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = hsla(4, 85, 60, 0.26 * fade)
  ctx.lineWidth = cell * 0.56 * flick
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.strokeStyle = hsla(12, 95, 74, 0.95 * fade)
  ctx.lineWidth = cell * 0.14
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.strokeStyle = `rgba(255, 244, 236, ${0.9 * fade})`
  ctx.lineWidth = cell * 0.05
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.restore()
  glowAt(g, x1, y1, cell * 0.5 * flick, 8, 0.6 * fade)
}

// —————————————————————————————————————————————————————— player

function drawPlayer(g: Gfx) {
  const { ctx, s, dark, cell, Y } = g
  const cx = s.player.x * cell
  const cy = Y(s.player.y)
  const surging = s.surgeTime > 0
  const r = cell * (surging ? 0.44 : 0.4)
  const lw = Math.max(1.3, cell * 0.07)

  if (s.phase === 'dying') {
    const k = clamp01(1 - s.deathAnim / 0.85)
    if (s.cause === 'drowned') {
      // Taken under the water, wincing.
      ctx.save()
      ctx.globalAlpha = 1 - k
      drawBlipCaught(ctx, { x: cx, y: cy + k * cell * 0.6, r, k: k * 0.35, dark, lw })
      ctx.restore()
    } else {
      drawBlipCaught(ctx, { x: cx, y: cy, r, k, dark, lw })
    }
    return
  }

  for (const dot of s.trail) {
    ctx.beginPath()
    ctx.arc(dot.x * cell, Y(dot.y), r * (0.35 + 0.5 * dot.life), 0, TAU)
    ctx.fillStyle = hsla(GOLD, 92, 60, 0.2 * dot.life)
    ctx.fill()
  }

  // A little light of your own on the floor, so your eye finds you first in a busy maze.
  const lampHue = surging ? GOLD : ACCENT
  const lamp = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * (surging ? 3 : 2.4))
  lamp.addColorStop(0, hsla(lampHue, 85, 58, dark ? 0.24 : 0.2))
  lamp.addColorStop(1, hsla(lampHue, 85, 58, 0))
  ctx.fillStyle = lamp
  ctx.beginPath()
  ctx.arc(cx, cy, r * 3, 0, TAU)
  ctx.fill()

  if (s.invuln > 0 && Math.floor(s.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.45

  // His mouth opens to eat while he moves, and rests where it stopped.
  const open = 0.5 - 0.5 * Math.cos(s.mouth * Math.PI)
  drawBlip(ctx, { x: cx, y: cy, r, dir: s.player.dir, open, stride: s.mouth, dark, lw, t: s.time, happy: false, power: s.fright > 0 })
  ctx.globalAlpha = 1
}

// ————————————————————————————————————————————————————— chasers

/**
 * A train's cars, joined into one caterpillar: its body between each car and
 * the next, drawn under them, so the line reads as one creature.
 */
function drawCouplings(g: Gfx) {
  const { ctx, s, cell, Y } = g
  const cars = s.ghosts.filter((gh) => gh.kind === 'train' && gh.mode !== 'eaten')
  if (cars.length < 2) return
  ctx.lineCap = 'round'
  for (const a of cars) {
    for (const b of cars) {
      if (b.x <= a.x || Math.abs(a.y - b.y) > 0.05 || b.x - a.x > 1.2) continue
      // As faint as the cars it joins while they sleep.
      ctx.globalAlpha = a.mode === 'asleep' ? 0.5 : 0.35 + 0.65 * a.arrive
      const scared = a.mode === 'frightened' && b.mode === 'frightened'
      const y = Y(a.y) + cell * 0.08
      for (const [colour, width] of [
        ['#1a2b3c', cell * 0.46],
        [scared ? '#d6def3' : '#cdbb8e', cell * 0.4],
      ] as const) {
        ctx.strokeStyle = colour
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.moveTo(a.x * cell, y)
        ctx.lineTo(b.x * cell, y)
        ctx.stroke()
      }
    }
  }
  ctx.globalAlpha = 1
  ctx.lineCap = 'butt'
}

/** Whether a train's car has no car ahead of it on its row, the way it is going: the one with the head. */
function leadsTrain(s: GameState, car: Ghost) {
  const ahead = car.dir === 'left' ? -1 : 1
  return !s.ghosts.some(
    (o) => o !== car && o.kind === 'train' && o.mode !== 'eaten' && Math.abs(o.y - car.y) < 0.05 && (o.x - car.x) * ahead > 0 && Math.abs(o.x - car.x) < 1.2,
  )
}

/**
 * A bug (games/mazeBugs.ts), its eyes on the way it's going so its next turn
 * shows on its face before it takes it. One seeded ahead sleeps, faint and
 * still, eyes shut, z's drifting off it: unmistakably there, never yet
 * chasing. A glowberry turns it pale and wide-eyed, and as that runs out it
 * flashes back into its own colours; caught, it goes home dazed and
 * see-through, seeing stars.
 */
function drawChaser(g: Gfx, ghost: Ghost) {
  const { ctx, s, dark, cell, Y, t } = g
  const asleep = ghost.mode === 'asleep'
  const car = ghost.kind === 'train'
  const cx = ghost.x * cell
  const cy = Y(ghost.y) + (asleep ? Math.sin(ghost.bob * 0.5) * cell * 0.05 : 0) - cell * 0.03
  const size = cell * (car ? CAR_SIZE : BUG_SIZE)
  const r = cell * 0.38
  const scared = ghost.mode === 'frightened'
  const eaten = ghost.mode === 'eaten'
  const flash = scared && s.fright < 2 && Math.floor(t * 8) % 2 === 0
  const name = BUG_OF[ghost.kind]
  const step = asleep ? 0 : Math.floor(ghost.bob * 1.4) % 2
  const look = [LOOK[ghost.dir].x, LOOK[ghost.dir].y] as const
  const lead = car && leadsTrain(s, ghost)

  if (eaten) {
    paintBug(ctx, name, cx, cy, size * 0.92, { state: 'dazed', look, step, t, lead }, 0.6)
    return
  }

  // Waking, it fades in.
  const alpha = asleep ? 0.5 : 0.35 + 0.65 * ghost.arrive
  if (ghost.hit > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * ghost.hit})`
    ctx.beginPath()
    ctx.arc(cx, cy, size * (0.52 + ghost.hit * 0.2), 0, TAU)
    ctx.fill()
  }
  const state = scared ? 'scared' : asleep || ghost.arrive < 0.35 ? 'asleep' : 'normal'
  paintBug(ctx, name, cx, cy, size, { state, own: flash, look, step, t: t + ghost.id * 0.7, lead }, alpha)

  ctx.globalAlpha = alpha
  if (asleep) {
    // The z's drifting off it: "not yet", at a glance.
    ctx.font = `700 ${Math.max(9, Math.round(cell * 0.3))}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = dark ? 'rgba(231, 238, 243, 0.9)' : 'rgba(26, 43, 60, 0.85)'
    for (let k = 0; k < 2; k++) {
      const u = frac(t * 0.45 + ghost.id * 0.37 + k * 0.5)
      ctx.globalAlpha = 0.5 * Math.sin(u * Math.PI)
      ctx.fillText('z', cx + r * (0.7 + u * 0.5), cy - r * (1.3 + u * 1.1))
    }
    ctx.globalAlpha = alpha
  }

  // Frozen by the charm: in a block of ice until it wears off.
  if (s.freeze > 0 && !asleep) {
    const fade = Math.min(1, s.freeze / 0.5)
    ctx.globalAlpha = fade
    // Big enough for the bug in it, hat and feelers too.
    const bw = Math.max(r * 2.36, size * 0.8)
    const bh = Math.max(r * 2.4, size * 0.98)
    ctx.beginPath()
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, r * 0.3)
    ctx.fillStyle = dark ? 'rgba(180, 225, 255, 0.22)' : 'rgba(150, 210, 245, 0.3)'
    ctx.fill()
    ctx.strokeStyle = dark ? 'rgba(210, 240, 255, 0.85)' : 'rgba(70, 150, 200, 0.85)'
    ctx.lineWidth = Math.max(1, cell * 0.04)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx - bw * 0.4, cy - bh * 0.23)
    ctx.lineTo(cx - bw * 0.25, cy - bh * 0.4)
    ctx.moveTo(cx + bw * 0.3, cy + bh * 0.35)
    ctx.lineTo(cx + bw * 0.4, cy + bh * 0.23)
    ctx.stroke()
    ctx.lineCap = 'butt'
  }
  ctx.globalAlpha = 1
}

// ——————————————————————————————————————————————————————— debris

function drawBits(g: Gfx) {
  const { ctx, s, dark, cell, Y } = g
  for (const b of s.bits) {
    const a = clamp01(b.life / b.maxLife)
    const x = b.x * cell
    const y = Y(b.y)
    if (b.kind === 'spark') {
      ctx.globalAlpha = a
      ctx.strokeStyle = hsla(b.hue, 90, dark ? 70 : 50)
      ctx.lineWidth = Math.max(1.2, cell * b.size * 0.6)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - b.vx * cell * 0.035, y - b.vy * cell * 0.035)
      ctx.stroke()
      continue
    }
    const sz = cell * b.size
    ctx.globalAlpha = Math.min(1, a * 1.6)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(b.angle)
    ctx.beginPath()
    ctx.moveTo(sz, 0)
    ctx.lineTo(-sz * 0.6, sz * 0.72)
    ctx.lineTo(-sz * 0.42, -sz * 0.62)
    ctx.closePath()
    ctx.fillStyle = hsla(b.hue, 70, 60, dark ? 0.35 : 0.4)
    ctx.fill()
    ctx.strokeStyle = hsla(b.hue, 70, lineL(dark), 0.95)
    ctx.lineWidth = Math.max(1, sz * 0.18)
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
  }
  ctx.globalAlpha = 1
  ctx.lineCap = 'butt'
}

function drawRings(g: Gfx) {
  const { ctx, s, dark, cell, Y } = g
  for (const r of s.rings) {
    const k = 1 - r.life / r.maxLife
    const ease = 1 - (1 - k) ** 3
    ctx.globalAlpha = (1 - k) * 0.85
    ctx.strokeStyle = hsla(r.hue, 85, dark ? 70 : 46)
    ctx.lineWidth = Math.max(1, cell * 0.09 * (1 - k) + 0.5)
    ctx.beginPath()
    ctx.arc(r.x * cell, Y(r.y), Math.max(0.5, cell * (r.r0 + (r.r1 - r.r0) * ease)), 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ————————————————————————————————————————————————————————— tide

/**
 * The rainwater, rising.
 *
 * It lives just under the view while you are making ground, so most runs only
 * ever see the glow that warns it is about to move. Once it is climbing it has
 * to be unambiguous — a surface with a crest, bubbles, rain coming down into
 * it — because the only correct response to seeing it is to stop and climb.
 */
function drawTide(g: Gfx) {
  const { ctx, s, dark, cell, w, h, Y, t } = g
  const surface = Y(bufferRowOf(s, s.tide))
  const heat = tidePressure(s)
  if (surface > h + cell && heat <= 0.01) return

  const top = Math.min(surface, h + cell)
  const beat = heat > 0.5 ? 0.5 + 0.5 * Math.sin(t * (5 + heat * 6)) : 0
  const glow = ctx.createLinearGradient(0, top - cell * 3.2, 0, top)
  glow.addColorStop(0, hsla(WATER_HUE, 80, 60, 0))
  glow.addColorStop(1, hsla(WATER_HUE, 80, 60, 0.08 + heat * 0.28 + beat * 0.08))
  ctx.fillStyle = glow
  ctx.fillRect(0, top - cell * 3.2, w, cell * 3.2)

  // Rain coming down into it while it is awake, a short slanting streak a drop.
  if (heat > 0.25) {
    ctx.strokeStyle = hsla(WATER_HUE, 80, dark ? 78 : 46)
    ctx.lineWidth = Math.max(1, cell * 0.035)
    ctx.lineCap = 'round'
    for (let i = 0; i < 18; i++) {
      const u = frac(t * 1.6 + i * 0.137)
      const x = frac(Math.sin(i * 91.7) * 311.3) * w + u * cell * 0.5
      const y = top - (1 - u) * cell * 3
      ctx.globalAlpha = heat * Math.sin(u * Math.PI) * 0.8
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - cell * 0.08, y - cell * 0.32)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.lineCap = 'butt'
  }

  if (top >= h) return

  const wave = (x: number) =>
    top + Math.sin(x / (cell * 1.3) + t * 2.4) * cell * 0.09 + Math.sin(x / (cell * 3.1) - t * 1.4) * cell * 0.06
  const path = new Path2D()
  path.moveTo(0, h)
  for (let x = 0; x <= w + cell * 0.25; x += cell * 0.25) path.lineTo(x, wave(x))
  path.lineTo(w, h)
  path.closePath()

  const body = ctx.createLinearGradient(0, top, 0, h)
  body.addColorStop(0, dark ? hsla(WATER_HUE, 70, 40, 0.94) : hsla(WATER_HUE, 72, 62, 0.88))
  body.addColorStop(1, dark ? hsla(WATER_HUE + 12, 60, 13, 0.97) : hsla(WATER_HUE + 12, 55, 38, 0.93))
  ctx.fillStyle = body
  ctx.fill(path)

  // Bubbles rising through it.
  ctx.save()
  ctx.clip(path)
  ctx.strokeStyle = dark ? 'rgba(200, 232, 255, 0.5)' : 'rgba(236, 246, 255, 0.75)'
  ctx.lineWidth = Math.max(1, cell * 0.03)
  for (let i = 0; i < 16; i++) {
    const u = frac(t * 0.28 + i * 0.173)
    const x = frac(Math.sin(i * 57.1) * 713.7) * w + Math.sin(t * 1.6 + i * 2) * cell * 0.15
    const y = h - (h - top + cell) * u
    ctx.globalAlpha = Math.sin(u * Math.PI)
    ctx.beginPath()
    ctx.arc(x, y, cell * (0.05 + 0.07 * frac(i * 0.61)), 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
  ctx.globalAlpha = 1

  // The crest.
  ctx.beginPath()
  for (let x = 0; x <= w + cell * 0.25; x += cell * 0.25) {
    if (x === 0) ctx.moveTo(x, wave(x))
    else ctx.lineTo(x, wave(x))
  }
  ctx.strokeStyle = hsla(WATER_HUE - 8, 90, dark ? 76 : 50, 0.65 + heat * 0.35)
  ctx.lineWidth = Math.max(1.5, cell * 0.07)
  ctx.lineJoin = 'round'
  ctx.stroke()
}

// ————————————————————————————————————————————————————————— text

const POP_SCALE: Record<PopTone, number> = { ink: 0.52, streak: 0.62, lost: 0.46, row: 0.78 }

/** The streak keeps the amber the readout gives it; a lost one goes red. */
function popColour(tone: PopTone, dark: boolean) {
  switch (tone) {
    case 'streak':
      return hsla(40, 86, dark ? 66 : 38, 1)
    case 'lost':
      return hsla(350, 64, dark ? 72 : 44, 0.95)
    case 'row':
      return hsla(ACCENT, 70, dark ? 66 : 32, 1)
    default:
      return inkColor()
  }
}

function drawPops(g: Gfx) {
  const { ctx, s, dark, cell, Y } = g
  if (!s.pops.length) return
  const field = playfieldColor()
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const pop of s.pops) {
    const k = 1 - pop.life / pop.maxLife
    // Pops land big and settle, so the moment reads before the words do.
    const land = k < 0.12 ? 1 + (0.12 - k) * 2.2 : 1
    const size = Math.max(11, Math.round(cell * POP_SCALE[pop.tone] * land))
    ctx.font = `700 ${size}px ${FONT}`
    ctx.globalAlpha = Math.min(1, (pop.life / pop.maxLife) * 2.5)
    const x = pop.x * cell
    const y = Y(pop.y) - k * cell * (pop.tone === 'row' ? 0.5 : 0.9)
    // A halo of the floor behind the words, so they read over crumbs and walls alike.
    ctx.strokeStyle = field
    ctx.lineWidth = Math.max(3, size * 0.28)
    ctx.strokeText(pop.text, x, y)
    ctx.fillStyle = popColour(pop.tone, dark)
    ctx.fillText(pop.text, x, y)
  }
  ctx.restore()
}

// ——————————————————————————————————————————————————————— render

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.canvas.style.width = `${w}px`
    ctx.canvas.style.height = `${h}px`
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const layout = computeLayout(w, h, state)
  const cell = layout.cell
  const top = layout.rowY(0)
  const g: Gfx = {
    ctx,
    s: state,
    dark: isDarkTheme(),
    cell,
    w,
    h,
    t: state.time,
    Y: (y) => top + y * cell,
  }

  drawSky(g)

  // The board knocks with a big moment; the sky behind it does not.
  ctx.save()
  if ((state.shake ?? 0) > 0.01) {
    const m = state.shake * state.shake * cell * 0.3
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
  }

  drawMilestones(g)
  drawWalls(g)
  drawCrumbs(g)
  drawBites(g)
  drawFruit(g)
  drawCharm(g)
  drawBeam(g)

  /*
   * Anything straddling the side seam is drawn twice, once on each edge.
   * Positions live on a torus, so an actor halfway through the wrap is
   * genuinely half off one side and half onto the other — one draw would
   * show it sliding off the board and reappearing a frame later.
   */
  const span = state.cols * cell
  const seams = (x: number) => (x < 1 ? [0, span] : x > state.cols - 1 ? [0, -span] : [0])
  const drawAt = (x: number, draw: () => void) => {
    for (const dx of seams(x)) {
      ctx.save()
      ctx.translate(dx, 0)
      draw()
      ctx.restore()
    }
  }

  drawCouplings(g)
  for (const ghost of state.ghosts) drawAt(ghost.x, () => drawChaser(g, ghost))
  drawAt(state.player.x, () => drawPlayer(g))
  drawRings(g)
  drawBits(g)
  drawPops(g)
  ctx.restore()

  drawTide(g)
}
