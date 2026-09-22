import { isDarkTheme } from '../../lib/theme'
import { drawFish, type Glow } from './fishArt'
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

const OCEAN_DARK: [number, RGB][] = [
  [0, [30, 118, 154]],
  [700, [22, 92, 136]],
  [1400, [15, 66, 110]],
  [3600, [9, 38, 72]],
  [7000, [5, 20, 40]],
  [12000, [2, 8, 19]],
]
const OCEAN_LIGHT: [number, RGB][] = [
  [0, [86, 198, 224]],
  [700, [54, 162, 206]],
  [1400, [36, 124, 180]],
  [3600, [23, 86, 138]],
  [7000, [14, 53, 96]],
  [12000, [9, 32, 62]],
]

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

function drawOcean(ctx: CanvasRenderingContext2D, v: View, s: GameState, dark: boolean) {
  const stops = dark ? OCEAN_DARK : OCEAN_LIGHT
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

  // Sky, down to a moving wave line.
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, surfaceY))
  sky.addColorStop(0, dark ? 'rgb(14, 32, 52)' : 'rgb(150, 214, 240)')
  sky.addColorStop(1, dark ? 'rgb(50, 96, 126)' : 'rgb(216, 243, 252)')
  const waveY = (X: number) => {
    const wx = (X - v.w / 2) / v.ppu + v.cx
    return surfaceY + (Math.sin(wx * 0.012 + s.time * 1.4) * 3.2 + Math.sin(wx * 0.031 - s.time * 2.1) * 1.8) * v.ppu
  }
  ctx.fillStyle = sky
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(v.w, 0)
  for (let X = v.w; X >= -24; X -= 24) ctx.lineTo(X, waveY(X))
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.lineWidth = Math.max(1.5, 1.6 * v.ppu)
  ctx.beginPath()
  for (let X = 0; X <= v.w + 24; X += 24) {
    if (X === 0) ctx.moveTo(X, waveY(X))
    else ctx.lineTo(X, waveY(X))
  }
  ctx.stroke()

  const glowTop = Math.max(0, surfaceY)
  const band = ctx.createLinearGradient(0, glowTop, 0, glowTop + 60 * v.ppu)
  band.addColorStop(0, 'rgba(255, 255, 255, 0.16)')
  band.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = band
  ctx.fillRect(0, glowTop, v.w, 60 * v.ppu)
}

