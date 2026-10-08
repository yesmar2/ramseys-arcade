import { inkColor, isDarkTheme, playfieldColor } from '../../lib/theme'
import {
  LEAVE_TIME,
  PIN_EVERY,
  PIN_H,
  SHARD_FADE,
  SHARD_REST,
  THICK,
  poseWorld,
  type GameState,
  type Outcome,
  type Plate,
  type Point,
  type Pose,
  type Shard,
  type Vec3,
} from './game'

/*
 * Drawn the house way — soft fills inside clean outlines, in the site's own
 * colours, on the site's own ground — but in three dimensions, because the
 * whole game is a plate on a pin. The camera looks down at the table from a
 * little in front, so the pin can be seen standing under the plate, the plate
 * has a thickness, and a tip reads as a tip in any direction.
 *
 * The view is orthographic: a plate lying level is only squashed a little
 * top to bottom, which moves nothing — the balance point of the shape on the
 * screen is exactly where the plate's own is — so the eye judges what it sees.
 *
 * The plates are clear acrylic in the site's colours: the pin and the table's
 * grid show through them. The pin is a steel pin standing on its red head.
 * Gold marks the balance point, and only once the pin is in.
 */

const TAU = Math.PI * 2
const FONT = 'Outfit, system-ui, sans-serif'
const GOLD = 42
const PIN_HUE = 3
const GOOD_HUE = 153
const BAD_HUE = 3

/** How far the camera is from looking straight down. */
const VIEW = (28 * Math.PI) / 180
const COS = Math.cos(VIEW)
const SIN = Math.sin(VIEW)
/** The direction toward the camera: a face is seen when it faces this way. */
const TO_EYE: Vec3 = { x: 0, y: SIN, z: COS }
/** Where the light comes from: above, behind and to the left. */
const LIGHT = norm({ x: -0.35, y: -0.5, z: 1 })

/** The part of the table always in view, in projected units: the plates' square, headroom above, the clock below. */
const WIN = { x0: 0, x1: 1, y0: -0.16, y1: 1.0 }

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / l, y: v.y / l, z: v.z / l }
}

function dot(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function hsla(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

/** Outline lightness: bright over the dark theme's ground, deeper over the light one. */
const lineL = (dark: boolean) => (dark ? 66 : 40)

// -------------------------------------------------------------------- view

export type View = { k: number; ox: number; oy: number }

/** Where the table sits in a canvas `w` by `h`: the window above as big as fits, in the middle. */
export function viewFor(w: number, h: number): View {
  const ww = WIN.x1 - WIN.x0
  const wh = WIN.y1 - WIN.y0
  const k = Math.max(1, Math.min(w / ww, h / wh))
  return { k, ox: (w - k * ww) / 2 - WIN.x0 * k, oy: (h - k * wh) / 2 - WIN.y0 * k }
}

function project(v: View, p: Vec3): Point {
  return { x: v.ox + p.x * v.k, y: v.oy + (p.y * COS - p.z * SIN) * v.k }
}

/** The point on the table under a point on the canvas, looking through it at height `z`: for a tap on the plate. */
export function tablePointAt(px: number, py: number, w: number, h: number, z: number): Point {
  const v = viewFor(w, h)
  return { x: (px - v.ox) / v.k, y: ((py - v.oy) / v.k + z * SIN) / COS }
}

type Gfx = {
  ctx: CanvasRenderingContext2D
  v: View
  dark: boolean
  t: number
  /** Device pixels per CSS pixel: blur is measured in device pixels. */
  dpr: number
}

function path(ctx: CanvasRenderingContext2D, pts: Point[]) {
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
}

// ------------------------------------------------------------------ ground

/**
 * The table: the site's ground ruled as graph paper, fine lines every
 * twentieth and firmer ones every quarter, under a lamp's soft pool of light.
 * The rules help an eye that wants to measure.
 */
function drawTable(g: Gfx, w: number, h: number) {
  const { ctx, v, dark } = g
  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)

  const x0 = -v.ox / v.k
  const x1 = (w - v.ox) / v.k
  const y0 = -v.oy / v.k / COS
  const y1 = (h - v.oy) / v.k / COS
  ctx.strokeStyle = inkColor()
  ctx.lineWidth = 1
  for (const [step, alpha] of [
    [0.05, dark ? 0.045 : 0.06],
    [0.25, dark ? 0.085 : 0.1],
  ] as const) {
    ctx.globalAlpha = alpha
    ctx.beginPath()
    for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
      const px = Math.round(v.ox + x * v.k) + 0.5
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
    }
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
      const py = Math.round(v.oy + y * COS * v.k) + 0.5
      ctx.moveTo(0, py)
      ctx.lineTo(w, py)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // The lamp over the middle of the table, and the dark at its edges.
  const c = project(v, { x: 0.5, y: 0.5, z: 0 })
  const r = Math.max(w, h) * 0.75
  const pool = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r)
  pool.addColorStop(0, dark ? 'rgba(255, 244, 214, 0.07)' : 'rgba(255, 255, 255, 0.5)')
  pool.addColorStop(0.45, dark ? 'rgba(255, 244, 214, 0.02)' : 'rgba(255, 255, 255, 0.12)')
  pool.addColorStop(1, dark ? 'rgba(0, 0, 0, 0.28)' : 'rgba(20, 50, 60, 0.08)')
  ctx.fillStyle = pool
  ctx.fillRect(0, 0, w, h)
}

