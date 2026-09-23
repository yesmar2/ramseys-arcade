import type { FallingPiece, FloaterTone, GameState, Slab } from './StackerEngine'
import { BASE_SIZE, SLAB_H } from './StackerEngine'
import { mixColor } from '../../lib/color'
import { inkColor, isDarkTheme, playfieldColor } from '../../lib/theme'

/*
 * The tower, drawn as solid blocks lit from above: a bright top, a lighter
 * face to the left and a deeper one to the right, each edged in its own hue.
 * Each slab sits a few degrees round the wheel from the one below, so the
 * tower climbs through the colours as one band.
 *
 * Behind it the sky changes as you go up — the ground's own colour at the
 * foot, turning bluer, then violet, then rose the higher the tower gets — with
 * stars coming out over the dark theme and clouds drifting past over the light
 * one, both sliding down slower than the tower does.
 *
 * Sizes are the engine's units scaled to the width of the stage, so a phone
 * sees the whole slide from side to side, not just the middle of it.
 */

const TAU = Math.PI * 2
const FONT = 'Outfit, system-ui, sans-serif'
const GOLD = 42
/**
 * Engine units the play area is fitted to, across: the full slide from side to
 * side, slab and all, with a little room either end.
 */
const LAYOUT_W = 600

function hsla(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function frac(v: number) {
  return v - Math.floor(v)
}

function ease(t: number) {
  const k = clamp01(t)
  return k * k * (3 - 2 * k)
}

type View = {
  ctx: CanvasRenderingContext2D
  s: GameState
  dark: boolean
  w: number
  h: number
  /** Screen pixels per engine unit. */
  k: number
  cx: number
  cy: number
}

type Pt = { x: number; y: number }

function project(v: View, x: number, y: number, z: number): Pt {
  return { x: v.cx + (x - z) * 0.9 * v.k, y: v.cy + ((x + z) * 0.5 - y) * v.k }
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
  ctx.closePath()
}

// ——————————————————————————————————————————————————————————— sky

/** Where the sky has got to, 0 on the ground: a new tint every thirty slabs. */
const SKY_TINTS_DARK = [
  [205, 50, 22],
  [228, 48, 24],
  [262, 42, 24],
  [300, 36, 22],
  [340, 40, 22],
] as const
const SKY_TINTS_LIGHT = [
  [175, 55, 88],
  [205, 70, 88],
  [240, 60, 90],
  [285, 55, 91],
  [335, 60, 91],
] as const

function tintAt(alt: number, dark: boolean) {
  const stops = dark ? SKY_TINTS_DARK : SKY_TINTS_LIGHT
  const pos = Math.max(0, alt / 30)
  const i = Math.min(stops.length - 1, Math.floor(pos))
  const j = Math.min(stops.length - 1, i + 1)
  const t = ease(pos - i)
  const a = stops[i]!
  const b = stops[j]!
  return {
    h: a[0] + (b[0] - a[0]) * t,
    s: a[1] + (b[1] - a[1]) * t,
    l: a[2] + (b[2] - a[2]) * t,
  }
}

function drawSky(v: View) {
  const { ctx, s, dark, w, h } = v
  const ground = playfieldColor()
  const alt = s.cameraY / SLAB_H
  const tint = tintAt(alt + 6, dark)
  const sky = hslHex(tint.h, tint.s, tint.l)
  /*
   * The sky's fade, in flat bands too close in colour to see: a gradient over
   * the whole canvas is the single most expensive thing a canvas without a GPU
   * behind it can be asked to draw, several times the cost of the tower.
   */
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, w, h)
  const bands = 56
  const reach = h * 0.75
  for (let i = 0; i < bands; i++) {
    const t = 1 - i / bands
    ctx.fillStyle = mixColor(ground, sky, (dark ? 0.55 : 0.6) * t * t)
    ctx.fillRect(0, Math.floor((i * reach) / bands), w, Math.ceil(reach / bands) + 1)
  }

  // Stars come out as you climb, sliding down at a quarter of the tower's pace.
  const drift = s.cameraY * v.k * 0.25
  if (dark) {
    const show = clamp01(0.35 + alt / 40)
    ctx.fillStyle = inkColor()
    for (let band = 0; band < 3; band++) {
      ctx.beginPath()
      const count = Math.round((w * h) / 5200)
      for (let i = 1 + band; i <= count; i += 3) {
        const a = frac(Math.sin(i * 12.9898) * 43758.5453)
        const b = frac(Math.sin(i * 78.233) * 12345.6789)
        const c = frac(Math.sin(i * 3.7137) * 9973.113)
        const x = a * w
        const y = (((b * h * 1.2 + drift) % (h * 1.2)) + h * 1.2) % (h * 1.2) - h * 0.1
        const r = 0.45 + c * 1.1
        ctx.moveTo(x + r, y)
        ctx.arc(x, y, r, 0, TAU)
      }
      ctx.globalAlpha = show * (0.1 + band * 0.08)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } else {
    // Clouds: a few soft puffs, drifting across and down.
    for (let i = 0; i < 6; i++) {
      const a = frac(Math.sin(i * 91.7) * 311.3)
      const b = frac(Math.sin(i * 17.3) * 97.1)
      const x = ((a * w * 1.4 + s.time * (6 + i * 2)) % (w * 1.4)) - w * 0.2
      const y = (((b * h * 1.6 + drift * 1.4) % (h * 1.6)) + h * 1.6) % (h * 1.6) - h * 0.3
      const r = (26 + frac(i * 0.61) * 30) * v.k
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
      ctx.beginPath()
      ctx.ellipse(x, y, r * 1.6, r * 0.55, 0, 0, TAU)
      ctx.ellipse(x - r * 0.7, y + r * 0.1, r * 0.8, r * 0.45, 0, 0, TAU)
      ctx.ellipse(x + r * 0.8, y + r * 0.12, r * 0.9, r * 0.42, 0, 0, TAU)
      ctx.fill()
    }
  }
}

/** HSL to a hex string, for mixing with the site's ground colour. */
function hslHex(h: number, s: number, l: number) {
  const sat = s / 100
  const lig = l / 100
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => {
    const kk = (n + h / 30) % 12
    const c = lig - a * Math.max(Math.min(kk - 3, 9 - kk, 1), -1)
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// ——————————————————————————————————————————————————————— blocks

type Faces = { top: Pt[]; right: Pt[]; left: Pt[] }

function faces(v: View, x: number, z: number, w: number, d: number, y0: number, y1: number): Faces {
  const hw = w / 2
  const hd = d / 2
  return {
    top: [
      project(v, x - hw, y1, z - hd),
      project(v, x + hw, y1, z - hd),
      project(v, x + hw, y1, z + hd),
      project(v, x - hw, y1, z + hd),
    ],
    // The face toward +x, down and to the right.
    right: [
      project(v, x + hw, y1, z - hd),
      project(v, x + hw, y1, z + hd),
      project(v, x + hw, y0, z + hd),
      project(v, x + hw, y0, z - hd),
    ],
    // The face toward +z, down and to the left.
    left: [
      project(v, x - hw, y1, z + hd),
      project(v, x + hw, y1, z + hd),
      project(v, x + hw, y0, z + hd),
      project(v, x - hw, y0, z + hd),
    ],
  }
}

type Paint = { hue: number; sat?: number; alpha?: number; glow?: number; flash?: number }

/**
 * One block, lit from above: the top brightest, the left face a step down,
 * the right a step further, each face shading darker toward its foot, and a
 * catch of light along the top's back edges.
 */
function drawBlock(v: View, f: Faces, paint: Paint) {
  const { ctx, dark } = v
  const hue = paint.hue
  const sat = paint.sat ?? 62
  ctx.save()
  ctx.globalAlpha = paint.alpha ?? 1
  ctx.lineJoin = 'round'
  const line = hsla(hue, Math.min(70, sat), dark ? 72 : 36, 0.9)
  ctx.lineWidth = Math.max(1, 1.3 * v.k)

  const side = (pts: Pt[], light: number) => {
    ctx.fillStyle = hsla(hue, sat, light)
    poly(ctx, pts)
    ctx.fill()
    ctx.strokeStyle = line
    ctx.stroke()
  }
  side(f.right, dark ? 38 : 64)
  side(f.left, dark ? 47 : 73)

  poly(ctx, f.top)
  ctx.fillStyle = hsla(hue, sat, dark ? 60 : 82)
  ctx.fill()
  if (paint.flash) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.65 * paint.flash})`
    ctx.fill()
  }
  ctx.strokeStyle = line
  ctx.stroke()

  // Light along the far edges of the top.
  const t = f.top
  ctx.beginPath()
  ctx.moveTo(t[3]!.x, t[3]!.y)
  ctx.lineTo(t[0]!.x, t[0]!.y)
  ctx.lineTo(t[1]!.x, t[1]!.y)
  ctx.strokeStyle = `rgba(255, 255, 255, ${dark ? 0.28 : 0.6})`
  ctx.lineWidth = Math.max(1, 1.6 * v.k)
  ctx.stroke()

  if (paint.glow) {
    poly(ctx, f.top)
    ctx.strokeStyle = hsla(GOLD, 95, dark ? 68 : 50, paint.glow)
    ctx.lineWidth = Math.max(2, 4 * v.k)
    ctx.stroke()
  }
  ctx.restore()
}

function slabFaces(v: View, slab: Slab, y: number) {
  return faces(v, slab.x, slab.z, slab.w, slab.d, y, y + SLAB_H)
}

/** The stone the tower stands on: the first slab's footprint, running down out of sight. */
function drawPedestal(v: View, base: Slab) {
  const { ctx, dark, h } = v
  const depth = Math.max(SLAB_H * 4, (h - v.cy) / v.k + BASE_SIZE)
  const f = faces(v, base.x, base.z, base.w, base.d, -depth, SLAB_H)
  const stone = dark ? 215 : 205
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, 1.3 * v.k)
  const line = hsla(stone, 18, dark ? 58 : 50, 0.8)
  for (const [pts, light] of [
    [f.right, dark ? 20 : 78],
    [f.left, dark ? 25 : 85],
  ] as const) {
    ctx.fillStyle = hsla(stone, 16, light)
    poly(ctx, pts)
    ctx.fill()
    ctx.strokeStyle = line
    ctx.stroke()
  }
  poly(ctx, f.top)
  ctx.fillStyle = hsla(stone, 16, dark ? 34 : 92)
  ctx.fill()
  ctx.strokeStyle = line
  ctx.stroke()
  ctx.restore()
}

function drawFalling(v: View, piece: FallingPiece) {
  const f = faces(v, piece.x, piece.z, piece.w, piece.d, piece.y, piece.y + SLAB_H)
  // A tumble, as a turn of the drawing about the piece's own middle.
  const c = project(v, piece.x, piece.y + SLAB_H / 2, piece.z)
  const a = piece.angle ?? 0
  const turn = (p: Pt) => ({
    x: c.x + (p.x - c.x) * Math.cos(a) - (p.y - c.y) * Math.sin(a),
    y: c.y + (p.x - c.x) * Math.sin(a) + (p.y - c.y) * Math.cos(a),
  })
  drawBlock(
    v,
    { top: f.top.map(turn), right: f.right.map(turn), left: f.left.map(turn) },
    { hue: piece.hue, alpha: clamp01(piece.life) },
  )
}

// ————————————————————————————————————————————————————————— effects

/** Square rings spreading from a slab laid dead on, the way a drop spreads on water. */
function drawRipples(v: View) {
  const { ctx, s, dark } = v
  for (const r of s.ripples ?? []) {
    if (r.delay > 0) continue
    const t = 1 - r.life
    const spread = 6 + ease(t) * 70
    const hw = r.w / 2 + spread
    const hd = r.d / 2 + spread
    const pts = [
      project(v, r.x - hw, r.y, r.z - hd),
      project(v, r.x + hw, r.y, r.z - hd),
      project(v, r.x + hw, r.y, r.z + hd),
      project(v, r.x - hw, r.y, r.z + hd),
    ]
    poly(ctx, pts)
    ctx.strokeStyle = dark ? `rgba(255, 255, 255, ${0.75 * r.life})` : hsla(GOLD, 90, 46, 0.8 * r.life)
    ctx.lineWidth = Math.max(1, 3 * v.k * r.life)
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
}

function drawDust(v: View) {
  const { ctx, s, dark } = v
  for (const d of s.dust ?? []) {
    const p = project(v, d.x, d.y, d.z)
    const a = clamp01(d.life / d.maxLife)
    ctx.globalAlpha = a
    ctx.fillStyle = hsla(d.hue, 55, dark ? 70 : 60)
    const r = Math.max(1, (1.2 + 2 * a) * v.k)
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2)
  }
  ctx.globalAlpha = 1
}

function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, colour: string) {
  ctx.font = `700 ${Math.round(size)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = playfieldColor()
  ctx.lineWidth = Math.max(3, size * 0.26)
  ctx.strokeText(text, x, y)
  ctx.fillStyle = colour
  ctx.fillText(text, x, y)
}

function floaterColour(tone: FloaterTone | undefined, dark: boolean) {
  if (tone === 'grow') return hsla(152, 70, dark ? 64 : 34)
  return hsla(GOLD, 90, dark ? 64 : 38)
}

/** Every tenth slab has its number beside the tower, so a height is something you pass. */
function drawHeights(v: View) {
  const { ctx, s, dark, h } = v
  const x = v.cx - (BASE_SIZE * 0.9 + 40) * v.k
  ctx.font = `700 ${Math.max(11, Math.round(13 * v.k))}px ${FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const ink = inkColor()
  for (let n = 10; n <= s.stack.length; n += 10) {
    const p = project(v, 0, n * SLAB_H + SLAB_H / 2, 0)
    if (p.y < -20 || p.y > h + 20) continue
    ctx.globalAlpha = dark ? 0.35 : 0.4
    ctx.fillStyle = ink
    ctx.fillText(String(n), x, p.y)
    ctx.fillRect(x + 6 * v.k, p.y - 0.5, 14 * v.k, 1)
  }
  ctx.globalAlpha = 1
}

// ——————————————————————————————————————————————————————————— render

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const dark = isDarkTheme()
  const kPlay = Math.max(0.6, Math.min(1.4, w / LAYOUT_W))

  /*
   * In play the camera keeps the top of the tower a little below the middle.
   * When the run is over it pulls back until the whole tower is in the frame,
   * so the last thing you see is what you built.
   */
  const towerTop = state.stack.length * SLAB_H
  const over = state.phase === 'gameover' ? ease((state.overT ?? 0) / 1.3) : 0
  const kFit = Math.min(kPlay, (h * 0.62) / (towerTop + BASE_SIZE * 1.2))
  const k = kPlay + (kFit - kPlay) * over
  const cyPlay = h * 0.7 + state.cameraY * kPlay
  const cyFit = h * 0.62 + (towerTop / 2) * k
  const shake = state.shake * 12 * k
  const v: View = {
    ctx,
    s: state,
    dark,
    w,
    h,
    k,
    cx: w / 2 + (state.shake ? (Math.random() - 0.5) * shake : 0),
    cy: cyPlay + (cyFit - cyPlay) * over + (state.shake ? (Math.random() - 0.5) * shake * 0.7 : 0),
  }

  drawSky(v)

  // A soft pool of shade round the foot of the tower, in a few stacked rings
  // rather than a gradient, for the same reason as the sky.
  const foot = project(v, 0, 0, 0)
  if (foot.y < h + 120 * k) {
    ctx.fillStyle = dark ? 'rgba(0, 0, 0, 0.06)' : 'rgba(26, 43, 60, 0.018)'
    for (const r of [240, 205, 172, 140, 110, 82]) {
      ctx.beginPath()
      ctx.ellipse(foot.x, foot.y + 20 * k, r * k, r * 0.4 * k, 0, 0, TAU)
      ctx.fill()
    }
  }

  // A piece cut off the far side falls behind the tower, one off the near side in front of it.
  const topSlab = state.stack[state.stack.length - 1]
  const behind = (p: FallingPiece) => !!topSlab && p.x + p.z < topSlab.x + topSlab.z
  for (const piece of state.falling) if (behind(piece)) drawFalling(v, piece)

  const base = state.stack[0]
  if (base) drawPedestal(v, base)

  // Only what can be on screen: the camera never looks further down than this.
  const lowest = Math.max(1, Math.floor((v.cy - h - 60 * k) / (SLAB_H * k)))
  const last = state.stack.length - 1
  for (let i = Math.max(1, over > 0 ? 1 : lowest); i <= last; i++) {
    const slab = state.stack[i]!
    drawBlock(v, slabFaces(v, slab, i * SLAB_H), {
      hue: slab.hue,
      flash: i === last ? state.topFlash ?? 0 : 0,
      glow: i === last ? state.grow ?? 0 : 0,
    })
  }

  drawRipples(v)
  drawHeights(v)

  for (const piece of state.falling) if (!behind(piece)) drawFalling(v, piece)

  if (state.phase === 'playing' || state.phase === 'menu') {
    const f = slabFaces(v, state.moving, state.stack.length * SLAB_H)
    drawBlock(v, f, { hue: state.moving.hue })
  }

  drawDust(v)

  for (const f of state.floaters) {
    const p = project(v, f.x, f.y, f.z)
    ctx.globalAlpha = clamp01(Math.min(f.life * 2, f.life * 1.4))
    haloText(ctx, f.text, p.x, p.y, Math.max(16, 22 * k), floaterColour(f.tone, dark))
  }
  ctx.globalAlpha = 1

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.flash * 0.12})`
    ctx.fillRect(0, 0, w, h)
  }
}
