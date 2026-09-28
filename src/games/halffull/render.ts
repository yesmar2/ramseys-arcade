import { drawCritter, INK, type Critter, type Look, type Mood, type Pose } from '../findbug/critters'
import { TIP_TIME, isSplitRound, type GameState, type PourResult } from './game'
import { K, LEVELS, radiusAt, type Family, type Glass } from './glasses'
import { guestFor, liquidFor, type Liquid } from './looks'
import { splitLevelB } from './plan'
import { formatPercent, markFor, type Mark } from './score'

/*
 * Half Full's kitchen counter: the glass of the round, its guest sitting beside it, the jug that pours,
 * and the Tip, when the glass is lifted and poured into a measuring jug that says how full it was.
 *
 * The glass is drawn from its knots: its inside is exactly what's filled, a clear wall round it, a
 * little from above so its rim and its drink's top are ellipses. Nothing on it is a number or a mark:
 * the eye alone judges half, until the jug says.
 */

type Ctx = CanvasRenderingContext2D
type Pt = [number, number]

export type View = {
  w: number
  h: number
  /** Kept clear at the top (the chrome and the prompt) and the bottom (the controls). */
  top: number
  bottom: number
  font: string
  /** Seconds, for bubbles and wobble. */
  time: number
}

/** How squashed the ellipses are: we look down on the counter a little. */
const E = 0.16
const GLASS_EDGE = '#f4fbff'
const HALF_RED = '#e0413a'

const MARK_COLOUR: Record<Mark, string> = {
  '🎯': '#1fa463',
  '🟩': '#3cb54a',
  '🟨': '#e9b21a',
  '🟧': '#ee7d22',
  '🟥': '#dd3b36',
}

/** How far below the glass its stem and foot reach, in the glass's heights. */
const STEM: Partial<Record<Family, number>> = { bowl: 0.36, flute: 0.2, tulip: 0.24, cone: 0.16 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 3
const phaseOf = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1)

/* ---------- where things stand ---------- */

/** A glass set on the counter: `cx` its middle, `yb` its inside bottom, R its widest inside radius and H its inside height, in px. */
type Placed = { g: Glass; cx: number; yb: number; R: number; H: number; t: number; stem: number; base: number }

/** The biggest the glass will go with its foot at y1, inside the box. */
function fitGlass(g: Glass, x0: number, x1: number, y0: number, y1: number, maxR = Number.POSITIVE_INFINITY): Placed {
  const stemF = STEM[g.family] ?? 0
  const baseF = stemF ? 0.025 : 0.05
  const R = Math.max(8, Math.min(maxR, (x1 - x0) / 2 / 1.08, (y1 - y0) / (g.aspect * (1 + stemF + baseF) + 2 * E)))
  const H = g.aspect * R
  const stem = stemF * H
  const base = Math.max(3, baseF * H)
  return { g, cx: (x0 + x1) / 2, yb: y1 - stem - base, R, H, t: clamp(R * 0.05, 2.5, 6), stem, base }
}

/** The same glass at a scale, its foot where it was. */
function scalePlaced(p: Placed, k: number, cx: number, footY: number): Placed {
  const R = p.R * k
  const H = p.H * k
  const stem = p.stem * k
  const base = p.base * k
  return { ...p, R, H, stem, base, cx, yb: footY - stem - base, t: p.t * k }
}

const footOf = (p: Placed) => p.yb + p.base + p.stem
const rimR = (p: Placed) => (p.g.r[K]! / 1000) * p.R
const radiusPx = (p: Placed, L: number) => (radiusAt(p.g, L) / 1000) * p.R
const levelY = (p: Placed, L: number) => p.yb - (L / LEVELS) * p.H

type Scene = {
  counterY: number
  /** Where the round's glass stands while it's poured. */
  box: { x0: number; x1: number; y0: number; y1: number }
  guestSize: number
  pitcher: number
}

function sceneFor(v: View): Scene {
  const counterY = v.h - v.bottom + Math.min(26, v.bottom * 0.25)
  const guestSize = clamp(v.h * 0.11, 48, 104)
  const pitcher = clamp(Math.min(v.w, v.h) * 0.15, 44, 76)
  const room = Math.min(v.w - 32, 620)
  const x0 = (v.w - room) / 2
  // The glass shares the counter with its guest, on its right.
  const box = { x0: x0 + guestSize * 0.1, x1: x0 + room - guestSize * 0.9, y0: v.top + pitcher * 1.15 + 6, y1: counterY }
  return { counterY, box, guestSize, pitcher }
}

/* ---------- the kitchen ---------- */

function drawKitchen(ctx: Ctx, v: View, counterY: number) {
  const wall = ctx.createLinearGradient(0, 0, 0, counterY)
  wall.addColorStop(0, '#fde9d2')
  wall.addColorStop(1, '#f7cfa7')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, v.w, counterY)
  // Tiles behind the counter.
  const tile = clamp(v.w / 9, 34, 64)
  const tileTop = counterY - tile * 3.2
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'
  ctx.fillRect(0, tileTop, v.w, counterY - tileTop)
  ctx.strokeStyle = 'rgba(190, 120, 80, 0.16)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let y = counterY; y > tileTop; y -= tile) {
    ctx.moveTo(0, y)
    ctx.lineTo(v.w, y)
  }
  for (let x = (v.w / 2) % tile; x < v.w; x += tile) {
    ctx.moveTo(x, tileTop)
    ctx.lineTo(x, counterY)
  }
  ctx.stroke()
  // The counter: its top, lit, and its front.
  const lip = Math.max(10, (v.h - counterY) * 0.14)
  ctx.fillStyle = '#48b3a6'
  ctx.fillRect(0, counterY, v.w, lip)
  ctx.fillStyle = '#2f8b82'
  ctx.fillRect(0, counterY + lip, v.w, v.h - counterY - lip)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.fillRect(0, counterY, v.w, 2)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'
  ctx.fillRect(0, counterY + lip, v.w, 3)
}

/* ---------- a glass ---------- */

