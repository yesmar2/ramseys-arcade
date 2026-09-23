import { withAlpha } from '../../lib/color'
import { inkColor, isDarkTheme, playfieldColor } from '../../lib/theme'
import {
  BANNER_TIME,
  CORE_R,
  FIELD_H,
  GRAZE_R,
  MAX_STOCK,
  SHIP_W,
  SPECIES,
  bossReadout,
  nozzleOf,
  type Bullet,
  type Enemy,
  type GameState,
  type Species,
} from './game'

/*
 * Drawn the house way: soft fills inside clean outlines, in the site's own
 * colours, on the site's own ground. Outlines are brighter over the dark
 * theme's ground and deeper over the light one.
 *
 * The fleet keeps its faces — the octo, the crab, the squid — and the flagship
 * is the squid grown huge, crowned. Bullets are drawn once per colour and size
 * into little sprites and stamped, because a busy moment has hundreds of them.
 * The ship is the one green thing, and its heart, the one part that can be hit,
 * is a white dot that is always on top of everything.
 *
 * The field is one shape everywhere and sits in the middle of the canvas; what
 * is left over either side or above and below is the same sky, dimmed.
 */

const TAU = Math.PI * 2
const FONT = 'Outfit, system-ui, sans-serif'
const SHIP_HUE = 153
const GOLD = 42
const HOT = 4

