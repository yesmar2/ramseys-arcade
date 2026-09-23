import { PALETTE, type Swatch } from '../../data/games'
import { isDarkTheme, playfieldColor } from '../../lib/theme'
import { drawFish, type FishPaint, type Glow } from './fishArt'
import {
  COMBO_WINDOW,
  DASH_COOLDOWN,
  comboMultiplier,
  fishRadius,
  radiusForLevel,
  type Fish,
  type GameState,
  type Jelly,
  type Mine,
  type Pickup,
} from './game'
import { SPECIES, playerArt, type FishArt } from './species'
import { ZONES, darknessAt, depthMeters, mulberry32, rocksNear, type Rock, type ZoneId } from './world'

/*
 * The ocean, drawn back to front: water that darkens with real depth, the
 * surface and its light, drifting marine snow, rock, hazards, fish (smaller
 * than you first, then you, then anything that can eat you, so threats are
 * never hidden), then the dark of the deep with the glowing things punched
 * back through it, and finally the numbers and the HUD on top.
 */

const FONT = '"Outfit", system-ui, sans-serif'

type RGB = [number, number, number]

function oceanAt(stops: [number, RGB][], depth: number): RGB {
  const d = Math.max(0, depth)
  for (let i = 0; i < stops.length - 1; i++) {
    const [d0, c0] = stops[i]!
    const [d1, c1] = stops[i + 1]!
    if (d <= d1) {
      const t = (d - d0) / (d1 - d0)
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t]
    }
  }
  return stops[stops.length - 1]![1]
}