// ------------------------------------------------------------------- plate

/** The plate's world corners (its underside), its top, and which way its face points. */
type Solid = { bottom: Vec3[]; top: Vec3[]; normal: Vec3; alpha: number; fallen: number }

function solidOf(plate: Plate, pose: Pose, lift = 0, alpha = 1, fallen = 0): Solid {
  const s = Math.sin(pose.tilt)
  const normal = { x: pose.dir.x * s, y: pose.dir.y * s, z: Math.cos(pose.tilt) }
  const bottom = plate.points.map((p) => {
    const w = poseWorld(pose, p)
    return { x: w.x, y: w.y, z: w.z + lift }
  })
  const top = bottom.map((b) => ({ x: b.x + normal.x * THICK, y: b.y + normal.y * THICK, z: b.z + normal.z * THICK }))
  return { bottom, top, normal, alpha, fallen }
}

/** A point on the plate's top face, posed. */
function onTop(pose: Pose, p: Point, lift = 0): Vec3 {
  const w = poseWorld(pose, p)
  const s = Math.sin(pose.tilt)
  return {
    x: w.x + pose.dir.x * s * THICK,
    y: w.y + pose.dir.y * s * THICK,
    z: w.z + lift + Math.cos(pose.tilt) * THICK,
  }
}

/** The plate's shadow: straight down onto the table, softer and fainter the higher it is. */
function drawShadow(g: Gfx, solid: Solid) {
  const { ctx, v, dark } = g
  const h = solid.bottom.reduce((t, p) => t + Math.max(0, p.z), 0) / solid.bottom.length
  const flat = solid.bottom.map((p) => project(v, { x: p.x, y: p.y, z: 0 }))
  const a = (dark ? 0.38 : 0.2) * solid.alpha * (1 - clamp01(h / 0.5) * 0.55)
  ctx.save()
  ctx.fillStyle = `rgba(0, 0, 0, ${a})`
  ctx.shadowColor = `rgba(0, 0, 0, ${a})`
  ctx.shadowBlur = (4 + h * 90) * (v.k / 400) * g.dpr
  ctx.lineJoin = 'round'
  path(ctx, flat)
  ctx.fill()
  ctx.restore()
}