function hsla(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

/** Outline lightness: bright over the dark theme's ground, deeper over the light one. */
const lineL = (dark: boolean) => (dark ? 66 : 40)

function frac(v: number) {
  return v - Math.floor(v)
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

// ------------------------------------------------------------------- place

export type Place = {
  /** Pixels per field width. */
  k: number
  ox: number
  oy: number
  fw: number
  fh: number
}

/** Where the field sits in a canvas `w` by `h`: as big as fits, in the middle. */
export function fieldPlace(w: number, h: number): Place {
  const k = Math.max(1, Math.min(w, h / FIELD_H))
  const fw = k
  const fh = k * FIELD_H
  return { k, ox: (w - fw) / 2, oy: (h - fh) / 2, fw, fh }
}

/** A point on the canvas, in field units: for steering with a finger. */
export function fieldPointAt(px: number, py: number, w: number, h: number) {
  const p = fieldPlace(w, h)
  return { x: (px - p.ox) / p.k, y: (py - p.oy) / p.k }
}

type Gfx = {
  ctx: CanvasRenderingContext2D
  p: Place
  s: GameState
  dark: boolean
  t: number
  X: (v: number) => number
  Y: (v: number) => number
  U: (v: number) => number
  /** Device pixels per CSS pixel: sprites are drawn at the screen's own density. */
  dpr: number
}

// ------------------------------------------------------------------- ground

/**
 * Stars streaming down past the field, the near ones faster, as if the ship
 * were flying up through them; a few of them breathing. Positions are hashed,
 * so nothing jumps between frames.
 */
function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, dark: boolean, t: number, k: number) {
  const count = Math.round((w * h) / 5200)
  ctx.fillStyle = inkColor()
  for (let i = 1; i <= count; i++) {
    const a = frac(Math.sin(i * 12.9898) * 43758.5453)
    const b = frac(Math.sin(i * 78.233) * 12345.6789)
    const c = frac(Math.sin(i * 3.7137) * 9973.113)
    const speed = (0.02 + c * c * 0.16) * k
    const y = (b * h + t * speed) % h
    const breathe = c > 0.9 ? 0.55 + 0.45 * Math.sin(t * (0.8 + c) + i) : 1
    ctx.globalAlpha = (dark ? 0.07 + c * 0.2 : 0.05 + c * 0.1) * breathe
    const r = 0.45 + c * 1.1
    if (c > 0.8) {
      // The nearest ones stretch a little with their speed.
      ctx.fillRect(a * w - r * 0.5, y - r * 2.5, r, r * 5)
    } else {
      ctx.beginPath()
      ctx.arc(a * w, y, r, 0, TAU)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

/**
 * Great soft clouds of the site's colours drifting down behind the field, so
 * the sky is somewhere rather than nowhere. A flagship turns them its colour.
 */
function drawNebula(g: Gfx, w: number, h: number) {
  const { ctx, dark, t, p } = g
  const boss = bossReadout(g.s)
  const clouds = [
    { hue: 262, x: 0.2, r: 0.7, speed: 0.012, seed: 0.1 },
    { hue: 204, x: 0.85, r: 0.6, speed: 0.018, seed: 0.45 },
    { hue: 334, x: 0.45, r: 0.8, speed: 0.009, seed: 0.8 },
  ]
  const span = h + p.k * 1.6
  for (const c of clouds) {
    const hue = boss ? boss.hue : c.hue
    const cy = frac(c.seed + (t * c.speed * p.k) / span) * span - p.k * 0.8
    const cx = p.ox + c.x * p.fw
    const r = c.r * p.k
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, hsla(hue, 70, dark ? 55 : 65, dark ? 0.09 : 0.08))
    grad.addColorStop(1, hsla(hue, 70, dark ? 55 : 65, 0))
    ctx.fillStyle = grad
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  }
  void w
}

/** Settle what is outside the field back, rather than boxing it in with bars. */
function drawSurround(ctx: CanvasRenderingContext2D, p: Place, w: number, h: number, dark: boolean) {
  const shade = withAlpha(playfieldColor(), 0.78)
  const clear = withAlpha(playfieldColor(), 0)
  const band = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    grad.addColorStop(0, shade)
    grad.addColorStop(1, clear)
    ctx.fillStyle = grad
    ctx.fillRect(rx, ry, rw, rh)
  }
  if (p.ox > 1) {
    band(0, 0, p.ox, 0, 0, 0, p.ox, h)
    band(w, 0, w - p.ox, 0, p.ox + p.fw, 0, p.ox, h)
  }
  if (p.oy > 1) {
    band(0, 0, 0, p.oy, 0, 0, w, p.oy)
    band(0, h, 0, h - p.oy, 0, p.oy + p.fh, w, p.oy)
  }
  // The field's edge: a faint line, so it reads as a window rather than a fade.
  if (p.ox > 1 || p.oy > 1) {
    ctx.strokeStyle = withAlpha(inkColor(), dark ? 0.1 : 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(p.ox + 0.5, p.oy + 0.5, p.fw - 1, p.fh - 1, Math.min(14, p.k * 0.03))
    ctx.stroke()
  }
}

// ------------------------------------------------------------------ bullets

/**
 * Bullet sprites, drawn once per look, colour and size and stamped after. A
 * glow, a body in its colour inside a clean outline, and a white heart; a
 * grazed one wears a gold rim.
 */
const sprites = new Map<string, HTMLCanvasElement | OffscreenCanvas>()

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  return null
}

function bulletSprite(kind: Bullet['kind'], hue: number, rpx: number, dark: boolean, gold: boolean) {
  const r = Math.max(2, Math.round(rpx * 2) / 2)
  const key = `${kind}|${hue}|${r}|${dark ? 1 : 0}|${gold ? 1 : 0}`
  const have = sprites.get(key)
  if (have) return { img: have, r }
  const pad = Math.ceil(r * 2.2 + 2)
  const size = pad * 2
  const c = makeCanvas(size, size)
  if (!c) return null
  const g = c.getContext('2d') as CanvasRenderingContext2D | null
  if (!g) return null
  g.translate(pad, pad)
  const glowHue = gold ? GOLD : hue
  const glow = g.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.15)
  glow.addColorStop(0, hsla(glowHue, 95, 62, dark ? 0.42 : 0.3))
  glow.addColorStop(1, hsla(glowHue, 95, 62, 0))
  g.fillStyle = glow
  g.beginPath()
  g.arc(0, 0, r * 2.15, 0, TAU)
  g.fill()
  const line = gold ? hsla(GOLD, 95, dark ? 70 : 44, 1) : hsla(hue, 78, lineL(dark), 1)
  g.lineWidth = Math.max(1, r * (kind === 'big' ? 0.16 : 0.24))
  g.strokeStyle = line
  g.fillStyle = hsla(hue, 82, dark ? 60 : 58, 0.95)
  g.beginPath()
  if (kind === 'rice') g.ellipse(0, 0, r * 1.7, r * 0.78, 0, 0, TAU)
  else if (kind === 'dart') {
    g.moveTo(r * 1.9, 0)
    g.lineTo(-r * 0.9, r * 0.8)
    g.lineTo(-r * 0.5, 0)
    g.lineTo(-r * 0.9, -r * 0.8)
    g.closePath()
  } else g.arc(0, 0, r, 0, TAU)
  g.fill()
  g.stroke()
  if (kind === 'big') {
    g.strokeStyle = hsla(hue, 85, dark ? 80 : 50, 0.8)
    g.lineWidth = Math.max(1, r * 0.1)
    g.beginPath()
    g.arc(0, 0, r * 0.7, 0, TAU)
    g.stroke()
  }
  // The white heart.
  g.fillStyle = 'rgba(255, 252, 247, 0.96)'
  g.beginPath()
  if (kind === 'rice') g.ellipse(r * 0.15, 0, r * 0.9, r * 0.36, 0, 0, TAU)
  else if (kind === 'dart') g.ellipse(r * 0.3, 0, r * 0.7, r * 0.26, 0, 0, TAU)
  else g.arc(0, 0, r * (kind === 'big' ? 0.42 : 0.5), 0, TAU)
  g.fill()
  sprites.set(key, c)
  return { img: c, r }
}

function drawBullets(g: Gfx) {
  const { ctx, s, dark, U, X, Y, t, dpr } = g
  for (const b of s.bullets) {
    const rpx = U(b.r) * (b.kind === 'rice' || b.kind === 'dart' ? 1.25 : 1.15)
    if (b.wait > 0) {
      // About to leave: a small flare where it will come from.
      const k = clamp01(1 - b.wait / 0.4)
      ctx.globalAlpha = 0.25 + 0.5 * k
      ctx.fillStyle = hsla(b.hue, 90, dark ? 70 : 55, 1)
      ctx.beginPath()
      ctx.arc(X(b.x), Y(b.y), Math.max(1, rpx * 0.6 * k), 0, TAU)
      ctx.fill()
      ctx.globalAlpha = 1
      continue
    }
    const sp = bulletSprite(b.kind, b.hue, rpx * dpr, dark, b.grazed)
    if (!sp) continue
    const size = sp.img.width / dpr
    const x = X(b.x)
    const y = Y(b.y)
    if (b.kind === 'rice' || b.kind === 'dart') {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(Math.atan2(b.vy, b.vx))
      ctx.drawImage(sp.img as CanvasImageSource, -size / 2, -size / 2, size, size)
      ctx.restore()
    } else {
      const pulse = b.kind === 'big' ? 1 + 0.06 * Math.sin(t * 9 + b.x * 40) : 1
      ctx.drawImage(sp.img as CanvasImageSource, x - (size * pulse) / 2, y - (size * pulse) / 2, size * pulse, size * pulse)
    }
  }
}

// -------------------------------------------------------------------- ships

type N = (n: number) => number

function traceSquid(ctx: CanvasRenderingContext2D, X: N, Y: N) {
  ctx.beginPath()
  ctx.moveTo(X(0), Y(-1))
  ctx.bezierCurveTo(X(0.42), Y(-1), X(0.74), Y(-0.45), X(0.74), Y(0.02))
  ctx.lineTo(X(0.74), Y(0.24))
  ctx.quadraticCurveTo(X(0.74), Y(0.48), X(0.5), Y(0.48))
  ctx.lineTo(X(-0.5), Y(0.48))
  ctx.quadraticCurveTo(X(-0.74), Y(0.48), X(-0.74), Y(0.24))
  ctx.lineTo(X(-0.74), Y(0.02))
  ctx.bezierCurveTo(X(-0.74), Y(-0.45), X(-0.42), Y(-1), X(0), Y(-1))
  ctx.closePath()
}

function traceCrab(ctx: CanvasRenderingContext2D, X: N, Y: N) {
  ctx.beginPath()
  ctx.moveTo(X(-0.25), Y(-0.64))
  ctx.lineTo(X(0.25), Y(-0.64))
  ctx.quadraticCurveTo(X(0.64), Y(-0.64), X(0.64), Y(-0.2))
  ctx.lineTo(X(0.64), Y(0.36))
  ctx.quadraticCurveTo(X(0.64), Y(0.56), X(0.44), Y(0.56))
  ctx.lineTo(X(-0.44), Y(0.56))
  ctx.quadraticCurveTo(X(-0.64), Y(0.56), X(-0.64), Y(0.36))
  ctx.lineTo(X(-0.64), Y(-0.2))
  ctx.quadraticCurveTo(X(-0.64), Y(-0.64), X(-0.25), Y(-0.64))
  ctx.closePath()
}

/** A dome over a skirt of four lobes; the lobes trade lengths each step. */
function traceOcto(ctx: CanvasRenderingContext2D, X: N, Y: N, frame: number) {
  ctx.beginPath()
  ctx.moveTo(X(-0.8), Y(0.3))
  ctx.bezierCurveTo(X(-0.8), Y(-0.62), X(-0.44), Y(-0.98), X(0), Y(-0.98))
  ctx.bezierCurveTo(X(0.44), Y(-0.98), X(0.8), Y(-0.62), X(0.8), Y(0.3))
  const valleys = [
    [0.8, 0.3],
    [0.4, 0.44],
    [0, 0.44],
    [-0.4, 0.44],
    [-0.8, 0.3],
  ] as const
  const long = 1.42
  const short = 1.0
  const reach = frame ? [long, short, long, short] : [short, long, short, long]
  const sway = frame ? 0.05 : -0.05
  for (let i = 0; i < 4; i++) {
    const a = valleys[i]!
    const b = valleys[i + 1]!
    ctx.quadraticCurveTo(X((a[0] + b[0]) / 2 + sway), Y(reach[i]!), X(b[0]), Y(b[1]))
  }
  ctx.closePath()
}

/** Everything that hangs off the hull, stroked before it so its outline runs whole. */
function drawLimbs(ctx: CanvasRenderingContext2D, species: Species, X: N, Y: N, frame: number, sway = 0) {
  ctx.beginPath()
  if (species === 'squid' || species === 'queen') {
    for (const side of [-1, 1]) {
      ctx.moveTo(X(0.7 * side), Y(-0.28))
      ctx.lineTo(X(0.98 * side), Y(0.18))
      ctx.lineTo(X(0.7 * side), Y(0.24))
    }
    const count = species === 'queen' ? 5 : 3
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1) - 0.5
      const rx = u * 0.8
      const phase = frame ? 1 : -1
      const tx = u * 1.5 + Math.sin(sway + i * 1.3) * 0.12 * (species === 'queen' ? 1.5 : 1)
      const ty = 0.95 + (i % 2 ? 0.08 : 0) * phase + (species === 'queen' ? 0.35 : 0)
      ctx.moveTo(X(rx), Y(0.46))
      ctx.quadraticCurveTo(X(rx + (tx - rx) * 0.2 + phase * 0.14), Y(0.72), X(tx), Y(ty))
    }
  } else if (species === 'crab') {
    const up = frame ? -0.64 : -0.3
    for (const side of [-1, 1]) {
      ctx.moveTo(X(0.22 * side), Y(-0.62))
      ctx.quadraticCurveTo(X(0.24 * side), Y(-0.9), X(0.42 * side), Y(-0.98))
      ctx.moveTo(X(0.6 * side), Y(0.08))
      ctx.quadraticCurveTo(X(1.0 * side), Y(0.08), X(0.9 * side), Y(up))
      ctx.lineTo(X(0.72 * side), Y(up - 0.3))
      ctx.moveTo(X(0.9 * side), Y(up))
      ctx.lineTo(X(1.04 * side), Y(up - 0.28))
      ctx.moveTo(X(0.3 * side), Y(0.54))
      ctx.lineTo(X((frame ? 0.48 : 0.34) * side), Y(0.96))
    }
  }
  ctx.stroke()
}