function css(c: RGB, a = 1) {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`
}

const colorCache = new Map<string, RGB>()

function hslToRgb(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/** Parses the few colour forms used here, for building fade-to-clear gradients. */
function toRgb(color: string): RGB {
  let out = colorCache.get(color)
  if (out) return out
  if (color.startsWith('#')) {
    const n = Number.parseInt(color.slice(1), 16)
    out = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  } else {
    const nums = color.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255]
    out = color.startsWith('hsl')
      ? hslToRgb(nums[0] ?? 0, (nums[1] ?? 0) / 100, (nums[2] ?? 0) / 100)
      : [nums[0] ?? 255, nums[1] ?? 255, nums[2] ?? 255]
  }
  colorCache.set(color, out)
  return out
}

type View = {
  w: number
  h: number
  ppu: number
  cx: number
  cy: number
  halfW: number
  halfH: number
}

function sx(v: View, x: number) {
  return (x - v.cx) * v.ppu + v.w / 2
}

function sy(v: View, y: number) {
  return (y - v.cy) * v.ppu + v.h / 2
}

function onScreen(v: View, x: number, y: number, pad: number) {
  const X = sx(v, x)
  const Y = sy(v, y)
  return X > -pad && X < v.w + pad && Y > -pad && Y < v.h + pad
}

let coarsePointer: boolean | null = null
function isTouch() {
  if (coarsePointer === null) {
    coarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
  }
  return coarsePointer
}

function hashCell(ix: number, iy: number) {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/*
 * Light in the dark.
 *
 * Below the twilight nothing is lit by the sun, and what you see is what makes
 * its own light, the way Pandora's forest is at night: fish glow at the edges
 * and along their bellies, the reef's rim and its growth shine, jellies burn,
 * spores drift up out of the abyss, and the plankton the water is full of
 * flares wherever you swim through it and fades behind you. None of it is in
 * the shallows, which keep the sun; it comes on through the twilight and is
 * full by the midnight zone.
 *
 * All of it is drawn from the depth, the time and fixed noise, never from
 * `Math.random`, so a replayed run looks the same every time.
 */
function biolumeAt(y: number) {
  const t = Math.max(0, Math.min(1, (darknessAt(y) - 0.06) / 0.42))
  return t * t * (3 - 2 * t)
}

/** The colours the water's own life glows in: mostly cyan, some violet and blue, a little pink. */
const PLANKTON = ['#6ff4ff', '#6ff4ff', '#6ff4ff', '#8ef7d4', '#a98bff', '#7fb2ff', '#ff8ad8']

/**
 * Where the player has just been, kept per run so the plankton behind them can
 * still be glowing. Keyed by the run's seed: the home page's cabinet draws its
 * own run through this same renderer.
 */
type Wake = { x: number; y: number; t: number }[]
const wakes = new Map<number, Wake>()
const WAKE_LIFE = 1.5

function wakeFor(s: GameState): Wake {
  let wake = wakes.get(s.seed)
  if (!wake) {
    if (wakes.size > 4) wakes.clear()
    wake = []
    wakes.set(s.seed, wake)
  }
  const p = s.player
  const last = wake[wake.length - 1]
  if (last && (last.t > s.time || s.phase === 'menu')) wake.length = 0
  if (s.phase === 'playing' && (!last || Math.hypot(p.x - last.x, p.y - last.y) > 8 || s.time - last.t > 0.12)) {
    wake.push({ x: p.x, y: p.y, t: s.time })
  }
  while (wake.length && s.time - wake[0]!.t > WAKE_LIFE) wake.shift()
  return wake
}

/**
 * The water's plankton: a field of tiny lights that sits still in the world,
 * each one breathing on its own clock, and flaring as you pass. A second,
 * fainter field further back drifts slower, for depth.
 */
function drawPlankton(ctx: CanvasRenderingContext2D, v: View, s: GameState, lum: number, wake: Wake, glows: Glow[]) {
  if (lum < 0.02) return
  const reach = 70 + radiusForLevel(s.player.level) * 1.6
  // Only lights near the wake need to measure themselves against it.
  const box = wakeBox(wake, reach)
  const layers = [
    { p: 0.6, cell: 95, size: 0.9, alpha: 0.4, reacts: false },
    { p: 1, cell: 70, size: 1.25, alpha: 0.55, reacts: true },
  ]
  // Zoomed out, most of the field is left undrawn, so the screen holds about as
  // many lights as it does up close; which ones go is fixed, so none flicker.
  const keep = Math.min(1, (v.ppu / 0.8) ** 2)
  const dots: Dots = new Map()
  for (const layer of layers) {
    const lcx = v.cx * layer.p
    const lcy = v.cy * layer.p
    const cell = layer.cell
    const x0 = Math.floor((lcx - v.halfW) / cell) - 1
    const x1 = Math.ceil((lcx + v.halfW) / cell) + 1
    const y0 = Math.floor((lcy - v.halfH) / cell) - 1
    const y1 = Math.ceil((lcy + v.halfH) / cell) + 1
    for (let iy = y0; iy <= y1; iy++) {
      for (let ix = x0; ix <= x1; ix++) {
        const h2 = hashCell(ix * 3 - 11, iy * 5 + 23)
        if (h2 > keep) continue
        const h1 = hashCell(ix + 91, iy - 57)
        const drift = s.time * (0.25 + h1 * 0.3) + h2 * 10
        const wx = ix * cell + h1 * cell + Math.sin(drift) * cell * 0.12
        const wy = iy * cell + h2 * cell + Math.cos(drift * 0.8) * cell * 0.1
        const X = (wx - lcx) * v.ppu + v.w / 2
        const Y = (wy - lcy) * v.ppu + v.h / 2
        if (X < -10 || X > v.w + 10 || Y < -10 || Y > v.h + 10) continue
        let lit = 0
        if (layer.reacts && wx > box.x0 && wx < box.x1 && wy > box.y0 && wy < box.y1) {
          for (let i = wake.length - 1; i >= 0; i -= 2) {
            const w = wake[i]!
            const dx = wx - w.x
            const dy = wy - w.y
            if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d < reach) lit = Math.max(lit, (1 - d / reach) * (1 - (s.time - w.t) / WAKE_LIFE))
          }
        }
        const breathe = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.time * (0.5 + h2 * 0.9) + h1 * 40))
        const color = PLANKTON[Math.floor(h1 * 97) % PLANKTON.length]!
        const a = Math.min(1, lum * (layer.alpha * breathe + lit * 1.2))
        if (a < 0.03) continue
        const R = Math.max(0.7, layer.size * Math.min(1.6, Math.max(0.7, v.ppu)) * (1 + lit * 1.4))
        addDot(dots, color, a, X, Y, R)
        if (lit > 0.25) glows.push({ x: X, y: Y, r: R * 7, color, strength: lit * lum * 0.8 })
      }
    }
  }
  fillDots(ctx, dots)
  drawWake(ctx, v, s, lum, wake, glows)
}

/** The ground within `reach` of anywhere the wake has been. */
function wakeBox(wake: Wake, reach: number) {
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const w of wake) {
    x0 = Math.min(x0, w.x)
    x1 = Math.max(x1, w.x)
    y0 = Math.min(y0, w.y)
    y1 = Math.max(y1, w.y)
  }
  return { x0: x0 - reach, x1: x1 + reach, y0: y0 - reach, y1: y1 + reach }
}

/**
 * The trail you leave: the plankton too fine to see until it is disturbed,
 * flaring along your path and fading behind you, the way the forest floor
 * lights under a footstep on Pandora. Only the ground the wake covers is
 * looked at, so a long swim costs no more than a short one.
 */
function drawWake(ctx: CanvasRenderingContext2D, v: View, s: GameState, lum: number, wake: Wake, glows: Glow[]) {
  if (wake.length < 2 || lum < 0.05) return
  const reach = 34 + radiusForLevel(s.player.level) * 0.75
  const cell = Math.max(12, reach / 5)
  const box = wakeBox(wake, reach)
  const x0 = Math.floor(box.x0 / cell)
  const x1 = Math.ceil(box.x1 / cell)
  const y0 = Math.floor(box.y0 / cell)
  const y1 = Math.ceil(box.y1 / cell)
  // The newest stretch, right behind the tail, is too close to the fish to read as wake.
  const fresh = s.time - 0.08
  let lights = 0
  const dots: Dots = new Map()
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      const h1 = hashCell(ix * 13 + 7, iy * 17 - 29)
      const h2 = hashCell(ix - 401, iy + 211)
      const wx = ix * cell + h1 * cell
      const wy = iy * cell + h2 * cell
      let lit = 0
      for (let i = 0; i < wake.length; i++) {
        const w = wake[i]!
        const dx = wx - w.x
        const dy = wy - w.y
        if (dx >= reach || dx <= -reach || dy >= reach || dy <= -reach || w.t > fresh) continue
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d >= reach) continue
        lit = Math.max(lit, (1 - d / reach) * (1 - (s.time - w.t) / WAKE_LIFE))
      }
      if (lit < 0.06) continue
      const X = sx(v, wx)
      const Y = sy(v, wy)
      if (X < -10 || X > v.w + 10 || Y < -10 || Y > v.h + 10) continue
      // Each grain flickers as it settles, and stirs a little in the water.
      const flicker = 0.6 + 0.4 * Math.sin(s.time * 11 + h1 * 60)
      const a = Math.min(1, lum * lit * 1.5 * flicker)
      const color = PLANKTON[Math.floor(h2 * 89) % PLANKTON.length]!
      const R = Math.max(0.8, (0.8 + lit * 1.6) * Math.min(1.5, Math.max(0.7, v.ppu)))
      addDot(dots, color, a, X, Y, R)
      if (lit > 0.4 && lights < 36) {
        glows.push({ x: X, y: Y, r: R * 6, color, strength: a * 0.9 })
        lights++
      }
    }
  }
  fillDots(ctx, dots)
}

/** Spores that drift up out of the abyss, swaying as they rise. */
function drawSpores(ctx: CanvasRenderingContext2D, v: View, s: GameState, lum: number, glows: Glow[]) {
  const deep = Math.max(0, Math.min(1, (darknessAt(v.cy) - 0.4) / 0.3))
  if (deep * lum < 0.02) return
  const cell = 220
  const period = 26
  const x0 = Math.floor((v.cx - v.halfW) / cell) - 1
  const x1 = Math.ceil((v.cx + v.halfW) / cell) + 1
  const y0 = Math.floor((v.cy - v.halfH) / cell) - 1
  const y1 = Math.ceil((v.cy + v.halfH) / cell) + 1
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      const h = hashCell(ix * 7 + 5, iy * 11 - 3)
      if (h > 0.42) continue
      // Each rises a whole cell over its period, then starts again at the bottom.
      const rise = ((s.time / period + h * 13) % 1) * cell
      const wx = ix * cell + hashCell(ix, iy + 70) * cell + Math.sin(s.time * 0.9 + h * 30) * 18
      const wy = iy * cell + cell - rise
      const X = sx(v, wx)
      const Y = sy(v, wy)
      if (X < -20 || X > v.w + 20 || Y < -20 || Y > v.h + 20) continue
      const edge = Math.min(1, rise / (cell * 0.15), (cell - rise) / (cell * 0.15))
      const a = deep * lum * edge * (0.55 + 0.45 * Math.sin(s.time * 3 + h * 50))
      const R = Math.max(1.2, 2.2 * Math.min(1.5, v.ppu))
      const color = h < 0.15 ? '#f6ffd9' : h < 0.3 ? '#b8fff4' : '#e3c6ff'
      ctx.globalAlpha = Math.min(1, a)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(X, Y, R, 0, Math.PI * 2)
      ctx.fill()
      glows.push({ x: X, y: Y, r: R * 6.5, color, strength: a })
    }
  }
  ctx.globalAlpha = 1
}

/**
 * Sun through the surface: slow, soft shafts that fade as the water deepens.
 * They stand in the world a little behind the fish, so swimming sideways
 * slides past them rather than dragging them along.
 */
function drawSunRays(ctx: CanvasRenderingContext2D, v: View, s: GameState, dark: boolean) {
  const surface = sy(v, 0)
  const reach = 950 * v.ppu
  if (surface + reach < 0) return
  const top = Math.max(-20, surface)
  const spacing = 240
  const lcx = v.cx * 0.35
  const k0 = Math.floor((lcx - v.halfW) / spacing) - 2
  const k1 = Math.ceil((lcx + v.halfW) / spacing) + 2
  ctx.save()
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over'
  for (let k = k0; k <= k1; k++) {
    const h = hashCell(k, 404)
    if (h > 0.72) continue
    const phase = s.time * 0.1 + h * 20
    const wx = k * spacing + h * spacing * 0.6 + Math.sin(phase) * 26
    const baseX = (wx - lcx) * v.ppu + v.w / 2
    const width = (26 + 44 * h) * v.ppu * (0.8 + 0.2 * Math.sin(phase * 1.3))
    const slant = 190 * v.ppu
    const strength = (dark ? 0.055 : 0.16) * (0.55 + 0.45 * Math.sin(s.time * 0.33 + h * 31))
    const grad = ctx.createLinearGradient(0, top, 0, surface + reach)
    grad.addColorStop(0, `rgba(214, 250, 255, ${strength})`)
    grad.addColorStop(1, 'rgba(214, 250, 255, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(baseX - width / 2, top)
    ctx.lineTo(baseX + width / 2, top)
    ctx.lineTo(baseX + width * 1.7 + slant, surface + reach)
    ctx.lineTo(baseX - width * 1.7 + slant, surface + reach)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawSnow(ctx: CanvasRenderingContext2D, v: View, s: GameState, color: string, alphaScale: number) {
  const layers = [
    { p: 0.55, cell: 160, size: 1.1, alpha: 0.14 },
    { p: 0.85, cell: 120, size: 1.6, alpha: 0.2 },
  ]
  ctx.fillStyle = color
  for (const layer of layers) {
    const lcx = v.cx * layer.p
    const lcy = v.cy * layer.p
    const cell = layer.cell
    const x0 = Math.floor((lcx - v.halfW) / cell) - 1
    const x1 = Math.ceil((lcx + v.halfW) / cell) + 1
    const y0 = Math.floor((lcy - v.halfH) / cell) - 1
    const y1 = Math.ceil((lcy + v.halfH) / cell) + 1
    const r = Math.max(0.6, layer.size * Math.max(0.6, v.ppu))
    // Flakes are filled together, a path for each of four brightnesses,
    // rather than hundreds of fills a frame.
    const shades: number[][] = [[], [], [], []]
    for (let iy = y0; iy <= y1; iy++) {
      for (let ix = x0; ix <= x1; ix++) {
        const h1 = hashCell(ix, iy)
        const lx = ix * cell + h1 * cell
        const fall = (s.time * (5 + h1 * 6)) % cell
        const ly = iy * cell + hashCell(ix + 31, iy - 17) * cell + fall
        const X = (lx - lcx) * v.ppu + v.w / 2
        const Y = (ly - lcy) * v.ppu + v.h / 2
        if (Y < sy(v, 0)) continue
        shades[Math.min(3, Math.floor(hashCell(ix * 3, iy * 7) * 4))]!.push(X, Y)
      }
    }
    for (let k = 0; k < 4; k++) {
      const flakes = shades[k]!
      if (!flakes.length) continue
      ctx.globalAlpha = layer.alpha * alphaScale * (0.4 + 0.6 * ((k + 0.5) / 4))
      ctx.beginPath()
      for (let i = 0; i < flakes.length; i += 2) {
        ctx.moveTo(flakes[i]! + r, flakes[i + 1]!)
        ctx.arc(flakes[i]!, flakes[i + 1]!, r, 0, Math.PI * 2)
      }
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

const rockShapes = new Map<string, number[]>()

function rockShape(rock: Rock) {
  const key = `${rock.id}:${rock.seed}`
  let shape = rockShapes.get(key)
  if (!shape) {
    const r = mulberry32(rock.seed)
    shape = []
    for (let i = 0; i < 13; i++) shape.push(0.88 + r() * 0.24)
    if (rockShapes.size > 1500) rockShapes.clear()
    rockShapes.set(key, shape)
  }
  return shape
}

function rockPath(ctx: CanvasRenderingContext2D, X: number, Y: number, R: number, shape: number[]) {
  const n = shape.length
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push([X + Math.cos(a) * R * shape[i]!, Y + Math.sin(a) * R * shape[i]! * 0.92])
  }
  ctx.beginPath()
  const last = pts[n - 1]!
  ctx.moveTo((last[0] + pts[0]![0]) / 2, (last[1] + pts[0]![1]) / 2)
  for (let i = 0; i < n; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % n]!
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
  }
  ctx.closePath()
}

type Badge = { x: number; y: number; r: number; level: number; kind: 'food' | 'danger' | 'player' | 'neutral'; alpha: number }

function rollScale(roll: number) {
  return (Math.sign(roll) || 1) * Math.max(0.18, Math.abs(roll))
}

function toLocal(angle: number, roll: number, wx: number, wy: number) {
  const c = Math.cos(-angle)
  const sn = Math.sin(-angle)
  const lx = wx * c - wy * sn
  const ly = wx * sn + wy * c
  return { x: lx, y: ly * (Math.sign(roll) || 1) }
}

function pushGlows(out: Glow[], local: Glow[], X: number, Y: number, angle: number, roll: number, alpha: number) {
  const c = Math.cos(angle)
  const sn = Math.sin(angle)
  const rs = rollScale(roll)
  for (const g of local) {
    const ly = g.y * rs
    out.push({ x: X + c * g.x - sn * ly, y: Y + sn * g.x + c * ly, r: g.r, color: g.color, strength: g.strength * alpha })
  }
}

function fishAmp(f: Fish) {
  switch (f.state) {
    case 'flee':
    case 'lunge':
    case 'strike':
    case 'leave':
      return 1.35
    case 'alert':
    case 'windup':
      return 0.45
    case 'rest':
      return 0.55
    default:
      return 0.85
  }
}

/**
 * How far a fish reaches above its centre on screen — its body, half its
 * dorsal fin, and its tail when it's diving — so its number can sit clear of
 * it instead of over it.
 */
function reachUp(L: number, art: FishArt, angle: number, puff: number) {
  const H = L * art.height * (1 + 0.45 * puff)
  const sin = Math.sin(angle)
  const cos = Math.abs(Math.cos(angle))
  const body = Math.hypot((L / 2) * sin, (H / 2) * cos)
  return body + cos * H * art.dorsalSize * 0.5 + Math.max(0, sin) * H * art.tailSize * 0.8
}

function badgeSize(r: number) {
  return Math.round(Math.max(11, Math.min(24, r * 0.6)))
}

/** Where a fish's number goes: just above the top of the fish. */
function badgeY(Y: number, L: number, art: FishArt, angle: number, puff: number, r: number) {
  return Y - reachUp(L, art, angle, puff) - badgeSize(r) * 0.65 - 2
}

function drawOneFish(
  ctx: CanvasRenderingContext2D,
  v: View,
  s: GameState,
  f: Fish,
  glows: Glow[],
  badges: Badge[],
) {
  const spec = SPECIES[f.species]
  const r = fishRadius(f)
  const L = r * spec.art.length * v.ppu
  const X = sx(v, f.x)
  const Y = sy(v, f.y)
  const p = s.player
  const playing = s.phase !== 'menu'
  const threat = playing && f.level > p.level
  const hunting = threat && (f.state === 'alert' || f.state === 'lunge' || f.state === 'windup' || f.state === 'strike')
  const look = hunting ? toLocal(f.angle, f.roll, p.x - f.x, p.y - f.y) : { x: 1, y: 0.05 }
  const alarm = hunting ? (f.state === 'alert' ? Math.min(1, f.stateTime / 0.25) : 1) : 0
  const leaving = f.state === 'leave' ? Math.max(0, 1 - f.stateTime / 1.2) : 1
  const alpha = f.fade * leaving

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(X, Y)
  ctx.rotate(f.angle)
  ctx.scale(1, rollScale(f.roll))
  const local: Glow[] = []
  drawFish(
    ctx,
    spec.art,
    {
      length: L,
      swim: f.swim,
      amp: fishAmp(f),
      mouth: f.mouth,
      lookX: look.x,
      lookY: look.y,
      alarm,
      puff: f.puff,
      time: s.time,
      biolume: biolumeAt(f.y),
    },
    f.seed,
    local,
    paintFor(spec.art, f.y, darknessAt(f.y) * 0.8, spec.behavior === 'golden' ? 0.5 : 0.3),
  )
  ctx.restore()
  pushGlows(glows, local, X, Y, f.angle, f.roll, alpha)

  if (f.species === 'goldfish') {
    for (let i = 0; i < 3; i++) {
      const a = s.time * 3 + i * 2.1 + f.seed
      glows.push({
        x: X + Math.cos(a) * L * 0.55,
        y: Y + Math.sin(a * 1.3) * L * 0.35,
        r: Math.max(6, L * 0.12),
        color: '#fff2a8',
        strength: 0.8 * alpha,
      })
    }
  }

  if (L >= 8) {
    badges.push({
      x: X,
      y: badgeY(Y, L, spec.art, f.angle, f.puff, r * v.ppu),
      r: r * v.ppu,
      level: f.level,
      kind: !playing ? 'neutral' : threat ? 'danger' : 'food',
      alpha: alpha * (playing && !threat && f.level < p.level * 0.25 ? 0.7 : 1),
    })
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, v: View, s: GameState, glows: Glow[], badges: Badge[], sk: Skin) {
  const p = s.player
  const art: FishArt = playerArt(p.stage)
  const pr = radiusForLevel(p.level)
  const X = sx(v, p.x)
  const Y = sy(v, p.y)
  const L = pr * art.length * v.ppu * (1 + 0.14 * p.gulp)
  let alpha = 1
  let roll = rollScale(p.roll)
  let sink = 0
  if (s.phase === 'dying' || s.phase === 'gameover') {
    const t = s.phase === 'gameover' ? 1 : 1 - s.dying / 1.5
    alpha = Math.max(0, 1 - t * 1.1)
    roll = roll * Math.cos(Math.min(1, t * 1.4) * Math.PI)
    sink = t * 30
    if (alpha <= 0) return
  }
  // Protected (the start, or a popped shield): a soft pulse rather than a
  // ghost, and the number stays solid since it's the first thing you read.
  const pulse = p.invuln > 0 && s.phase === 'playing' ? 0.75 + 0.25 * Math.sin(s.time * 18) : 1

  // Speed streaks while dashing.
  if (p.dash > 0) {
    ctx.save()
    ctx.strokeStyle = css(sk.inkRgb, 0.45)
    ctx.lineWidth = Math.max(1.5, L * 0.03)
    ctx.lineCap = 'round'
    const bx = -Math.cos(p.angle)
    const by = -Math.sin(p.angle)
    for (let i = -2; i <= 2; i++) {
      const ox = -by * i * L * 0.12
      const oy = bx * i * L * 0.12
      const start = L * (0.55 + Math.abs(i) * 0.08)
      ctx.beginPath()
      ctx.moveTo(X + bx * start + ox, Y + by * start + oy)
      ctx.lineTo(X + bx * (start + L * 0.7) + ox, Y + by * (start + L * 0.7) + oy)
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.save()
  ctx.globalAlpha = alpha * pulse
  ctx.translate(X, Y + sink)
  ctx.rotate(p.angle)
  ctx.scale(1, roll)
  const local: Glow[] = []
  drawFish(
    ctx,
    art,
    {
      length: L,
      swim: p.swim,
      amp: p.dash > 0 ? 1.5 : 0.5 + Math.min(1, p.speed / 260) * 0.7,
      mouth: Math.max(p.mouth * 0.85, p.gulp),
      lookX: 1,
      lookY: 0.05,
      alarm: 0,
      puff: 0,
      time: s.time,
      // You light up a touch sooner than the rest, so you are never the one thing unlit.
      biolume: Math.min(1, biolumeAt(p.y) * 1.15),
    },
    7,
    local,
    // The one fish you steer reads brighter than the rest, as Barrage's cannon does.
    paintFor(art, p.y, 0, 0.58),
  )
  ctx.restore()
  pushGlows(glows, local, X, Y + sink, p.angle, p.roll, alpha * pulse)
  if (s.frenzy) glows.push({ x: X, y: Y, r: L * 0.9, color: '#ff7ae6', strength: 0.55 + 0.2 * Math.sin(s.time * 8) })

  if (s.phase === 'playing') {
    if (p.shield) drawShieldOrb(ctx, X, Y, pr * v.ppu * 1.55, 0.95, sk)
    if (p.stun > 0) {
      ctx.save()
      ctx.fillStyle = sk.dark ? '#f5e3ff' : hsla(swatchHue('violet'), 60, 42)
      for (let i = 0; i < 3; i++) {
        const a = s.time * 5 + (i / 3) * Math.PI * 2
        const rx = X + Math.cos(a) * pr * v.ppu * 0.9
        const ry = Y - pr * v.ppu * 0.9 + Math.sin(a) * pr * v.ppu * 0.25
        const sz = Math.max(3, pr * v.ppu * 0.14)
        ctx.beginPath()
        for (let k = 0; k < 8; k++) {
          const ra = (k / 8) * Math.PI * 2
          const rr = k % 2 === 0 ? sz : sz * 0.42
          if (k === 0) ctx.moveTo(rx + Math.cos(ra) * rr, ry + Math.sin(ra) * rr)
          else ctx.lineTo(rx + Math.cos(ra) * rr, ry + Math.sin(ra) * rr)
        }
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }
    if (p.dashCd > 0 && p.dash <= 0) {
      const frac = 1 - p.dashCd / DASH_COOLDOWN
      ctx.save()
      ctx.strokeStyle = css(sk.inkRgb, 0.35)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(X, Y, pr * v.ppu * 1.3 + 6, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }
  badges.push({
    x: X,
    y: badgeY(Y + sink, L, art, p.angle, 0, pr * v.ppu),
    r: pr * v.ppu,
    level: p.level,
    kind: 'player',
    alpha,
  })
}

/** Bubbles are drawn in the ink, so they show on pale water too. */
function drawParticles(ctx: CanvasRenderingContext2D, v: View, s: GameState, glows: Glow[], bubbleInk: RGB) {
  for (const pt of s.particles) {
    const X = sx(v, pt.x)
    const Y = sy(v, pt.y)
    if (X < -20 || X > v.w + 20 || Y < -20 || Y > v.h + 20) continue
    const R = Math.max(0.8, pt.size * v.ppu)
    const a = Math.max(0, Math.min(1, pt.life * 1.4))
    if (pt.kind === 'bubble') {
      ctx.globalAlpha = a * 0.5
      ctx.strokeStyle = css(bubbleInk)
      ctx.lineWidth = Math.max(0.8, R * 0.22)
      ctx.beginPath()
      ctx.arc(X, Y, R, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.globalAlpha = a
      ctx.fillStyle = pt.color
      ctx.beginPath()
      ctx.arc(X, Y, R, 0, Math.PI * 2)
      ctx.fill()
      if (pt.kind === 'spark') glows.push({ x: X, y: Y, r: R * 4, color: pt.color, strength: a * 0.6 })
    }
  }
  ctx.globalAlpha = 1
}

function drawBlasts(ctx: CanvasRenderingContext2D, v: View, s: GameState, glows: Glow[]) {
  for (const b of s.blasts) {
    const X = sx(v, b.x)
    const Y = sy(v, b.y)
    const R = b.r * v.ppu
    const p = 1 - b.life
    ctx.save()
    const core = R * (0.3 + 0.7 * p)
    const grad = ctx.createRadialGradient(X, Y, 0, X, Y, core)
    grad.addColorStop(0, `rgba(255, 250, 225, ${0.95 * b.life})`)
    grad.addColorStop(0.4, `rgba(255, 196, 92, ${0.7 * b.life})`)
    grad.addColorStop(1, 'rgba(255, 110, 50, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(X, Y, core, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * b.life})`
    ctx.lineWidth = Math.max(1, R * 0.08 * b.life)
    ctx.beginPath()
    ctx.arc(X, Y, R * (0.2 + 0.95 * p), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    glows.push({ x: X, y: Y, r: R * 1.3, color: '#ffb347', strength: b.life })
  }
}