function drawPlate(g: Gfx, plate: Plate, solid: Solid) {
  const { ctx, v, dark } = g
  const hue = plate.hue
  const n = plate.points.length
  const top = solid.top.map((p) => project(v, p))
  const bottom = solid.bottom.map((p) => project(v, p))
  const lit = dot(solid.normal, LIGHT)
  const shade = (lit - LIGHT.z) * 40
  // A plate that fell loses most of its colour.
  const sat = 72 - solid.fallen * 48

  ctx.save()
  ctx.globalAlpha = solid.alpha
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // The edges facing the camera: the plate's thickness.
  let area2 = 0
  for (let i = 0; i < n; i++) {
    const a = plate.points[i]!
    const b = plate.points[(i + 1) % n]!
    area2 += a.x * b.y - b.x * a.y
  }
  const turn = area2 > 0 ? 1 : -1
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const a = solid.bottom[i]!
    const b = solid.bottom[j]!
    const ex = b.x - a.x
    const ey = b.y - a.y
    const ez = b.z - a.z
    // The edge crossed with the face's normal points out of a plate wound one way and into one wound the other.
    const out = {
      x: (ey * solid.normal.z - ez * solid.normal.y) * turn,
      y: (ez * solid.normal.x - ex * solid.normal.z) * turn,
      z: (ex * solid.normal.y - ey * solid.normal.x) * turn,
    }
    if (dot(out, TO_EYE) <= 0) continue
    const lightSide = clamp01(0.45 + dot(norm(out), LIGHT) * 0.5)
    ctx.fillStyle = hsla(hue, sat * (dark ? 0.76 : 0.7), (dark ? 36 : 50) + lightSide * 16, dark ? 0.85 : 0.75)
    path(ctx, [top[i]!, top[j]!, bottom[j]!, bottom[i]!])
    ctx.fill()
  }

  // The face: clear colour, lighter where the lamp catches it, with a gleam that slides as it tips.
  path(ctx, top)
  ctx.fillStyle = hsla(hue, sat, (dark ? 62 : 64) + shade, dark ? 0.3 : 0.3)
  ctx.fill()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of top) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const slide = clamp01(0.5 + (solid.normal.x - solid.normal.y) * 1.2)
  const gleam = ctx.createLinearGradient(minX, minY, maxX, maxY)
  const at = 0.15 + slide * 0.5
  gleam.addColorStop(0, 'rgba(255, 255, 255, 0)')
  gleam.addColorStop(Math.max(0, at - 0.12), 'rgba(255, 255, 255, 0)')
  gleam.addColorStop(at, `rgba(255, 255, 255, ${dark ? 0.16 : 0.3})`)
  gleam.addColorStop(Math.min(1, at + 0.14), 'rgba(255, 255, 255, 0)')
  gleam.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gleam
  ctx.fill()
  ctx.strokeStyle = hsla(hue, sat, lineL(dark))
  ctx.lineWidth = Math.max(1.2, v.k * 0.0045)
  ctx.stroke()
  ctx.restore()
}

// --------------------------------------------------------------------- pin

/**
 * A steel pin standing on its round red head, point up. Knocked over, it
 * lies on the table away from the way the plate fell.
 */
function drawPin(g: Gfx, at: Point, height: number, down: number, away: Point, alpha: number) {
  const { ctx, v, dark } = g
  if (alpha <= 0.01) return
  // Thin, so where it touches the plate is a point (Ramsey, 2026-10-08: "the pins should be thinner").
  const head = 0.011
  const lean = down * (Math.PI / 2 - 0.06)
  // From the middle of its head to its point, which is where the plate sits.
  const len = Math.max(0, (down > 0 ? PIN_H : height) - head)
  const base = { x: at.x, y: at.y, z: head }
  const tip = {
    x: at.x - away.x * Math.sin(lean) * len,
    y: at.y - away.y * Math.sin(lean) * len,
    z: head + Math.cos(lean) * len,
  }
  const b = project(v, base)
  const t = project(v, tip)
  const foot = project(v, { x: at.x, y: at.y, z: 0 })
  const r = head * v.k

  ctx.save()
  ctx.globalAlpha = alpha
  // Its contact shadow.
  ctx.fillStyle = `rgba(0, 0, 0, ${dark ? 0.35 : 0.2})`
  ctx.beginPath()
  ctx.ellipse(foot.x, foot.y, r * 1.3, r * 1.3 * COS, 0, 0, TAU)
  ctx.fill()

  if (len > 0.002) {
    ctx.lineCap = 'round'
    ctx.strokeStyle = dark ? 'rgba(10, 16, 22, 0.8)' : 'rgba(40, 50, 60, 0.55)'
    ctx.lineWidth = Math.max(1.3, v.k * 0.0048)
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(t.x, t.y)
    ctx.stroke()
    const steel = ctx.createLinearGradient(b.x - 2, b.y, b.x + 2, b.y)
    steel.addColorStop(0, dark ? '#9fb0bd' : '#8b9aa6')
    steel.addColorStop(0.5, '#f4f8fb')
    steel.addColorStop(1, dark ? '#7d8e9b' : '#6f7e8a')
    ctx.strokeStyle = steel
    ctx.lineWidth = Math.max(0.8, v.k * 0.0025)
    ctx.stroke()
    // The point catches the light.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.beginPath()
    ctx.arc(t.x, t.y, Math.max(1, v.k * 0.003), 0, TAU)
    ctx.fill()
  }

  // The head: a glossy red bead.
  const bead = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r)
  bead.addColorStop(0, hsla(PIN_HUE, 90, 82))
  bead.addColorStop(0.45, hsla(PIN_HUE, 78, 58))
  bead.addColorStop(1, hsla(PIN_HUE, 70, 38))
  ctx.fillStyle = bead
  ctx.beginPath()
  ctx.arc(b.x, b.y, r, 0, TAU)
  ctx.fill()
  ctx.restore()
}

