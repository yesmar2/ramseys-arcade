import { mixColor, withAlpha } from '../../lib/color'
import { inkColor, isDarkTheme, playfieldColor } from '../../lib/theme'
import {
  CANNON_HUE,
  CHAIN_WINDOW,
  CLEAR_PAUSE,
  LINE_PAUSE,
  POWER_HUE,
  SPECIES_HUE,
  WAVE_BANNER,
  cannonRect,
  carrierRadius,
  chainMult,
  dropRadius,
  emitterOf,
  enterProgress,
  railY,
  roundsReady,
  shipX,
  shipY,
  shotSize,
  speciesFor,
  stageFor,
  type Bit,
  type GameState,
  type PowerKind,
  type Ship,
  type Species,
} from './game'

/*
 * Drawn the house way: soft fills inside clean outlines, in the site's own
 * colours, on the site's own ground. Outlines are brighter over the dark
 * theme's ground and deeper over the light one.
 *
 * The fleet is the site's purples, the cannon is green, and red belongs to the
 * volley alone — a lit lane, a charging ship, a falling shot — so the one thing
 * that can end a life is the one thing in that colour.
 *
 * The canvas fills the shell, but the playfield keeps its shape so a run on a
 * phone and a run on a desktop are the same game — the shared leaderboard
 * depends on that. `Place` converts the game's width-normalised units into that
 * centred field.
 */

const TAU = Math.PI * 2
const FONT = 'Outfit, system-ui, sans-serif'
/** The volley's red. */
const HOT = 4
const GOLD = 42

