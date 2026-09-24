import { isDarkTheme } from '../../lib/theme'
import {
  CATCH_GOAL,
  CHIME_GAP,
  FLY_COLORS,
  LANTERNS,
  flySpot,
  hash,
  isPale,
  pondLayout,
  reflectionDrop,
  type Fly,
  type GameState,
  type Layout,
} from './game'

/** Every firefly's light while a Follow has them all alike. */
const PALE = { line: '#dfe5ff', light: '#e9eeff' }
/** The light of the one to follow. */
const GOLD = '#ffd36b'

/** A firefly's colours, unless a Follow has made them all alike. */
function colorsOf(s: GameState, f: Fly) {
  return isPale(s) ? PALE : FLY_COLORS[f.id]!
}

const TAU = Math.PI * 2
const FONT = '"Outfit", system-ui, sans-serif'

/*
 * Two skies for the two themes: night for dark, the blue hour for light. The
 * fireflies are the same in both; it's their light that makes the game, so
 * the light theme is dusk a little earlier rather than day.
 */
type Palette = {
  sky: [number, string][]
  starAlpha: number
  moon: string
  hills: string
  trees: string
  water: [number, string][]
  treeEcho: string
  treeEchoAlpha: number
  sheen: string
  bankLine: string
  pad: string
  padLine: string
  reed: string
  cattail: string
  glint: string
  lanternOff: string
  lanternOffLine: string
  string: string
  cap: string
  shade: string
  body: string
  text: string
  halo: string
}

const NIGHT: Palette = {
  sky: [[0, '#060920'], [0.5, '#141a46'], [0.82, '#352a5e'], [1, '#6b4670']],
  starAlpha: 1,
  moon: '#fff1d6',
  hills: '#1b1640',
  trees: '#080a1f',
  water: [[0, '#2a2352'], [0.08, '#171943'], [0.5, '#0c0f2c'], [1, '#05061a']],
  treeEcho: '#060818',
  treeEchoAlpha: 0.55,
  sheen: '160, 110, 160',
  bankLine: '#04051a',
  pad: 'rgba(22, 64, 62, 0.9)',
  padLine: 'rgba(62, 200, 160, 0.35)',
  reed: '#04050f',
  cattail: '#0a0612',
  glint: '#8f86c9',
  lanternOff: 'rgba(38, 30, 66, 0.92)',
  lanternOffLine: 'rgba(245, 185, 66, 0.32)',
  string: 'rgba(230, 210, 255, 0.22)',
  cap: '#1a1230',
  shade: '2, 3, 12',
  body: '#120d24',
  text: '#eef1ff',
  halo: 'rgba(6, 9, 32, 0.85)',
}

const BLUE_HOUR: Palette = {
  sky: [[0, '#2b3a78'], [0.5, '#4f5a9e'], [0.82, '#9a86b8'], [1, '#e9b3a4']],
  starAlpha: 0.45,
  moon: '#fff7e8',
  hills: '#4a4a86',
  trees: '#23254f',
  water: [[0, '#7d79b4'], [0.08, '#565d9c'], [0.5, '#394379'], [1, '#262d5c']],
  treeEcho: '#1f234b',
  treeEchoAlpha: 0.45,
  sheen: '240, 180, 170',
  bankLine: '#1d2148',
  pad: 'rgba(40, 92, 88, 0.9)',
  padLine: 'rgba(120, 220, 190, 0.45)',
  reed: '#161a3a',
  cattail: '#221a33',
  glint: '#d6d2ff',
  lanternOff: 'rgba(70, 62, 112, 0.9)',
  lanternOffLine: 'rgba(245, 185, 66, 0.45)',
  string: 'rgba(240, 230, 255, 0.4)',
  cap: '#2a2250',
  shade: '12, 14, 40',
  body: '#1c1633',
  text: '#ffffff',
  halo: 'rgba(30, 36, 80, 0.75)',
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/* ---- Light. ---- */

const glowSprites = new Map<string, HTMLCanvasElement>()

/** One soft light per colour, painted once and stamped wherever it's wanted. */
function glowSprite(hex: string) {
  let sprite = glowSprites.get(hex)
  if (!sprite) {
    sprite = makeCanvas(64, 64)
    const g = sprite.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, rgba(hex, 1))
    grad.addColorStop(0.18, rgba(hex, 0.55))
    grad.addColorStop(0.5, rgba(hex, 0.14))
    grad.addColorStop(1, rgba(hex, 0))
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    glowSprites.set(hex, sprite)
  }
  return sprite
}