// ------------------------------------------------------------------- marks

/**
 * What the pin going in shows: gold at the true balance point with a dashed
 * ring round it as wide as the margin for a balance, the red dimple where the
 * pin went in, and, for a miss, a line from one to the other.
 */
function drawMarks(g: Gfx, plate: Plate, pose: Pose, outcome: Outcome, reveal: number, lift = 0, alpha = 1) {
  const { ctx, v, dark } = g
  if (reveal <= 0 || alpha <= 0.01) return
  const c = plate.centroid
  const at = (p: Point) => project(v, onTop(pose, p, lift))
  const k = v.k
  const pop = 1 + 0.6 * (1 - clamp01(reveal * 1.4)) * (1 - clamp01(reveal * 1.4))
  ctx.save()
  ctx.globalAlpha = alpha * clamp01(reveal * 2.5)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const gp = at(c)
  const pin = outcome.pin
  if (pin && !outcome.balanced) {
    // From where the pin went in to where it should have.
    const pp = at(pin)
    ctx.strokeStyle = hsla(GOLD, 85, lineL(dark), 0.75)
    ctx.lineWidth = Math.max(1, k * 0.0028)
    ctx.setLineDash([Math.max(2, k * 0.008), Math.max(2, k * 0.01)])
    ctx.beginPath()
    ctx.moveTo(pp.x, pp.y)
    ctx.lineTo(gp.x, gp.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
  // Where the pin went in and where it should have: a small dot each, red and gold, exact points; the
  // ghost pin under the plate (drawGhostPin) stands at the gold one (Ramsey, 2026-10-08, picking B · Ghost
  // pin from the "Centroid pin and center" mocks: "maybe the pins should be thinner along with the dot").
  const spot = (p: { x: number; y: number }, hue: number) => {
    ctx.fillStyle = hsla(hue, 90, dark ? 62 : 52)
    ctx.strokeStyle = dark ? 'rgba(10, 16, 22, 0.9)' : 'rgba(255, 255, 255, 0.95)'
    ctx.lineWidth = Math.max(0.8, k * 0.0018)
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(1.4, k * 0.0032) * (hue === GOLD ? pop : 1), 0, TAU)
    ctx.fill()
    ctx.stroke()
  }
  if (pin) spot(at(pin), PIN_HUE)
  spot(gp, GOLD)
  ctx.restore()
}

/** A dead center: a gold ring going out from the balance point and a glow. */
function drawBurst(g: Gfx, s: GameState) {
  const { ctx, v } = g
  const o = s.outcome
  if (!o || !o.dead || !s.plate || s.flash <= 0) return
  const c = project(v, onTop(s.pose, s.plate.centroid))
  const u = 1 - s.flash
  ctx.save()
  const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, v.k * 0.22)
  glow.addColorStop(0, hsla(GOLD, 100, 70, 0.45 * s.flash))
  glow.addColorStop(1, hsla(GOLD, 100, 70, 0))
  ctx.fillStyle = glow
  ctx.fillRect(c.x - v.k * 0.22, c.y - v.k * 0.22, v.k * 0.44, v.k * 0.44)
  ctx.strokeStyle = hsla(GOLD, 95, 62, s.flash)
  ctx.lineWidth = Math.max(1.5, v.k * 0.008 * s.flash)
  ctx.beginPath()
  ctx.ellipse(c.x, c.y, v.k * (0.03 + u * 0.3), v.k * (0.03 + u * 0.3) * COS, 0, 0, TAU)
  ctx.stroke()
  ctx.restore()
}

// -------------------------------------------------------------- the egg

/** A shard's corner, `p` about its middle, turned `angle` about its level axis, in the world. */
function shardCorner(sh: Shard, p: Point): Vec3 {
  const c = Math.cos(sh.angle)
  const s = Math.sin(sh.angle)
  const along = sh.axis.x * p.x + sh.axis.y * p.y
  return {
    x: sh.at.x + p.x * c + sh.axis.x * along * (1 - c),
    y: sh.at.y + p.y * c + sh.axis.y * along * (1 - c),
    z: sh.at.z + (sh.axis.x * p.y - sh.axis.y * p.x) * s,
  }
}