/** One wall, bottom up to level `upTo`. side −1 is the left. */
function wallPts(p: Placed, side: -1 | 1, upTo = LEVELS): Pt[] {
  const pts: Pt[] = []
  const top = (upTo / LEVELS) * K
  for (let k = 0; k <= K; k++) {
    if (k > top) {
      pts.push([p.cx + side * radiusPx(p, upTo), levelY(p, upTo)])
      break
    }
    pts.push([p.cx + side * (p.g.r[k]! / 1000) * p.R, p.yb - (k / K) * p.H])
  }
  return pts
}

/** The inside of the glass: up the left wall, across the far rim, down the right, round the near bottom. */
function insidePath(ctx: Ctx, p: Placed) {
  const left = wallPts(p, -1)
  const right = wallPts(p, 1).reverse()
  const top = rimR(p)
  const r0 = (p.g.r[0]! / 1000) * p.R
  ctx.beginPath()
  ctx.moveTo(left[0]![0], left[0]![1])
  for (const [x, y] of left) ctx.lineTo(x, y)
  ctx.ellipse(p.cx, p.yb - p.H, top, E * top, 0, Math.PI, 2 * Math.PI)
  for (const [x, y] of right) ctx.lineTo(x, y)
  ctx.ellipse(p.cx, p.yb, r0, E * r0, 0, 0, Math.PI)
  ctx.closePath()
}