type Plate = { w: number; base: number; outer: number; inner: number }

const HELMET: Record<Species, Plate> = {
  squid: { w: 0.6, base: -0.46, outer: -1.66, inner: -1.24 },
  crab: { w: 0.6, base: -0.5, outer: -1.18, inner: -0.8 },
  octo: { w: 0.66, base: -0.44, outer: -1.64, inner: -1.26 },
  queen: { w: 0.6, base: -0.46, outer: -1.66, inner: -1.24 },
}

function traceHelmet(ctx: CanvasRenderingContext2D, X: N, Y: N, a: Plate) {
  ctx.beginPath()
  ctx.moveTo(X(-a.w), Y(a.base))
  ctx.quadraticCurveTo(X(0), Y(a.outer), X(a.w), Y(a.base))
  ctx.lineTo(X(a.w * 0.72), Y(a.base + 0.1))
  ctx.quadraticCurveTo(X(0), Y(a.inner), X(-a.w * 0.72), Y(a.base + 0.1))
  ctx.closePath()
}

const EYES: Record<Species, { x: number; y: number; r: number }> = {
  squid: { x: 0.3, y: -0.2, r: 0.2 },
  crab: { x: 0.3, y: -0.14, r: 0.19 },
  octo: { x: 0.32, y: -0.3, r: 0.2 },
  queen: { x: 0.3, y: -0.24, r: 0.18 },
}