function shardAlpha(sh: Shard) {
  return sh.rested < 0 ? 1 : 1 - clamp01((sh.rested - SHARD_REST) / SHARD_FADE)
}

/** The broken plate's pieces' shadows on the table, fainter the higher a piece is. */
function drawShardShadows(g: Gfx, s: GameState) {
  const { ctx, v, dark } = g
  if (!s.shards.length) return
  ctx.save()
  for (const sh of s.shards) {
    const a = (dark ? 0.3 : 0.16) * shardAlpha(sh) * (1 - clamp01(sh.at.z / 0.5) * 0.7)
    if (a <= 0.005) continue
    ctx.fillStyle = `rgba(0, 0, 0, ${a})`
    path(
      ctx,
      sh.points.map((p) => {
        const w = shardCorner(sh, p)
        return project(v, { x: w.x, y: w.y, z: 0 })
      }),
    )
    ctx.fill()
  }
  ctx.restore()
}

/** The pieces themselves: clear glass in the plate's colour, flashing as they turn to the lamp. */
function drawShards(g: Gfx, s: GameState) {
  const { ctx, v, dark } = g
  if (!s.shards.length) return
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, v.k * 0.0035)
  for (const sh of s.shards) {
    const a = shardAlpha(sh)
    if (a <= 0.01) continue
    const corners = sh.points.map((p) => project(v, shardCorner(sh, p)))
    const sin = Math.sin(sh.angle)
    // Glass looks the same either way up, so a piece face down is lit as one face up.
    const lit = Math.abs(dot({ x: sh.axis.y * sin, y: -sh.axis.x * sin, z: Math.cos(sh.angle) }, LIGHT))
    path(ctx, corners)
    ctx.globalAlpha = a
    ctx.fillStyle = hsla(sh.hue, 72, (dark ? 62 : 64) + (lit - LIGHT.z) * 40, 0.35)
    ctx.fill()
    const glint = clamp01((lit - 0.75) * 3)
    if (glint > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${glint * 0.45})`
      ctx.fill()
    }
    ctx.strokeStyle = hsla(sh.hue, 72, lineL(dark))
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * The egg's clue: a balanced plate, sitting on its pin, has a hairline crack
 * or two running out from the pin, barely there, so the glass looks as if it
 * could break. Each pin gets its own crack, the same every frame.
 */
function drawCrack(g: Gfx, s: GameState) {
  const o = s.outcome
  if (!s.crackHint || s.phase !== 'settling' || s.stage !== 'wobble' || !o?.balanced || !o.pin || !s.plate) return
  const { ctx, v, dark } = g
  const pin = o.pin
  let seed = Math.floor(pin.x * 99991 + pin.y * 77933) >>> 0
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const at = (p: Point) => project(v, onTop(s.pose, p))
  ctx.save()
  ctx.globalAlpha = clamp01((s.stageT - 0.05) / 0.25)
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.38)' : 'rgba(20, 40, 55, 0.3)'
  ctx.lineWidth = Math.max(0.7, v.k * 0.0017)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  const legs = 3 + Math.floor(rnd() * 2)
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * TAU + rnd() * 1.2
    const len = 0.02 + rnd() * 0.028
    const bend = a + (rnd() - 0.5) * 0.9
    const kink = { x: pin.x + Math.cos(a) * len * 0.45, y: pin.y + Math.sin(a) * len * 0.45 }
    const tip = { x: kink.x + Math.cos(bend) * len * 0.55, y: kink.y + Math.sin(bend) * len * 0.55 }
    const from = at(pin)
    const k = at(kink)
    const t = at(tip)
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(k.x, k.y)
    ctx.lineTo(t.x, t.y)
  }
  ctx.stroke()
  ctx.restore()
}

// ------------------------------------------------------------------- bits

function drawSparks(g: Gfx, s: GameState) {
  const { ctx, v } = g
  for (const sp of s.sparks) {
    const p = project(v, sp.at)
    const a = clamp01(sp.life / sp.maxLife)
    ctx.fillStyle = hsla(sp.hue, 95, 62, a)
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(1, v.k * 0.006 * (0.5 + a)), 0, TAU)
    ctx.fill()
  }
}

function drawFloaters(g: Gfx, s: GameState) {
  const { ctx, v, dark } = g
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const f of s.floaters) {
    const p = project(v, f.at)
    const age = f.maxLife - f.life
    const a = clamp01(f.life / 0.3) * clamp01(age / 0.08)
    const size = Math.max(11, v.k * (f.tone === 'gold' ? 0.05 : 0.045))
    const grow = 1 + 0.25 * (1 - clamp01(age / 0.15))
    ctx.font = `700 ${Math.round(size * grow)}px ${FONT}`
    ctx.globalAlpha = a
    ctx.strokeStyle = playfieldColor()
    ctx.lineWidth = size * 0.24
    ctx.strokeText(f.text, p.x, p.y)
    const hue = f.tone === 'gold' ? GOLD : f.tone === 'good' ? GOOD_HUE : BAD_HUE
    ctx.fillStyle = hsla(hue, 80, f.tone === 'gold' ? (dark ? 62 : 44) : lineL(dark))
    ctx.fillText(f.text, p.x, p.y)
  }
  ctx.restore()
}

/**
 * Under the plates: the clock, draining from both ends toward the middle,
 * and a row of ten beads that fill with gold for each plate balanced in a row
 * — the tenth brings a pin back.
 */
function drawClock(g: Gfx, s: GameState) {
  const { ctx, v, dark } = g
  const live = s.phase === 'aiming' || s.phase === 'settling'
  if (!live) return
  const cy = v.oy + 0.905 * v.k
  const half = 0.26 * v.k
  const cx = v.ox + 0.5 * v.k
  if (s.day) {
    drawDayRow(g, s, cx, cy)
    return
  }
  const th = Math.max(3, v.k * 0.011)
  const aiming = s.phase === 'aiming'
  const left = aiming ? s.clock / s.clockMax : 0
  const urgent = aiming && s.appear >= 1 && s.clock < Math.min(1.6, s.clockMax * 0.35)
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = inkColor()
  ctx.globalAlpha = dark ? 0.12 : 0.1
  ctx.lineWidth = th
  ctx.beginPath()
  ctx.moveTo(cx - half, cy)
  ctx.lineTo(cx + half, cy)
  ctx.stroke()
  ctx.globalAlpha = 1
  if (left > 0) {
    const pulse = urgent ? 0.7 + 0.3 * Math.sin(g.t * 14) : 1
    ctx.strokeStyle = urgent ? hsla(BAD_HUE, 80, dark ? 62 : 50, pulse) : hsla(s.plate?.hue ?? 183, 70, dark ? 60 : 46)
    ctx.beginPath()
    ctx.moveTo(cx - half * left, cy)
    ctx.lineTo(cx + half * left, cy)
    ctx.stroke()
  }

  const beads = PIN_EVERY
  const run = s.streak % PIN_EVERY === 0 && s.streak > 0 && !aiming ? PIN_EVERY : s.streak % PIN_EVERY
  const gap = Math.max(9, v.k * 0.034)
  const br = Math.max(2.2, v.k * 0.0085)
  const by = cy + Math.max(10, v.k * 0.04)
  for (let i = 0; i < beads; i++) {
    const bx = cx + (i - (beads - 1) / 2) * gap
    ctx.beginPath()
    ctx.arc(bx, by, br, 0, TAU)
    if (i < run) {
      ctx.fillStyle = hsla(GOLD, 92, dark ? 58 : 52)
      ctx.fill()
    } else {
      ctx.strokeStyle = inkColor()
      ctx.globalAlpha = dark ? 0.25 : 0.2
      ctx.lineWidth = Math.max(1, v.k * 0.0025)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
  ctx.restore()
}

/** A day's plates have no clock: a dot for each of the six instead, coloured as its square once it's played. */
function drawDayRow(g: Gfx, s: GameState, cx: number, cy: number) {
  const { ctx, v, dark } = g
  const day = s.day!
  const n = day.plan.plates.length
  const gap = Math.max(18, v.k * 0.06)
  const r = Math.max(4, v.k * 0.014)
  const hueOf = (score: number) => (score >= 97 ? GOLD : score >= 91 ? 150 : score >= 82 ? 48 : score >= 70 ? 26 : BAD_HUE)
  ctx.save()
  for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * gap
    const score = day.scores[i]
    ctx.beginPath()
    ctx.arc(x, cy, r, 0, TAU)
    if (score !== undefined) {
      ctx.fillStyle = hsla(hueOf(score), 85, dark ? 60 : 50)
      ctx.fill()
    } else {
      ctx.strokeStyle = inkColor()
      ctx.globalAlpha = i === s.plateNo - 1 ? 0.7 : dark ? 0.25 : 0.2
      ctx.lineWidth = i === s.plateNo - 1 ? Math.max(1.6, v.k * 0.005) : Math.max(1, v.k * 0.0025)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
  ctx.restore()
}

/**
 * Where the pin should have gone: a see-through gold pin standing on the table at the plate's balance point,
 * up to the plate's underside there, beside the real one, so the miss reads as two pins.
 */
function drawGhostPin(g: Gfx, plate: Plate, pose: Pose, reveal: number) {
  const { ctx, v } = g
  if (reveal <= 0.01) return
  const c = plate.centroid
  const head = 0.011
  const top = Math.max(head, poseWorld(pose, c).z)
  const b = project(v, { x: c.x, y: c.y, z: head })
  const t = project(v, { x: c.x, y: c.y, z: top })
  const r = head * v.k
  ctx.save()
  ctx.globalAlpha = 0.7 * clamp01(reveal * 1.5)
  ctx.lineCap = 'round'
  ctx.strokeStyle = hsla(GOLD, 90, 62, 0.9)
  ctx.lineWidth = Math.max(0.9, v.k * 0.0028)
  ctx.beginPath()
  ctx.moveTo(b.x, b.y)
  ctx.lineTo(t.x, t.y)
  ctx.stroke()
  const bead = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r)
  bead.addColorStop(0, hsla(GOLD, 95, 85))
  bead.addColorStop(0.5, hsla(GOLD, 90, 60))
  bead.addColorStop(1, hsla(GOLD, 80, 40))
  ctx.fillStyle = bead
  ctx.beginPath()
  ctx.arc(b.x, b.y, r, 0, TAU)
  ctx.fill()
  ctx.restore()
}

/** The keyboard's crosshair, on the plate's face. */
function drawCursor(g: Gfx, s: GameState) {
  const { ctx, v, dark } = g
  if (s.phase !== 'aiming' || !s.cursor) return
  const z = s.pose.at.z + THICK
  const p = project(v, { x: s.cursor.x, y: s.cursor.y, z })
  const r = Math.max(6, v.k * 0.024)
  ctx.save()
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(20, 30, 40, 0.85)'
  ctx.lineWidth = Math.max(1.2, v.k * 0.004)
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, TAU)
  ctx.moveTo(p.x - r * 1.6, p.y)
  ctx.lineTo(p.x - r * 0.45, p.y)
  ctx.moveTo(p.x + r * 0.45, p.y)
  ctx.lineTo(p.x + r * 1.6, p.y)
  ctx.moveTo(p.x, p.y - r * 1.6)
  ctx.lineTo(p.x, p.y - r * 0.45)
  ctx.moveTo(p.x, p.y + r * 0.45)
  ctx.lineTo(p.x, p.y + r * 1.6)
  ctx.stroke()
  ctx.restore()
}

// ------------------------------------------------------------------- frame

/** How far the plate has fallen, 0–1: it greys as it goes down flat. */
function fallenOf(s: GameState) {
  if (s.phase === 'aiming' || s.phase === 'menu' || !s.outcome || s.outcome.balanced) return 0
  if (s.stage === 'rest') return 1
  if (s.stage === 'flop') return clamp01(1 - s.tilt / Math.max(1e-6, s.leanTilt))
  if (s.stage === 'fall') return clamp01(1 - s.z / 0.27)
  return 0
}

/** How much of the balance point is shown: none while aiming, all of it from just after the pin goes in. */
function revealOf(s: GameState) {
  if (s.phase === 'menu') return 1
  if (s.phase === 'aiming' || !s.outcome) return 0
  if (!s.outcome.pin) return clamp01(s.settleT / 0.3)
  return clamp01((s.settleT - 0.08) / 0.35)
}

let coarse: boolean | null = null
function isTouch() {
  if (coarse === null) {
    coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
  }
  return coarse
}

/**
 * The first plate of a run: what to do with it. Nothing on the table said,
 * and a first-timer watched the clock run out on a plate they didn't know to
 * tap. Under the clock where there's room (a phone), over it where there isn't.
 */
function drawHint(g: Gfx, s: GameState, w: number, h: number) {
  if (s.phase !== 'aiming' || s.plateNo > 1) return
  const { ctx, v, dark } = g
  const alpha = clamp01((s.appear - 0.5) / 0.4)
  if (alpha <= 0) return
  const lines = s.day
    ? [isTouch() ? 'Tap where the plate would balance' : 'Click where the plate would balance', 'Its true center: six plates, no clock']
    : isTouch()
      ? ['Tap where the plate would balance', 'Its true center, before the clock runs out']
      : ['Click where the plate would balance', 'Or the arrow keys, then Space, before the clock runs out']
  const big = Math.round(Math.max(13, Math.min(16, w * 0.036)))
  const small = Math.round(big * 0.84)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `600 ${big}px ${FONT}`
  const w1 = ctx.measureText(lines[0]!).width
  ctx.font = `600 ${small}px ${FONT}`
  const w2 = ctx.measureText(lines[1]!).width
  const cw = Math.min(w - 20, Math.max(w1, w2) + 32)
  const ch = big * 3.4
  const clockY = v.oy + 0.905 * v.k
  const y = h - clockY - 16 >= ch + 14 ? clockY + 18 : clockY - ch - 18
  const x = w / 2 - cw / 2
  ctx.fillStyle = dark ? 'rgba(24, 36, 46, 0.86)' : 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.roundRect(x, y, cw, ch, 14)
  ctx.fill()
  ctx.strokeStyle = inkColor()
  ctx.globalAlpha = alpha * 0.1
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = inkColor()
  ctx.font = `600 ${big}px ${FONT}`
  ctx.fillText(lines[0]!, w / 2, y + ch * 0.34, cw - 16)
  ctx.globalAlpha = alpha * 0.72
  ctx.font = `600 ${small}px ${FONT}`
  ctx.fillText(lines[1]!, w / 2, y + ch * 0.7, cw - 16)
  ctx.restore()
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dark = isDarkTheme()
  const dpr = ctx.getTransform().a || 1
  const s = state
  const v0 = viewFor(w, h)
  // A fall shakes the table.
  const shake = s.shake > 0 ? s.shake * s.shake * v0.k * 0.012 : 0
  const v = { ...v0, ox: v0.ox + (Math.random() - 0.5) * shake, oy: v0.oy + (Math.random() - 0.5) * shake }
  const g: Gfx = { ctx, v, dark, t: s.time, dpr }

  drawTable(g, w, h)

  const leaving = s.leaving
  let leavingSolid: Solid | null = null
  if (leaving) {
    const u = clamp01(leaving.t / LEAVE_TIME)
    const alpha = 1 - u
    const lift = leaving.lift ? u * u * 0.35 : 0
    // A broken plate is in pieces on the table already: only its pin goes.
    leavingSolid = leaving.broken ? null : solidOf(leaving.plate, leaving.pose, lift, alpha, leaving.lift ? 0 : 1)
    if (leavingSolid) drawShadow(g, leavingSolid)
    const pin = leaving.outcome?.pin
    if (pin) {
      const height = leaving.lift ? leaving.pinH * (1 - u) : leaving.pinH
      drawPin(g, pin, height, leaving.pinDown, leaving.outcome!.dir, alpha)
    }
  }

  const plate = s.plate
  // A new plate fades in once the last one has mostly gone.
  const appearing = s.phase === 'aiming' ? clamp01((s.appear - 0.25) / 0.55) : 1
  const broken = s.phase === 'settling' && s.stage === 'shatter'
  const solid = plate && !broken ? solidOf(plate, s.pose, 0, appearing, fallenOf(s)) : null
  if (solid) drawShadow(g, solid)
  drawShardShadows(g, s)
  const o = s.outcome
  if (plate && o?.pin && s.phase !== 'aiming') {
    drawPin(g, o.pin, s.pinH, s.pinDown, o.dir, 1)
    drawGhostPin(g, plate, s.pose, revealOf(s))
  }

  if (leaving && leavingSolid) {
    drawPlate(g, leaving.plate, leavingSolid)
    const lift = leaving.lift ? clamp01(leaving.t / LEAVE_TIME) ** 2 * 0.35 : 0
    if (leaving.outcome) {
      drawMarks(g, leaving.plate, leaving.pose, leaving.outcome, 1, lift, leavingSolid.alpha)
    }
  }
  if (plate && solid) {
    drawPlate(g, plate, solid)
    if (o) drawMarks(g, plate, s.pose, o, revealOf(s))
    drawCrack(g, s)
  }
  drawShards(g, s)

  drawBurst(g, s)
  drawSparks(g, s)
  drawFloaters(g, s)
  drawClock(g, s)
  drawCursor(g, s)
  drawHint(g, s, w, h)
}