function glow(ctx: CanvasRenderingContext2D, hex: string, x: number, y: number, r: number, a: number, squash = 1) {
  if (a <= 0.005 || r <= 0.5) return
  ctx.globalAlpha = Math.min(1, a)
  ctx.drawImage(glowSprite(hex), x - r, y - r * squash, r * 2, r * 2 * squash)
}

/* ---- The still parts, painted once per size and theme. ---- */

/** By size, top and theme: the game and the home page's screens each keep their own. */
const backdrops = new Map<string, { canvas: HTMLCanvasElement; shade: HTMLCanvasElement }>()

function treeline(w: number, bank: number, unit: number): [number, number][] {
  const pines: [number, number, number][] = []
  const count = Math.max(10, Math.round(w / 17))
  for (let i = 0; i <= count + 1; i++) {
    const k = unit * 0.9 + 0.1
    pines.push([
      i * (w / count) - 8 + hash(i * 1.7) * 12,
      (16 + hash(i * 3.9) * 34 + (i % 5 === 2 ? 14 : 0)) * k,
      (9 + hash(i * 6.1) * 7) * k,
    ])
  }
  const pts: [number, number][] = []
  for (let x = 0; x <= w + 3; x += 3) {
    let top = (10 + Math.sin(x * 0.05) * 3) * (unit * 0.9 + 0.1)
    for (const [px, ph, pw] of pines) {
      const d = Math.abs(x - px)
      if (d < pw) {
        const t = d / pw
        const hgt = ph * (1 - t) + ((d % 4) < 2 ? 1.5 : -1.5) * t
        if (hgt > top) top = hgt
      }
    }
    pts.push([x, bank - top])
  }
  return pts
}