function steel(hue: number, dark: boolean) {
  return hsla(hue, 16, dark ? 80 : 90, dark ? 0.42 : 0.9)
}

/** A ship of the fleet: limbs, hull, a helmet if it is plated, eyes on the player's ship, a nozzle that glows as it fires. */
function drawEnemy(g: Gfx, e: Enemy) {
  const { ctx, dark, t, U, X: FX, Y: FY, s } = g
  const spec = SPECIES[e.species]
  const boss = e.species === 'queen' ? bossReadout(s) : null
  const hue = boss ? boss.hue : spec.hue
  const sw = U(spec.w)
  const sh = U(spec.h)
  let cx = FX(e.x)
  const cy = FY(e.y)
  if (e.hurt > 0.5 && e.species !== 'queen') cx += (Math.random() - 0.5) * sw * 0.05
  const X: N = (n) => cx + (n * sw) / 2
  const Y: N = (n) => cy + (n * sh) / 2
  const line = hsla(hue, 60, lineL(dark), 0.97)
  const lw = Math.max(1.2, sw * (e.species === 'queen' ? 0.018 : 0.042))
  const frame = Math.floor(t * 4 + e.id * 0.7) % 2
  const species = e.species

  if (species === 'queen') {
    // A halo in the phase's colour, breathing.
    const r = sw * 0.75
    const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r)
    glow.addColorStop(0, hsla(hue, 90, 60, dark ? 0.2 : 0.14))
    glow.addColorStop(1, hsla(hue, 90, 60, 0))
    ctx.fillStyle = glow
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = line
  ctx.lineWidth = lw
  drawLimbs(ctx, species, X, Y, frame, t * 2 + e.id)
  if (species === 'crab') {
    ctx.fillStyle = line
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(X(0.42 * side), Y(-0.98), lw * 0.9, 0, TAU)
      ctx.fill()
    }
  }

  // The nozzle, under the hull's middle.
  ctx.beginPath()
  ctx.moveTo(X(-0.12), Y(0.44))
  ctx.lineTo(X(0.12), Y(0.44))
  ctx.lineTo(X(0.08), Y(0.66))
  ctx.lineTo(X(-0.08), Y(0.66))
  ctx.closePath()
  ctx.fillStyle = hsla(hue, 30, dark ? 30 : 58, 0.95)
  ctx.fill()
  ctx.stroke()

  if (species === 'squid' || species === 'queen') traceSquid(ctx, X, Y)
  else if (species === 'crab') traceCrab(ctx, X, Y)
  else traceOcto(ctx, X, Y, frame)
  ctx.fillStyle = hsla(hue, 62, 60, dark ? 0.26 : 0.32)
  ctx.fill()
  if (e.hurt > 0) {
    // A flagship is under fire nearly all the time: its flash is a flicker, not a whiteout.
    ctx.fillStyle = `rgba(255, 255, 255, ${(species === 'queen' ? 0.14 : 0.55) * e.hurt})`
    ctx.fill()
  }
  ctx.stroke()

  if (e.plated) {
    const a = HELMET[species]
    traceHelmet(ctx, X, Y, a)
    ctx.fillStyle = steel(hue, dark)
    ctx.fill()
    ctx.stroke()
  }

  if (species === 'queen') drawCrown(g, X, Y, hue, lw)
  drawEyes(g, e, species, hue, X, Y, sw, line)

  if (e.flare > 0) {
    // Light in the nozzle as it fires.
    const n = nozzleOf(e)
    const ox = FX(n.x)
    const oy = FY(n.y)
    const r = sw * (species === 'queen' ? 0.05 : 0.1) * e.flare
    const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 3)
    glow.addColorStop(0, hsla(hue, 95, 72, 0.8 * e.flare))
    glow.addColorStop(1, hsla(hue, 95, 62, 0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(ox, oy, r * 3, 0, TAU)
    ctx.fill()
  }
}