function drawDarkness(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
  const dark = darknessAt(v.cy)
  if (dark < 0.04) return
  const focus = s.phase === 'menu' ? { x: v.w / 2, y: v.h / 2 } : { x: sx(v, s.player.x), y: sy(v, s.player.y) }
  const inner = Math.min(v.w, v.h) * (0.6 - dark * 0.26)
  const outer = Math.hypot(v.w, v.h) * 0.62
  const grad = ctx.createRadialGradient(focus.x, focus.y, inner, focus.x, focus.y, outer)
  // A night blue rather than black, so the dark itself has a colour.
  grad.addColorStop(0, 'rgba(3, 5, 20, 0)')
  grad.addColorStop(1, `rgba(3, 5, 20, ${0.8 * dark})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, v.w, v.h)
}

const glowSprites = new Map<string, HTMLCanvasElement>()

/**
 * One soft light, painted once per colour and stamped wherever it's wanted,
 * which is far cheaper than a gradient each. Looked up by the colour as
 * written, so a frame builds no strings to find them.
 */
function glowSprite(color: string) {
  let sprite = glowSprites.get(color)
  if (!sprite) {
    const c = toRgb(color)
    sprite = document.createElement('canvas')
    sprite.width = 64
    sprite.height = 64
    const g = sprite.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, css(c, 0.55))
    grad.addColorStop(0.35, css(c, 0.22))
    grad.addColorStop(1, css(c, 0))
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    if (glowSprites.size > 160) glowSprites.clear()
    glowSprites.set(color, sprite)
  }
  return sprite
}

/** Light added over everything else, up to `cap` of them; ones too faint or small to see are skipped. */
function drawGlows(ctx: CanvasRenderingContext2D, glows: Glow[], boost: number, cap: number) {
  if (!glows.length) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const n = Math.min(glows.length, cap)
  for (let i = 0; i < n; i++) {
    const glow = glows[i]!
    const alpha = Math.min(1, glow.strength * boost)
    if (glow.r < 2 || alpha < 0.03) continue
    ctx.globalAlpha = alpha
    ctx.drawImage(glowSprite(glow.color), glow.x - glow.r, glow.y - glow.r, glow.r * 2, glow.r * 2)
  }
  ctx.restore()
}

/**
 * Dots of light batched by colour and brightness, one fill for each pair
 * instead of one for every dot, since the deep puts hundreds on screen: per
 * colour, the dots at each of six brightness steps, as x, y, r triples.
 */
type Dots = Map<string, number[][]>

function addDot(dots: Dots, color: string, alpha: number, x: number, y: number, r: number) {
  const level = Math.min(6, Math.round(alpha * 6))
  if (level <= 0) return
  let levels = dots.get(color)
  if (!levels) {
    levels = [[], [], [], [], [], [], []]
    dots.set(color, levels)
  }
  levels[level]!.push(x, y, r)
}

function fillDots(ctx: CanvasRenderingContext2D, dots: Dots) {
  for (const [color, levels] of dots) {
    ctx.fillStyle = color
    for (let level = 1; level <= 6; level++) {
      const list = levels[level]!
      if (!list.length) continue
      ctx.globalAlpha = level / 6
      ctx.beginPath()
      for (let i = 0; i < list.length; i += 3) {
        ctx.moveTo(list[i]! + list[i + 2]!, list[i + 1]!)
        ctx.arc(list[i]!, list[i + 1]!, list[i + 2]!, 0, Math.PI * 2)
      }
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

function compact(n: number) {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1e6) return `${Math.round(n / 1000)}k`
  return `${(n / 1e6).toFixed(1)}M`
}

const BADGE_COLORS = {
  food: { fill: '#1f9d57', text: '#ffffff' },
  danger: { fill: '#e23b3b', text: '#ffffff' },
  player: { fill: '#ffffff', text: '#8a2bab' },
  neutral: { fill: 'rgba(8, 20, 36, 0.62)', text: '#ffffff' },
}

function drawBadges(ctx: CanvasRenderingContext2D, badges: Badge[]) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const b of badges) {
    const size = badgeSize(b.r)
    const text = compact(b.level)
    ctx.font = `600 ${size}px ${FONT}`
    const tw = ctx.measureText(text).width
    const w = Math.max(size * 1.25, tw + size * 0.75)
    const h = size * 1.3
    const colors = BADGE_COLORS[b.kind]
    ctx.globalAlpha = b.alpha
    ctx.fillStyle = colors.fill
    ctx.beginPath()
    ctx.roundRect(b.x - w / 2, b.y - h / 2, w, h, h / 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.fillStyle = colors.text
    ctx.fillText(text, b.x, b.y + size * 0.04)
  }
  ctx.globalAlpha = 1
}

function drawAlerts(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
  if (s.phase !== 'playing') return
  const p = s.player
  for (const f of s.fishes) {
    if (f.level <= p.level) continue
    if (f.state !== 'alert' && f.state !== 'windup') continue
    const art = SPECIES[f.species].art
    const r = fishRadius(f) * v.ppu
    const X = sx(v, f.x)
    const pop = Math.min(1, f.stateTime / 0.12)
    const R = 12 * (0.6 + 0.4 * pop) * (1 + 0.08 * Math.sin(s.time * 20))
    // Stacked over the fish's number, which sits just above the fish.
    const Y = badgeY(sy(v, f.y), r * art.length, art, f.angle, f.puff, r) - badgeSize(r) * 0.65 - R - 4
    ctx.fillStyle = '#ff3b30'
    ctx.beginPath()
    ctx.arc(X, Y, R, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 ${Math.round(R * 1.4)}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', X, Y + 1)
  }
}

const GAUGE_MAX = 11000

function gaugeY(top: number, height: number, depth: number) {
  return top + height * Math.sqrt(Math.min(GAUGE_MAX, Math.max(0, depth)) / GAUGE_MAX)
}

// Colour and water ----------------------------------------------------------

/*
 * Drawn the way every other game on the site is drawn: the site's playfield
 * colour for the water, everything in it a soft fill inside a clean outline
 * in one of the palette's ten colours, and text in the site's ink with a halo
 * of the water behind it. Outline and ink lightness follow the water rather
 * than the theme alone, because in the light theme the shallows are pale and
 * the abyss is still black.
 */

/** The hue the other games give anything hostile. */
const HUE_HOT = 348
const INK_ON_DARK: RGB = [231, 238, 243]
const INK_ON_LIGHT: RGB = [26, 43, 60]
/** Water darker than this takes light ink and brighter outlines. */
const INK_FLIP = 0.4

const DEEP_WATER: Record<'dark' | 'light', [number, RGB][]> = {
  dark: [
    [1400, [17, 29, 43]],
    [3600, [14, 20, 38]],
    [7000, [10, 11, 25]],
    [12000, [6, 6, 14]],
  ],
  light: [
    [700, [204, 232, 234]],
    [1400, [150, 199, 212]],
    [3600, [58, 102, 124]],
    [7000, [20, 38, 54]],
    [12000, [8, 16, 26]],
  ],
}

const ROCK_SWATCH: Record<ZoneId, Swatch> = { shallows: 'teal', twilight: 'sky', midnight: 'indigo', abyss: 'violet' }
const CORAL_SWATCHES: Swatch[] = ['pink', 'orange', 'violet', 'amber', 'teal']
const CRYSTAL_MIDNIGHT: Swatch[] = ['sky', 'violet']
const CRYSTAL_ABYSS: Swatch[] = ['teal', 'pink', 'violet']

type Skin = {
  water: RGB
  /** Dark water: light ink, brighter outlines. */
  dark: boolean
  ink: string
  inkRgb: RGB
  /** Outline lightness, %. */
  lineL: number
  /** Lightness of the small marks drawn inside a shape, %. */
  markL: number
}

function hsla(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function luminance(c: RGB) {
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
}

const swatchHues = new Map<Swatch, number>()

/** A palette colour's hue, so every outline and fill stays inside the site's ten colours. */
function swatchHue(swatch: Swatch) {
  let hue = swatchHues.get(swatch)
  if (hue === undefined) {
    hue = Math.round(rgbToHsl(toRgb(PALETTE[swatch]))[0])
    swatchHues.set(swatch, hue)
  }
  return hue
}

let waterKey = ''
let water: [number, RGB][] = []
const paintCache = new Map<string, FishPaint>()

/** Water by depth: the site's own playfield at the surface, darkening from there. */
function waterStops() {
  const field = playfieldColor()
  const dark = isDarkTheme()
  const key = `${field}|${dark}`
  if (key !== waterKey) {
    waterKey = key
    const surface = mixRgb(toRgb(field), toRgb(PALETTE.teal), dark ? 0.08 : 0.06)
    water = [[0, surface], ...DEEP_WATER[dark ? 'dark' : 'light']]
    paintCache.clear()
  }
  return water
}

function skinAt(depth: number): Skin {
  const at = oceanAt(waterStops(), depth)
  const dark = luminance(at) < INK_FLIP
  const inkRgb = dark ? INK_ON_DARK : INK_ON_LIGHT
  return { water: at, dark, ink: css(inkRgb), inkRgb, lineL: dark ? 64 : 42, markL: dark ? 86 : 30 }
}

/**
 * A fish's colours: its palette colour as a soft fill, mixed over the
 * water it swims in so it still hides what's behind it; the same colour for
 * the outline; marks light or dark as the fish is known by them.
 */
function paintFor(art: FishArt, depth: number, tint: number, fill: number): FishPaint {
  const stops = waterStops()
  const band = Math.round(Math.max(0, depth) / 250)
  const dim = Math.round(tint * 6)
  const key = `${art.swatch}|${art.tailSwatch ?? ''}|${art.pattern}|${band}|${dim}|${fill}`
  const cached = paintCache.get(key)
  if (cached) return cached
  const under = oceanAt(stops, band * 250)
  const dark = luminance(under) < INK_FLIP
  const hue = swatchHue(art.swatch)
  const tailHue = art.tailSwatch ? swatchHue(art.tailSwatch) : hue
  const lineL = dark ? 64 : 42
  const lineA = 0.95 - dim * 0.05
  const soft = (h: number, amount: number) => css(mixRgb(under, hslToRgb(h, 0.64, 0.58), amount))
  const line = hsla(hue, 64, lineL, lineA)
  const fin = soft(hue, fill * 0.62)
  const lightMarks = art.pattern === 'bands' || art.pattern === 'lateral'
  const made: FishPaint = {
    body: soft(hue, fill),
    fin,
    tail: art.tailSwatch ? soft(tailHue, Math.min(0.9, fill * 2)) : fin,
    line,
    tailLine: hsla(tailHue, 64, lineL, lineA),
    pattern: lightMarks ? hsla(hue, 60, dark ? 88 : 97, 0.95) : line,
    eye: dark ? '#f4f8fa' : '#ffffff',
    pupil: '#16202a',
    mouth: '#16202a',
    teeth: '#f4f8fa',
    glow: hsla(hue, 92, 74),
  }
  if (paintCache.size > 800) paintCache.clear()
  paintCache.set(key, made)
  return made
}

function drawOcean(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
  const stops = waterStops()
  const surfaceY = sy(v, 0)
  const amp = 5 * v.ppu
  const top = Math.max(0, surfaceY - amp * 2)
  if (top < v.h) {
    const grad = ctx.createLinearGradient(0, top, 0, v.h)
    for (let i = 0; i <= 4; i++) {
      const yScreen = top + ((v.h - top) * i) / 4
      const depth = (yScreen - v.h / 2) / v.ppu + v.cy
      grad.addColorStop(i / 4, css(oceanAt(stops, depth)))
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, top, v.w, v.h - top)
  }
  if (surfaceY <= -amp * 2) return

  // Above the surface is just the site.
  const waveY = (X: number) => {
    const wx = (X - v.w / 2) / v.ppu + v.cx
    return surfaceY + (Math.sin(wx * 0.012 + s.time * 1.4) * 3.2 + Math.sin(wx * 0.031 - s.time * 2.1) * 1.8) * v.ppu
  }
  ctx.fillStyle = playfieldColor()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(v.w, 0)
  for (let X = v.w; X >= -12; X -= 12) ctx.lineTo(X, waveY(X))
  ctx.closePath()
  ctx.fill()

  // The surface is an edge, and edges here are outlines.
  const teal = swatchHue('teal')
  const dark = luminance(stops[0]![1]) < INK_FLIP
  const glowTop = Math.max(0, surfaceY)
  const band = ctx.createLinearGradient(0, glowTop, 0, glowTop + 70 * v.ppu)
  band.addColorStop(0, hsla(teal, 64, 58, dark ? 0.16 : 0.2))
  band.addColorStop(1, hsla(teal, 64, 58, 0))
  ctx.fillStyle = band
  ctx.fillRect(0, glowTop, v.w, 70 * v.ppu)
  ctx.strokeStyle = hsla(teal, 64, dark ? 64 : 42, 0.95)
  ctx.lineWidth = Math.max(1.5, 1.4 * v.ppu)
  ctx.lineJoin = 'round'
  ctx.beginPath()
  for (let X = 0; X <= v.w + 12; X += 12) {
    if (X === 0) ctx.moveTo(X, waveY(X))
    else ctx.lineTo(X, waveY(X))
  }
  ctx.stroke()
}

function drawRock(ctx: CanvasRenderingContext2D, v: View, rock: Rock, time: number, glows: Glow[], ambient: Glow[]) {
  const X = sx(v, rock.x)
  const Y = sy(v, rock.y)
  const R = rock.r * v.ppu
  const shape = rockShape(rock)
  const rand = mulberry32(rock.seed ^ 0x5bd1e995)
  const under = oceanAt(waterStops(), rock.y)
  const lineL = luminance(under) < INK_FLIP ? 64 : 42
  const hue = swatchHue(ROCK_SWATCH[rock.zone])
  const lw = Math.min(3, Math.max(1.5, R * 0.035))
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Weed stands behind the rock's top edge.
  if (rock.main && (rock.zone === 'shallows' || rock.zone === 'twilight')) {
    const strands = rock.zone === 'shallows' ? 3 : 2
    ctx.strokeStyle = hsla(swatchHue('green'), 46, lineL, 0.7)
    ctx.lineWidth = Math.min(3, Math.max(1.4, R * 0.04))
    for (let i = 0; i < strands; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 1.6
      const bx = X + Math.cos(a) * R * 0.8
      const by = Y + Math.sin(a) * R * 0.78
      const len = R * (0.55 + rand() * 0.5)
      const sway = Math.sin(time * 0.9 + rock.seed * 0.001 + i) * len * 0.25
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.bezierCurveTo(bx + sway * 0.4, by - len * 0.35, bx - sway * 0.6, by - len * 0.7, bx + sway, by - len)
      ctx.stroke()
    }
  }

  rockPath(ctx, X, Y, R, shape)
  // Deep rock is a dark shape for its own light to show against, not a pale one.
  ctx.fillStyle = css(mixRgb(under, hslToRgb(hue, 0.22, 0.58), 0.26 * (1 - biolumeAt(rock.y) * 0.65)))
  ctx.fill()
  ctx.strokeStyle = hsla(hue, 30, lineL, 0.9)
  ctx.lineWidth = lw
  ctx.stroke()

  // Texture is a few pebbles and a lit edge, in outline only.
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = hsla(hue, 30, lineL, 0.28)
  ctx.lineWidth = Math.max(1, lw * 0.6)
  for (let i = 0; i < 4; i++) {
    const a = rand() * Math.PI * 2
    const d = rand() * R * 0.6
    ctx.beginPath()
    ctx.ellipse(X + Math.cos(a) * d, Y + Math.sin(a) * d, R * (0.07 + rand() * 0.08), R * (0.05 + rand() * 0.05), rand() * Math.PI, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.strokeStyle = hsla(hue, 30, lineL, 0.45)
  ctx.beginPath()
  ctx.arc(X, Y + R * 0.08, R * 0.8, Math.PI * 1.18, Math.PI * 1.5)
  ctx.stroke()
  ctx.restore()

  if (rock.main && rock.zone === 'shallows') {
    const pieces = 3 + Math.floor(rand() * 3)
    for (let i = 0; i < pieces; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.2
      const px = X + Math.cos(a) * R * 0.86
      const py = Y + Math.sin(a) * R * 0.82
      const size = R * (0.12 + rand() * 0.12)
      const h = swatchHue(CORAL_SWATCHES[Math.floor(rand() * CORAL_SWATCHES.length)]!)
      ctx.strokeStyle = hsla(h, 64, lineL, 0.95)
      ctx.fillStyle = hsla(h, 64, 58, 0.3)
      ctx.lineWidth = Math.min(3, Math.max(1.3, size * 0.16))
      if (rand() < 0.5) {
        // Branching coral: three stems, a bead on each tip.
        const lean = Math.sin(time * 0.7 + i + rock.seed * 0.0001) * size * 0.08
        ctx.beginPath()
        for (let k = -1; k <= 1; k++) {
          ctx.moveTo(px, py)
          ctx.lineTo(px + k * size * 0.45 + lean, py - size * (0.8 - Math.abs(k) * 0.15))
        }
        ctx.stroke()
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath()
          ctx.arc(px + k * size * 0.45 + lean, py - size * (0.8 - Math.abs(k) * 0.15), Math.max(1.5, size * 0.14), 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      } else {
        // A dome of brain coral.
        ctx.beginPath()
        ctx.arc(px, py, size * 0.55, Math.PI, 0)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(px, py, size * 0.3, Math.PI * 1.15, Math.PI * 1.85)
        ctx.stroke()
      }
    }
  } else if (rock.main && rock.zone === 'twilight') {
    // Tube sponges.
    const h = swatchHue('orange')
    ctx.strokeStyle = hsla(h, 58, lineL, 0.9)
    ctx.fillStyle = hsla(h, 58, 58, 0.26)
    for (let i = 0; i < 2; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 1.6
      const px = X + Math.cos(a) * R * 0.84
      const py = Y + Math.sin(a) * R * 0.8
      const size = R * (0.14 + rand() * 0.1)
      ctx.lineWidth = Math.min(2.6, Math.max(1.2, size * 0.12))
      ctx.beginPath()
      ctx.roundRect(px - size * 0.22, py - size, size * 0.44, size, size * 0.2)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(px, py - size, size * 0.14, size * 0.06, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (rock.main) {
    // Crystals: the only light down here that isn't alive.
    const pieces = rock.zone === 'abyss' ? 3 : 2
    const tones = rock.zone === 'abyss' ? CRYSTAL_ABYSS : CRYSTAL_MIDNIGHT
    for (let i = 0; i < pieces; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2
      const px = X + Math.cos(a) * R * 0.84
      const py = Y + Math.sin(a) * R * 0.8
      const size = R * (0.12 + rand() * 0.14)
      const swatch = tones[Math.floor(rand() * tones.length)]!
      const h = swatchHue(swatch)
      ctx.fillStyle = hsla(h, 70, 58, 0.32)
      ctx.strokeStyle = hsla(h, 70, lineL, 0.95)
      ctx.lineWidth = Math.min(2.6, Math.max(1.2, size * 0.1))
      ctx.beginPath()
      ctx.moveTo(px - size * 0.18, py)
      ctx.lineTo(px + (rand() - 0.5) * size * 0.3, py - size)
      ctx.lineTo(px + size * 0.18, py)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      const pulse = 0.6 + 0.4 * Math.sin(time * 1.6 + i + rock.seed * 0.0003)
      glows.push({ x: px, y: py - size * 0.5, r: size * 2.2, color: PALETTE[swatch], strength: 0.5 * pulse })
    }
  }
  drawReefLight(ctx, rock, X, Y, R, shape, lw, time, ambient)
  ctx.restore()
}

/** The glowing growth on a deep reef: cyan and mint in the midnight zone, violet and pink below. */
const MOSS_MIDNIGHT = ['#6ff4ff', '#8ef7d4', '#7fb2ff']
const MOSS_ABYSS = ['#ff8ad8', '#c7a4ff', '#6ff4ff']

/**
 * A reef in the dark, lit by what grows on it: its rim glowing, patches of
 * moss breathing light on its face, and on the big rock of a formation, a few
 * anemones whose bulbs pulse, with a curled frond or two in the abyss like the
 * spiral plants of Pandora's forest floor. Its own random stream, so the reef's
 * shape and its coral are exactly what they were.
 */
function drawReefLight(
  ctx: CanvasRenderingContext2D,
  rock: Rock,
  X: number,
  Y: number,
  R: number,
  shape: number[],
  lw: number,
  time: number,
  glows: Glow[],
) {
  const lum = biolumeAt(rock.y)
  if (lum < 0.03) return
  const g = mulberry32(rock.seed ^ 0x3c6ef372)
  const abyss = rock.zone === 'abyss'
  const moss = abyss ? MOSS_ABYSS : MOSS_MIDNIGHT
  const rimHue = swatchHue(abyss ? 'violet' : rock.zone === 'midnight' ? 'sky' : 'teal')

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  rockPath(ctx, X, Y, R, shape)
  ctx.strokeStyle = hsla(rimHue, 90, 70, 0.12 * lum)
  ctx.lineWidth = lw * 4.5
  ctx.stroke()
  ctx.strokeStyle = hsla(rimHue, 90, 76, 0.28 * lum)
  ctx.lineWidth = lw * 1.4
  ctx.stroke()
  ctx.restore()

  // Moss, in patches over the face: a few specks to a patch, never more than a
  // few pixels each, so a boulder is speckled with light rather than spotted.
  const patches = rock.main ? 8 : 3
  for (let i = 0; i < patches; i++) {
    const a = g() * Math.PI * 2
    const d = Math.sqrt(g()) * R * 0.72
    const px = X + Math.cos(a) * d
    const py = Y + Math.sin(a) * d * 0.9
    const color = moss[Math.floor(g() * moss.length)]!
    const pulse = 0.5 + 0.5 * Math.sin(time * (0.7 + g() * 0.8) + i * 2.3)
    const specks = 2 + Math.floor(g() * 3)
    const spread = Math.min(14, Math.max(4, R * 0.05))
    ctx.fillStyle = color
    ctx.globalAlpha = Math.min(1, lum * (0.45 + 0.55 * pulse))
    ctx.beginPath()
    for (let k = 0; k < specks; k++) {
      const r = Math.min(3.2, Math.max(0.9, R * (0.006 + g() * 0.008)))
      const mx = px + (g() - 0.5) * spread
      const my = py + (g() - 0.5) * spread
      ctx.moveTo(mx + r, my)
      ctx.arc(mx, my, r, 0, Math.PI * 2)
    }
    ctx.fill()
    // Every other patch on a big rock gets a halo; the small ones glow by their rim alone.
    if (rock.main && i % 2 === 0) glows.push({ x: px, y: py, r: spread * 1.8, color, strength: 0.5 * lum * pulse })
  }
  ctx.globalAlpha = 1

  if (!rock.main || (rock.zone !== 'midnight' && !abyss)) return

  // Anemones along the top: a stalk swaying, a bulb pulsing at its tip.
  const stalks = 3 + Math.floor(g() * 3)
  ctx.lineCap = 'round'
  for (let i = 0; i < stalks; i++) {
    const a = -Math.PI / 2 + (g() - 0.5) * 1.9
    const bx = X + Math.cos(a) * R * 0.86
    const by = Y + Math.sin(a) * R * 0.82
    const len = R * (0.16 + g() * 0.2)
    const sway = Math.sin(time * 1.1 + i * 1.7 + rock.seed * 0.0007) * len * 0.22
    const tx = bx + Math.cos(a) * len * 0.35 + sway
    const ty = by - len
    const color = moss[Math.floor(g() * moss.length)]!
    const pulse = 0.5 + 0.5 * Math.sin(time * 2 + i * 1.3 + g() * 6)
    ctx.globalAlpha = 0.55 * lum
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1.1, len * 0.07)
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.quadraticCurveTo(bx + sway * 0.2, by - len * 0.6, tx, ty)
    ctx.stroke()
    const bulb = Math.max(1.8, len * 0.13)
    ctx.globalAlpha = Math.min(1, lum * (0.6 + 0.4 * pulse))
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(tx, ty, bulb, 0, Math.PI * 2)
    ctx.fill()
    glows.push({ x: tx, y: ty, r: bulb * 7, color, strength: (0.5 + 0.45 * pulse) * lum })
  }

  if (abyss) {
    // A frond curled into a spiral, glowing along its curl.
    const fronds = 1 + Math.floor(g() * 2)
    for (let i = 0; i < fronds; i++) {
      const a = -Math.PI / 2 + (g() - 0.5) * 1.4
      const bx = X + Math.cos(a) * R * 0.84
      const by = Y + Math.sin(a) * R * 0.8
      const size = R * (0.16 + g() * 0.1)
      const color = moss[Math.floor(g() * moss.length)]!
      const lean = Math.sin(time * 0.6 + i * 2 + rock.seed * 0.0005) * size * 0.1
      const cx = bx + lean
      const cy = by - size * 1.25
      ctx.globalAlpha = 0.65 * lum
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(1.2, size * 0.08)
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.quadraticCurveTo(bx - size * 0.15, by - size * 0.6, cx + size * 0.5, cy)
      for (let k = 0; k <= 26; k++) {
        const t = k / 26
        const ang = t * Math.PI * 3.2
        const rr = size * 0.5 * (1 - t * 0.85)
        ctx.lineTo(cx + Math.cos(ang) * rr, cy - Math.sin(ang) * rr)
      }
      ctx.stroke()
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.4 + i * 2.7)
      glows.push({ x: cx, y: cy, r: size * 1.6, color, strength: (0.45 + 0.35 * pulse) * lum })
    }
  }
  ctx.globalAlpha = 1
}

function drawJelly(ctx: CanvasRenderingContext2D, v: View, j: Jelly, time: number, glows: Glow[], deep: number) {
  const X = sx(v, j.x)
  const Y = sy(v, j.y)
  const R = j.r * v.ppu
  const beat = Math.sin(j.phase)
  const rx = R * (1 - 0.08 * beat)
  const ry = R * 0.82 * (1 + 0.12 * beat)
  const dark = luminance(oceanAt(waterStops(), j.y)) < INK_FLIP
  const lineL = dark ? 64 : 42
  ctx.save()
  ctx.globalAlpha = j.fade
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.strokeStyle = hsla(j.hue, 70, lineL, 0.45)
  ctx.lineWidth = Math.max(1, R * 0.045)
  for (let i = 0; i < 7; i++) {
    const t0 = (i / 6 - 0.5) * 1.6
    const bx = X + t0 * rx * 0.8
    ctx.beginPath()
    ctx.moveTo(bx, Y)
    const len = R * (2.1 + (i % 3) * 0.35)
    for (let k = 1; k <= 6; k++) {
      const t = k / 6
      const wave = Math.sin(time * 2.4 + i * 1.3 + t * 5) * R * 0.16 * t
      ctx.lineTo(bx + wave, Y + len * t)
    }
    ctx.stroke()
  }
  ctx.strokeStyle = hsla(j.hue, 70, lineL, 0.75)
  ctx.lineWidth = Math.max(1.3, R * 0.09)
  for (let i = 0; i < 3; i++) {
    const bx = X + (i - 1) * rx * 0.25
    ctx.beginPath()
    ctx.moveTo(bx, Y)
    for (let k = 1; k <= 5; k++) {
      const t = k / 5
      ctx.lineTo(bx + Math.sin(time * 2 + i * 2 + t * 6) * R * 0.1, Y + R * 1.25 * t)
    }
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.moveTo(X - rx, Y)
  ctx.ellipse(X, Y, rx, ry, 0, Math.PI, 0)
  for (let k = 0; k < 5; k++) {
    const x1 = X + rx - ((k + 0.5) / 5) * rx * 2
    const x2 = X + rx - ((k + 1) / 5) * rx * 2
    ctx.quadraticCurveTo(x1, Y + R * 0.14, x2, Y)
  }
  ctx.closePath()
  ctx.fillStyle = hsla(j.hue, 70, 58, 0.24)
  ctx.fill()
  ctx.strokeStyle = hsla(j.hue, 70, lineL, 0.95)
  ctx.lineWidth = Math.min(3, Math.max(1.3, R * 0.07))
  ctx.stroke()

  ctx.strokeStyle = hsla(j.hue, 60, dark ? 86 : 30, 0.55)
  ctx.lineWidth = Math.max(1, R * 0.05)
  for (let i = 0; i < 4; i++) {
    const a = Math.PI + ((i + 0.5) / 4) * Math.PI
    ctx.beginPath()
    ctx.arc(X + Math.cos(a) * rx * 0.42, Y - ry * 0.25 + Math.sin(a) * ry * 0.2, R * 0.11, 0, Math.PI * 2)
    ctx.stroke()
  }

  // In the dark the bell's edge burns, and the long tentacles end in points of light.
  const lum = biolumeAt(j.y)
  if (lum > 0.02) {
    const light = hsla(j.hue, 92, 76)
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = j.fade * 0.32 * lum
    ctx.strokeStyle = light
    ctx.lineWidth = Math.max(2.5, R * 0.22)
    ctx.beginPath()
    ctx.ellipse(X, Y, rx, ry, 0, Math.PI, 0)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
    for (let i = 0; i < 7; i++) {
      const t0 = (i / 6 - 0.5) * 1.6
      const len = R * (2.1 + (i % 3) * 0.35)
      const tx = X + t0 * rx * 0.8 + Math.sin(time * 2.4 + i * 1.3 + 5) * R * 0.16
      const ty = Y + len
      const pulse = 0.5 + 0.5 * Math.sin(time * 3 + i * 1.9)
      glows.push({ x: tx, y: ty, r: R * 0.55, color: light, strength: (0.35 + 0.35 * pulse) * lum * j.fade })
    }
  }
  ctx.restore()
  glows.push({ x: X, y: Y - ry * 0.2, r: R * 2.4, color: `hsl(${j.hue}, 85%, 72%)`, strength: (0.25 + 0.6 * deep + 0.3 * lum) * j.fade })
}

function drawMine(ctx: CanvasRenderingContext2D, v: View, m: Mine, time: number, glows: Glow[]) {
  const X = sx(v, m.x)
  const Y = sy(v, m.y + Math.sin(m.bob * 1.3) * m.r * 0.15)
  const R = m.r * v.ppu
  const under = oceanAt(waterStops(), m.y)
  const dark = luminance(under) < INK_FLIP
  const ink = dark ? INK_ON_DARK : INK_ON_LIGHT
  const line = hsla(HUE_HOT, 64, dark ? 64 : 42, 0.95)
  ctx.save()
  ctx.globalAlpha = m.fade
  ctx.lineCap = 'round'

  // Chain, into the dark.
  ctx.lineWidth = Math.max(1, R * 0.08)
  for (let i = 0; i < 9; i++) {
    const ly = Y + R * 1.05 + i * R * 0.42
    ctx.strokeStyle = css(ink, 0.3 * (1 - i / 9))
    ctx.beginPath()
    if (i % 2 === 0) ctx.ellipse(X, ly, R * 0.1, R * 0.2, 0, 0, Math.PI * 2)
    else ctx.ellipse(X, ly, R * 0.05, R * 0.2, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.strokeStyle = line
  ctx.lineWidth = Math.min(3.5, Math.max(1.5, R * 0.16))
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    ctx.beginPath()
    ctx.moveTo(X + Math.cos(a) * R * 0.8, Y + Math.sin(a) * R * 0.8)
    ctx.lineTo(X + Math.cos(a) * R * 1.3, Y + Math.sin(a) * R * 1.3)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(X, Y, R, 0, Math.PI * 2)
  ctx.fillStyle = css(mixRgb(under, hslToRgb(HUE_HOT, 0.64, 0.58), 0.28))
  ctx.fill()
  ctx.lineWidth = Math.min(3, Math.max(1.5, R * 0.1))
  ctx.stroke()
  ctx.strokeStyle = hsla(HUE_HOT, 64, dark ? 64 : 42, 0.35)
  ctx.lineWidth = Math.max(1, R * 0.06)
  ctx.beginPath()
  ctx.ellipse(X, Y, R * 0.98, R * 0.3, 0, 0, Math.PI * 2)
  ctx.stroke()

  const armed = m.fuse >= 0
  const rate = armed ? 10 : 0.9
  const on = armed ? Math.sin(time * rate * Math.PI * 2) > 0 : (time * rate) % 1 < 0.14
  ctx.fillStyle = on ? hsla(HUE_HOT, 90, 62) : hsla(HUE_HOT, 40, dark ? 30 : 72)
  ctx.beginPath()
  ctx.arc(X, Y - R * 0.45, R * 0.17, 0, Math.PI * 2)
  ctx.fill()
  if (on) glows.push({ x: X, y: Y - R * 0.45, r: R * (armed ? 2.4 : 1.4), color: '#ff4d6d', strength: armed ? 0.9 : 0.55 })

  if (armed) {
    // The blast radius, dashed like Barrage's hold line.
    const blast = m.r * 5.2 * v.ppu
    ctx.globalAlpha = m.fade * (0.45 + 0.25 * Math.sin(time * 20))
    ctx.strokeStyle = hsla(HUE_HOT, 74, dark ? 62 : 48)
    ctx.lineWidth = 2
    ctx.lineCap = 'butt'
    ctx.setLineDash([8, 7])
    ctx.beginPath()
    ctx.arc(X, Y, blast, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = m.fade * 0.08
    ctx.fillStyle = hsla(HUE_HOT, 74, 58)
    ctx.fill()
  }
  ctx.restore()
}

function drawShieldOrb(ctx: CanvasRenderingContext2D, X: number, Y: number, R: number, alpha: number, sk: Skin) {
  const hue = swatchHue('teal')
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.arc(X, Y, R, 0, Math.PI * 2)
  ctx.fillStyle = hsla(hue, 70, 58, 0.14)
  ctx.fill()
  ctx.strokeStyle = hsla(hue, 70, sk.lineL, 0.9)
  ctx.lineWidth = Math.min(3, Math.max(1.3, R * 0.06))
  ctx.stroke()
  ctx.strokeStyle = hsla(hue, 60, sk.markL, 0.8)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(X, Y, R * 0.72, Math.PI * 1.1, Math.PI * 1.45)
  ctx.stroke()
  ctx.restore()
}

function drawPickup(ctx: CanvasRenderingContext2D, v: View, pk: Pickup, glows: Glow[], sk: Skin) {
  const X = sx(v, pk.x)
  const Y = sy(v, pk.y + Math.sin(pk.bob * 2) * pk.r * 0.3)
  const R = pk.r * v.ppu * (1 + 0.06 * Math.sin(pk.bob * 4))
  const alpha = Math.min(1, pk.life / 3)
  const hue = swatchHue('teal')
  drawShieldOrb(ctx, X, Y, R, alpha, sk)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = hsla(hue, 70, 58, 0.3)
  ctx.strokeStyle = hsla(hue, 70, sk.lineL, 0.95)
  ctx.lineWidth = Math.min(2.4, Math.max(1.2, R * 0.07))
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(X, Y - R * 0.42)
  ctx.lineTo(X + R * 0.34, Y - R * 0.26)
  ctx.lineTo(X + R * 0.28, Y + R * 0.14)
  ctx.lineTo(X, Y + R * 0.4)
  ctx.lineTo(X - R * 0.28, Y + R * 0.14)
  ctx.lineTo(X - R * 0.34, Y - R * 0.26)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
  glows.push({ x: X, y: Y, r: R * 2.2, color: PALETTE.teal, strength: 0.4 * alpha })
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [h * 60, s, l]
}

/** A colour picked for dark water, taken down to a deep shade of itself when the water is pale. */
function textColor(color: string, sk: Skin) {
  if (color === '#ffffff') return sk.ink
  if (sk.dark) return color
  const [h, s] = rgbToHsl(toRgb(color))
  return hsla(Math.round(h), Math.round(s * 85), 34)
}

/**
 * Text stands on a halo, as the other games' floaters do: deeper than the
 * water when it's dark, paler when it's light, with an edge of the same so it
 * still reads where it crosses a fish.
 */
function halo(ctx: CanvasRenderingContext2D, sk: Skin, size: number) {
  const color = css(mixRgb(sk.water, sk.dark ? [0, 0, 0] : [255, 255, 255], 0.45), 0.95)
  ctx.shadowColor = color
  ctx.shadowBlur = Math.max(6, size * 0.4)
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(3, size * 0.18)
  ctx.lineJoin = 'round'
}

function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
}

function drawFloaters(ctx: CanvasRenderingContext2D, v: View, s: GameState, sk: Skin) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of s.floaters) {
    const X = sx(v, f.x)
    const Y = sy(v, f.y)
    const alpha = f.life > 0.45 ? 1 : Math.max(0, f.life / 0.45)
    const age = 1 - f.life
    const pop = age < 0.12 ? 1 + (0.12 - age) * 3 : 1
    const size = Math.min(v.h * 0.075, (21 + 13 * f.weight) * pop)
    ctx.globalAlpha = alpha
    ctx.font = `600 ${Math.round(size)}px ${FONT}`
    halo(ctx, sk, size)
    ctx.fillStyle = textColor(f.color, sk)
    haloText(ctx, f.text, X, Y)
    if (f.sub) {
      const sub = Math.round(size * 0.66)
      ctx.font = `600 ${sub}px ${FONT}`
      halo(ctx, sk, sub)
      ctx.fillStyle = f.sub.startsWith('Lv') ? (sk.dark ? '#6ff2a6' : '#16895a') : sk.ink
      haloText(ctx, f.sub, X, Y + size * 0.82)
    }
  }
  ctx.restore()
}

function drawDanger(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
  if (s.phase !== 'playing' || s.danger < 0.03) return
  const a = s.danger * (0.24 + 0.1 * Math.sin(s.time * 9))
  const grad = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.36, v.w / 2, v.h / 2, Math.hypot(v.w, v.h) * 0.6)
  grad.addColorStop(0, hsla(HUE_HOT, 80, 55, 0))
  grad.addColorStop(1, hsla(HUE_HOT, 80, 55, a))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, v.w, v.h)
}

function drawIndicators(ctx: CanvasRenderingContext2D, v: View, s: GameState, sk: Skin) {
  if (s.phase !== 'playing') return
  const p = s.player
  const margin = 30
  const diag = Math.hypot(v.halfW, v.halfH)
  for (const f of s.fishes) {
    const golden = f.species === 'goldfish' && f.state !== 'leave'
    let threat = false
    if (f.level > p.level) {
      if (f.state === 'alert' || f.state === 'lunge' || f.state === 'windup' || f.state === 'strike') threat = true
      else if (SPECIES[f.species].behavior === 'patroller') {
        const d = Math.hypot(p.x - f.x, p.y - f.y)
        const toward = ((p.x - f.x) * Math.cos(f.angle) + (p.y - f.y) * Math.sin(f.angle)) / Math.max(d, 1e-3)
        threat = d < diag * 1.5 && toward > 0.75
      }
    }
    if (!threat && !golden) continue
    const X = sx(v, f.x)
    const Y = sy(v, f.y)
    if (X > 0 && X < v.w && Y > 0 && Y < v.h) continue
    const dx = X - v.w / 2
    const dy = Y - v.h / 2
    const t = Math.min((v.w / 2 - margin) / Math.max(1e-3, Math.abs(dx)), (v.h / 2 - margin) / Math.max(1e-3, Math.abs(dy)))
    const size = golden ? 13 : 15
    ctx.save()
    ctx.translate(v.w / 2 + dx * t, v.h / 2 + dy * t)
    ctx.rotate(Math.atan2(dy, dx))
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(s.time * 10)
    ctx.fillStyle = golden ? PALETTE.amber : hsla(HUE_HOT, 80, 58)
    ctx.strokeStyle = css(sk.water, 0.85)
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(size, 0)
    ctx.lineTo(-size * 0.7, -size * 0.8)
    ctx.lineTo(-size * 0.3, 0)
    ctx.lineTo(-size * 0.7, size * 0.8)
    ctx.closePath()
    ctx.stroke()
    ctx.fill()
    ctx.restore()
  }
}

function drawCombo(ctx: CanvasRenderingContext2D, v: View, s: GameState, sk: Skin) {
  if (s.phase !== 'playing' || s.combo < 2) return
  const y = 86
  const hue = (s.time * 220) % 360
  const color = s.frenzy
    ? `hsl(${hue}, ${sk.dark ? 95 : 80}%, ${sk.dark ? 72 : 36}%)`
    : textColor(s.combo >= 4 ? '#ffd166' : '#ffffff', sk)
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const big = s.frenzy ? 30 : 26
  ctx.font = `600 ${big}px ${FONT}`
  halo(ctx, sk, big)
  ctx.fillStyle = color
  haloText(ctx, `×${s.combo}`, v.w / 2, y)
  ctx.font = `600 12px ${FONT}`
  halo(ctx, sk, 12)
  ctx.fillStyle = css(sk.inkRgb, 0.9)
  haloText(ctx, s.frenzy ? 'FRENZY · POINTS ×2' : `COMBO · POINTS ×${comboMultiplier(s.combo).toFixed(1)}`, v.w / 2, y + 22)
  ctx.shadowBlur = 0
  const barW = 96
  const frac = Math.max(0, s.comboTimer / COMBO_WINDOW)
  ctx.fillStyle = css(sk.inkRgb, 0.14)
  ctx.beginPath()
  ctx.roundRect(v.w / 2 - barW / 2, y + 34, barW, 4, 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(v.w / 2 - barW / 2, y + 34, barW * frac, 4, 2)
  ctx.fill()
  ctx.restore()
}

function drawGauge(ctx: CanvasRenderingContext2D, v: View, s: GameState, sk: Skin) {
  if (s.phase === 'menu') return
  const stops = waterStops()
  const x = v.w - 16
  const top = Math.max(70, v.h * 0.26)
  const bottom = v.h * 0.8
  const height = bottom - top
  if (height < 80) return
  ctx.save()
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < ZONES.length; i++) {
    const zone = ZONES[i]!
    const next = ZONES[i + 1]?.top ?? GAUGE_MAX
    const y0 = gaugeY(top, height, zone.top)
    const y1 = gaugeY(top, height, next)
    ctx.fillStyle = css(oceanAt(stops, (zone.top + Math.min(next, GAUGE_MAX)) / 2))
    ctx.fillRect(x - 3, y0, 6, y1 - y0)
    if (i > 0) {
      ctx.fillStyle = css(sk.inkRgb, 0.6)
      ctx.fillRect(x - 5, y0, 10, 1)
      ctx.font = `600 10px ${FONT}`
      ctx.fillStyle = css(sk.inkRgb, 0.72)
      ctx.fillText(`×${zone.mult}`, x - 9, y0)
    }
  }
  ctx.strokeStyle = css(sk.inkRgb, 0.3)
  ctx.lineWidth = 1
  ctx.strokeRect(x - 3.5, top - 0.5, 7, height + 1)

  const py = gaugeY(top, height, s.player.y)
  ctx.fillStyle = PALETTE.magenta
  ctx.strokeStyle = css(sk.water, 0.9)
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x - 6, py)
  ctx.lineTo(x - 13, py - 5)
  ctx.lineTo(x - 13, py + 5)
  ctx.closePath()
  ctx.stroke()
  ctx.fill()
  ctx.font = `600 11px ${FONT}`
  halo(ctx, sk, 11)
  ctx.fillStyle = sk.ink
  haloText(ctx, `${depthMeters(s.player.y)} m`, x - 17, py)
  ctx.restore()
}

function drawBanner(ctx: CanvasRenderingContext2D, v: View, s: GameState, sk: Skin) {
  const b = s.banners[0]
  if (!b) return
  const t = 1 - b.life / b.maxLife
  const alpha = t < 0.1 ? t / 0.1 : t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1
  const pop = 1 + Math.max(0, 0.12 - t) * 2
  const size = Math.round(Math.max(24, Math.min(46, v.w * 0.055)) * pop)
  const y = v.h * 0.3
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${size}px ${FONT}`
  halo(ctx, sk, size)
  ctx.fillStyle = textColor(b.color, sk)
  haloText(ctx, b.text, v.w / 2, y)
  if (b.sub) {
    const sub = Math.round(Math.max(13, size * 0.38))
    ctx.font = `600 ${sub}px ${FONT}`
    halo(ctx, sk, sub)
    ctx.fillStyle = css(sk.inkRgb, 0.94)
    haloText(ctx, b.sub, v.w / 2, y + size * 0.78)
  }
  ctx.restore()
}

/** The first-seconds hint, on the same frosted card the site uses for everything else. */
function drawHint(ctx: CanvasRenderingContext2D, v: View, s: GameState, sk: Skin) {
  if (s.phase !== 'playing' || s.elapsed > 9 || s.player.level >= 6) return
  const alpha = s.elapsed < 7 ? Math.min(1, s.elapsed / 0.5) : (9 - s.elapsed) / 2
  const lines = [
    isTouch() ? 'Drag to swim · tap to dash' : 'Mouse to swim · click or Space to dash',
    'Eat green numbers · avoid red',
  ]
  ctx.save()
  ctx.globalAlpha = Math.max(0, alpha)
  ctx.font = `600 15px ${FONT}`
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36
  const h = 58
  const x = v.w / 2 - w / 2
  const y = v.h - h - Math.max(24, v.h * 0.06)
  ctx.fillStyle = sk.dark ? 'rgba(24, 36, 46, 0.82)' : 'rgba(255, 255, 255, 0.86)'
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 14)
  ctx.fill()
  ctx.strokeStyle = css(sk.inkRgb, 0.1)
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = sk.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(lines[0]!, v.w / 2, y + 19)
  ctx.fillStyle = css(sk.inkRgb, 0.72)
  ctx.font = `600 13px ${FONT}`
  ctx.fillText(lines[1]!, v.w / 2, y + 40)
  ctx.restore()
}