function drawRays(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
  const depthTop = v.cy - v.halfH
  if (depthTop > 2600) return
  const strength = 0.065 * (1 - Math.max(0, depthTop) / 2600)
  const surfaceY = Math.max(-20, sy(v, 0))
  const reach = sy(v, 1400)
  if (reach <= surfaceY) return
  ctx.save()
  const spacing = Math.max(170, v.w / 4)
  const span = spacing * 6
  for (let i = 0; i < 6; i++) {
    const base = ((((i * spacing - v.cx * 0.35 * v.ppu) % span) + span) % span) - spacing
    const sway = Math.sin(s.time * 0.25 + i * 1.7) * 26
    const wTop = 8 + (i % 3) * 9
    const slant = (reach - surfaceY) * 0.2
    const grad = ctx.createLinearGradient(0, surfaceY, 0, reach)
    grad.addColorStop(0, `rgba(255, 255, 255, ${strength * (0.7 + 0.3 * Math.sin(s.time * 0.6 + i * 2.3))})`)
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(base + sway, surfaceY)
    ctx.lineTo(base + sway + wTop, surfaceY)
    ctx.lineTo(base + sway + slant + wTop * 2.6, reach)
    ctx.lineTo(base + sway + slant, reach)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function hashCell(ix: number, iy: number) {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function drawSnow(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
  const depthDark = darknessAt(v.cy)
  const layers = [
    { p: 0.55, cell: 160, size: 1.1, alpha: 0.14 },
    { p: 0.85, cell: 120, size: 1.6, alpha: 0.2 },
  ]
  ctx.fillStyle = '#dff4ff'
  for (const layer of layers) {
    const lcx = v.cx * layer.p
    const lcy = v.cy * layer.p
    const cell = layer.cell
    const x0 = Math.floor((lcx - v.halfW) / cell) - 1
    const x1 = Math.ceil((lcx + v.halfW) / cell) + 1
    const y0 = Math.floor((lcy - v.halfH) / cell) - 1
    const y1 = Math.ceil((lcy + v.halfH) / cell) + 1
    const alpha = layer.alpha * (0.55 + depthDark * 1.1)
    for (let iy = y0; iy <= y1; iy++) {
      for (let ix = x0; ix <= x1; ix++) {
        const h1 = hashCell(ix, iy)
        const lx = ix * cell + h1 * cell
        const fall = (s.time * (5 + h1 * 6)) % cell
        const ly = iy * cell + hashCell(ix + 31, iy - 17) * cell + fall
        const X = (lx - lcx) * v.ppu + v.w / 2
        const Y = (ly - lcy) * v.ppu + v.h / 2
        if (Y < sy(v, 0)) continue
        ctx.globalAlpha = alpha * (0.4 + 0.6 * hashCell(ix * 3, iy * 7))
        ctx.beginPath()
        ctx.arc(X, Y, Math.max(0.6, layer.size * Math.max(0.6, v.ppu)), 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  ctx.globalAlpha = 1
}

const ROCK_COLORS: Record<ZoneId, { top: string; base: string; shadow: string; outline: string }> = {
  shallows: { top: '#c9b48f', base: '#9c8a6c', shadow: '#6a5c47', outline: '#4b4032' },
  twilight: { top: '#8795a3', base: '#5f6d7b', shadow: '#3d4753', outline: '#2a323b' },
  midnight: { top: '#566377', base: '#3c4758', shadow: '#232a36', outline: '#161b24' },
  abyss: { top: '#3a4254', base: '#282e3c', shadow: '#161a23', outline: '#0c0f15' },
}

const CORAL = ['#ff7a8a', '#ff9f43', '#c77dff', '#4fd1c5', '#ffd166']

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

function drawRock(ctx: CanvasRenderingContext2D, v: View, rock: Rock, time: number, glows: Glow[]) {
  const X = sx(v, rock.x)
  const Y = sy(v, rock.y)
  const R = rock.r * v.ppu
  const colors = ROCK_COLORS[rock.zone]
  const shape = rockShape(rock)
  const rand = mulberry32(rock.seed ^ 0x5bd1e995)

  // Weed and coral stand behind the rock's top edge.
  if (rock.main && (rock.zone === 'shallows' || rock.zone === 'twilight')) {
    const strands = rock.zone === 'shallows' ? 3 : 2
    ctx.lineCap = 'round'
    for (let i = 0; i < strands; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 1.6
      const bx = X + Math.cos(a) * R * 0.8
      const by = Y + Math.sin(a) * R * 0.78
      const len = R * (0.55 + rand() * 0.5)
      const sway = Math.sin(time * 0.9 + rock.seed * 0.001 + i) * len * 0.25
      ctx.strokeStyle = rock.zone === 'shallows' ? '#3f9f5a' : '#2f6b58'
      ctx.lineWidth = Math.max(1.5, R * 0.05)
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.bezierCurveTo(bx + sway * 0.4, by - len * 0.35, bx - sway * 0.6, by - len * 0.7, bx + sway, by - len)
      ctx.stroke()
    }
  }

  rockPath(ctx, X, Y, R, shape)
  const grad = ctx.createLinearGradient(0, Y - R, 0, Y + R)
  grad.addColorStop(0, colors.top)
  grad.addColorStop(0.45, colors.base)
  grad.addColorStop(1, colors.shadow)
  ctx.fillStyle = grad
  ctx.fill()

  ctx.save()
  ctx.clip()
  ctx.fillStyle = colors.shadow
  ctx.globalAlpha = 0.22
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2
    const d = rand() * R * 0.7
    ctx.beginPath()
    ctx.ellipse(X + Math.cos(a) * d, Y + Math.sin(a) * d, R * (0.08 + rand() * 0.12), R * (0.05 + rand() * 0.08), rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 0.28
  ctx.strokeStyle = colors.top
  ctx.lineWidth = Math.max(1.5, R * 0.06)
  ctx.beginPath()
  ctx.arc(X, Y + R * 0.08, R * 0.92, Math.PI * 1.15, Math.PI * 1.85)
  ctx.stroke()
  ctx.restore()

  rockPath(ctx, X, Y, R, shape)
  ctx.strokeStyle = colors.outline
  ctx.lineWidth = Math.max(1.2, R * 0.028)
  ctx.stroke()

  if (!rock.main) return
  if (rock.zone === 'shallows') {
    const pieces = 3 + Math.floor(rand() * 3)
    for (let i = 0; i < pieces; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.2
      const px = X + Math.cos(a) * R * 0.86
      const py = Y + Math.sin(a) * R * 0.82
      const size = R * (0.12 + rand() * 0.12)
      const color = CORAL[Math.floor(rand() * CORAL.length)]!
      ctx.fillStyle = color
      ctx.strokeStyle = color
      if (rand() < 0.5) {
        ctx.lineWidth = Math.max(1.4, size * 0.22)
        ctx.lineCap = 'round'
        ctx.beginPath()
        const lean = Math.sin(time * 0.7 + i + rock.seed * 0.0001) * size * 0.08
        for (let k = -1; k <= 1; k++) {
          ctx.moveTo(px, py)
          ctx.lineTo(px + k * size * 0.45 + lean, py - size * (0.8 + Math.abs(k) * -0.15))
        }
        ctx.stroke()
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath()
          ctx.arc(px + k * size * 0.45 + lean, py - size * (0.8 + Math.abs(k) * -0.15), size * 0.16, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        ctx.beginPath()
        ctx.arc(px, py, size * 0.55, Math.PI, 0)
        ctx.closePath()
        ctx.globalAlpha = 0.9
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }
  } else if (rock.zone === 'twilight') {
    const pieces = 2
    for (let i = 0; i < pieces; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 1.6
      const px = X + Math.cos(a) * R * 0.84
      const py = Y + Math.sin(a) * R * 0.8
      const size = R * (0.14 + rand() * 0.1)
      ctx.fillStyle = '#c98552'
      ctx.beginPath()
      ctx.roundRect(px - size * 0.22, py - size, size * 0.44, size, size * 0.2)
      ctx.fill()
      ctx.fillStyle = '#6b3d22'
      ctx.beginPath()
      ctx.ellipse(px, py - size, size * 0.18, size * 0.07, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    const pieces = rock.zone === 'abyss' ? 3 : 2
    const tone = rock.zone === 'abyss' ? ['#7cf7ff', '#ff7df0', '#b8a2ff'] : ['#9fd8ff', '#d5b8ff']
    for (let i = 0; i < pieces; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2
      const px = X + Math.cos(a) * R * 0.84
      const py = Y + Math.sin(a) * R * 0.8
      const size = R * (0.12 + rand() * 0.14)
      const color = tone[Math.floor(rand() * tone.length)]!
      ctx.fillStyle = color
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.moveTo(px - size * 0.18, py)
      ctx.lineTo(px + (rand() - 0.5) * size * 0.3, py - size)
      ctx.lineTo(px + size * 0.18, py)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
      const pulse = 0.6 + 0.4 * Math.sin(time * 1.6 + i + rock.seed * 0.0003)
      glows.push({ x: px, y: py - size * 0.5, r: size * 2.2, color, strength: 0.55 * pulse })
    }
  }
}

function drawJelly(ctx: CanvasRenderingContext2D, v: View, j: Jelly, time: number, glows: Glow[], deep: number) {
  const X = sx(v, j.x)
  const Y = sy(v, j.y)
  const R = j.r * v.ppu
  const beat = Math.sin(j.phase)
  const rx = R * (1 - 0.08 * beat)
  const ry = R * 0.82 * (1 + 0.12 * beat)
  const c = toRgb(`hsl(${j.hue}, 85%, 72%)`)
  ctx.save()
  ctx.globalAlpha = j.fade

  ctx.lineCap = 'round'
  ctx.strokeStyle = css(c, 0.5)
  ctx.lineWidth = Math.max(1, R * 0.05)
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
  ctx.strokeStyle = css(c, 0.7)
  ctx.lineWidth = Math.max(1.4, R * 0.12)
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
  const grad = ctx.createRadialGradient(X, Y - ry * 0.35, R * 0.1, X, Y, R * 1.05)
  grad.addColorStop(0, css([255, 255, 255], 0.55))
  grad.addColorStop(0.5, css(c, 0.42))
  grad.addColorStop(1, css(c, 0.22))
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = css(c, 0.85)
  ctx.lineWidth = Math.max(1, R * 0.05)
  ctx.stroke()

  ctx.strokeStyle = css([255, 255, 255], 0.35)
  ctx.lineWidth = Math.max(1, R * 0.06)
  for (let i = 0; i < 4; i++) {
    const a = Math.PI + ((i + 0.5) / 4) * Math.PI
    ctx.beginPath()
    ctx.arc(X + Math.cos(a) * rx * 0.42, Y - ry * 0.25 + Math.sin(a) * ry * 0.2, R * 0.11, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
  glows.push({ x: X, y: Y - ry * 0.2, r: R * 2.4, color: `hsl(${j.hue}, 85%, 72%)`, strength: (0.25 + 0.6 * deep) * j.fade })
}

function drawMine(ctx: CanvasRenderingContext2D, v: View, m: Mine, time: number, glows: Glow[]) {
  const X = sx(v, m.x)
  const Y = sy(v, m.y + Math.sin(m.bob * 1.3) * m.r * 0.15)
  const R = m.r * v.ppu
  ctx.save()
  ctx.globalAlpha = m.fade

  // Chain, into the dark.
  ctx.strokeStyle = '#4a5058'
  ctx.lineWidth = Math.max(1, R * 0.1)
  for (let i = 0; i < 9; i++) {
    const ly = Y + R * 1.05 + i * R * 0.42
    ctx.globalAlpha = m.fade * (1 - i / 9)
    ctx.beginPath()
    if (i % 2 === 0) ctx.ellipse(X, ly, R * 0.1, R * 0.2, 0, 0, Math.PI * 2)
    else ctx.ellipse(X, ly, R * 0.05, R * 0.2, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = m.fade

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    const x1 = X + Math.cos(a) * R * 0.8
    const y1 = Y + Math.sin(a) * R * 0.8
    const x2 = X + Math.cos(a) * R * 1.32
    const y2 = Y + Math.sin(a) * R * 1.32
    ctx.strokeStyle = '#505862'
    ctx.lineWidth = Math.max(1.5, R * 0.2)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.fillStyle = '#8a939e'
    ctx.beginPath()
    ctx.arc(x2, y2, R * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  const grad = ctx.createRadialGradient(X - R * 0.35, Y - R * 0.35, R * 0.1, X, Y, R)
  grad.addColorStop(0, '#8b949f')
  grad.addColorStop(0.5, '#3b424b')
  grad.addColorStop(1, '#16191e')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(X, Y, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#0d0f12'
  ctx.lineWidth = Math.max(1, R * 0.06)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.ellipse(X, Y, R * 0.98, R * 0.3, 0, 0, Math.PI * 2)
  ctx.stroke()

  const armed = m.fuse >= 0
  const rate = armed ? 10 : 0.9
  const on = armed ? Math.sin(time * rate * Math.PI * 2) > 0 : (time * rate) % 1 < 0.14
  ctx.fillStyle = on ? '#ff3b30' : '#5a1d1a'
  ctx.beginPath()
  ctx.arc(X, Y - R * 0.45, R * 0.17, 0, Math.PI * 2)
  ctx.fill()
  if (on) glows.push({ x: X, y: Y - R * 0.45, r: R * (armed ? 2.4 : 1.4), color: '#ff3b30', strength: armed ? 0.9 : 0.55 })

  if (armed) {
    // The blast radius, so it is clear how far to run.
    const blast = m.r * 5.2 * v.ppu
    ctx.globalAlpha = m.fade * (0.35 + 0.25 * Math.sin(time * 20))
    ctx.strokeStyle = '#ff5a4a'
    ctx.lineWidth = Math.max(1.5, 2)
    ctx.setLineDash([8, 7])
    ctx.beginPath()
    ctx.arc(X, Y, blast, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = m.fade * 0.08
    ctx.fillStyle = '#ff3b30'
    ctx.fill()
  }
  ctx.restore()
}

function drawBubbleOrb(ctx: CanvasRenderingContext2D, X: number, Y: number, R: number, time: number, alpha: number) {
  const hue = (time * 70) % 360
  ctx.save()
  ctx.globalAlpha = alpha
  const grad = ctx.createRadialGradient(X, Y, R * 0.55, X, Y, R)
  grad.addColorStop(0, 'rgba(200, 245, 255, 0.04)')
  grad.addColorStop(0.8, `hsla(${hue}, 90%, 80%, 0.18)`)
  grad.addColorStop(1, `hsla(${(hue + 60) % 360}, 95%, 85%, 0.55)`)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(X, Y, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = `hsla(${(hue + 120) % 360}, 90%, 88%, 0.75)`
  ctx.lineWidth = Math.max(1.2, R * 0.05)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.lineWidth = Math.max(1.2, R * 0.08)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(X, Y, R * 0.72, Math.PI * 1.1, Math.PI * 1.45)
  ctx.stroke()
  ctx.restore()
}

function drawPickup(ctx: CanvasRenderingContext2D, v: View, pk: Pickup, time: number, glows: Glow[]) {
  const X = sx(v, pk.x)
  const Y = sy(v, pk.y + Math.sin(pk.bob * 2) * pk.r * 0.3)
  const R = pk.r * v.ppu * (1 + 0.06 * Math.sin(pk.bob * 4))
  const alpha = Math.min(1, pk.life / 3)
  drawBubbleOrb(ctx, X, Y, R, time, alpha)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.moveTo(X, Y - R * 0.42)
  ctx.lineTo(X + R * 0.34, Y - R * 0.26)
  ctx.lineTo(X + R * 0.28, Y + R * 0.14)
  ctx.lineTo(X, Y + R * 0.4)
  ctx.lineTo(X - R * 0.28, Y + R * 0.14)
  ctx.lineTo(X - R * 0.34, Y - R * 0.26)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  glows.push({ x: X, y: Y, r: R * 2.2, color: '#bff6ff', strength: 0.5 * alpha })
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
      tint: darknessAt(f.y) * 0.8,
      time: s.time,
    },
    f.seed,
    local,
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
      y: Y,
      r: r * v.ppu,
      level: f.level,
      kind: !playing ? 'neutral' : threat ? 'danger' : 'food',
      alpha: alpha * (playing && !threat && f.level < p.level * 0.25 ? 0.7 : 1),
    })
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, v: View, s: GameState, glows: Glow[], badges: Badge[]) {
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
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
      tint: 0,
      time: s.time,
    },
    7,
    local,
  )
  ctx.restore()
  pushGlows(glows, local, X, Y + sink, p.angle, p.roll, alpha * pulse)
  if (s.frenzy) glows.push({ x: X, y: Y, r: L * 0.9, color: '#ff7ae6', strength: 0.55 + 0.2 * Math.sin(s.time * 8) })

  if (s.phase === 'playing') {
    if (p.shield) drawBubbleOrb(ctx, X, Y, pr * v.ppu * 1.55, s.time, 0.95)
    if (p.stun > 0) {
      ctx.save()
      ctx.fillStyle = '#f5e3ff'
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(X, Y, pr * v.ppu * 1.3 + 6, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }
  badges.push({ x: X, y: Y + sink, r: pr * v.ppu, level: p.level, kind: 'player', alpha })
}

function drawParticles(ctx: CanvasRenderingContext2D, v: View, s: GameState, glows: Glow[]) {
  for (const pt of s.particles) {
    const X = sx(v, pt.x)
    const Y = sy(v, pt.y)
    if (X < -20 || X > v.w + 20 || Y < -20 || Y > v.h + 20) continue
    const R = Math.max(0.8, pt.size * v.ppu)
    const a = Math.max(0, Math.min(1, pt.life * 1.4))
    if (pt.kind === 'bubble') {
      ctx.globalAlpha = a * 0.8
      ctx.strokeStyle = pt.color
      ctx.lineWidth = Math.max(0.8, R * 0.3)
      ctx.beginPath()
      ctx.arc(X, Y, R, 0, Math.PI * 2)
      ctx.stroke()
      if (R > 2.5) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.beginPath()
        ctx.arc(X - R * 0.35, Y - R * 0.35, R * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }
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
  grad.addColorStop(0, 'rgba(1, 5, 12, 0)')
  grad.addColorStop(1, `rgba(1, 5, 12, ${0.8 * dark})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, v.w, v.h)
}

function drawGlows(ctx: CanvasRenderingContext2D, glows: Glow[], boost: number) {
  if (!glows.length) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const n = Math.min(glows.length, 110)
  for (let i = 0; i < n; i++) {
    const g = glows[i]!
    if (g.r < 1 || g.strength <= 0.01) continue
    const c = toRgb(g.color)
    const a = Math.min(1, g.strength * boost)
    const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r)
    grad.addColorStop(0, css(c, 0.55 * a))
    grad.addColorStop(0.35, css(c, 0.22 * a))
    grad.addColorStop(1, css(c, 0))
    ctx.fillStyle = grad
    ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2)
  }
  ctx.restore()
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
    const size = Math.round(Math.max(11, Math.min(24, b.r * 0.6)))
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
    const r = fishRadius(f) * v.ppu
    const X = sx(v, f.x)
    const Y = sy(v, f.y) - r * 1.25 - 16
    const pop = Math.min(1, f.stateTime / 0.12)
    const R = 12 * (0.6 + 0.4 * pop) * (1 + 0.08 * Math.sin(s.time * 20))
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

function drawFloaters(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
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
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(3, size * 0.2)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.strokeText(f.text, X, Y)
    ctx.fillStyle = f.color
    ctx.fillText(f.text, X, Y)
    if (f.sub) {
      const sub = Math.round(size * 0.66)
      const subY = Y + size * 0.82
      ctx.font = `600 ${sub}px ${FONT}`
      ctx.lineWidth = Math.max(2.5, sub * 0.22)
      ctx.strokeText(f.sub, X, subY)
      ctx.fillStyle = f.sub.startsWith('Lv') ? '#6ff2a6' : '#ffffff'
      ctx.fillText(f.sub, X, subY)
    }
  }
  ctx.globalAlpha = 1
}

function drawDanger(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
  if (s.phase !== 'playing' || s.danger < 0.03) return
  const a = s.danger * (0.26 + 0.1 * Math.sin(s.time * 9))
  const grad = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.36, v.w / 2, v.h / 2, Math.hypot(v.w, v.h) * 0.6)
  grad.addColorStop(0, 'rgba(230, 40, 40, 0)')
  grad.addColorStop(1, `rgba(230, 40, 40, ${a})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, v.w, v.h)
}

function drawIndicators(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
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
    const ex = v.w / 2 + dx * t
    const ey = v.h / 2 + dy * t
    const ang = Math.atan2(dy, dx)
    const size = golden ? 13 : 15
    ctx.save()
    ctx.translate(ex, ey)
    ctx.rotate(ang)
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(s.time * 10)
    ctx.fillStyle = golden ? '#ffcf4a' : '#ff3b30'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(size, 0)
    ctx.lineTo(-size * 0.7, -size * 0.8)
    ctx.lineTo(-size * 0.3, 0)
    ctx.lineTo(-size * 0.7, size * 0.8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

function drawCombo(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
  if (s.phase !== 'playing' || s.combo < 2) return
  const y = 86
  const color = s.frenzy ? `hsl(${(s.time * 220) % 360}, 95%, 72%)` : s.combo >= 4 ? '#ffd166' : '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const big = s.frenzy ? 30 : 26
  ctx.font = `600 ${big}px ${FONT}`
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
  const label = `×${s.combo}`
  ctx.strokeText(label, v.w / 2, y)
  ctx.fillStyle = color
  ctx.fillText(label, v.w / 2, y)
  ctx.font = `600 12px ${FONT}`
  ctx.lineWidth = 3
  const sub = s.frenzy ? 'FRENZY · POINTS ×2' : `COMBO · POINTS ×${comboMultiplier(s.combo).toFixed(1)}`
  ctx.strokeText(sub, v.w / 2, y + 22)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.fillText(sub, v.w / 2, y + 22)
  const barW = 96
  const frac = Math.max(0, s.comboTimer / COMBO_WINDOW)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.roundRect(v.w / 2 - barW / 2, y + 34, barW, 4, 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(v.w / 2 - barW / 2, y + 34, barW * frac, 4, 2)
  ctx.fill()
}

const GAUGE_MAX = 11000

function gaugeY(top: number, height: number, depth: number) {
  return top + height * Math.sqrt(Math.min(GAUGE_MAX, Math.max(0, depth)) / GAUGE_MAX)
}

function drawGauge(ctx: CanvasRenderingContext2D, v: View, s: GameState, dark: boolean) {
  if (s.phase === 'menu') return
  const stops = dark ? OCEAN_DARK : OCEAN_LIGHT
  const x = v.w - 16
  const top = Math.max(70, v.h * 0.26)
  const bottom = v.h * 0.8
  const height = bottom - top
  if (height < 80) return
  ctx.save()
  for (let i = 0; i < ZONES.length; i++) {
    const zone = ZONES[i]!
    const next = ZONES[i + 1]?.top ?? GAUGE_MAX
    const y0 = gaugeY(top, height, zone.top)
    const y1 = gaugeY(top, height, next)
    ctx.fillStyle = css(oceanAt(stops, (zone.top + Math.min(next, GAUGE_MAX)) / 2))
    ctx.fillRect(x - 3, y0, 6, y1 - y0)
    if (i > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
      ctx.fillRect(x - 5, y0, 10, 1)
      ctx.font = `600 10px ${FONT}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
      ctx.fillText(`×${zone.mult}`, x - 9, y0)
    }
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(x - 3.5, top - 0.5, 7, height + 1)

  const py = gaugeY(top, height, s.player.y)
  ctx.fillStyle = '#e59cff'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.beginPath()
  ctx.moveTo(x - 6, py)
  ctx.lineTo(x - 13, py - 5)
  ctx.lineTo(x - 13, py + 5)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.font = `600 11px ${FONT}`
  ctx.textAlign = 'right'
  ctx.lineWidth = 3
  const label = `${depthMeters(s.player.y)} m`
  ctx.strokeText(label, x - 17, py)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, x - 17, py)
  ctx.restore()
}

function drawBanner(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
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
  ctx.lineJoin = 'round'
  ctx.font = `600 ${size}px ${FONT}`
  ctx.lineWidth = Math.max(4, size * 0.16)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.strokeText(b.text, v.w / 2, y)
  ctx.fillStyle = b.color
  ctx.fillText(b.text, v.w / 2, y)
  if (b.sub) {
    const sub = Math.round(Math.max(13, size * 0.38))
    ctx.font = `600 ${sub}px ${FONT}`
    ctx.lineWidth = Math.max(3, sub * 0.24)
    ctx.strokeText(b.sub, v.w / 2, y + size * 0.78)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
    ctx.fillText(b.sub, v.w / 2, y + size * 0.78)
  }
  ctx.restore()
}

function drawHint(ctx: CanvasRenderingContext2D, v: View, s: GameState) {
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
  ctx.fillStyle = 'rgba(4, 16, 30, 0.55)'
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 14)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(lines[0]!, v.w / 2, y + 19)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)'
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
  const dark = isDarkTheme()
  const glows: Glow[] = []
  const badges: Badge[] = []

  drawOcean(ctx, v, s, dark)
  drawRays(ctx, v, s)
  drawSnow(ctx, v, s)

  const diag = Math.hypot(v.halfW, v.halfH)
  for (const rock of rocksNear(s.seed, v.cx, v.cy, diag + 200)) {
    if (!onScreen(v, rock.x, rock.y, rock.r * ppu * 1.6)) continue
    drawRock(ctx, v, rock, s.time, glows)
  }

  const deep = darknessAt(v.cy)
  for (const m of s.mines) if (onScreen(v, m.x, m.y, m.r * ppu * 8)) drawMine(ctx, v, m, s.time, glows)
  for (const j of s.jellies) if (onScreen(v, j.x, j.y, j.r * ppu * 3)) drawJelly(ctx, v, j, s.time, glows, deep)
  for (const pk of s.pickups) if (onScreen(v, pk.x, pk.y, pk.r * ppu * 2)) drawPickup(ctx, v, pk, s.time, glows)

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
  if (s.phase !== 'menu') drawPlayer(ctx, v, s, glows, badges)
  for (const f of bigger) drawOneFish(ctx, v, s, f, glows, badges)

  drawParticles(ctx, v, s, glows)
  drawBlasts(ctx, v, s, glows)
  drawDarkness(ctx, v, s)
  drawGlows(ctx, glows, 0.45 + deep * 0.75)
  drawBadges(ctx, badges)
  drawAlerts(ctx, v, s)
  drawFloaters(ctx, v, s)
  drawDanger(ctx, v, s)

  if (s.flash > 0) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.5, s.flash * 0.6)
    ctx.fillStyle = s.flashColor
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  drawIndicators(ctx, v, s)
  drawCombo(ctx, v, s)
  drawGauge(ctx, v, s, dark)
  drawBanner(ctx, v, s)
  drawHint(ctx, v, s)
}