/** The flagship's crown: three gold points over the brow, a jewel in the middle one in the phase's colour. */
function drawCrown(g: Gfx, X: N, Y: N, hue: number, lw: number) {
  const { ctx, dark, t } = g
  ctx.beginPath()
  ctx.moveTo(X(-0.42), Y(-0.86))
  ctx.lineTo(X(-0.48), Y(-1.32))
  ctx.lineTo(X(-0.22), Y(-1.04))
  ctx.lineTo(X(0), Y(-1.46))
  ctx.lineTo(X(0.22), Y(-1.04))
  ctx.lineTo(X(0.48), Y(-1.32))
  ctx.lineTo(X(0.42), Y(-0.86))
  ctx.quadraticCurveTo(X(0), Y(-0.98), X(-0.42), Y(-0.86))
  ctx.closePath()
  ctx.fillStyle = hsla(GOLD, 90, 60, dark ? 0.5 : 0.7)
  ctx.fill()
  ctx.strokeStyle = hsla(GOLD, 80, lineL(dark), 1)
  ctx.lineWidth = lw
  ctx.stroke()
  const jx = X(0)
  const jy = Y(-1.18)
  const jr = Math.abs(X(0.07) - X(0))
  ctx.fillStyle = hsla(hue, 90, dark ? 66 : 54, 0.8 + 0.2 * Math.sin(t * 4))
  ctx.beginPath()
  ctx.arc(jx, jy, jr, 0, TAU)
  ctx.fill()
  ctx.stroke()
}

function drawEyes(g: Gfx, e: Enemy, species: Species, hue: number, X: N, Y: N, sw: number, line: string) {
  const { ctx, s, dark, t } = g
  const eye = EYES[species]
  const r = (eye.r * sw) / 2
  const blink = frac((t + e.id * 0.73) / 4.3) * 4.3 < 0.12
  // Small ships wince when hit; the flagship stares it out.
  const squint = e.hurt > 0.5 && species !== 'queen'
  // Eyes on the player's ship.
  const dx = s.ship.x - e.x
  const dy = s.ship.y - e.y
  const d = Math.hypot(dx, dy) || 1
  const lx = (dx / d) * r * 0.38
  const ly = (dy / d) * r * 0.3
  for (const side of [-1, 1]) {
    const ex = X(eye.x * side)
    const ey = Y(eye.y)
    if (blink || squint) {
      ctx.strokeStyle = line
      ctx.lineWidth = Math.max(1, r * 0.45)
      ctx.beginPath()
      ctx.moveTo(ex - r * 0.85, ey + (squint ? -side * r * 0.25 : 0))
      ctx.lineTo(ex + r * 0.85, ey + (squint ? side * r * 0.25 : 0))
      ctx.stroke()
      continue
    }
    ctx.beginPath()
    ctx.arc(ex, ey, r, 0, TAU)
    ctx.fillStyle = dark ? '#eaf1f6' : '#ffffff'
    ctx.fill()
    ctx.strokeStyle = line
    ctx.lineWidth = Math.max(0.8, r * 0.3)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ex + lx, ey + ly, r * 0.5, 0, TAU)
    ctx.fillStyle = e.flare > 0.3 ? hsla(HOT, 85, 50) : hsla(hue, 40, dark ? 16 : 20)
    ctx.fill()
  }
}

// ---------------------------------------------------------------- the ship

/**
 * The player's ship: a little green craft with a canopy, swept wings and an
 * engine that flickers, leaning into its turns. Its heart is drawn separately,
 * after everything else, so it is never lost under a bullet.
 */