function hsla(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

/** Outline lightness: bright over the dark theme's ground, deeper over the light one. */
const lineL = (dark: boolean) => (dark ? 64 : 42)

function frac(v: number) {
  return v - Math.floor(v)
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

type Place = {
  /** Lengths in game units -> canvas px. */
  u: (v: number) => number
  x: (v: number) => number
  y: (v: number) => number
  ox: number
  oy: number
  fw: number
  fh: number
}

/**
 * Centred across, but sat on the bottom rather than centred down: spare height
 * goes above the fleet as sky, so the cannon stays down by the thumbs on a
 * phone instead of floating over a slab of empty ground.
 */
function placement(w: number, h: number, portrait: boolean): Place {
  const stage = stageFor(portrait)
  const scale = Math.min(w / stage.w, h / stage.h)
  const fw = scale * stage.w
  const fh = scale * stage.h
  const ox = (w - fw) / 2
  const oy = h - fh
  return { u: (v) => v * fw, x: (v) => ox + v * fw, y: (v) => oy + v * fw, ox, oy, fw, fh }
}

/** A point on the canvas, in the field's own units — for steering with a finger. */
export function fieldXAt(px: number, w: number, h: number, portrait: boolean): number {
  const p = placement(w, h, portrait)
  return (px - p.ox) / p.fw
}

type Gfx = {
  ctx: CanvasRenderingContext2D
  p: Place
  s: GameState
  dark: boolean
  t: number
}

// ------------------------------------------------------------------- ground

/**
 * Two layers of stars sinking slowly past, the near ones a little faster, a
 * few of them breathing. Positions are hashed, so nothing jumps between frames.
 */
function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, dark: boolean, t: number) {
  const count = Math.round((w * h) / 6500)
  ctx.fillStyle = inkColor()
  for (let i = 1; i <= count; i++) {
    const a = frac(Math.sin(i * 12.9898) * 43758.5453)
    const b = frac(Math.sin(i * 78.233) * 12345.6789)
    const c = frac(Math.sin(i * 3.7137) * 9973.113)
    const near = c > 0.72
    const y = (b * h + t * (near ? 6 : 2.5)) % h
    const breathe = c > 0.9 ? 0.55 + 0.45 * Math.sin(t * (0.8 + c) + i) : 1
    ctx.globalAlpha = (dark ? 0.06 + c * 0.16 : 0.04 + c * 0.09) * breathe
    ctx.beginPath()
    ctx.arc(a * w, y, 0.45 + c * 1.05, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/**
 * Settle the surround back rather than boxing the field in. A flat tint over
 * the play area draws a hard rectangle across the screen, which is the exact
 * letterboxed look this is meant to avoid; fading the margins inward reads as
 * depth instead of a border.
 */
function drawSurround(ctx: CanvasRenderingContext2D, p: Place, w: number, h: number) {
  const shade = withAlpha(playfieldColor(), 0.82)
  const clear = withAlpha(playfieldColor(), 0)

  const band = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
  ) => {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    grad.addColorStop(0, shade)
    grad.addColorStop(1, clear)
    ctx.fillStyle = grad
    ctx.fillRect(rx, ry, rw, rh)
  }

  // Landscape shells leave side margins, portrait ones leave top and bottom.
  if (p.ox > 0) {
    band(0, 0, p.ox, 0, 0, 0, p.ox, h)
    band(w, 0, w - p.ox, 0, p.ox + p.fw, 0, p.ox, h)
  }
  if (p.oy > 0) {
    band(0, 0, 0, p.oy, 0, 0, w, p.oy)
    band(0, h, 0, h - p.oy, 0, p.oy + p.fh, w, p.oy)
  }
}

/**
 * The strip the cannon runs on: a rail with its sleepers. While a chain is
 * alive the rail burns gold from the middle out, and burns back in as its
 * clock runs down.
 */
function drawGround(g: Gfx, w: number, h: number) {
  const { ctx, p, s, dark } = g
  const top = p.y(railY(s.layout))
  const ink = inkColor()
  ctx.fillStyle = mixColor(playfieldColor(), ink, dark ? 0.05 : 0.055)
  ctx.fillRect(0, top, w, h - top + 40)

  ctx.strokeStyle = withAlpha(ink, dark ? 0.1 : 0.12)
  ctx.lineWidth = Math.max(1, p.u(0.0024))
  const tick = p.u(0.011)
  ctx.beginPath()
  for (let x = 0.0175; x < 1; x += 0.035) {
    ctx.moveTo(p.x(x), top + ctx.lineWidth)
    ctx.lineTo(p.x(x), top + tick)
  }
  ctx.stroke()

  ctx.strokeStyle = withAlpha(ink, dark ? 0.24 : 0.26)
  ctx.lineWidth = Math.max(1, p.u(0.003))
  ctx.beginPath()
  ctx.moveTo(0, top)
  ctx.lineTo(w, top)
  ctx.stroke()

  if (s.chain >= 2 && (s.phase === 'playing' || s.phase === 'clearing')) {
    const left = clamp01(s.chainT / CHAIN_WINDOW)
    const mult = chainMult(s.chain)
    const half = (p.fw / 2) * left
    const mid = p.x(0.5)
    const thick = Math.max(2, p.u(mult >= 2 ? 0.0042 : 0.003))
    ctx.fillStyle = hsla(GOLD, 92, dark ? 60 : 48, mult >= 2 ? 0.9 : 0.6)
    ctx.beginPath()
    ctx.roundRect(mid - half, top - thick / 2, half * 2, thick, thick / 2)
    ctx.fill()
  }
}

// --------------------------------------------------------------------- line

/** How close the fleet's front is to the line, 0 at a wave's start ground to 1 on it. */
function linePressure(s: GameState): number {
  let low = -Infinity
  for (const ship of s.ships) {
    if (!ship.alive) continue
    low = Math.max(low, shipY(s, ship) + s.layout.shipH)
  }
  if (low === -Infinity) return 0
  return clamp01(1 - (s.layout.holdLine - low) / s.layout.descent)
}

/**
 * The line itself: a field strung between posts. Green while the fleet is far
 * off, amber as it comes down, red and beating when it is close. A volley's
 * shots pass straight through it — it is a line, not cover — and it flexes
 * where they do.
 */
function drawLine(g: Gfx) {
  const { ctx, p, s, dark, t } = g
  const y = p.y(s.layout.holdLine)
  const x0 = p.x(0)
  const x1 = p.x(1)
  const broken = s.endCause === 'line' && (s.phase === 'dying' || s.phase === 'gameover')
  const pressure = broken ? 1 : linePressure(s)
  const hue = pressure < 0.55 ? 150 - (110 * pressure) / 0.55 : 40 - (36 * (pressure - 0.55)) / 0.45
  const beat = pressure > 0.5 ? 0.5 + 0.5 * Math.sin(t * (4 + pressure * 9)) : 0

  if (broken) {
    // What is left of it: stubs from each post, flickering out.
    const fade = s.phase === 'dying' ? clamp01(s.dyingFor / LINE_PAUSE) : 0
    ctx.strokeStyle = hsla(HOT, 80, lineL(dark), 0.25 + 0.6 * fade * (0.5 + 0.5 * Math.sin(t * 50)))
    ctx.lineWidth = Math.max(1, p.u(0.003))
    ctx.beginPath()
    for (let i = 0; i <= 8; i++) {
      const px = p.x(i / 8)
      const stub = p.u(0.018) * (0.4 + 0.6 * frac(Math.sin(i * 91.7) * 311.3))
      ctx.moveTo(px - stub, y)
      ctx.lineTo(px + stub, y)
    }
    ctx.stroke()
  } else {
    // The field's glow, rising off the line.
    const bandH = p.u(0.04)
    const grad = ctx.createLinearGradient(0, y, 0, y - bandH)
    grad.addColorStop(0, hsla(hue, 80, 58, (dark ? 0.1 : 0.12) + pressure * 0.12 + beat * 0.1))
    grad.addColorStop(1, hsla(hue, 80, 58, 0))
    ctx.fillStyle = grad
    ctx.fillRect(x0, y - bandH, x1 - x0, bandH)

    ctx.strokeStyle = hsla(hue, 70, lineL(dark), 0.5 + 0.3 * pressure)
    ctx.lineWidth = Math.max(1, p.u(0.0026))
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()

    // Current running along it.
    ctx.save()
    ctx.setLineDash([p.u(0.05), p.u(0.1)])
    ctx.lineDashOffset = -t * p.u(0.09)
    ctx.strokeStyle = hsla(hue, 85, dark ? 78 : 52, 0.45 + 0.35 * beat)
    ctx.lineWidth = Math.max(1.2, p.u(0.0042))
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()
    ctx.restore()

    // Where the volley passed through.
    for (const r of s.ripples) {
      const k = 1 - r.life / 0.45
      ctx.strokeStyle = hsla(hue, 80, dark ? 74 : 48, (1 - k) * 0.85)
      ctx.lineWidth = Math.max(1, p.u(0.0025))
      ctx.beginPath()
      ctx.ellipse(p.x(r.x), y, p.u(0.01 + 0.03 * k), p.u(0.003 + 0.007 * k), 0, 0, TAU)
      ctx.stroke()
    }
  }

  // The posts.
  const post = p.u(0.0075)
  for (let i = 0; i <= 8; i++) {
    const px = p.x(i / 8)
    ctx.beginPath()
    ctx.moveTo(px, y - post)
    ctx.lineTo(px + post * 0.8, y)
    ctx.lineTo(px, y + post)
    ctx.lineTo(px - post * 0.8, y)
    ctx.closePath()
    ctx.fillStyle = hsla(broken ? HOT : hue, 70, dark ? 62 : 56, broken ? 0.5 : 0.85)
    ctx.fill()
    ctx.strokeStyle = hsla(broken ? HOT : hue, 60, lineL(dark), 0.95)
    ctx.lineWidth = Math.max(1, p.u(0.002))
    ctx.stroke()
  }
}

// -------------------------------------------------------------------- lanes

/**
 * The tell. Each lit ship drops a lane to the ground — leaning the way its
 * shots will — with marks running down it, and marks the spot on the rail it
 * will hit. Faint as the charge begins, hard and flickering just before it
 * fires, so how long is left reads without a number.
 */
function drawLanes(g: Gfx) {
  const { ctx, p, s, dark, t } = g
  if (s.chargeLeft <= 0) return
  const floor = railY(s.layout)

  for (const ship of s.ships) {
    if (!ship.alive || !ship.charging) continue
    const c = ship.charge
    const e = emitterOf(s, ship)
    const landX = e.x + s.volleySpread * (floor - e.y)
    const x0 = p.x(e.x)
    const y0 = p.y(e.y)
    const x1 = p.x(landX)
    const y1 = p.y(floor)
    const w0 = p.u(0.006)
    const w1 = p.u(0.019)
    const flicker = c > 0.72 ? 0.5 + 0.5 * Math.sin(t * 42) : 0

    const grad = ctx.createLinearGradient(0, y0, 0, y1)
    grad.addColorStop(0, hsla(HOT, 85, 58, 0.03 + c * 0.1))
    grad.addColorStop(1, hsla(HOT, 85, 58, 0.07 + c * 0.17 + flicker * 0.06))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(x0 - w0, y0)
    ctx.lineTo(x0 + w0, y0)
    ctx.lineTo(x1 + w1, y1)
    ctx.lineTo(x1 - w1, y1)
    ctx.closePath()
    ctx.fill()

    ctx.save()
    ctx.setLineDash([p.u(0.014), p.u(0.012)])
    ctx.lineDashOffset = -t * p.u(0.12)
    ctx.strokeStyle = hsla(HOT, 82, dark ? 66 : 50, 0.18 + c * 0.55 + flicker * 0.2)
    ctx.lineWidth = Math.max(1, p.u(0.0022))
    ctx.beginPath()
    ctx.moveTo(x0 - w0, y0)
    ctx.lineTo(x1 - w1, y1)
    ctx.moveTo(x0 + w0, y0)
    ctx.lineTo(x1 + w1, y1)
    ctx.stroke()
    ctx.restore()

    // Chevrons running down the lane.
    ctx.strokeStyle = hsla(HOT, 85, dark ? 70 : 50, 1)
    ctx.lineWidth = Math.max(1.2, p.u(0.003))
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let k = 0; k < 3; k++) {
      const u = frac(t * 1.1 + k / 3)
      const cx = x0 + (x1 - x0) * u
      const cy = y0 + (y1 - y0) * u
      const half = (w0 + (w1 - w0) * u) * 0.7
      ctx.globalAlpha = (0.12 + c * 0.6) * Math.sin(u * Math.PI)
      ctx.beginPath()
      ctx.moveTo(cx - half, cy - half * 0.7)
      ctx.lineTo(cx, cy + half * 0.3)
      ctx.lineTo(cx + half, cy - half * 0.7)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // The mark on the rail.
    ctx.fillStyle = hsla(HOT, 88, 58, 0.18 + c * 0.45 + flicker * 0.15)
    ctx.beginPath()
    ctx.ellipse(x1, y1, w1 * 1.5, Math.max(2, p.u(0.006)), 0, 0, TAU)
    ctx.fill()
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

function traceBody(ctx: CanvasRenderingContext2D, species: Species, X: N, Y: N, frame: number) {
  if (species === 'squid') traceSquid(ctx, X, Y)
  else if (species === 'crab') traceCrab(ctx, X, Y)
  else traceOcto(ctx, X, Y, frame)
}

/** Everything that hangs off the hull, stroked before it so its outline runs whole. */
function drawLimbs(ctx: CanvasRenderingContext2D, species: Species, X: N, Y: N, frame: number) {
  ctx.beginPath()
  if (species === 'squid') {
    // Side fins, then three tentacles that splay and tuck.
    for (const side of [-1, 1]) {
      ctx.moveTo(X(0.7 * side), Y(-0.28))
      ctx.lineTo(X(0.98 * side), Y(0.18))
      ctx.lineTo(X(0.7 * side), Y(0.24))
    }
    const tips = frame
      ? [
          [-0.5, 0.98],
          [0, 0.9],
          [0.5, 0.98],
        ]
      : [
          [-0.74, 0.9],
          [0, 1.02],
          [0.74, 0.9],
        ]
    const roots = [-0.4, 0, 0.4]
    for (let i = 0; i < 3; i++) {
      const [tx, ty] = tips[i]!
      const rx = roots[i]!
      ctx.moveTo(X(rx), Y(0.46))
      ctx.quadraticCurveTo(X(rx + (tx! - rx) * 0.2 + (frame ? 0.14 : -0.14)), Y(0.72), X(tx!), Y(ty!))
    }
  } else if (species === 'crab') {
    const up = frame ? -0.64 : -0.3
    for (const side of [-1, 1]) {
      // Antenna.
      ctx.moveTo(X(0.22 * side), Y(-0.62))
      ctx.quadraticCurveTo(X(0.24 * side), Y(-0.9), X(0.42 * side), Y(-0.98))
      // Arm and pincer.
      ctx.moveTo(X(0.6 * side), Y(0.08))
      ctx.quadraticCurveTo(X(1.0 * side), Y(0.08), X(0.9 * side), Y(up))
      ctx.lineTo(X(0.72 * side), Y(up - 0.3))
      ctx.moveTo(X(0.9 * side), Y(up))
      ctx.lineTo(X(1.04 * side), Y(up - 0.28))
      // Leg.
      ctx.moveTo(X(0.3 * side), Y(0.54))
      ctx.lineTo(X((frame ? 0.48 : 0.34) * side), Y(0.96))
    }
  }
  ctx.stroke()
}

type Plate = { w: number; base: number; outer: number; inner: number }

/** The helmet's arch for each kind of hull, sized so it sits just proud of the top. */
const HELMET: Record<Species, Plate> = {
  squid: { w: 0.6, base: -0.46, outer: -1.66, inner: -1.24 },
  crab: { w: 0.6, base: -0.5, outer: -1.18, inner: -0.8 },
  octo: { w: 0.66, base: -0.44, outer: -1.64, inner: -1.26 },
}

/** A point along the middle of the helmet's band, k from -1 (left end) to 1. */
function helmetPoint(a: Plate, k: number) {
  const u = (k + 1) / 2
  const b = 2 * u * (1 - u)
  const outer = a.base + b * (a.outer - a.base)
  const inner = a.base + 0.1 + b * (a.inner - a.base - 0.1)
  return { x: k * a.w * 0.86, y: (outer + inner) / 2 }
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
}

function steel(hue: number, dark: boolean) {
  return hsla(hue, 16, dark ? 80 : 90, dark ? 0.42 : 0.9)
}

/** Which of the two gait frames the fleet is on. */
function gaitFrame(s: GameState) {
  if (s.phase === 'menu') return Math.floor(s.time * 2.2) % 2
  return Math.floor(s.gait / 2) % 2
}

/**
 * One ship: limbs, hull, armour, eyes, nozzle. Armour is drawn from `hp`, not
 * the tier it started at, so what is left on the hull says how many hits are
 * left. The eyes follow the cannon; a ship winding up glows, its eyes go red,
 * and light gathers under it.
 */
function drawShip(g: Gfx, ship: Ship, frame: number) {
  const { ctx, p, s, dark, t } = g
  const L = s.layout
  const species = speciesFor(ship.row, L.rows)
  const hue = SPECIES_HUE[species]
  const sw = p.u(L.shipW)
  const sh = p.u(L.shipH)
  const c = ship.charging ? ship.charge : 0
  let cx = p.x(shipX(s, ship)) + sw / 2
  const cy = p.y(shipY(s, ship)) + sh / 2
  if (ship.hurt > 0) cx += (Math.random() - 0.5) * sw * 0.07 * ship.hurt
  if (c > 0.7) cx += (Math.random() - 0.5) * sw * 0.035
  const X: N = (n) => cx + (n * sw) / 2
  const Y: N = (n) => cy + (n * sh) / 2
  const line = hsla(hue, 58, lineL(dark), 0.96)
  const lw = Math.max(1.2, sw * 0.042)

  if (c > 0) {
    const glow = ctx.createRadialGradient(cx, Y(0.7), 0, cx, Y(0.7), sw * 0.95)
    glow.addColorStop(0, hsla(HOT, 90, 60, 0.32 * c))
    glow.addColorStop(1, hsla(HOT, 90, 60, 0))
    ctx.fillStyle = glow
    ctx.fillRect(cx - sw, Y(0.7) - sw, sw * 2, sw * 2)
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = line
  ctx.lineWidth = lw
  drawLimbs(ctx, species, X, Y, frame)
  if (species === 'crab') {
    ctx.fillStyle = line
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(X(0.42 * side), Y(-0.98), lw * 0.9, 0, TAU)
      ctx.fill()
    }
  }

  // Pauldrons go under the hull, so its outline crosses their inner edge.
  if (ship.hp >= 3) {
    for (const side of [-1, 1]) {
      const px = side < 0 ? X(-1.0) : X(0.62)
      ctx.beginPath()
      ctx.roundRect(px, Y(-0.38), (0.38 * sw) / 2, (0.7 * sh) / 2, sw * 0.05)
      ctx.fillStyle = steel(hue, dark)
      ctx.fill()
      ctx.stroke()
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

  traceBody(ctx, species, X, Y, frame)
  ctx.fillStyle = hsla(hue, 62, 60, dark ? 0.24 : 0.3)
  ctx.fill()
  if (ship.hurt > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * ship.hurt})`
    ctx.fill()
  }
  ctx.stroke()
  if (c > 0) {
    // The hull's outline beats red as the charge comes up.
    ctx.strokeStyle = hsla(HOT, 85, dark ? 66 : 50, c * (0.55 + 0.45 * Math.sin(t * 20)))
    ctx.stroke()
    ctx.strokeStyle = line
  }

  if (ship.hp >= 2) {
    const a = HELMET[species]
    traceHelmet(ctx, X, Y, a)
    ctx.fillStyle = steel(hue, dark)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = line
    for (const k of [-0.55, 0, 0.55]) {
      const r = helmetPoint(a, k)
      ctx.beginPath()
      ctx.arc(X(r.x), Y(r.y), Math.max(0.8, sw * 0.02), 0, TAU)
      ctx.fill()
    }
  }
  if (ship.hp >= 3) {
    ctx.fillStyle = line
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(X(0.81 * side), Y(-0.02), Math.max(0.8, sw * 0.02), 0, TAU)
      ctx.fill()
    }
  }

  drawEyes(g, ship, species, hue, X, Y, sw, line, c)

  if (c > 0) {
    // Light gathering in the nozzle.
    const ox = X(0)
    const oy = Y(0.84)
    const r = sw * (0.035 + 0.075 * c)
    const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 2.6)
    glow.addColorStop(0, hsla(HOT, 95, 70, 0.7 * c))
    glow.addColorStop(1, hsla(HOT, 95, 60, 0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(ox, oy, r * 2.6, 0, TAU)
    ctx.fill()
    ctx.fillStyle = hsla(HOT, 90, dark ? 64 : 56, 0.95)
    ctx.beginPath()
    ctx.arc(ox, oy, r, 0, TAU)
    ctx.fill()
    ctx.fillStyle = `rgba(255, 246, 238, ${0.5 + 0.5 * c})`
    ctx.beginPath()
    ctx.arc(ox, oy, r * 0.45, 0, TAU)
    ctx.fill()
    // Motes drawn in from around it.
    ctx.fillStyle = hsla(HOT, 95, dark ? 72 : 55, 0.9)
    for (let k = 0; k < 5; k++) {
      const u = frac(t * 2.2 + k / 5)
      const a = (k / 5) * TAU + t * 2.5
      const d = sw * 0.6 * (1 - u)
      ctx.globalAlpha = c * u
      ctx.beginPath()
      ctx.arc(ox + Math.cos(a) * d, oy + Math.sin(a) * d * 0.7, Math.max(0.8, sw * 0.022), 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

function drawEyes(
  g: Gfx,
  ship: Ship,
  species: Species,
  hue: number,
  X: N,
  Y: N,
  sw: number,
  line: string,
  c: number,
) {
  const { ctx, s, dark, t } = g
  const eye = EYES[species]
  const r = (eye.r * sw) / 2
  const hash = frac(Math.sin((ship.col + 1) * 12.9898 + (ship.row + 1) * 78.233) * 43758.5453)
  const blink = frac((t + hash * 9) / 4.7) * 4.7 < 0.13 && c === 0
  const squint = ship.hurt > 0.35
  const look = clamp01(((s.cannonX - (shipX(s, ship) + s.layout.shipW / 2)) / 0.35 + 1) / 2) * 2 - 1

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
    if (c > 0) {
      ctx.fillStyle = hsla(HOT, 90, dark ? 64 : 58, 0.3 + 0.7 * c)
      ctx.fill()
    }
    ctx.strokeStyle = line
    ctx.lineWidth = Math.max(0.8, r * 0.3)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ex + look * r * 0.38, ey + r * 0.3, r * (c > 0 ? 0.36 : 0.5), 0, TAU)
    ctx.fillStyle = c > 0 ? 'rgba(255, 248, 240, 0.95)' : hsla(hue, 40, dark ? 16 : 20)
    ctx.fill()
  }
}

// ------------------------------------------------------------------ pickups

function drawGlyph(ctx: CanvasRenderingContext2D, kind: PowerKind, cx: number, cy: number, rr: number) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (kind === 'pierce') {
    // An arrow driving up through the mark.
    ctx.moveTo(cx, cy + rr * 0.5)
    ctx.lineTo(cx, cy - rr * 0.52)
    ctx.moveTo(cx - rr * 0.34, cy - rr * 0.18)
    ctx.lineTo(cx, cy - rr * 0.54)
    ctx.lineTo(cx + rr * 0.34, cy - rr * 0.18)
  } else if (kind === 'spread') {
    // Three diverging lines.
    for (const lean of [-0.42, 0, 0.42]) {
      ctx.moveTo(cx, cy + rr * 0.5)
      ctx.lineTo(cx + rr * lean, cy - rr * 0.5)
    }
  } else if (kind === 'slow') {
    // An hourglass.
    ctx.moveTo(cx - rr * 0.4, cy - rr * 0.5)
    ctx.lineTo(cx + rr * 0.4, cy - rr * 0.5)
    ctx.lineTo(cx - rr * 0.4, cy + rr * 0.5)
    ctx.lineTo(cx + rr * 0.4, cy + rr * 0.5)
    ctx.closePath()
  } else {
    // A struck-through volley.
    ctx.moveTo(cx - rr * 0.42, cy - rr * 0.42)
    ctx.lineTo(cx + rr * 0.42, cy + rr * 0.42)
    ctx.moveTo(cx + rr * 0.42, cy - rr * 0.42)
    ctx.lineTo(cx - rr * 0.42, cy + rr * 0.42)
  }
  ctx.stroke()
}

/** A capsule: a soft glow, a rounded case in its colour, and a mark that does not rely on colour. */
function drawCapsule(g: Gfx, kind: PowerKind, cx: number, cy: number, rr: number) {
  const { ctx, dark } = g
  const hue = POWER_HUE[kind]
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 2.1)
  glow.addColorStop(0, hsla(hue, 85, 60, dark ? 0.28 : 0.22))
  glow.addColorStop(1, hsla(hue, 85, 60, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, rr * 2.1, 0, TAU)
  ctx.fill()

  const line = hsla(hue, 62, lineL(dark), 0.98)
  ctx.beginPath()
  ctx.roundRect(cx - rr, cy - rr, rr * 2, rr * 2, rr * 0.45)
  ctx.fillStyle = hsla(hue, 72, 60, dark ? 0.3 : 0.4)
  ctx.fill()
  ctx.strokeStyle = line
  ctx.lineWidth = Math.max(1.2, rr * 0.15)
  ctx.stroke()
  ctx.lineWidth = Math.max(1.2, rr * 0.17)
  drawGlyph(ctx, kind, cx, cy, rr)
}

/**
 * The supply runner: a small saucer with its capsule slung underneath, so what
 * it is carrying is plain before you decide to turn your gun on it.
 */
function drawCarrier(g: Gfx) {
  const { ctx, p, s, dark, t } = g
  const c = s.carrier
  if (!c) return
  const r = p.u(carrierRadius())
  const cx = p.x(c.x)
  const cy = p.y(c.y)
  const hue = POWER_HUE[c.kind]
  const line = hsla(hue, 55, lineL(dark), 0.96)
  const swing = Math.sin(t * 3.2) * r * 0.14
  const capX = cx + swing
  const capY = cy + r * 0.92

  ctx.strokeStyle = line
  ctx.lineWidth = Math.max(1, r * 0.06)
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 0.2)
  ctx.lineTo(capX, capY - r * 0.4)
  ctx.stroke()
  drawCapsule(g, c.kind, capX, capY, r * 0.4)

  // Exhaust off the trailing side.
  const back = -Math.sign(c.vx)
  ctx.fillStyle = hsla(hue, 90, 64, 0.4 + 0.2 * Math.sin(t * 30))
  ctx.beginPath()
  ctx.moveTo(cx + back * r * 0.9, cy - r * 0.1)
  ctx.lineTo(cx + back * r * (1.35 + 0.1 * Math.sin(t * 41)), cy)
  ctx.lineTo(cx + back * r * 0.9, cy + r * 0.1)
  ctx.closePath()
  ctx.fill()

  ctx.lineWidth = Math.max(1.2, r * 0.1)
  ctx.lineJoin = 'round'
  ctx.fillStyle = hsla(hue, 55, 62, dark ? 0.24 : 0.32)
  ctx.beginPath()
  ctx.ellipse(cx, cy - r * 0.16, r * 0.46, r * 0.4, 0, Math.PI, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = line
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.3, 0, 0, TAU)
  ctx.fill()
  ctx.stroke()

  const lit = Math.floor(t * 8) % 3
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(cx + (i - 1) * r * 0.5, cy + r * 0.04, Math.max(1.2, r * 0.08), 0, TAU)
    ctx.fillStyle = i === lit ? hsla(GOLD, 95, dark ? 68 : 52) : line
    ctx.fill()
  }
}

/** Falling capsules, each with a guide down to where it will reach the rail. */
function drawDrops(g: Gfx) {
  const { ctx, p, s, dark, t } = g
  const rr = p.u(dropRadius())
  const floor = p.y(railY(s.layout))
  for (const drop of s.drops) {
    const cx = p.x(drop.x)
    const cy = p.y(drop.y)
    const hue = POWER_HUE[drop.kind]
    // Blink out over the last second and a half rather than vanishing.
    const alpha = drop.life < 1.5 ? 0.35 + 0.65 * Math.abs(Math.sin(drop.life * 9)) : 1
    ctx.globalAlpha = alpha
    ctx.save()
    ctx.setLineDash([p.u(0.008), p.u(0.012)])
    ctx.lineDashOffset = -t * p.u(0.04)
    ctx.strokeStyle = hsla(hue, 70, lineL(dark), 0.35)
    ctx.lineWidth = Math.max(1, p.u(0.002))
    ctx.beginPath()
    ctx.moveTo(cx, cy + rr * 1.3)
    ctx.lineTo(cx, floor)
    ctx.stroke()
    ctx.restore()
    ctx.fillStyle = hsla(hue, 75, 58, 0.35)
    ctx.beginPath()
    ctx.ellipse(cx, floor, rr * 1.1, Math.max(1.5, p.u(0.004)), 0, 0, TAU)
    ctx.fill()
    drawCapsule(g, drop.kind, cx, cy, rr)
    ctx.globalAlpha = 1
  }
}

// -------------------------------------------------------------------- shots

function drawShots(g: Gfx) {
  const { ctx, p, s, dark } = g
  const slowed = s.buffSlow > 0
  ctx.lineCap = 'round'
  for (const shot of s.shots) {
    const size = shotSize(shot.hostile)
    if (!shot.hostile) {
      // A green streak with a bright head; a piercing round runs amber.
      const hue = shot.pierce ? POWER_HUE.pierce : CANNON_HUE
      const sp = Math.hypot(shot.vx, shot.vy) || 1
      const len = p.u(size.h) * 1.25
      const hx = p.x(shot.x)
      const hy = p.y(shot.y)
      const tx = hx - (shot.vx / sp) * len
      const ty = hy - (shot.vy / sp) * len
      ctx.strokeStyle = hsla(hue, 80, 60, dark ? 0.2 : 0.22)
      ctx.lineWidth = Math.max(4, p.u(0.014))
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(hx, hy)
      ctx.stroke()
      ctx.strokeStyle = hsla(hue, 78, dark ? 64 : 42, 0.95)
      ctx.lineWidth = Math.max(2, p.u(size.w))
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(hx, hy)
      ctx.stroke()
      ctx.fillStyle = hsla(hue, 90, dark ? 88 : 70)
      ctx.beginPath()
      ctx.arc(hx, hy, Math.max(1.4, p.u(size.w) * 0.7), 0, TAU)
      ctx.fill()
      continue
    }

    // A red bolt: a trail, a glow, a hot core.
    const cx = p.x(shot.x)
    const cy = p.y(shot.y + size.h / 2)
    const ang = Math.atan2(shot.vy, shot.vx)
    const rx = p.u(size.h) / 2
    const ry = p.u(size.w) / 2
    const sp = Math.hypot(shot.vx, shot.vy) || 1
    for (let k = 1; k <= 3; k++) {
      const back = rx * 0.9 * k
      ctx.fillStyle = hsla(HOT, 90, 60, 0.16 / k)
      ctx.beginPath()
      ctx.arc(cx - (shot.vx / sp) * back, cy - (shot.vy / sp) * back, ry * (1.1 - k * 0.2), 0, TAU)
      ctx.fill()
    }
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(ang)
    ctx.fillStyle = hsla(HOT, 90, 60, 0.2)
    ctx.beginPath()
    ctx.ellipse(0, 0, rx * 1.5, ry * 2.2, 0, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU)
    ctx.fillStyle = hsla(HOT, 88, dark ? 60 : 54, 0.95)
    ctx.fill()
    ctx.strokeStyle = slowed ? hsla(POWER_HUE.slow, 70, lineL(dark), 0.95) : hsla(HOT, 80, dark ? 76 : 38, 0.95)
    ctx.lineWidth = Math.max(1, ry * (slowed ? 0.5 : 0.35))
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 244, 236, 0.92)'
    ctx.beginPath()
    ctx.ellipse(rx * 0.2, 0, rx * 0.5, ry * 0.42, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
  ctx.lineCap = 'butt'
}

// ------------------------------------------------------------------- debris

function bitHue(b: Bit, dark: boolean, light: number) {
  if (b.hue < 0) return withAlpha(inkColor(), dark ? 0.85 : 0.7)
  return hsla(b.hue, 85, light)
}

function drawBits(g: Gfx) {
  const { ctx, p, s, dark } = g
  for (const b of s.bits) {
    const a = clamp01(b.life / b.maxLife)
    const x = p.x(b.x)
    const y = p.y(b.y)
    if (b.kind === 'spark') {
      ctx.globalAlpha = a
      ctx.strokeStyle = bitHue(b, dark, dark ? 72 : 52)
      ctx.lineWidth = Math.max(1.2, p.u(b.size) * 0.55)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - p.u(b.vx) * 0.035, y - p.u(b.vy) * 0.035)
      ctx.stroke()
      continue
    }
    const sz = p.u(b.size)
    ctx.globalAlpha = Math.min(1, a * 1.6)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(b.angle)
    ctx.beginPath()
    if (b.kind === 'plate') {
      ctx.roundRect(-sz / 2, -sz * 0.22, sz, sz * 0.44, sz * 0.12)
      ctx.fillStyle = steel(b.hue, dark)
    } else {
      ctx.moveTo(sz, 0)
      ctx.lineTo(-sz * 0.6, sz * 0.72)
      ctx.lineTo(-sz * 0.42, -sz * 0.62)
      ctx.closePath()
      ctx.fillStyle = hsla(b.hue, 60, 60, dark ? 0.3 : 0.36)
    }
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
  const { ctx, p, s, dark } = g
  for (const r of s.rings) {
    const k = 1 - r.life / r.maxLife
    const ease = 1 - (1 - k) ** 3
    ctx.globalAlpha = (1 - k) * 0.85
    ctx.strokeStyle = hsla(r.hue, 70, dark ? 70 : 46)
    ctx.lineWidth = Math.max(1, p.u(0.006) * (1 - k) + 0.6)
    ctx.beginPath()
    ctx.arc(p.x(r.x), p.y(r.y), Math.max(0.5, p.u(r.r0 + (r.r1 - r.r0) * ease)), 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ------------------------------------------------------------------- cannon

/**
 * The cannon: a sled on the rail, a turret, a barrel that kicks. The four
 * lights on the sled are the rounds it has ready — four in the air at once —
 * so an empty gun shows as one, not as a trigger that stopped working.
 */
function drawCannon(g: Gfx) {
  const { ctx, p, s, dark, t } = g
  const gone = (s.phase === 'dying' || s.phase === 'gameover') && s.endCause !== 'line'
  if (gone) return
  const r = cannonRect(s)
  const W = p.u(r.w)
  const H = p.u(r.h)
  const cx = p.x(s.cannonX)
  const base = p.y(r.y + r.h)
  const appear = 1 - s.respawn
  const line = hsla(CANNON_HUE, 55, lineL(dark), 0.98)
  const fill = hsla(CANNON_HUE, 60, 58, dark ? 0.26 : 0.32)
  const lw = Math.max(1.4, W * 0.032)

  if (s.respawn > 0) {
    // Set down from above in a column of light.
    const top = p.y(s.layout.holdLine)
    const grad = ctx.createLinearGradient(0, top, 0, base)
    grad.addColorStop(0, hsla(CANNON_HUE, 80, 60, 0))
    grad.addColorStop(1, hsla(CANNON_HUE, 80, 60, 0.3 * s.respawn))
    ctx.fillStyle = grad
    ctx.fillRect(cx - W * 0.45, top, W * 0.9, base - top)
  }

  ctx.save()
  ctx.globalAlpha = 0.25 + 0.75 * appear
  ctx.translate(cx, base - (1 - appear) * H * 0.4)
  ctx.rotate(s.lean * 0.07)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.lineWidth = lw
  ctx.strokeStyle = line

  // Hover pads under the sled.
  const flick = 0.75 + 0.25 * Math.sin(t * 37)
  ctx.fillStyle = hsla(CANNON_HUE, 85, 62, 0.32 * flick)
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * W * 0.3, -H * 0.02, W * 0.11, H * 0.07, 0, 0, TAU)
    ctx.fill()
  }

  // Barrels, then the turret over their roots, then the sled over the turret's.
  const kick = s.kick * H * 0.14
  const bw = W * 0.12
  const spread = s.buffSpread > 0
  if (spread) {
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(side * W * 0.06, -H * 0.5)
      ctx.rotate(side * 0.32)
      ctx.beginPath()
      ctx.roundRect(-bw * 0.35, -H * 0.5 + kick, bw * 0.7, H * 0.5, bw * 0.2)
      ctx.fillStyle = hsla(POWER_HUE.spread, 70, 60, dark ? 0.3 : 0.4)
      ctx.fill()
      ctx.strokeStyle = hsla(POWER_HUE.spread, 60, lineL(dark), 0.95)
      ctx.stroke()
      ctx.restore()
    }
    ctx.strokeStyle = line
  }
  ctx.beginPath()
  ctx.roundRect(-bw / 2, -H * 1.1 + kick, bw, H * 0.7, bw * 0.25)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(-bw * 0.72, -H * 1.12 + kick, bw * 1.44, H * 0.12, bw * 0.2)
  ctx.fillStyle = s.pierceLeft > 0 ? hsla(POWER_HUE.pierce, 90, 60, 0.9) : fill
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(0, -H * 0.46, W * 0.27, H * 0.42, 0, Math.PI, 0)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(-W * 0.1, -H * 0.62, Math.max(1.4, W * 0.045), 0, TAU)
  ctx.fillStyle = dark ? '#eaf1f6' : '#ffffff'
  ctx.fill()
  ctx.lineWidth = lw * 0.7
  ctx.stroke()
  ctx.lineWidth = lw

  ctx.beginPath()
  ctx.moveTo(-W / 2, -H * 0.1)
  ctx.lineTo(-W * 0.4, -H * 0.5)
  ctx.lineTo(W * 0.4, -H * 0.5)
  ctx.lineTo(W / 2, -H * 0.1)
  ctx.quadraticCurveTo(W / 2, 0, W * 0.42, 0)
  ctx.lineTo(-W * 0.42, 0)
  ctx.quadraticCurveTo(-W / 2, 0, -W / 2, -H * 0.1)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.stroke()

  // Rounds ready.
  const ready = s.phase === 'menu' ? 4 : roundsReady(s)
  const pip = Math.max(1.3, W * 0.034)
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.arc((i - 1.5) * W * 0.13, -H * 0.27, pip, 0, TAU)
    ctx.fillStyle = i < ready ? hsla(CANNON_HUE, 85, dark ? 68 : 42) : hsla(CANNON_HUE, 18, dark ? 40 : 70, 0.7)
    ctx.fill()
  }

  // Muzzle flash.
  if (s.kick > 0.5) {
    const k = (s.kick - 0.5) / 0.5
    const my = -H * 1.14 + kick
    const f = W * 0.16 * k
    ctx.fillStyle = hsla(CANNON_HUE, 95, dark ? 82 : 60, 0.9 * k)
    ctx.beginPath()
    ctx.moveTo(0, my - f * 1.6)
    ctx.lineTo(f * 0.35, my - f * 0.3)
    ctx.lineTo(f, my)
    ctx.lineTo(f * 0.3, my + f * 0.2)
    ctx.lineTo(-f * 0.3, my + f * 0.2)
    ctx.lineTo(-f, my)
    ctx.lineTo(-f * 0.35, my - f * 0.3)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  if (s.hitFlash > 0 && s.phase === 'playing') {
    ctx.fillStyle = `rgba(255, 255, 255, ${s.hitFlash * 0.5})`
    ctx.fillRect(cx - W / 2, base - H, W, H)
  }
}

// --------------------------------------------------------------------- text

/** Text on a halo of the ground behind it, so it reads over ships and stars alike. */
function haloText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  colour: string,
  weight = 600,
) {
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
  const { ctx, p, s, dark } = g
  const small = Math.max(11, p.u(0.017))
  for (const f of s.floaters) {
    const a = clamp01(f.life / f.maxLife)
    ctx.globalAlpha = Math.min(1, a * 1.8)
    let colour = inkColor()
    let size = small
    let weight = 600
    if (f.tone === 'defuse') {
      colour = hsla(HOT, 85, dark ? 66 : 46)
      size = small * 1.1
      weight = 700
    } else if (f.tone === 'chain') {
      colour = hsla(GOLD, 92, dark ? 62 : 40)
      size = small * 1.25
      weight = 700
    } else if (f.tone === 'pickup') {
      colour = hsla(CANNON_HUE, 70, dark ? 66 : 36)
      size = small * 1.1
      weight = 700
    } else if (f.tone === 'jam') {
      colour = hsla(POWER_HUE.jam, 75, dark ? 68 : 40)
      size = small * 1.15
      weight = 700
    }
    haloText(ctx, f.text, p.x(f.x), p.y(f.y), size, colour, weight)
  }
  ctx.globalAlpha = 1
}

/** What a wave has in store that the last one didn't. */
function waveNote(wave: number) {
  if (wave === 1) return 'Lit ships fire next · hit one first to stop its shot'
  if (wave === 3) return 'Plated ships from here · the lanes lean'
  if (wave === 5) return 'Three rounds down every lane'
  if (wave === 6) return 'Heavy plate: three hits to break'
  return ''
}

/** Where banners go: the open ground between the fleet's slots and the line. */
function bannerY(s: GameState) {
  const low = s.formY + s.layout.formH
  return (low + s.layout.holdLine) / 2
}

function drawBanners(g: Gfx) {
  const { ctx, p, s, dark } = g
  const ink = inkColor()
  const big = Math.max(26, p.u(0.062))
  const note = Math.max(12, p.u(0.019))
  const mid = p.x(0.5)
  const y = p.y(bannerY(s))

  if (s.phase === 'playing' && s.waveT < WAVE_BANNER) {
    const t = s.waveT
    const left = WAVE_BANNER - t
    const alpha = t < 0.15 ? t / 0.15 : left < 0.45 ? left / 0.45 : 1
    const grow = 1 + Math.max(0, 0.15 - t) * 0.8
    ctx.globalAlpha = alpha
    haloText(ctx, `Wave ${s.wave}`, mid, y - big * 0.3, big * grow, ink, 700)
    const line = waveNote(s.wave)
    if (line) haloText(ctx, line, mid, y + big * 0.55, note, ink)
    ctx.globalAlpha = 1
  }

  if (s.phase === 'clearing' && s.clearBonus) {
    const k = clamp01((CLEAR_PAUSE - s.clearingFor) / 0.2)
    ctx.globalAlpha = Math.min(k, clamp01(s.clearingFor / 0.3))
    haloText(ctx, `Wave ${s.wave} clear`, mid, y - big * 0.3, big * 0.9, ink, 700)
    const gold = hsla(GOLD, 92, dark ? 62 : 40)
    const bonus = s.clearBonus.clean
      ? `+${s.clearBonus.clear}   +${s.clearBonus.clean} untouched`
      : `+${s.clearBonus.clear}`
    haloText(ctx, bonus, mid, y + big * 0.5, note * 1.15, gold, 700)
    ctx.globalAlpha = 1
  }

  if (s.endCause === 'line' && s.phase === 'dying') {
    // The fleet is sitting on the line now, so this goes in the sky it came from.
    let top = s.layout.holdLine
    for (const ship of s.ships) if (ship.alive) top = Math.min(top, shipY(s, ship))
    ctx.globalAlpha = clamp01((LINE_PAUSE - s.dyingFor) / 0.25)
    haloText(ctx, 'The line broke', mid, p.y(Math.max(0.14, top / 2 + 0.03)), big * 0.85, hsla(HOT, 85, dark ? 66 : 46), 700)
    ctx.globalAlpha = 1
  }
}

// ------------------------------------------------------------------- render

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const p = placement(w, h, state.layout.fieldH > 1)
  const dark = isDarkTheme()
  const t = state.time
  const g: Gfx = { ctx, p, s: state, dark, t }

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)
  drawStars(ctx, w, h, dark, t)

  // The field shakes with a big hit; the sky behind it and the banners don't.
  ctx.save()
  if (state.shake > 0.01) {
    const m = state.shake * state.shake * p.u(0.024)
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
  }

  drawGround(g, w, h)
  drawLanes(g)
  drawLine(g)

  const frame = gaitFrame(state)
  for (const ship of state.ships) {
    if (!ship.alive) continue
    // Paddling hard on the way in, then in step with the march.
    const flying = enterProgress(state, ship) < 1
    drawShip(g, ship, flying ? Math.floor(t * 8 + ship.col) % 2 : frame)
  }

  drawCarrier(g)
  drawDrops(g)
  drawShots(g)
  drawRings(g)
  drawBits(g)
  drawCannon(g)
  drawFloaters(g)
  ctx.restore()

  drawSurround(ctx, p, w, h)
  drawBanners(g)

  if (state.hitFlash > 0) {
    ctx.fillStyle = hsla(HOT, 80, 58, state.hitFlash * state.hitFlash * 0.14)
    ctx.fillRect(0, 0, w, h)
  }
}