/** The drink up to a level: body, the shade on its far side, its top, and its fizz. */
function drawLiquid(ctx: Ctx, p: Placed, level: number, liquid: Liquid, time: number, alpha = 1) {
  if (level <= 0) return
  const L = Math.min(level, LEVELS)
  const y = levelY(p, L)
  const rL = radiusPx(p, L)
  const r0 = (p.g.r[0]! / 1000) * p.R
  ctx.save()
  ctx.globalAlpha *= alpha
  const solid = ctx.globalAlpha >= 0.999
  insidePath(ctx, p)
  ctx.clip()
  const body = () => {
    ctx.beginPath()
    const left = wallPts(p, -1, L)
    const right = wallPts(p, 1, L).reverse()
    ctx.moveTo(left[0]![0], left[0]![1])
    for (const [x, yy] of left) ctx.lineTo(x, yy)
    for (const [x, yy] of right) ctx.lineTo(x, yy)
    ctx.ellipse(p.cx, p.yb, r0, E * r0, 0, 0, Math.PI)
    ctx.closePath()
  }
  body()
  const shade = ctx.createLinearGradient(p.cx - p.R, 0, p.cx + p.R, 0)
  shade.addColorStop(0, liquid.body)
  shade.addColorStop(0.62, liquid.body)
  shade.addColorStop(1, liquid.shade)
  ctx.fillStyle = shade
  ctx.fill()
  if (liquid.bubbles && solid) {
    ctx.save()
    body()
    ctx.clip()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    const hL = p.yb - y
    for (let i = 0; i < 9; i++) {
      const phase = (i * 0.37 + time * (0.18 + (i % 3) * 0.07)) % 1
      const by = p.yb - phase * hL
      const at = clamp(((p.yb - by) / p.H) * LEVELS, 0, LEVELS)
      const bx = p.cx + (((i * 0.61) % 1) - 0.5) * 1.4 * radiusPx(p, at)
      ctx.beginPath()
      ctx.arc(bx, by, 1.2 + (i % 3) * 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
  // The top, seen from a little above.
  ctx.beginPath()
  ctx.ellipse(p.cx, y, rL, E * rL, 0, 0, Math.PI * 2)
  ctx.fillStyle = liquid.top
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = liquid.shade
  ctx.stroke()
  ctx.restore()
}

function drawShadow(ctx: Ctx, p: Placed, alpha = 1) {
  if (alpha <= 0) return
  const r = Math.max((p.g.r[0]! / 1000) * p.R + p.t, p.stem ? p.R * 0.62 : 0)
  ctx.fillStyle = `rgba(90, 40, 20, ${0.16 * alpha})`
  ctx.beginPath()
  ctx.ellipse(p.cx + r * 0.05, footOf(p), r * 1.05, Math.max(3, E * r * 1.1), 0, 0, Math.PI * 2)
  ctx.fill()
}

/** What the glass stands on: a thick glass base, or a stem and a foot. */
function drawFoot(ctx: Ctx, p: Placed) {
  const r0 = (p.g.r[0]! / 1000) * p.R
  const foot = footOf(p)
  ctx.lineJoin = 'round'
  if (p.stem > 0) {
    const fr = Math.max(p.R * 0.58, r0 + p.t)
    const sw = Math.max(3, p.R * 0.09)
    ctx.beginPath()
    ctx.moveTo(p.cx - sw / 2, p.yb + E * r0)
    ctx.lineTo(p.cx - sw / 2, foot - E * fr * 0.5)
    ctx.lineTo(p.cx + sw / 2, foot - E * fr * 0.5)
    ctx.lineTo(p.cx + sw / 2, p.yb + E * r0)
    ctx.closePath()
    ctx.fillStyle = 'rgba(225, 242, 250, 0.85)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = INK
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(p.cx, foot - E * fr * 0.4, fr, E * fr, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(225, 242, 250, 0.92)'
    ctx.fill()
    ctx.stroke()
    return
  }
  const rb = r0 + p.t / 2
  ctx.beginPath()
  ctx.moveTo(p.cx - rb, p.yb)
  ctx.lineTo(p.cx - rb, foot - E * rb)
  ctx.ellipse(p.cx, foot - E * rb, rb, E * rb, 0, Math.PI, 0, true)
  ctx.lineTo(p.cx + rb, p.yb)
  ctx.closePath()
  ctx.fillStyle = 'rgba(225, 242, 250, 0.8)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  ctx.stroke()
}

/** The glass behind the drink: a clear tint, and the far half of the rim. */
function drawGlassBack(ctx: Ctx, p: Placed) {
  insidePath(ctx, p)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.26)'
  ctx.fill()
  const top = rimR(p)
  ctx.beginPath()
  ctx.ellipse(p.cx, p.yb - p.H, top, E * top, 0, Math.PI, 2 * Math.PI)
  ctx.lineWidth = p.t * 0.7 + 2
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.lineWidth = p.t * 0.7
  ctx.strokeStyle = 'rgba(244, 251, 255, 0.9)'
  ctx.stroke()
}

/** The walls, the near rim and bottom, and the glint down the left. */
function drawGlassFront(ctx: Ctx, p: Placed) {
  const top = rimR(p)
  const r0 = (p.g.r[0]! / 1000) * p.R
  const outline = () => {
    ctx.beginPath()
    const left = wallPts(p, -1)
    ctx.moveTo(left[0]![0], left[0]![1])
    for (const [x, y] of left) ctx.lineTo(x, y)
    ctx.ellipse(p.cx, p.yb - p.H, top, E * top, 0, Math.PI, 0, true)
    for (const [x, y] of wallPts(p, 1).reverse()) ctx.lineTo(x, y)
    ctx.ellipse(p.cx, p.yb, r0, E * r0, 0, 0, Math.PI)
  }
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  outline()
  ctx.lineWidth = p.t + 3
  ctx.strokeStyle = INK
  ctx.stroke()
  outline()
  ctx.lineWidth = p.t
  ctx.strokeStyle = GLASS_EDGE
  ctx.stroke()
  // Two glints down the left, following its shape.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
  for (const [from, to, at, width] of [
    [8, 42, 0.72, Math.max(2, p.R * 0.06)],
    [12, 30, 0.5, Math.max(1.2, p.R * 0.025)],
  ] as const) {
    ctx.beginPath()
    for (let k = from; k <= to; k++) {
      const x = p.cx - (p.g.r[k]! / 1000) * p.R * at
      const y = p.yb - (k / K) * p.H
      if (k === from) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.lineWidth = width
    ctx.stroke()
  }
}

type GlassMarks = {
  /** A see-through drink to here: where the player stopped, after the Tip. */
  ghost?: number
  /** The line the glass was really half at, dashed red. */
  half?: number
  /** The words beside the line. */
  halfWords?: string
  /** Drawn over the drink and under the glass's front: the stream falling in. */
  between?: () => void
  /** The shadow's strength, for a glass being lifted off or set down. */
  shadow?: number
}

function drawGlass(ctx: Ctx, p: Placed, level: number, liquid: Liquid, v: View, marks: GlassMarks = {}) {
  drawShadow(ctx, p, marks.shadow ?? 1)
  drawFoot(ctx, p)
  drawGlassBack(ctx, p)
  drawLiquid(ctx, p, level, liquid, v.time)
  if (marks.ghost != null) drawLiquid(ctx, p, marks.ghost, liquid, v.time, 0.5)
  marks.between?.()
  drawGlassFront(ctx, p)
  // The lower line's word goes under it and the upper's over it, so close lines never share a word's room.
  const ghost = marks.ghost != null && marks.ghost > 0 ? marks.ghost : null
  const half = marks.half ?? null
  if (ghost != null) levelLine(ctx, p, ghost, INK, false, 'you', v, -1, half != null && ghost < half)
  if (half != null) levelLine(ctx, p, half, HALF_RED, true, marks.halfWords ?? 'half', v, 1, ghost != null && half < ghost)
}

/** A line across the glass at a level, its word sitting on it, in the left half (−1) or the right (1). */
function levelLine(ctx: Ctx, p: Placed, L: number, colour: string, dashed: boolean, words: string, v: View, side: 1 | -1, below = false) {
  const y = levelY(p, L)
  const r = radiusPx(p, L)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.setLineDash(dashed ? [7, 5] : [])
  ctx.beginPath()
  ctx.moveTo(p.cx - r - 3, y)
  ctx.lineTo(p.cx + r + 3, y)
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.stroke()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = colour
  ctx.stroke()
  ctx.setLineDash([])
  const size = clamp(p.R * 0.17, 12, 16)
  ctx.font = `800 ${size}px ${v.font}`
  ctx.textBaseline = below ? 'top' : 'bottom'
  ctx.textAlign = 'center'
  const x = p.cx + side * Math.max(r * 0.5, size * 1.2)
  const yText = below ? y + 4 : y - 3
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeText(words, x, yText)
  ctx.fillStyle = colour
  ctx.fillText(words, x, yText)
  ctx.restore()
}

/* ---------- the jug that pours, and its stream ---------- */

/** A cream jug with its spout at (x, y), tipped by `tilt` radians to pour right. */
function drawPitcher(ctx: Ctx, x: number, y: number, s: number, tilt: number, liquid: Liquid) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.lineJoin = 'round'
  ctx.lineWidth = 2.2
  ctx.strokeStyle = INK
  // Handle, behind.
  ctx.beginPath()
  ctx.ellipse(-1.02 * s, 0.52 * s, 0.2 * s, 0.26 * s, 0, Math.PI / 2, (3 * Math.PI) / 2)
  ctx.lineWidth = Math.max(4, s * 0.1)
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.lineWidth = Math.max(2, s * 0.06)
  ctx.strokeStyle = '#fffaf1'
  ctx.stroke()
  // Body and spout.
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-0.3 * s, 0.1 * s)
  ctx.quadraticCurveTo(-0.22 * s, 0.5 * s, -0.24 * s, 0.98 * s)
  ctx.lineTo(-0.96 * s, 0.98 * s)
  ctx.quadraticCurveTo(-1.02 * s, 0.5 * s, -0.9 * s, 0.1 * s)
  ctx.lineTo(-0.34 * s, 0.1 * s)
  ctx.lineTo(-0.2 * s, 0.22 * s)
  ctx.closePath()
  ctx.fillStyle = '#fffaf1'
  ctx.fill()
  ctx.lineWidth = 2.2
  ctx.strokeStyle = INK
  ctx.stroke()
  // A band in the drink's colour, so the jug says what's in it.
  ctx.beginPath()
  ctx.moveTo(-0.24 * s, 0.5 * s)
  ctx.lineTo(-0.98 * s, 0.5 * s)
  ctx.lineTo(-0.99 * s, 0.66 * s)
  ctx.lineTo(-0.235 * s, 0.66 * s)
  ctx.closePath()
  ctx.fillStyle = liquid.body
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** A falling ribbon of drink from (x, y0) to (x, y1). */
function drawStream(ctx: Ctx, x: number, y0: number, y1: number, width: number, liquid: Liquid, time: number) {
  if (y1 <= y0 || width <= 0.5) return
  ctx.save()
  ctx.beginPath()
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const y = lerp(y0, y1, i / steps)
    const wob = Math.sin(time * 18 + i * 0.9) * 0.7 * (i / steps)
    const half = width * (0.55 + 0.45 * (1 - i / steps)) * 0.5
    if (i === 0) ctx.moveTo(x - half + wob, y)
    else ctx.lineTo(x - half + wob, y)
  }
  for (let i = steps; i >= 0; i--) {
    const y = lerp(y0, y1, i / steps)
    const wob = Math.sin(time * 18 + i * 0.9) * 0.7 * (i / steps)
    const half = width * (0.55 + 0.45 * (1 - i / steps)) * 0.5
    ctx.lineTo(x + half + wob, y)
  }
  ctx.closePath()
  ctx.fillStyle = liquid.body
  ctx.fill()
  ctx.lineWidth = 1.2
  ctx.strokeStyle = liquid.shade
  ctx.stroke()
  // Splash where it lands.
  ctx.fillStyle = liquid.top
  for (let i = 0; i < 3; i++) {
    const a = time * 9 + i * 2.1
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * width * 1.3, y1 - Math.abs(Math.sin(a)) * width, Math.max(1.2, width * 0.22), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/* ---------- guests ---------- */

function drawGuest(ctx: Ctx, look: Look, x: number, y: number, size: number, mood: Mood, pose: Pose, gazeX: number) {
  const c: Critter = {
    id: -1,
    x,
    y,
    size,
    look: { ...look, held: 'none' },
    pose,
    facing: 0,
    flip: false,
    gazeX,
    gazeY: 0.15,
    mood,
    lift: 0,
    z: 0,
  }
  drawCritter(ctx, c)
}

/** How a guest takes their pour: a bullseye delights, a way-off one shocks. */
function reaction(r: PourResult | undefined): { mood: Mood; pose: Pose } {
  if (!r) return { mood: 'smile', pose: 'stand' }
  if (r.score >= 96) return { mood: 'open', pose: 'cheer' }
  if (r.score >= 86) return { mood: 'smile', pose: 'wave' }
  if (r.score >= 60) return { mood: 'sleepy', pose: 'stand' }
  return { mood: 'o', pose: 'stand' }
}

/* ---------- the measuring jug ---------- */

type Jug = { cx: number; bottom: number; r: number; h: number }

function jugFor(v: View, s: Scene): Jug {
  const avail = s.counterY - v.top - 30
  const h = Math.min(avail * 0.7, 360)
  const r = clamp(Math.min(h * 0.24, v.w * 0.11), 26, 78)
  // At the right on a phone; on a wide screen, not so far from the glass it's poured from.
  const cx = Math.min(v.w - r - Math.max(r * 0.55 + 16, v.w * 0.06), v.w * 0.5 + Math.max(170, v.w * 0.16))
  return { cx, bottom: s.counterY - 4, r, h }
}

/** A straight measuring jug, `fill` of it full, ten ticks and a red HALF line. */
function drawJug(ctx: Ctx, j: Jug, fill: number, liquid: Liquid, v: View, halfWord = 'HALF') {
  const top = j.bottom - j.h
  const er = E * j.r
  ctx.save()
  ctx.lineJoin = 'round'
  // Shadow and handle.
  ctx.fillStyle = 'rgba(90, 40, 20, 0.16)'
  ctx.beginPath()
  ctx.ellipse(j.cx + j.r * 0.1, j.bottom + 2, j.r * 1.2, er * 1.3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(j.cx + j.r, top + j.h * 0.14)
  ctx.bezierCurveTo(j.cx + j.r * 1.75, top + j.h * 0.14, j.cx + j.r * 1.75, top + j.h * 0.62, j.cx + j.r, top + j.h * 0.62)
  ctx.lineWidth = Math.max(7, j.r * 0.2)
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.lineWidth = Math.max(4, j.r * 0.13)
  ctx.strokeStyle = GLASS_EDGE
  ctx.stroke()
  // Inside.
  const inside = () => {
    ctx.beginPath()
    ctx.moveTo(j.cx - j.r, j.bottom)
    ctx.lineTo(j.cx - j.r, top)
    ctx.ellipse(j.cx, top, j.r, er, 0, Math.PI, 2 * Math.PI)
    ctx.lineTo(j.cx + j.r, j.bottom)
    ctx.ellipse(j.cx, j.bottom, j.r, er, 0, 0, Math.PI)
    ctx.closePath()
  }
  inside()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)'
  ctx.fill()
  // The drink.
  if (fill > 0) {
    const y = j.bottom - j.h * Math.min(1, fill)
    ctx.save()
    inside()
    ctx.clip()
    ctx.beginPath()
    ctx.moveTo(j.cx - j.r, y)
    ctx.lineTo(j.cx - j.r, j.bottom)
    ctx.ellipse(j.cx, j.bottom, j.r, er, 0, Math.PI, 0, true)
    ctx.lineTo(j.cx + j.r, y)
    ctx.closePath()
    const shade = ctx.createLinearGradient(j.cx - j.r, 0, j.cx + j.r, 0)
    shade.addColorStop(0, liquid.body)
    shade.addColorStop(0.6, liquid.body)
    shade.addColorStop(1, liquid.shade)
    ctx.fillStyle = shade
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(j.cx, y, j.r, er, 0, 0, Math.PI * 2)
    ctx.fillStyle = liquid.top
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = liquid.shade
    ctx.stroke()
    ctx.restore()
  }
  // Ticks down the left, a tenth apart.
  ctx.strokeStyle = 'rgba(26, 43, 60, 0.55)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  for (let i = 1; i < 10; i++) {
    if (i === 5) continue
    const y = j.bottom - (j.h * i) / 10
    ctx.moveTo(j.cx - j.r + 3, y + E * j.r * 0.9)
    ctx.lineTo(j.cx - j.r + j.r * (i % 5 === 0 ? 0.5 : 0.28), y + E * j.r * 0.8)
  }
  ctx.stroke()
  // The half line, all the way round the front.
  const hy = j.bottom - j.h / 2
  ctx.save()
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.ellipse(j.cx, hy, j.r, er, 0, 0, Math.PI)
  ctx.lineWidth = 3
  ctx.strokeStyle = HALF_RED
  ctx.stroke()
  ctx.restore()
  const size = clamp(j.r * 0.3, 11, 16)
  ctx.font = `800 ${size}px ${v.font}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.strokeText(halfWord, j.cx - j.r - 6, hy + er * 0.6)
  ctx.fillStyle = HALF_RED
  ctx.fillText(halfWord, j.cx - j.r - 6, hy + er * 0.6)
  // Walls, rim and bottom.
  const outline = () => {
    ctx.beginPath()
    ctx.moveTo(j.cx - j.r, j.bottom)
    ctx.lineTo(j.cx - j.r, top)
    ctx.ellipse(j.cx, top, j.r, er, 0, Math.PI, 3 * Math.PI)
    ctx.moveTo(j.cx + j.r, top)
    ctx.lineTo(j.cx + j.r, j.bottom)
    ctx.ellipse(j.cx, j.bottom, j.r, er, 0, 0, Math.PI)
  }
  outline()
  ctx.lineWidth = 6
  ctx.strokeStyle = INK
  ctx.stroke()
  outline()
  ctx.lineWidth = 3.5
  ctx.strokeStyle = GLASS_EDGE
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.lineWidth = Math.max(2, j.r * 0.08)
  ctx.beginPath()
  ctx.moveTo(j.cx - j.r * 0.62, top + j.h * 0.1)
  ctx.lineTo(j.cx - j.r * 0.62, j.bottom - j.h * 0.12)
  ctx.stroke()
  ctx.restore()
}

/** The number the jug's counting up to, over its top (moved right by `dx`). */
function drawCount(ctx: Ctx, j: Jug, text: string, v: View, colour = INK, dx = 0) {
  const size = clamp(j.r * 0.62, 22, 44)
  ctx.save()
  ctx.font = `800 ${size}px ${v.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.lineWidth = 6
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)'
  const y = j.bottom - j.h - E * j.r - 12
  ctx.strokeText(text, j.cx + dx, y)
  ctx.fillStyle = colour
  ctx.fillText(text, j.cx + dx, y)
  ctx.restore()
}

/** The stamp that lands on the jug: how full, in the pour's colour. */
function drawStamp(ctx: Ctx, x: number, y: number, size: number, text: string, colour: string, t: number, v: View) {
  if (t <= 0) return
  const k = t < 0.6 ? lerp(2.2, 0.92, easeOut(t / 0.6)) : lerp(0.92, 1, (t - 0.6) / 0.4)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.16)
  ctx.scale(k, k)
  ctx.globalAlpha = clamp(t * 3, 0, 1)
  const w = size * 2.3
  const h = size * 1.12
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, size * 0.24)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
  ctx.fill()
  ctx.lineWidth = Math.max(3, size * 0.1)
  ctx.strokeStyle = colour
  ctx.stroke()
  ctx.font = `900 ${size * 0.72}px ${v.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = colour
  ctx.fillText(text, 0, size * 0.04)
  ctx.restore()
}

/* ---------- a tipped glass's drink, by area ---------- */

/** Keep the part of a polygon at or below a height (screen y at least Y). */
function clipBelow(poly: Pt[], Y: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const ina = a[1] >= Y
    const inb = b[1] >= Y
    if (ina) out.push(a)
    if (ina !== inb) {
      const t = (Y - a[1]) / (b[1] - a[1])
      out.push([a[0] + (b[0] - a[0]) * t, Y])
    }
  }
  return out
}

function polyArea(poly: Pt[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!
    const q = poly[(i + 1) % poly.length]!
    a += p[0] * q[1] - q[0] * p[1]
  }
  return Math.abs(a) / 2
}

/** The height the drink's top sits at, in a glass outline tipped any way, for it to cover `area`. */
function surfaceFor(poly: Pt[], area: number): number {
  let lo = Math.min(...poly.map((p) => p[1]))
  let hi = Math.max(...poly.map((p) => p[1]))
  if (area <= 0) return hi
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2
    if (polyArea(clipBelow(poly, mid)) > area) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

type Pose2 = { px: number; py: number; theta: number; k: number }

/** The glass drawn lifted and turned: its right rim (the lip it pours from) at (px, py), turned theta, scaled k. */
function withPose(ctx: Ctx, p: Placed, pose: Pose2, draw: () => void) {
  const lipX = p.cx + rimR(p)
  const lipY = p.yb - p.H
  ctx.save()
  ctx.translate(pose.px, pose.py)
  ctx.rotate(pose.theta)
  ctx.scale(pose.k, pose.k)
  ctx.translate(-lipX, -lipY)
  draw()
  ctx.restore()
}

function posedPoint(p: Placed, pose: Pose2, x: number, y: number): Pt {
  const dx = (x - (p.cx + rimR(p))) * pose.k
  const dy = (y - (p.yb - p.H)) * pose.k
  const c = Math.cos(pose.theta)
  const s = Math.sin(pose.theta)
  return [pose.px + dx * c - dy * s, pose.py + dx * s + dy * c]
}

/** The box a posed glass covers: its walls, rim and foot. */
function posedBox(p: Placed, pose: Pose2): { x0: number; x1: number; y0: number; y1: number } {
  const pts: Pt[] = []
  for (let k = 0; k <= K; k += 5) {
    const r = (p.g.r[k]! / 1000) * p.R + p.t
    const y = p.yb - (k / K) * p.H
    pts.push([p.cx - r, y], [p.cx + r, y])
  }
  const r0 = (p.g.r[0]! / 1000) * p.R
  const fr = p.stem ? Math.max(p.R * 0.58, r0 + p.t) : r0 + p.t
  pts.push([p.cx - fr, footOf(p)], [p.cx + fr, footOf(p)])
  const out = pts.map(([x, y]) => posedPoint(p, pose, x, y))
  return {
    x0: Math.min(...out.map((q) => q[0])),
    x1: Math.max(...out.map((q) => q[0])),
    y0: Math.min(...out.map((q) => q[1])),
    y1: Math.max(...out.map((q) => q[1])),
  }
}

/** A glass lifted and tipped, with `remaining` of its drink's outline area still in it. */
function drawTippedGlass(ctx: Ctx, p: Placed, pose: Pose2, level: number, remaining: number, liquid: Liquid) {
  withPose(ctx, p, pose, () => {
    drawFoot(ctx, p)
    drawGlassBack(ctx, p)
  })
  // The outline in the room, to find where the drink's top sits.
  const local = [...wallPts(p, -1), ...wallPts(p, 1).reverse()]
  const poly = local.map(([x, y]) => posedPoint(p, pose, x, y))
  const upright = [...wallPts(p, -1, level), ...wallPts(p, 1, level).reverse()]
  // By outline area, the drink finds the lowest part of the tipped glass: its mouth, as it pours.
  const area = polyArea(upright) * pose.k * pose.k * remaining
  if (pose.theta < 0.03 && remaining >= 0.999) {
    withPose(ctx, p, pose, () => drawLiquid(ctx, p, level, liquid, 0))
  } else if (area > 0.5) {
    const Y = surfaceFor(poly, area)
    ctx.save()
    ctx.beginPath()
    for (const [i, [x, y]] of poly.entries()) {
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.clip()
    const minX = Math.min(...poly.map((q) => q[0]))
    const maxX = Math.max(...poly.map((q) => q[0]))
    const maxY = Math.max(...poly.map((q) => q[1]))
    ctx.fillStyle = liquid.body
    ctx.fillRect(minX - 4, Y, maxX - minX + 8, maxY - Y + 8)
    // Its top, where the level crosses the glass's sides.
    const xs: number[] = []
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i]!
      const [bx, by] = poly[(i + 1) % poly.length]!
      if ((ay - Y) * (by - Y) <= 0 && ay !== by) xs.push(ax + ((Y - ay) / (by - ay)) * (bx - ax))
    }
    if (xs.length >= 2) {
      const x0 = Math.min(...xs)
      const x1 = Math.max(...xs)
      const rx = (x1 - x0) / 2
      ctx.beginPath()
      ctx.ellipse((x0 + x1) / 2, Y, Math.max(0.5, rx), Math.max(0.5, E * rx), 0, 0, Math.PI * 2)
      ctx.fillStyle = liquid.top
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = liquid.shade
      ctx.stroke()
    }
    ctx.restore()
  }
  withPose(ctx, p, pose, () => drawGlassFront(ctx, p))
}

/* ---------- a round ---------- */

/** Where the round's glass stands while it's poured. */
function pourPlaced(s: GameState, v: View, sc: Scene): Placed {
  const g = s.plan.pours[s.round]!
  return fitGlass(g, sc.box.x0, sc.box.x1, sc.box.y0, sc.box.y1, Math.min(v.w, v.h) * 0.42)
}

/** Where the guest stands beside the round's glass: by it, and never off the screen's edge. */
function guestBeside(p: Placed, v: View, size: number): number {
  return Math.min(v.w - size * 0.62, p.cx + p.R * 1.08 + size * 0.38)
}

function drawHalfRound(ctx: Ctx, s: GameState, v: View, sc: Scene) {
  const liquid = liquidFor(s.plan, s.round)
  const guest = guestFor(s.plan, s.round)
  const home = pourPlaced(s, v, sc)
  const result = s.phase === 'pour' ? undefined : s.results[s.round]
  const jug = jugFor(v, sc)
  const gs = sc.guestSize
  const guestHome = guestBeside(home, v, gs)

  if (s.phase === 'pour') {
    // Slide in from the right as the round begins, the guest with the glass.
    const dx = (1 - easeOut(phaseOf(s.roundT, 0, 0.45))) * v.w * 0.7
    const p = { ...home, cx: home.cx + dx }
    drawGuest(ctx, guest.look, guestHome + dx, sc.counterY, gs, 'smile', s.roundT < 1.2 ? 'wave' : 'stand', -0.7)
    // The jug above pours while the level rises, its stream falling in behind the glass's front.
    const pouring = s.flow > 25
    const spoutX = p.cx + 2
    const spoutY = p.yb - p.H - E * rimR(p) - sc.pitcher * 1.05
    const width = clamp(2 + s.flow / 130, 2, 11)
    const landing = levelY(p, s.level) + (s.level > 0 ? 0 : E * radiusPx(p, 0))
    drawGlass(ctx, p, s.level, liquid, v, {
      between: pouring ? () => drawStream(ctx, spoutX, spoutY + 2, landing, width, liquid, v.time) : undefined,
    })
    drawPitcher(ctx, spoutX, spoutY, sc.pitcher, pouring ? 0.62 : 0.18, liquid)
    return
  }

  // The Tip, and after it.
  const r = result!
  const t = s.phase === 'tip' ? s.tipT : TIP_TIME
  const leftRoom = jug.cx - jug.r - 26
  const restK = Math.min(1, fitGlass(home.g, 16, leftRoom, sc.box.y0, sc.box.y1).R / home.R)
  const rest = scalePlaced(home, restK, 16 + (leftRoom - 16) / 2, sc.counterY)
  const lipHome: Pt = [home.cx + rimR(home), home.yb - home.H]
  const lipRest: Pt = [rest.cx + rimR(rest), rest.yb - rest.H]
  const pourAt: Pt = [jug.cx - jug.r * 0.3, jug.bottom - jug.h - E * jug.r - 18]
  // Tipped over the jug, the glass reaches up about its length and its width, and back about its length:
  // it has to stay clear of the prompt and on the screen.
  const length = home.H + home.stem + home.base
  const reach = length + 2 * rimR(home)
  const pourK = Math.min(restK, (jug.h * 0.8) / length, (pourAt[1] - v.top - 8) / reach, (pourAt[0] - 8) / (0.95 * length + 0.4 * home.R))
  const TILT = 1.95
  const a = easeInOut(phaseOf(t, 0, 0.5))
  const pour = easeInOut(phaseOf(t, 0.5, 1.7))
  const back = easeInOut(phaseOf(t, 1.75, 2.1))
  const stampT = phaseOf(t, 2.05, 2.6)
  let pose: Pose2
  if (t < 1.75) {
    pose = { px: lerp(lipHome[0], pourAt[0], a), py: lerp(lipHome[1], pourAt[1], a), theta: TILT * a, k: lerp(1, pourK, a) }
  } else {
    pose = { px: lerp(pourAt[0], lipRest[0], back), py: lerp(pourAt[1], lipRest[1], back), theta: TILT * (1 - back), k: lerp(pourK, restK, back) }
  }
  // On the way up and back down the glass swings about its lip: keep all of it on the screen.
  const box = posedBox(home, pose)
  if (box.x0 < 6) pose.px += 6 - box.x0
  else if (box.x1 > v.w - 6) pose.px -= box.x1 - (v.w - 6)
  if (box.y0 < v.top + 4) pose.py += v.top + 4 - box.y0
  const fill = (r.percent / 100) * pour
  const jugFill = t >= 1.75 ? r.percent / 100 : fill
  // The jug comes in as the glass is lifted.
  ctx.save()
  ctx.globalAlpha = a
  drawJug(ctx, jug, jugFill, liquid, v)
  ctx.restore()
  // The guest steps over to the jug to watch, then takes it how it went.
  const react = stampT > 0.2 ? reaction(r) : { mood: 'smile' as Mood, pose: 'stand' as Pose }
  const byJugSize = gs * 0.8
  const byJug = Math.min(v.w - byJugSize * 0.62, jug.cx + jug.r * 1.6 + gs * 0.3)
  drawGuest(ctx, guest.look, lerp(guestHome, byJug, a), sc.counterY + lerp(0, gs * 0.05, a), lerp(gs, byJugSize, a), react.mood, react.pose, -0.8)
  if (t < 2.1) {
    // The shadow goes as the glass leaves the counter, and comes back as it's set down.
    if (t < 0.5) drawShadow(ctx, home, 1 - a)
    else if (t >= 1.75) drawShadow(ctx, rest, back)
    const remaining = t < 0.5 ? 1 : 1 - pour
    drawTippedGlass(ctx, home, pose, r.level, t >= 1.75 ? 0 : remaining, liquid)
    if (t > 0.5 && t < 1.72 && r.percent > 0.5) {
      const rate = Math.sin(Math.PI * phaseOf(t, 0.5, 1.7)) * Math.min(1, r.percent / 20)
      const lip = posedPoint(home, pose, home.cx + rimR(home), home.yb - home.H)
      const surface = jug.bottom - jug.h * fill
      drawStream(ctx, lip[0] + 2, lip[1] + 2, surface, clamp(3 + rate * jug.r * 0.22, 2, 14), liquid, v.time)
    }
  } else {
    drawGlass(ctx, rest, 0, liquid, v, {
      ghost: stampT > 0 ? r.level : undefined,
      half: stampT > 0.35 ? home.g.half : undefined,
      halfWords: 'half',
    })
  }
  if (stampT <= 0 && t >= 0.45) drawCount(ctx, jug, t < 1.75 ? `${Math.round(r.percent * pour)}%` : formatPercent(r.percent), v, INK, jug.r * 0.55)
  const stampSize = clamp(jug.r * 0.72, 26, 50)
  const stampY = Math.max(v.top + 30 + stampSize * 0.6, jug.bottom - jug.h - E * jug.r - stampSize * 0.95)
  drawStamp(ctx, jug.cx - jug.r * 0.15, stampY, stampSize, formatPercent(r.percent), MARK_COLOUR[markFor(r.score)], stampT, v)
}

/* ---------- the split ---------- */

type Pair = { a: Placed; b: Placed; left: 'a' | 'b'; gapX: number }

/**
 * Both glasses on one scale, so what they hold compares, the tall one on the day's side. Between them
 * a gap `gap` px wide, where their two guests stand.
 */
function placePair(s: GameState, sc: Scene, x0: number, x1: number, y0: number, gap: number): Pair {
  const sp = s.plan.split
  const worldH = (g: typeof sp.A, size: number) => g.aspect * size * (1 + (STEM[g.family] ?? 0) + 0.05) + 2 * E * size
  // Each glass is budgeted a little over its width, for its shadow.
  const worldW = 2 * sp.sizeA * 1.1 + 2 * sp.sizeB * 1.1
  const maxH = Math.max(worldH(sp.A, sp.sizeA), worldH(sp.B, sp.sizeB))
  // However little room there is, the glasses keep a size (a nought or less can't be drawn).
  const px = Math.max(8 / Math.max(sp.sizeA, sp.sizeB), Math.min((x1 - x0 - gap) / worldW, (sc.counterY - y0) / maxH))
  const left = s.plan.looks.tallLeft ? 'a' : 'b'
  const lw = 2 * (left === 'a' ? sp.sizeA : sp.sizeB) * 1.1 * px
  const rw = 2 * (left === 'a' ? sp.sizeB : sp.sizeA) * 1.1 * px
  const mid = (x0 + x1) / 2
  const total = lw + rw + gap
  const lx = mid - total / 2 + lw / 2
  const rx = mid + total / 2 - rw / 2
  const place = (g: typeof sp.A, size: number, cx: number): Placed => {
    const R = size * px
    const H = g.aspect * R
    const stem = (STEM[g.family] ?? 0) * H
    const base = Math.max(3, (stem ? 0.025 : 0.05) * H)
    return { g, cx, yb: sc.counterY - stem - base, R, H, t: clamp(R * 0.05, 2.5, 6), stem, base }
  }
  const a = place(sp.A, sp.sizeA, left === 'a' ? lx : rx)
  const b = place(sp.B, sp.sizeB, left === 'a' ? rx : lx)
  return { a, b, left, gapX: mid - total / 2 + lw + gap / 2 }
}

function drawSplitRound(ctx: Ctx, s: GameState, v: View, sc: Scene) {
  const sp = s.plan.split
  const liquid = liquidFor(s.plan, s.round)
  const guestA = guestFor(s.plan, 4)
  const guestB = guestFor(s.plan, 5)
  const guestK = sc.guestSize * 0.72
  const pair = placePair(s, sc, 8, v.w - 8, sc.box.y0, guestK * 1.05)
  // −1: the tall glass (A) stands on the left.
  const aSide = pair.left === 'a' ? -1 : 1

  if (s.phase === 'pour') {
    const dx = (1 - easeOut(phaseOf(s.roundT, 0, 0.45))) * v.w * 0.7
    const a = { ...pair.a, cx: pair.a.cx + dx }
    const b = { ...pair.b, cx: pair.b.cx + dx }
    // The two guests stand between the glasses, each by their own.
    const gx = pair.gapX + dx
    drawGuest(ctx, guestA.look, gx + aSide * guestK * 0.27, sc.counterY, guestK, 'smile', 'stand', aSide * 0.8)
    drawGuest(ctx, guestB.look, gx - aSide * guestK * 0.27, sc.counterY, guestK, 'smile', 'stand', -aSide * 0.8)
    drawGlass(ctx, a, s.level, liquid, v)
    drawGlass(ctx, b, splitLevelB(sp, s.level), liquid, v)
    return
  }

  // The reveal: the two glasses drain into twin tubes, each a whole jug's worth tall, and fade away.
  const r = s.results[s.round]!
  const t = s.phase === 'tip' ? s.tipT : TIP_TIME
  const levelA = r.level
  const levelB = splitLevelB(sp, levelA)
  const fillIn = easeInOut(phaseOf(t, 0.5, 1.7))
  const fade = 1 - easeInOut(phaseOf(t, 1.2, 1.8))
  if (fade > 0) {
    ctx.save()
    ctx.globalAlpha = fade
    drawGlass(ctx, pair.a, levelForDrain(pair.a, levelA, 1 - fillIn), liquid, v)
    drawGlass(ctx, pair.b, levelForDrain(pair.b, levelB, 1 - fillIn), liquid, v)
    ctx.restore()
  }
  const avail = sc.counterY - v.top - 40
  const tubeR = clamp(v.w * 0.085, 26, 58)
  const stampSize = clamp(tubeR * 0.8, 24, 46)
  // The tubes, their counts and the stamp over them all fit under the prompt.
  const tubeH = Math.max(40, Math.min(avail * 0.6, tubeR * 7, sc.counterY - (v.top + 30) - E * tubeR - 2.8 * stampSize))
  const gapX = tubeR * 1.9
  const rise = easeOut(phaseOf(t, 0, 0.45))
  const shareA = r.percent / 100
  // Near fair, both are pleased; otherwise whoever got more grins and the other pouts.
  const fair = r.score >= 90
  const feel = (more: boolean): { mood: Mood; pose: Pose } =>
    fair ? { mood: r.score >= 96 ? 'open' : 'smile', pose: r.score >= 96 ? 'cheer' : 'wave' } : more ? { mood: 'open', pose: 'cheer' } : { mood: 'o', pose: 'stand' }
  const tubes = [
    { cx: v.w / 2 + aSide * gapX, share: shareA, guest: guestA, feel: feel(shareA > 0.5), side: aSide },
    { cx: v.w / 2 - aSide * gapX, share: 1 - shareA, guest: guestB, feel: feel(shareA < 0.5), side: -aSide },
  ]
  ctx.save()
  ctx.globalAlpha = rise
  for (const tube of tubes) {
    const j: Jug = { cx: tube.cx, bottom: sc.counterY - 4 + (1 - rise) * 40, r: tubeR, h: tubeH }
    drawJug(ctx, j, tube.share * fillIn, liquid, v, '½')
    if (t < 2.05) drawCount(ctx, j, `${Math.round(tube.share * 100 * (t < 1.75 ? fillIn : 1))}%`, v)
  }
  ctx.restore()
  // Each guest beside their own tube, taking it how it went.
  for (const tube of tubes) {
    const look = tube.guest.look
    const x = tube.cx + tube.side * (tubeR * 1.2 + guestK * 0.4)
    const f = t >= 2.05 ? tube.feel : { mood: 'smile' as Mood, pose: 'stand' as Pose }
    ctx.save()
    ctx.globalAlpha = rise
    drawGuest(ctx, look, x, sc.counterY, guestK, f.mood, f.pose, -tube.side * 0.8)
    ctx.restore()
    if (t >= 2.05) drawCount(ctx, { cx: tube.cx, bottom: sc.counterY - 4, r: tubeR, h: tubeH }, `${Math.round(tube.share * 100)}%`, v, INK)
  }
  const pa = Math.round(r.percent)
  const stampY = Math.max(v.top + 30 + stampSize * 0.6, sc.counterY - tubeH - E * tubeR - stampSize * 2.2)
  drawStamp(ctx, v.w / 2, stampY, stampSize, `${pa} : ${100 - pa}`, MARK_COLOUR[markFor(r.score)], phaseOf(t, 2.05, 2.6), v)
}

/** The level a glass holds `drain` of what it had at `level`. */
function levelForDrain(p: Placed, level: number, drain: number): number {
  if (drain >= 1) return level
  if (drain <= 0) return 0
  // By outline area, as the eye sees it drain.
  const want = drain
  let lo = 0
  let hi = level
  const areaTo = (L: number) => polyArea([...wallPts(p, -1, L), ...wallPts(p, 1, L).reverse()])
  const total = areaTo(level)
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    if (areaTo(mid) < want * total) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/* ---------- the whole frame ---------- */

export function renderHalfFull(ctx: Ctx, s: GameState, v: View) {
  const sc = sceneFor(v)
  drawKitchen(ctx, v, sc.counterY)
  if (s.phase === 'menu') {
    // The day's first glass waits on the counter, empty, beside its guest.
    const p = fitGlass(s.plan.pours[0]!, sc.box.x0, sc.box.x1, sc.box.y0, sc.box.y1, Math.min(v.w, v.h) * 0.42)
    drawGuest(ctx, guestFor(s.plan, 0).look, Math.min(v.w - sc.guestSize * 0.4, p.cx + p.R * 1.08 + sc.guestSize * 0.38), sc.counterY, sc.guestSize, 'smile', 'wave', -0.7)
    drawGlass(ctx, p, 0, liquidFor(s.plan, 0), v)
    return
  }
  if (isSplitRound(s.round)) drawSplitRound(ctx, s, v, sc)
  else drawHalfRound(ctx, s, v, sc)
}

/** Where the lock's hint finger should point on a first ever pour: the glass's middle. */
export function glassMiddle(s: GameState, v: View): { x: number; y: number } | null {
  if (s.phase !== 'pour' || isSplitRound(s.round)) return null
  const sc = sceneFor(v)
  const p = pourPlaced(s, v, sc)
  return { x: p.cx, y: p.yb - p.H * 0.45 }
}

/** How far a drag has to go to fill the round's glass from empty to the brim, in px. */
export function dragSpan(s: GameState, v: View): number {
  const sc = sceneFor(v)
  if (isSplitRound(s.round)) return Math.max(220, v.w * 0.8)
  const p = pourPlaced(s, v, sc)
  return Math.max(p.H * 1.25, v.h * 0.42, 260)
}