function paintBackdrop(w: number, h: number, L: Layout, pal: Palette, dpr: number) {
  const canvas = makeCanvas(w * dpr, h * dpr)
  const g = canvas.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const { bank, unit } = L

  const sky = g.createLinearGradient(0, 0, 0, bank)
  for (const [at, c] of pal.sky) sky.addColorStop(at, c)
  g.fillStyle = sky
  g.fillRect(0, 0, w, bank + 2)

  g.fillStyle = '#e8ecff'
  const stars = Math.round((w * bank) / 1800)
  for (let i = 0; i < stars; i++) {
    const sx = hash(i * 3.1) * w
    const sy = Math.pow(hash(i * 5.7 + 1), 1.6) * bank * 0.8
    g.globalAlpha = (0.2 + hash(i * 9.3) * 0.55 * (1 - sy / bank)) * pal.starAlpha
    g.beginPath()
    g.arc(sx, sy, 0.5 + hash(i * 2.2) * 0.8, 0, TAU)
    g.fill()
  }
  g.globalAlpha = 1

  // A thin new moon: its disc, then the sky drawn back over most of it.
  const mx = w * 0.84
  const my = Math.max(L.top * 0.5, bank * 0.16)
  const mr = 11 * Math.max(0.7, unit)
  g.fillStyle = pal.moon
  g.beginPath()
  g.arc(mx, my, mr, 0, TAU)
  g.fill()
  g.fillStyle = sky
  g.beginPath()
  g.arc(mx + mr * 0.45, my - mr * 0.28, mr * 0.92, 0, TAU)
  g.fill()
  const moonGlow = g.createRadialGradient(mx, my, 0, mx, my, mr * 4.4)
  moonGlow.addColorStop(0, 'rgba(255, 240, 210, 0.18)')
  moonGlow.addColorStop(1, 'rgba(255, 240, 210, 0)')
  g.fillStyle = moonGlow
  g.fillRect(mx - mr * 4.5, my - mr * 4.5, mr * 9, mr * 9)

  // Far hills, then the pines along the far bank.
  const lift = unit * 0.9 + 0.1
  g.fillStyle = pal.hills
  g.beginPath()
  g.moveTo(0, bank)
  for (let x = 0; x <= w + 10; x += 10) {
    g.lineTo(x, bank - (34 + Math.sin(x * 0.012 + 1.3) * 16 + Math.sin(x * 0.031) * 6) * lift)
  }
  g.lineTo(w, bank)
  g.closePath()
  g.fill()
  const trees = treeline(w, bank, unit)
  g.fillStyle = pal.trees
  g.beginPath()
  g.moveTo(0, bank)
  for (const [x, y] of trees) g.lineTo(x, y)
  g.lineTo(w, bank)
  g.closePath()
  g.fill()

  // The pond, holding the sky's last colour near the bank, the pines again upside down.
  const water = g.createLinearGradient(0, bank, 0, h)
  for (const [at, c] of pal.water) water.addColorStop(at, c)
  g.fillStyle = water
  g.fillRect(0, bank, w, h - bank)
  g.globalAlpha = pal.treeEchoAlpha
  g.fillStyle = pal.treeEcho
  g.beginPath()
  g.moveTo(0, bank)
  for (const [x, y] of trees) g.lineTo(x, bank + (bank - y) * 0.8)
  g.lineTo(w, bank)
  g.closePath()
  g.fill()
  g.globalAlpha = 1
  const sheenH = 70 * Math.max(0.6, unit)
  const sheen = g.createLinearGradient(0, bank, 0, bank + sheenH)
  sheen.addColorStop(0, `rgba(${pal.sheen}, 0.26)`)
  sheen.addColorStop(1, `rgba(${pal.sheen}, 0)`)
  g.fillStyle = sheen
  g.fillRect(0, bank, w, sheenH)
  g.fillStyle = pal.bankLine
  g.fillRect(0, bank - 1, w, 2)

  // Lily pads, each with its notch, out of the fireflies' way.
  const f = L.field
  const pads: [number, number, number][] = [
    [f.x - f.w * 0.16, f.y + f.h * 0.34, 22],
    [f.x + f.w * 1.12, f.y + f.h * 0.28, 19],
    [f.x + f.w * 0.3, f.y + f.h * 1.2, 26],
    [f.x + f.w * 0.84, f.y + f.h * 1.18, 17],
  ]
  pads.forEach(([px, py, size], i) => {
    const pr = size * unit
    if (py + pr * 0.4 > h) return
    const a0 = hash(i * 4.4) * TAU
    g.beginPath()
    g.ellipse(px, py, pr, pr * 0.34, 0, a0 + 0.35, a0 + TAU - 0.35)
    g.lineTo(px, py)
    g.closePath()
    g.fillStyle = pal.pad
    g.fill()
    g.strokeStyle = pal.padLine
    g.lineWidth = 1.2
    g.stroke()
  })

  // The dark gathers at the edges.
  const shade = makeCanvas(w * dpr, h * dpr)
  const sg = shade.getContext('2d')!
  sg.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cx = w / 2
  const cy = f.y + f.h * 0.45
  const vignette = sg.createRadialGradient(cx, cy, Math.min(w, h) * 0.45, cx, cy, Math.hypot(w, h) * 0.62)
  vignette.addColorStop(0, `rgba(${pal.shade}, 0)`)
  vignette.addColorStop(1, `rgba(${pal.shade}, ${pal === NIGHT ? 0.55 : 0.35})`)
  sg.fillStyle = vignette
  sg.fillRect(0, 0, w, h)
  return { canvas, shade }
}

/* ---- What moves. ---- */