export function renderGame(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const ppu = s.scale * s.zoom
  const shake = s.shake > 0 ? (s.shake * s.shake * 10) / ppu : 0
  const v: View = {
    w,
    h,
    ppu,
    cx: s.cameraX + (shake ? (Math.random() - 0.5) * shake : 0),
    cy: s.cameraY + (shake ? (Math.random() - 0.5) * shake : 0),
    halfW: w / 2 / ppu,
    halfH: h / 2 / ppu,
  }
  const sk = skinAt(v.cy)
  const glows: Glow[] = []
  // The water's and the reef's light, kept apart so however much of it there
  // is, it never crowds out the light of anything you can meet.
  const ambient: Glow[] = []
  const badges: Badge[] = []
  const deep = darknessAt(v.cy)
  const lum = biolumeAt(v.cy)

  drawOcean(ctx, v, s)
  drawSunRays(ctx, v, s, sk.dark)
  // Marine snow gives way to the plankton's own light as the water darkens.
  drawSnow(ctx, v, s, sk.ink, 0.5 * (1 - lum * 0.75))
  drawPlankton(ctx, v, s, lum, wakeFor(s), ambient)
  drawSpores(ctx, v, s, lum, ambient)

  const diag = Math.hypot(v.halfW, v.halfH)
  for (const rock of rocksNear(s.seed, v.cx, v.cy, diag + 200)) {
    if (onScreen(v, rock.x, rock.y, rock.r * ppu * 1.6)) drawRock(ctx, v, rock, s.time, glows, ambient)
  }
  for (const m of s.mines) if (onScreen(v, m.x, m.y, m.r * ppu * 8)) drawMine(ctx, v, m, s.time, glows)
  for (const j of s.jellies) if (onScreen(v, j.x, j.y, j.r * ppu * 3)) drawJelly(ctx, v, j, s.time, glows, deep)
  for (const pk of s.pickups) if (onScreen(v, pk.x, pk.y, pk.r * ppu * 2)) drawPickup(ctx, v, pk, glows, sk)

  const p = s.player
  const smaller: Fish[] = []
  const bigger: Fish[] = []
  for (const f of s.fishes) {
    const r = fishRadius(f) * ppu * SPECIES[f.species].art.length
    if (!onScreen(v, f.x, f.y, r + 40)) continue
    if (s.phase !== 'menu' && f.level > p.level) bigger.push(f)
    else smaller.push(f)
  }
  const byLevel = (a: Fish, b: Fish) => a.level - b.level
  smaller.sort(byLevel)
  bigger.sort(byLevel)
  for (const f of smaller) drawOneFish(ctx, v, s, f, glows, badges)
  if (s.phase !== 'menu') drawPlayer(ctx, v, s, glows, badges, sk)
  for (const f of bigger) drawOneFish(ctx, v, s, f, glows, badges)

  drawParticles(ctx, v, s, glows, sk.inkRgb)
  drawBlasts(ctx, v, s, glows)
  drawDarkness(ctx, v, s)
  // Added light is lost on pale water; don't let it wash the shallows out.
  const boost = (0.45 + deep * 0.75) * (sk.dark ? 1 : 0.6)
  drawGlows(ctx, ambient, boost, 140)
  drawGlows(ctx, glows, boost, 180)
  drawBadges(ctx, badges)
  drawAlerts(ctx, v, s)
  drawFloaters(ctx, v, s, sk)
  drawDanger(ctx, v, s)

  if (s.flash > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.5, s.flash * 0.6)
    ctx.fillStyle = s.flashColor
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  drawIndicators(ctx, v, s, sk)
  drawCombo(ctx, v, s, sk)
  drawGauge(ctx, v, s, sk)
  drawBanner(ctx, v, s, sk)
  drawHint(ctx, v, s, sk)
}