function drawShip(g: Gfx) {
  const { ctx, s, dark, t, U, X, Y } = g
  if (s.phase === 'gameover' || s.phase === 'dying' || s.phase === 'menu') return
  const sh = s.ship
  // Blinks while it can't be hit.
  if (sh.shield > 0 && !s.blast && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.45
  const cx = X(sh.x)
  const cy = Y(sh.y)
  const w = U(SHIP_W)
  const line = hsla(SHIP_HUE, 58, lineL(dark), 0.98)
  const fill = hsla(SHIP_HUE, 62, 58, dark ? 0.3 : 0.36)
  const lw = Math.max(1.3, w * 0.045)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(sh.lean * 0.12)
  const bank = 1 - Math.abs(sh.lean) * 0.18
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // The engine's flame, longer while it climbs.
  const flick = 0.75 + 0.25 * Math.sin(t * 43) + 0.1 * Math.sin(t * 71)
  const flame = w * (0.42 + 0.14 * flick)
  const grad = ctx.createLinearGradient(0, w * 0.3, 0, w * 0.3 + flame)
  grad.addColorStop(0, hsla(SHIP_HUE, 95, 70, 0.9))
  grad.addColorStop(0.5, hsla(180, 95, 65, 0.5))
  grad.addColorStop(1, hsla(200, 95, 65, 0))
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(-w * 0.1, w * 0.28)
  ctx.quadraticCurveTo(0, w * 0.3 + flame * 1.1, w * 0.1, w * 0.28)
  ctx.closePath()
  ctx.fill()

  // Wings.
  ctx.strokeStyle = line
  ctx.lineWidth = lw
  ctx.fillStyle = fill
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * w * 0.1, -w * 0.05)
    ctx.lineTo(side * w * 0.5 * bank, w * 0.2)
    ctx.quadraticCurveTo(side * w * 0.52 * bank, w * 0.32, side * w * 0.36 * bank, w * 0.3)
    ctx.lineTo(side * w * 0.1, w * 0.24)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  // Hull: a rounded dart.
  ctx.beginPath()
  ctx.moveTo(0, -w * 0.56)
  ctx.bezierCurveTo(w * 0.14, -w * 0.46, w * 0.19, -w * 0.1, w * 0.17, w * 0.18)
  ctx.quadraticCurveTo(w * 0.15, w * 0.34, 0, w * 0.34)
  ctx.quadraticCurveTo(-w * 0.15, w * 0.34, -w * 0.17, w * 0.18)
  ctx.bezierCurveTo(-w * 0.19, -w * 0.1, -w * 0.14, -w * 0.46, 0, -w * 0.56)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // Canopy.
  ctx.beginPath()
  ctx.ellipse(0, -w * 0.2, w * 0.075, w * 0.14, 0, 0, TAU)
  ctx.fillStyle = dark ? 'rgba(234, 241, 246, 0.35)' : 'rgba(255, 255, 255, 0.7)'
  ctx.fill()
  ctx.lineWidth = lw * 0.8
  ctx.stroke()
  ctx.restore()

  // Wing guns, from the third power level: two small orbs either side.
  if (s.power >= 3) {
    for (const side of [-1, 1]) {
      const ox = X(sh.x + side * 0.05)
      const oy = Y(sh.y + 0.005 + Math.sin(t * 5 + side) * 0.004)
      const r = U(0.011)
      const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 2.4)
      glow.addColorStop(0, hsla(SHIP_HUE, 90, 65, 0.5))
      glow.addColorStop(1, hsla(SHIP_HUE, 90, 65, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(ox, oy, r * 2.4, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ox, oy, r, 0, TAU)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = line
      ctx.lineWidth = lw * 0.8
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

/** The heart: the only part that can be hit, on top of everything, with the graze circle round it while focused. */
function drawCore(g: Gfx) {
  const { ctx, s, dark, t, U, X, Y } = g
  if (s.phase !== 'playing') return
  const sh = s.ship
  const cx = X(sh.x)
  const cy = Y(sh.y)
  const f = sh.focus
  if (f > 0.05) {
    ctx.save()
    ctx.globalAlpha = f * 0.55
    ctx.setLineDash([U(0.008), U(0.01)])
    ctx.lineDashOffset = -t * U(0.03)
    ctx.strokeStyle = hsla(GOLD, 80, dark ? 70 : 45, 0.8)
    ctx.lineWidth = Math.max(1, U(0.0025))
    ctx.beginPath()
    ctx.arc(cx, cy, U(GRAZE_R), 0, TAU)
    ctx.stroke()
    ctx.restore()
  }
  const r = Math.max(2.2, U(CORE_R))
  const glowR = r * (2.2 + s.grazeGlow * 1.6 + f * 0.6)
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR)
  glow.addColorStop(0, s.grazeGlow > 0.1 ? hsla(GOLD, 95, 70, 0.8) : hsla(SHIP_HUE, 95, 70, 0.7))
  glow.addColorStop(1, hsla(SHIP_HUE, 95, 70, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, glowR, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, TAU)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = hsla(SHIP_HUE, 70, dark ? 55 : 35, 1)
  ctx.lineWidth = Math.max(1, r * 0.4)
  ctx.stroke()
}

/**
 * What the ship has in hand, right under it where the eye already is: a pip
 * for each Barrage ready, and a thin bar filling toward the next.
 */
function drawCharge(g: Gfx) {
  const { ctx, s, dark, U, X, Y } = g
  if (s.phase !== 'playing') return
  const sh = s.ship
  const y = Y(sh.y + 0.062)
  const pip = Math.max(2, U(0.0075))
  const gap = pip * 3
  const x0 = X(sh.x) - ((MAX_STOCK - 1) * gap) / 2
  for (let i = 0; i < MAX_STOCK; i++) {
    const x = x0 + i * gap
    ctx.beginPath()
    ctx.moveTo(x, y - pip)
    ctx.lineTo(x + pip, y)
    ctx.lineTo(x, y + pip)
    ctx.lineTo(x - pip, y)
    ctx.closePath()
    if (i < s.stock) {
      ctx.fillStyle = hsla(GOLD, 95, dark ? 62 : 50, 0.95)
      ctx.fill()
    } else {
      ctx.strokeStyle = hsla(GOLD, 40, dark ? 45 : 70, 0.7)
      ctx.lineWidth = 1
      ctx.stroke()
      if (i === s.stock && s.charge > 0) {
        // The one filling.
        ctx.save()
        ctx.clip()
        ctx.fillStyle = hsla(GOLD, 95, dark ? 62 : 50, 0.8)
        ctx.fillRect(x - pip, y + pip - pip * 2 * s.charge, pip * 2, pip * 2 * s.charge)
        ctx.restore()
      }
    }
  }
}

// ------------------------------------------------------------ rounds, stars

function drawBolts(g: Gfx) {
  const { ctx, s, dark, U, X, Y } = g
  ctx.lineCap = 'round'
  for (const b of s.bolts) {
    const x = X(b.x)
    const y = Y(b.y)
    const sp = Math.hypot(b.vx, b.vy) || 1
    const len = U(b.needle ? 0.022 : 0.034)
    const tx = x - (b.vx / sp) * len
    const ty = y - (b.vy / sp) * len
    ctx.strokeStyle = hsla(b.needle ? 170 : SHIP_HUE, 85, 62, dark ? 0.22 : 0.25)
    ctx.lineWidth = Math.max(3, U(0.012))
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.strokeStyle = hsla(b.needle ? 170 : SHIP_HUE, 80, dark ? 70 : 42, 0.95)
    ctx.lineWidth = Math.max(1.4, U(b.needle ? 0.004 : 0.006))
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
}

function drawStarShape(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = spin + (i / 8) * TAU
    const rr = i % 2 ? r * 0.42 : r
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawStars2(g: Gfx) {
  const { ctx, s, dark, t, U, X, Y } = g
  for (const st of s.stars) {
    const x = X(st.x)
    const y = Y(st.y)
    const r = U(st.gold ? 0.011 : 0.007)
    ctx.fillStyle = st.gold ? hsla(GOLD, 95, dark ? 64 : 52, 0.95) : hsla(GOLD, 40, dark ? 88 : 60, 0.85)
    drawStarShape(ctx, x, y, r, t * 5 + st.x * 30)
    ctx.fill()
    if (st.gold) {
      ctx.strokeStyle = hsla(GOLD, 90, dark ? 78 : 40, 0.9)
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

/** The Barrage going out: a gold wave with a bright front and a warm wash behind it. */
function drawBlast(g: Gfx) {
  const { ctx, s, dark, U, X, Y } = g
  const b = s.blast
  if (!b) return
  const x = X(b.x)
  const y = Y(b.y)
  const r = U(b.r)
  const fade = clamp01(1 - b.r / 1.85)
  const inner = Math.max(0, r - U(0.14))
  const wash = ctx.createRadialGradient(x, y, inner, x, y, r)
  wash.addColorStop(0, hsla(GOLD, 95, 62, 0))
  wash.addColorStop(0.85, hsla(GOLD, 95, 62, (dark ? 0.2 : 0.16) * fade))
  wash.addColorStop(1, hsla(GOLD, 95, 70, 0.4 * fade))
  ctx.fillStyle = wash
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = hsla(GOLD, 95, dark ? 76 : 50, 0.9 * fade)
  ctx.lineWidth = Math.max(2, U(0.008))
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.stroke()
}

// ------------------------------------------------------------------- debris

function drawBits(g: Gfx) {
  const { ctx, s, dark, U, X, Y } = g
  for (const b of s.bits) {
    const a = clamp01(b.life / b.maxLife)
    const x = X(b.x)
    const y = Y(b.y)
    if (b.kind === 'spark') {
      ctx.globalAlpha = a
      ctx.strokeStyle = hsla(b.hue, 90, dark ? 72 : 52)
      ctx.lineWidth = Math.max(1.2, U(b.size) * 0.55)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - U(b.vx) * 0.035, y - U(b.vy) * 0.035)
      ctx.stroke()
      continue
    }
    const sz = U(b.size)
    ctx.globalAlpha = Math.min(1, a * 1.6)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(b.angle)
    ctx.beginPath()
    ctx.moveTo(sz, 0)
    ctx.lineTo(-sz * 0.6, sz * 0.72)
    ctx.lineTo(-sz * 0.42, -sz * 0.62)
    ctx.closePath()
    ctx.fillStyle = hsla(b.hue, 60, 60, dark ? 0.3 : 0.36)
    ctx.fill()
    ctx.strokeStyle = hsla(b.hue, 58, lineL(dark), 0.95)
    ctx.lineWidth = Math.max(1, sz * 0.14)
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
  }
  ctx.globalAlpha = 1
  ctx.lineCap = 'butt'
}

function drawRings(g: Gfx) {
  const { ctx, s, dark, U, X, Y } = g
  for (const r of s.rings) {
    const k = 1 - r.life / r.maxLife
    const e = 1 - (1 - k) ** 3
    ctx.globalAlpha = (1 - k) * 0.85
    ctx.strokeStyle = hsla(r.hue, 75, dark ? 70 : 46)
    ctx.lineWidth = Math.max(1, U(r.width) * (1 - k) + 0.6)
    ctx.beginPath()
    ctx.arc(X(r.x), Y(r.y), Math.max(0.5, U(r.r0 + (r.r1 - r.r0) * e)), 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// --------------------------------------------------------------------- text

/** Text on a halo of the ground behind it, so it reads over ships and bullets alike. */
function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, colour: string, weight = 600) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const ground = playfieldColor()
  ctx.strokeStyle = ground
  ctx.lineWidth = Math.max(3, size * 0.24)
  ctx.shadowColor = ground
  ctx.shadowBlur = size * 0.45
  ctx.strokeText(text, x, y)
  ctx.shadowBlur = 0
  ctx.fillStyle = colour
  ctx.fillText(text, x, y)
}

function drawFloaters(g: Gfx) {
  const { ctx, s, dark, U, X, Y } = g
  const small = Math.max(10, U(0.03))
  for (const f of s.floaters) {
    const a = clamp01(f.life / f.maxLife)
    ctx.globalAlpha = Math.min(1, a * 1.8)
    let colour = withAlpha(inkColor(), 0.8)
    let size = small
    let weight = 600
    if (f.tone === 'bonus') {
      colour = hsla(GOLD, 92, dark ? 64 : 40)
      size = small * 1.25
      weight = 800
    } else if (f.tone === 'warn') {
      colour = hsla(HOT, 80, dark ? 66 : 46)
      size = small * 1.1
      weight = 700
    }
    haloText(ctx, f.text, X(f.x), Y(f.y), size, colour, weight)
  }
  ctx.globalAlpha = 1
}

/** The flagship's bar across the top of the field: a segment a phase, the current one draining, its name and its clock. */
function drawBossBar(g: Gfx) {
  const { ctx, s, dark, U, X, Y } = g
  const b = bossReadout(s)
  if (!b) return
  const x0 = X(0.06)
  const x1 = X(0.94)
  const y = Y(0.035)
  const h = Math.max(4, U(0.011))
  const gap = U(0.012)
  const seg = (x1 - x0 - gap * (b.phases - 1)) / b.phases
  ctx.globalAlpha = b.title
  for (let i = 0; i < b.phases; i++) {
    const sx = x0 + i * (seg + gap)
    ctx.beginPath()
    ctx.roundRect(sx, y, seg, h, h / 2)
    ctx.fillStyle = withAlpha(inkColor(), dark ? 0.12 : 0.1)
    ctx.fill()
    const left = i < b.phase ? 0 : i > b.phase ? 1 : b.left
    if (left > 0) {
      ctx.beginPath()
      ctx.roundRect(sx, y, seg * left, h, h / 2)
      ctx.fillStyle = hsla(i === b.phase ? b.hue : 0, i === b.phase ? 80 : 0, dark ? 62 : 52, i === b.phase ? 0.95 : 0.35)
      ctx.fill()
    }
  }
  const size = Math.max(11, U(0.03))
  ctx.font = `700 ${Math.round(size)}px ${FONT}`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = hsla(b.hue, 80, dark ? 70 : 40)
  ctx.fillText(b.name, x0, y + h + U(0.008))
  ctx.textAlign = 'right'
  ctx.fillStyle = withAlpha(inkColor(), 0.7)
  ctx.fillText(`${Math.ceil(b.time)}`, x1, y + h + U(0.008))
  ctx.globalAlpha = 1
}

function drawBanner(g: Gfx) {
  const { ctx, s, dark, U, X, Y } = g
  const b = s.banner
  if (!b) return
  const t = b.t
  const left = BANNER_TIME - t
  const alpha = t < 0.15 ? t / 0.15 : left < 0.45 ? left / 0.45 : 1
  const big = Math.max(24, U(0.1))
  const note = Math.max(12, U(0.036))
  const y = Y(FIELD_H * 0.42)
  ctx.globalAlpha = clamp01(alpha)
  const grow = 1 + Math.max(0, 0.15 - t) * 0.8
  const colour =
    b.tone === 'boss' ? hsla(HOT, 80, dark ? 68 : 46) : b.tone === 'phase' ? hsla(GOLD, 92, dark ? 64 : 40) : inkColor()
  haloText(ctx, b.text, X(0.5), y - big * 0.3, big * grow, colour, 800)
  if (b.sub) haloText(ctx, b.sub, X(0.5), y + big * 0.55, note, b.tone === 'clear' ? hsla(GOLD, 92, dark ? 62 : 40) : inkColor(), 600)
  ctx.globalAlpha = 1
}

// ------------------------------------------------------------------- render

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const p = fieldPlace(w, h)
  const dark = isDarkTheme()
  const t = state.time
  const g: Gfx = {
    ctx,
    p,
    s: state,
    dark,
    t,
    X: (v) => p.ox + v * p.k,
    Y: (v) => p.oy + v * p.k,
    U: (v) => v * p.k,
    dpr: Math.max(1, Math.abs(ctx.getTransform().a) || 1),
  }

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)
  drawNebula(g, w, h)
  drawStars(ctx, w, h, dark, t, p.k)

  ctx.save()
  // The field shakes with a big hit; the sky behind it doesn't.
  if (state.shake > 0.01) {
    const m = state.shake * state.shake * p.k * 0.02
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
  }
  ctx.beginPath()
  ctx.rect(p.ox, p.oy, p.fw, p.fh)
  ctx.clip()

  for (const e of state.enemies) if (!e.gone) drawEnemy(g, e)
  drawBolts(g)
  drawShip(g)
  drawBlast(g)
  drawBullets(g)
  drawStars2(g)
  drawRings(g)
  drawBits(g)
  drawCore(g)
  drawCharge(g)
  drawFloaters(g)
  drawBossBar(g)
  ctx.restore()

  drawSurround(ctx, p, w, h, dark)
  drawBanner(g)

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 250, 240, ${state.flash * state.flash * (dark ? 0.22 : 0.3)})`
    ctx.fillRect(0, 0, w, h)
  }
}