function drawSkyLife(ctx: CanvasRenderingContext2D, s: GameState, L: Layout, pal: Palette) {
  ctx.globalCompositeOperation = 'lighter'
  const count = Math.round(L.w / 22)
  for (let i = 0; i < count; i++) {
    const x = hash(i * 13.7 + 2) * L.w
    const y = Math.pow(hash(i * 4.1 + 9), 1.3) * L.bank * 0.7
    const tw = 0.5 + 0.5 * Math.sin(s.time * (1.2 + hash(i) * 2) + i * 5)
    glow(ctx, '#dfe6ff', x, y, 3.5 + tw * 2.5, (0.3 + 0.5 * tw) * pal.starAlpha)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

function flyAlpha(s: GameState, f: Fly) {
  let a = clamp((s.time - f.born) / 0.7, 0, 1)
  if (f.gone) a *= clamp(1 - (s.time - f.gone) / 1.1, 0, 1)
  return a
}

function drawWater(ctx: CanvasRenderingContext2D, s: GameState, L: Layout, pal: Palette) {
  const { w, h, bank, unit, field } = L
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = pal.glint
  ctx.lineWidth = 1
  const glints = Math.round(w / 28)
  for (let i = 0; i < glints; i++) {
    const y = bank + 8 + Math.pow(hash(i * 2.9), 1.4) * (h - bank - 20)
    const len = (14 + hash(i * 5.1) * 40) * Math.max(0.6, unit)
    const x = ((hash(i * 7.3) * w + s.time * (4 + hash(i) * 6)) % (w + 80)) - 40
    ctx.globalAlpha = 0.1 + 0.07 * Math.sin(s.time * 0.8 + i)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + len, y)
    ctx.stroke()
  }
  // Each firefly's light, shivering in the water under it.
  const drop = reflectionDrop(unit)
  for (let i = 0; i < s.flies.length; i++) {
    const f = s.flies[i]!
    const a = flyAlpha(s, f)
    if (a <= 0) continue
    const spot = flySpot(s, f, L)
    const ry = spot.y + drop
    if (ry < bank + 4 || ry > h + 20) continue
    const lvl = 0.3 + 0.7 * f.flare
    glow(ctx, colorsOf(s, f).light, spot.x + Math.sin(s.time * 3 + i) * 2, ry, (18 + 30 * f.flare) * unit, 0.35 * lvl * a, 1.7)
  }
  // Rings where a firefly sang.
  ctx.lineWidth = 1.3
  for (const r of s.ripples) {
    const u = (s.time - r.t) / 1.4
    const rx = (6 + 64 * u) * unit
    ctx.globalAlpha = Math.max(0, 0.45 * (1 - u))
    ctx.strokeStyle = FLY_COLORS[r.id]!.light
    ctx.beginPath()
    ctx.ellipse(field.x + r.u * field.w, field.y + r.v * field.h + drop, rx, rx * 0.28, 0, 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

function lanternLevel(s: GameState, i: number) {
  if (i >= s.lit) return 0
  let on = clamp((s.time - s.litAt[i]!) / 0.6, 0, 1)
  if (s.dimAt && s.time > s.dimAt) {
    const off = s.dimAt + (s.lit - 1 - i) * 0.14
    on *= clamp(1 - (s.time - off) / 0.35, 0, 1)
  }
  return on
}

/** 0 to 1 and back as a full string rings, lantern by lantern. */
function lanternRing(s: GameState, i: number) {
  if (s.phase !== 'chime') return 0
  const t = (s.time - (s.chimeAt + i * CHIME_GAP)) / 0.55
  return t > 0 && t < 1 ? Math.sin(t * Math.PI) : 0
}

/** The string of paper lanterns across the sky: one lights for every round won, and five end the night. */
function drawLanterns(ctx: CanvasRenderingContext2D, s: GameState, L: Layout, pal: Palette) {
  const { x0, y0, cx, cy, x1, y1 } = L.string
  const k = clamp(L.unit, 0.6, 1.3)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.strokeStyle = pal.string
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.quadraticCurveTo(cx, cy, x1, y1)
  ctx.stroke()
  for (let i = 0; i < LANTERNS; i++) {
    const u = (i + 1) / (LANTERNS + 1)
    const v = 1 - u
    const x = v * v * x0 + 2 * v * u * cx + u * u * x1
    const y = v * v * y0 + 2 * v * u * cy + u * u * y1
    const on = lanternLevel(s, i)
    const ring = lanternRing(s, i)
    const lighting = i < s.lit ? clamp((s.time - s.litAt[i]!) / 0.6, 0, 1) : 0
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Math.sin(s.time * 1.3 + i * 0.9) * 0.07 + ring * 0.12)
    ctx.scale(k, k)
    ctx.strokeStyle = pal.string
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, 7)
    ctx.stroke()
    const pop = (lighting > 0 && lighting < 1 ? 1 + 0.2 * Math.sin(lighting * Math.PI) : 1) + 0.18 * ring
    ctx.scale(pop, pop)
    if (on > 0) {
      ctx.globalCompositeOperation = 'lighter'
      const flick = 0.85 + 0.15 * Math.sin(s.time * 7 + i * 3) * Math.sin(s.time * 3.1 + i)
      glow(ctx, '#ffb347', 0, 18, 46 + 30 * ring, (0.5 + 0.4 * ring) * on * flick)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }
    ctx.beginPath()
    ctx.ellipse(0, 18, 8.5, 11, 0, 0, TAU)
    if (on > 0) {
      const body = ctx.createRadialGradient(0, 16, 1, 0, 18, 12)
      body.addColorStop(0, rgba('#fff1c4', 0.3 + 0.7 * on))
      body.addColorStop(0.6, rgba('#ffb347', 0.25 + 0.7 * on))
      body.addColorStop(1, rgba('#e8743a', 0.2 + 0.7 * on))
      ctx.fillStyle = body
    } else {
      ctx.fillStyle = pal.lanternOff
    }
    ctx.fill()
    ctx.strokeStyle = on > 0 ? rgba('#ffcf7a', 0.5 + 0.5 * on) : pal.lanternOffLine
    ctx.stroke()
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.moveTo(-8, 18)
    ctx.lineTo(8, 18)
    ctx.moveTo(-6.5, 12)
    ctx.lineTo(6.5, 12)
    ctx.moveTo(-6.5, 24)
    ctx.lineTo(6.5, 24)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = pal.cap
    ctx.fillRect(-4, 6, 8, 2.5)
    ctx.fillRect(-4, 28.5, 8, 2.5)
    ctx.restore()
  }
}

let finePointer: boolean | null = null
function hasKeys() {
  if (finePointer === null) {
    finePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches === true
  }
  return finePointer
}

/** The one to follow wears gold while it's shown, and again when the Follow is settled. */
function isGold(s: GameState, f: Fly) {
  if (s.kind !== 'follow' || f.id !== s.target) return false
  return s.phase === 'show' || s.phase === 'win' || s.phase === 'lost'
}

/** What a firefly's key reads: its own number, or in a Follow's last moment, its place's. */
function keyLabel(s: GameState, f: Fly): string | null {
  if (s.phase === 'show' || s.phase === 'swirl') return null
  if (s.phase === 'pick') return String(f.slot + 1)
  return String(f.id + 1)
}

function drawFlies(ctx: CanvasRenderingContext2D, s: GameState, L: Layout, pal: Palette, keys: boolean) {
  // Fireflies are drawn a size up from the rest of the pond: they're what you're looking at.
  const u = L.unit * 1.2
  const spots = s.flies.map((f) => flySpot(s, f, L))
  ctx.globalCompositeOperation = 'lighter'
  s.flies.forEach((f, i) => {
    const a = flyAlpha(s, f)
    if (a <= 0) return
    const { x, y } = spots[i]!
    const light = colorsOf(s, f).light
    const idle = 0.34 + 0.06 * Math.sin(s.time * 2.1 + f.phase)
    const lvl = idle + (1 - idle) * f.flare
    if (isGold(s, f)) {
      const pulse = 0.85 + 0.15 * Math.sin(s.time * 6)
      glow(ctx, GOLD, x, y, 110 * u, 0.4 * pulse * a)
      glow(ctx, GOLD, x, y, 44 * u, 0.7 * pulse * a)
    }
    if (f.flare > 0.02) glow(ctx, light, x, y, (70 + 70 * f.flare) * u, 0.22 * f.flare * a)
    glow(ctx, light, x, y, (22 + 26 * f.flare) * u, (0.45 + 0.5 * lvl) * a)
    glow(ctx, '#ffffff', x, y + u, (5 + 5 * f.flare) * u, (0.35 + 0.6 * f.flare) * a)
    if (f.wrong > 0) {
      glow(ctx, '#ff5a4f', x, y, 60 * u, 0.55 * f.wrong * a)
      glow(ctx, '#ff7a6e', x, y, 22 * u, 0.95 * f.wrong * a)
    }
  })
  const { field } = L
  for (const p of s.sparks) {
    const t = s.time - p.t
    const px = field.x + (p.u + p.du * t) * field.w
    const py = field.y + (p.v + p.dv * t - 0.04 * t * t) * field.h
    glow(ctx, FLY_COLORS[p.id]!.light, px, py, 5 * u, 0.9 * (1 - t / p.life))
  }
  ctx.globalCompositeOperation = 'source-over'

  // A small dark beetle over its own light, its wings a blur.
  s.flies.forEach((f, i) => {
    const a = flyAlpha(s, f)
    if (a <= 0) return
    const { x, y } = spots[i]!
    const c = colorsOf(s, f)
    // In a Catch, a ring closes in on a lit firefly as its moment runs out.
    if (f.open > 0 && f.window > 0) {
      ctx.globalAlpha = a * 0.9
      ctx.strokeStyle = rgba(c.light, 0.9)
      ctx.lineWidth = 2.5 * u
      ctx.beginPath()
      ctx.arc(x, y, (16 + 26 * (f.open / f.window)) * u, 0, TAU)
      ctx.stroke()
    }
    // The one to follow, ringed in gold while it's shown and when it's found.
    if (isGold(s, f)) {
      ctx.globalAlpha = a
      ctx.strokeStyle = rgba(GOLD, 0.9)
      ctx.lineWidth = 2.5 * u
      ctx.beginPath()
      ctx.arc(x, y, 30 * u, 0, TAU)
      ctx.stroke()
    }
    ctx.globalAlpha = a
    const flap = 0.45 + 0.55 * Math.abs(Math.sin(s.time * 26 + f.phase * 5))
    ctx.fillStyle = rgba(c.light, 0.16)
    ctx.strokeStyle = rgba(c.line, 0.85)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(x - 5.5 * u, y - 7 * u, 6.5 * u, 3.4 * u * flap, -0.5, 0, TAU)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(x + 5.5 * u, y - 7 * u, 6.5 * u, 3.4 * u * flap, 0.5, 0, TAU)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = pal.body
    ctx.beginPath()
    ctx.ellipse(x, y - 5.5 * u, 2.6 * u, 4.2 * u, 0, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y - 10.5 * u, 2.2 * u, 0, TAU)
    ctx.fill()
    // After a slip, or a lost Follow, the one it should have been circles itself.
    if (f.hint > 0 && (s.phase === 'fail' || s.phase === 'gameover' || s.phase === 'lost')) {
      const pulse = 0.5 + 0.5 * Math.sin(s.time * 10)
      ctx.strokeStyle = rgba('#ffffff', 0.5 + 0.4 * pulse)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, (26 + 4 * pulse) * u, 0, TAU)
      ctx.stroke()
    }
    // On a keyboard, each firefly's key rides under it.
    const label = keys ? keyLabel(s, f) : null
    if (label) {
      ctx.globalAlpha = a * 0.7
      ctx.font = `600 ${Math.round(11 * clamp(u, 0.8, 1.3))}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 3
      ctx.strokeStyle = pal.halo
      ctx.strokeText(label, x, y + 26 * u)
      ctx.fillStyle = pal.text
      ctx.fillText(label, x, y + 26 * u)
    }
  })
  ctx.globalAlpha = 1
}

function drawReeds(ctx: CanvasRenderingContext2D, s: GameState, L: Layout, pal: Palette) {
  const { w, h, unit } = L
  const spread = 58 * Math.max(0.7, unit)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.lineCap = 'round'
  const sides: [number, number][] = [[-6, 1], [w + 6, -1]]
  sides.forEach(([bx, dir], gi) => {
    for (let i = 0; i < 9; i++) {
      const k = gi * 20 + i
      const x0 = bx + dir * hash(k * 3.3) * spread
      const top = h - (h - L.bank) * (0.28 + hash(k * 1.9) * 0.35)
      const sway = (Math.sin(s.time * 0.7 + k) * 5 + dir * 6) * Math.max(0.7, unit)
      ctx.strokeStyle = pal.reed
      ctx.lineWidth = (2.5 + hash(k * 7.7) * 2) * Math.max(0.7, unit)
      ctx.beginPath()
      ctx.moveTo(x0, h + 6)
      ctx.quadraticCurveTo(x0 + sway * 0.3, (h + top) / 2, x0 + sway, top)
      ctx.stroke()
      if (i % 3 === 0) {
        ctx.fillStyle = pal.cattail
        ctx.beginPath()
        ctx.ellipse(x0 + sway * 0.98, top + 16 * unit, 3.4 * unit, 11 * unit, 0, 0, TAU)
        ctx.fill()
      }
    }
  })
  ctx.lineCap = 'butt'
}

function drawTaps(ctx: CanvasRenderingContext2D, s: GameState, L: Layout) {
  const k = clamp(L.unit, 0.5, 1.2)
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2 * k
  for (const t of s.taps) {
    const u = (s.time - t.t) / 0.5
    ctx.globalAlpha = Math.max(0, 0.55 * (1 - u))
    ctx.beginPath()
    ctx.arc(t.x, t.y, (10 + 22 * u) * k, 0, TAU)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** What the pond is doing, under it: watch, your turn, a Catch's count, a lantern lit. */
function drawStatus(ctx: CanvasRenderingContext2D, s: GameState, L: Layout, pal: Palette) {
  if (s.phase === 'menu' || s.phase === 'gameover') return
  let text = s.message
  if (s.phase === 'watch') text = `Watch · ${s.seq.length} notes`
  else if (s.phase === 'input') text = `Your turn · ${s.inputIdx} of ${s.seq.length}`
  else if (s.phase === 'catch') {
    const left = Math.max(0, Math.ceil(s.catchEnd - s.time))
    text = `Catch · ${s.caught} of ${CATCH_GOAL} · ${left}s`
  }
  if (!text) return
  const size = Math.round(15 * clamp(L.unit, 0.85, 1.25))
  ctx.font = `600 ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = 1
  ctx.lineWidth = 4
  ctx.lineJoin = 'round'
  ctx.strokeStyle = pal.halo
  const y = L.h - Math.max(28, 34 * L.unit)
  ctx.strokeText(text, L.w / 2, y)
  ctx.fillStyle = pal.text
  ctx.fillText(text, L.w / 2, y)
}

/**
 * Draw the pond. `hud` false leaves off what is written over it for a
 * player — the line under the pond and the keys — for the home page's screen.
 */
export function renderGame(ctx: CanvasRenderingContext2D, s: GameState, w: number, h: number, hud = true) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cw = Math.floor(w * dpr)
  const ch = Math.floor(h * dpr)
  if (ctx.canvas.width !== cw || ctx.canvas.height !== ch) {
    ctx.canvas.width = cw
    ctx.canvas.height = ch
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const pal = isDarkTheme() ? NIGHT : BLUE_HOUR
  const L = pondLayout(w, h, s.stageTop)
  const key = `${w}x${h}:${s.stageTop}:${dpr}:${pal === NIGHT ? 'n' : 'b'}`
  let backdrop = backdrops.get(key)
  if (!backdrop) {
    if (backdrops.size >= 6) backdrops.clear()
    backdrop = paintBackdrop(w, h, L, pal, dpr)
    backdrops.set(key, backdrop)
  }

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.drawImage(backdrop.canvas, 0, 0, w, h)
  drawSkyLife(ctx, s, L, pal)
  drawWater(ctx, s, L, pal)
  drawLanterns(ctx, s, L, pal)
  drawFlies(ctx, s, L, pal, hud && hasKeys() && s.phase !== 'menu')
  drawReeds(ctx, s, L, pal)
  drawTaps(ctx, s, L)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.drawImage(backdrop.shade, 0, 0, w, h)
  if (hud) drawStatus(ctx, s, L, pal)
}
