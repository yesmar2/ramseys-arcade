import { PALETTE, type Swatch } from '../../data/games'
import { isDarkTheme, playfieldColor } from '../../lib/theme'
import { drawFish, type FishPaint, type Glow } from './fishArt'
import {
  FLOOR,
  MAX_SIZE,
  OCEAN_W,
  STAGES,
  TIERS,
  barFill,
  chainOf,
  edible,
  fishRadius,
  playerRadius,
  rodTip,
  viewHalf,
  type GameState,
} from './game'
import { SPECIES, playerArt, type FishArt } from './species'

/*
 * The open ocean, drawn back to front through the camera: the sky and its sun, the water deepening down
 * to the sea floor with its sand, kelp and rocks, light from above and drifting specks, the rock walls at
 * the ocean's ends, the fisherman's line and hook, the fish smaller than you, you, the ones that can eat you
 * (so a threat is never hidden behind a meal), the shark and its warning, the surface's waves, the
 * fisherman's boat and gulls above them, splashes and bubbles, the words that float up, and last the bar
 * along the bottom with what you are and your lives.
 *
 * The deep lights itself, as the old open-ocean Frenzy's did (Ramsey, 2026-10-06: "can we have some of the
 * cool images from the original like in the deep ocean?"): below the reach of the sun the water darkens
 * round you, the fish glow at their edges and marks, plankton breathes in the dark and flares wherever you
 * swim through it, jellyfish drift with burning bells, and the rocks and kelp on the sea floor glow. The
 * lights are gathered as the frame is drawn and added over the dark at the end, so they punch through it.
 *
 * Anything that can eat you is drawn with a red outline and a red glow, its eye red, and a "!" over it
 * once it comes for you ("it's hard to tell which fish are the predators still").
 */

const FONT = '"Outfit", system-ui, sans-serif'

type RGB = [number, number, number]

const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const lum = (c: RGB) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255

function toRgb(color: string): RGB {
  if (color.startsWith('#')) {
    const hex = color.length === 4 ? color.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : color
    const n = Number.parseInt(hex.slice(1, 7), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const nums = color.match(/[\d.]+/g)?.map(Number) ?? [237, 247, 244]
  return [nums[0] ?? 237, nums[1] ?? 247, nums[2] ?? 244]
}

function hueOf([r, g, b]: RGB) {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  if (max === min) return 0
  const d = max - min
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return Math.round(h * 60)
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/** The colours of the place, from the site's playfield, in either theme. */
type Palette = {
  skyTop: RGB
  skyLow: RGB
  shallow: RGB
  deep: RGB
  sand: RGB
  rock: RGB
  kelp: RGB
  dark: boolean
  /** Ink for words over the shallows and over the deep. */
  inkShallow: string
  inkDeep: string
  key: string
}
let palette: Palette | null = null
const paints = new Map<string, FishPaint>()

function paletteNow(): Palette {
  const field = playfieldColor()
  const dark = isDarkTheme()
  const key = `${field}|${dark}`
  if (palette?.key === key) return palette
  const base = toRgb(field)
  const sky = toRgb(PALETTE.sky)
  const shallow = mix(base, sky, dark ? 0.24 : 0.32)
  const deep = dark ? mix(base, [4, 12, 22], 0.7) : mix(base, [22, 62, 98], 0.82)
  palette = {
    skyTop: dark ? mix(base, [10, 20, 40], 0.4) : mix(base, sky, 0.45),
    skyLow: dark ? mix(base, sky, 0.12) : mix(base, [255, 255, 255], 0.55),
    shallow,
    deep,
    sand: dark ? [70, 62, 48] : [226, 206, 158],
    rock: dark ? [34, 44, 56] : [96, 112, 124],
    kelp: dark ? [40, 110, 80] : [62, 150, 104],
    dark,
    inkShallow: lum(shallow) < 0.5 ? '#eef4f7' : '#16242f',
    inkDeep: '#eef4f7',
    key,
  }
  paints.clear()
  return palette
}

/** A fish's colours: its palette colour as a soft fill over the water, the same colour for its outline. */
function paintFor(art: FishArt, pal: Palette, fill = 0.42, threat = false): FishPaint {
  const key = `${art.swatch}|${art.tailSwatch ?? ''}|${art.pattern}|${fill}|${threat}`
  const cached = paints.get(key)
  if (cached) return cached
  const under = mix(pal.shallow, pal.deep, 0.35)
  const hue = hueOf(toRgb(PALETTE[art.swatch as Swatch]))
  const tailHue = art.tailSwatch ? hueOf(toRgb(PALETTE[art.tailSwatch])) : hue
  const lineL = pal.dark ? 66 : 40
  const soft = (h: number, amount: number) => css(mix(under, hslToRgb(h, 0.66, 0.58), amount))
  // Anything that can eat you is outlined in red.
  const line = threat ? 'hsla(2, 88%, 56%, 1)' : `hsla(${hue}, 64%, ${lineL}%, 0.95)`
  const fin = soft(hue, fill * 0.62)
  const lightMarks = art.pattern === 'bands' || art.pattern === 'lateral'
  const made: FishPaint = {
    body: soft(hue, fill),
    fin,
    tail: art.tailSwatch ? soft(tailHue, Math.min(0.9, fill * 2)) : fin,
    line,
    tailLine: threat ? 'hsla(2, 88%, 56%, 1)' : `hsla(${tailHue}, 64%, ${lineL}%, 0.95)`,
    pattern: lightMarks ? `hsla(${hue}, 60%, ${pal.dark ? 88 : 97}%, 0.95)` : line,
    eye: '#ffffff',
    pupil: '#16202a',
    mouth: '#16202a',
    teeth: '#f4f8fa',
    glow: `hsla(${hue}, 92%, 74%, 1)`,
  }
  paints.set(key, made)
  return made
}

const rollScale = (roll: number) => (Math.sign(roll) || 1) * Math.max(0.18, Math.abs(roll))

const smooth = (t: number) => {
  const k = Math.max(0, Math.min(1, t))
  return k * k * (3 - 2 * k)
}
/** How much things light themselves at a depth: none in the sunlit top, full by the deep. */
const lumAt = (y: number) => smooth((y - 420) / 480)
/** How dark the water is round the view, for the dark that closes in on you in the deep. */
const darkAt = (y: number) => smooth((y - 320) / 700)

/** The colours the water's own life glows in: mostly cyan, some violet and blue, a little pink. */
const PLANKTON = ['#6ff4ff', '#6ff4ff', '#6ff4ff', '#8ef7d4', '#a98bff', '#7fb2ff', '#ff8ad8']
/** The red of anything that can eat you. */
const DANGER = '#ff4a3d'

/** The frame's lights, in pixels, added over the dark at the end of it. */
let lights: Glow[] = []

const glowSprites = new Map<string, HTMLCanvasElement>()

/** One soft light, painted once per colour and stamped wherever it's wanted. */
function glowSprite(color: string) {
  let sprite = glowSprites.get(color)
  if (!sprite) {
    sprite = document.createElement('canvas')
    sprite.width = 64
    sprite.height = 64
    const g = sprite.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    // A colour as written: hex, rgb() or hsl()/hsla().
    const n = color.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255]
    const c: RGB = color.startsWith('hsl') ? hslToRgb(n[0] ?? 0, (n[1] ?? 0) / 100, (n[2] ?? 100) / 100) : toRgb(color)
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

function drawLights(ctx: CanvasRenderingContext2D) {
  if (!lights.length) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const n = Math.min(lights.length, 420)
  for (let i = 0; i < n; i++) {
    const g = lights[i]!
    const a = Math.min(1, g.strength)
    if (g.r < 2 || a < 0.03) continue
    ctx.globalAlpha = a
    ctx.drawImage(glowSprite(g.color), g.x - g.r, g.y - g.r, g.r * 2, g.r * 2)
  }
  ctx.restore()
}

/** A fish's own lights, from its frame (drawFish) to the screen's. */
function placeLights(local: Glow[], x: number, y: number, angle: number, roll: number, alpha: number) {
  const c = Math.cos(angle)
  const sn = Math.sin(angle)
  const rs = rollScale(roll)
  for (const g of local) {
    const ly = g.y * rs
    lights.push({ x: x + c * g.x - sn * ly, y: y + sn * g.x + c * ly, r: g.r, color: g.color, strength: g.strength * alpha })
  }
}

/** Where you've just been, so the plankton behind you can still be glowing. */
type WakePoint = { x: number; y: number; t: number }
let wake: WakePoint[] = []
const WAKE_LIFE = 1.5

function wakeNow(s: GameState) {
  const p = s.player
  const last = wake[wake.length - 1]
  if (last && (last.t > s.time || s.phase !== 'playing')) wake = []
  if (s.phase === 'playing' && !p.air && (!last || Math.hypot(p.x - last.x, p.y - last.y) > 8 || s.time - last.t > 0.12)) wake.push({ x: p.x, y: p.y, t: s.time })
  while (wake.length && s.time - wake[0]!.t > WAKE_LIFE) wake.shift()
  return wake
}

/**
 * The water's plankton in the deep: a field of tiny lights fixed in the water, each breathing on its own
 * clock, flaring as you swim through and fading behind you.
 */
function drawPlankton(ctx: CanvasRenderingContext2D, v: View) {
  const s = v.s
  const half = viewHalf(s)
  if (lumAt(s.camY + half.h) < 0.02) return
  const trail = wakeNow(s)
  const reach = 60 + playerRadius(s) * 1.6
  const cell = 46
  const x0 = Math.floor((s.camX - half.w) / cell) - 1
  const x1 = Math.ceil((s.camX + half.w) / cell) + 1
  const y0 = Math.max(0, Math.floor((s.camY - half.h) / cell) - 1)
  const y1 = Math.ceil((s.camY + half.h) / cell) + 1
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      const h1 = hash(ix * 31 + iy * 7.7)
      const h2 = hash(ix * 5.3 - iy * 13.1)
      const drift = s.time * (0.25 + h1 * 0.3) + h2 * 10
      const wx = ix * cell + h1 * cell + Math.sin(drift) * cell * 0.12
      const wy = iy * cell + h2 * cell + Math.cos(drift * 0.8) * cell * 0.1
      const lum = lumAt(wy)
      if (lum < 0.02) continue
      let lit = 0
      for (let i = trail.length - 1; i >= 0; i -= 2) {
        const w = trail[i]!
        const dx = wx - w.x
        const dy = wy - w.y
        if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < reach) lit = Math.max(lit, (1 - d / reach) * (1 - (s.time - w.t) / WAKE_LIFE))
      }
      const breathe = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.time * (0.5 + h2 * 0.9) + h1 * 40))
      const color = PLANKTON[Math.floor(h1 * 97) % PLANKTON.length]!
      const a = Math.min(1, lum * (0.5 * breathe + lit * 1.2))
      if (a < 0.03) continue
      const x = X(v, wx)
      const y = Y(v, wy)
      const R = Math.max(0.8, 1.2 * Math.min(1.5, Math.max(0.8, v.ppu)) * (1 + lit * 1.4))
      ctx.globalAlpha = a
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, R, 0, Math.PI * 2)
      ctx.fill()
      if (lit > 0.25) lights.push({ x, y, r: R * 7, color, strength: lit * lum * 0.8 })
    }
  }
  ctx.globalAlpha = 1
}

/**
 * Jellyfish drifting in the deep, harmless: a few to a stretch of water, each bobbing on its own, its bell's
 * edge burning and its tentacles ending in points of light. Where they are comes from the water itself, so
 * they're the same on every swim.
 */
function drawJellies(ctx: CanvasRenderingContext2D, v: View) {
  const s = v.s
  const half = viewHalf(s)
  const cell = 260
  const x0 = Math.floor((s.camX - half.w) / cell) - 1
  const x1 = Math.ceil((s.camX + half.w) / cell) + 1
  const y0 = Math.max(2, Math.floor((s.camY - half.h) / cell) - 1)
  const y1 = Math.min(Math.floor((FLOOR - 120) / cell), Math.ceil((s.camY + half.h) / cell) + 1)
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      const h = hash(ix * 17.3 + iy * 101.7)
      if (h > 0.45) continue
      const wx = ix * cell + hash(ix + iy * 3.1) * cell + Math.sin(s.time * 0.15 + h * 20) * 30
      const wy = iy * cell + hash(ix * 2.2 - iy) * cell + Math.sin(s.time * 0.4 + h * 9) * 18
      const lum = lumAt(wy)
      if (lum < 0.05) continue
      const R = (10 + h * 14) * v.ppu
      const x = X(v, wx)
      const y = Y(v, wy)
      if (x < -R * 3 || x > v.w + R * 3 || y < -R * 3 || y > v.h + R * 4) continue
      const hue = [190, 280, 320, 170][Math.floor(h * 40) % 4]!
      const beat = Math.sin(s.time * 2 + h * 30)
      const rx = R * (1 - 0.08 * beat)
      const ry = R * 0.82 * (1 + 0.12 * beat)
      ctx.save()
      ctx.globalAlpha = Math.min(1, lum * 1.2)
      ctx.lineCap = 'round'
      ctx.strokeStyle = `hsla(${hue}, 70%, 66%, 0.5)`
      ctx.lineWidth = Math.max(1, R * 0.05)
      for (let i = 0; i < 6; i++) {
        const bx = x + ((i / 5 - 0.5) * 1.5) * rx * 0.8
        const len = R * (2 + (i % 3) * 0.35)
        ctx.beginPath()
        ctx.moveTo(bx, y)
        for (let k = 1; k <= 6; k++) {
          const t = k / 6
          ctx.lineTo(bx + Math.sin(s.time * 2.4 + i * 1.3 + t * 5) * R * 0.16 * t, y + len * t)
        }
        ctx.stroke()
        if (i % 2 === 0) lights.push({ x: bx + Math.sin(s.time * 2.4 + i * 1.3 + 5) * R * 0.16, y: y + len, r: R * 0.6, color: `hsl(${hue}, 92%, 76%)`, strength: 0.6 * lum })
      }
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0)
      ctx.closePath()
      ctx.fillStyle = `hsla(${hue}, 70%, 58%, 0.28)`
      ctx.fill()
      ctx.strokeStyle = `hsla(${hue}, 80%, 72%, 0.95)`
      ctx.lineWidth = Math.max(1.3, R * 0.08)
      ctx.stroke()
      ctx.restore()
      lights.push({ x, y: y - ry * 0.2, r: R * 2.6, color: `hsl(${hue}, 85%, 72%)`, strength: 0.55 * lum })
    }
  }
}

/** The dark closing in round you, deeper down: night blue rather than black, so the dark has a colour. */
function drawDark(ctx: CanvasRenderingContext2D, v: View) {
  const s = v.s
  const dark = darkAt(s.camY)
  if (dark < 0.04) return
  const fx = s.phase === 'playing' ? X(v, s.player.x) : v.w / 2
  const fy = s.phase === 'playing' ? Y(v, s.player.y) : v.h / 2
  const inner = Math.min(v.w, v.h) * (0.55 - dark * 0.22)
  const outer = Math.hypot(v.w, v.h) * 0.62
  const grad = ctx.createRadialGradient(fx, fy, inner, fx, fy, outer)
  grad.addColorStop(0, 'rgba(3, 5, 20, 0)')
  grad.addColorStop(1, `rgba(3, 5, 20, ${0.78 * dark})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, v.w, v.h)
  // And the whole of the water a little darker, so the lights read.
  ctx.fillStyle = `rgba(3, 5, 20, ${0.28 * dark})`
  ctx.fillRect(0, Math.max(0, Y(v, 0)), v.w, v.h)
}

/** The camera, in pixels. */
type View = { s: GameState; w: number; h: number; ppu: number; x0: number; y0: number }
const X = (v: View, x: number) => (x - v.x0) * v.ppu
const Y = (v: View, y: number) => (y - v.y0) * v.ppu

/** A number from a position, the same every visit, for where kelp and rocks go. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function drawSky(ctx: CanvasRenderingContext2D, v: View, pal: Palette) {
  const sy = Y(v, 0)
  if (sy <= 0) return
  const g = ctx.createLinearGradient(0, Y(v, -260), 0, sy)
  g.addColorStop(0, css(pal.skyTop))
  g.addColorStop(1, css(pal.skyLow))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, v.w, sy)
  // The sun, far off, a little parallax.
  const sunX = v.w * 0.78 - (v.s.camX / OCEAN_W - 0.5) * v.w * 0.2
  const sunY = Y(v, -170)
  ctx.fillStyle = pal.dark ? 'rgba(240, 244, 255, 0.85)' : 'rgba(255, 236, 170, 0.95)'
  ctx.beginPath()
  ctx.arc(sunX, sunY, 22 * Math.max(0.8, v.ppu), 0, Math.PI * 2)
  ctx.fill()
  // A few soft clouds, drifting.
  ctx.fillStyle = pal.dark ? 'rgba(200, 215, 235, 0.12)' : 'rgba(255, 255, 255, 0.8)'
  for (let i = 0; i < 6; i++) {
    const wx = ((i * 431 + v.s.time * 6) % (OCEAN_W + 400)) - 200
    const wy = -200 + hash(i) * 70
    const cx = X(v, wx)
    const cy = Y(v, wy)
    if (cx < -120 || cx > v.w + 120) continue
    const r = (16 + hash(i + 9) * 10) * v.ppu
    ctx.beginPath()
    ctx.ellipse(cx, cy, r * 2.2, r, 0, 0, Math.PI * 2)
    ctx.ellipse(cx + r * 1.3, cy - r * 0.4, r * 1.4, r * 0.9, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawWater(ctx: CanvasRenderingContext2D, v: View, pal: Palette) {
  const top = Math.max(0, Y(v, 0))
  if (top >= v.h) return
  const g = ctx.createLinearGradient(0, Y(v, 0), 0, Y(v, FLOOR))
  g.addColorStop(0, css(pal.shallow))
  g.addColorStop(0.35, css(mix(pal.shallow, pal.deep, 0.45)))
  g.addColorStop(1, css(pal.deep))
  ctx.fillStyle = g
  ctx.fillRect(0, top, v.w, v.h - top)
  // Light from above, slowly drifting, fading with depth.
  const rayBottom = Y(v, 520)
  if (rayBottom > top) {
    const fade = ctx.createLinearGradient(0, Y(v, 0), 0, rayBottom)
    fade.addColorStop(0, pal.dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.16)')
    fade.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = fade
    for (let i = 0; i < 12; i++) {
      const wx = i * 170 + Math.sin(v.s.time * 0.2 + i) * 20
      const x = X(v, wx)
      const w = 40 * v.ppu
      if (x < -v.h || x > v.w + w) continue
      ctx.beginPath()
      ctx.moveTo(x, Y(v, 0))
      ctx.lineTo(x + w, Y(v, 0))
      ctx.lineTo(x + w + 160 * v.ppu, rayBottom)
      ctx.lineTo(x + 110 * v.ppu, rayBottom)
      ctx.fill()
    }
  }
  // Specks drifting up, tied to the water so they slide by as you swim.
  ctx.fillStyle = pal.dark ? 'rgba(200, 230, 255, 0.22)' : 'rgba(255, 255, 255, 0.5)'
  const cell = 70
  const half = viewHalf(v.s)
  const cx0 = Math.floor((v.s.camX - half.w) / cell)
  const cx1 = Math.ceil((v.s.camX + half.w) / cell)
  const cy0 = Math.max(0, Math.floor((v.s.camY - half.h) / cell))
  const cy1 = Math.ceil((v.s.camY + half.h) / cell)
  for (let ix = cx0; ix <= cx1; ix++) {
    for (let iy = cy0; iy <= cy1; iy++) {
      const h = hash(ix * 91 + iy * 7)
      if (h > 0.5) continue
      const wx = ix * cell + h * cell * 2
      const wy = iy * cell + ((hash(ix + iy * 13) * cell - v.s.time * (6 + h * 10)) % cell)
      if (wy < 4) continue
      ctx.beginPath()
      ctx.arc(X(v, wx), Y(v, wy), Math.max(0.7, (0.6 + h * 1.2) * v.ppu), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** The sea floor: sand, with kelp swaying and rocks, the same along the ocean every visit. */
function drawFloor(ctx: CanvasRenderingContext2D, v: View, pal: Palette) {
  const fy = Y(v, FLOOR)
  if (fy > v.h + 10) return
  const half = viewHalf(v.s)
  const from = Math.floor((v.s.camX - half.w - 80) / 40)
  const to = Math.ceil((v.s.camX + half.w + 80) / 40)
  // Kelp behind the sand line.
  ctx.lineCap = 'round'
  for (let i = from; i <= to; i++) {
    if (hash(i) > 0.28) continue
    const bx = X(v, i * 40 + hash(i + 3) * 30)
    const tall = (90 + hash(i + 5) * 170) * v.ppu
    ctx.strokeStyle = css(pal.kelp, 0.8)
    ctx.lineWidth = Math.max(2, 5 * v.ppu)
    ctx.beginPath()
    ctx.moveTo(bx, fy)
    const sway = Math.sin(v.s.time * 0.8 + i) * 14 * v.ppu
    ctx.bezierCurveTo(bx + sway, fy - tall * 0.35, bx - sway, fy - tall * 0.7, bx + sway * 0.6, fy - tall)
    ctx.stroke()
    // Its tip glows, a bulb of light on the end.
    const color = PLANKTON[Math.floor(hash(i + 8) * 7)]!
    const pulse = 0.5 + 0.5 * Math.sin(v.s.time * 1.4 + i)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(bx + sway * 0.6, fy - tall, Math.max(1.8, 4 * v.ppu), 0, Math.PI * 2)
    ctx.fill()
    lights.push({ x: bx + sway * 0.6, y: fy - tall, r: 26 * v.ppu, color, strength: 0.5 + 0.4 * pulse })
  }
  // The sand, gently uneven.
  ctx.fillStyle = css(pal.sand)
  ctx.beginPath()
  ctx.moveTo(0, v.h)
  for (let px = 0; px <= v.w + 20; px += 20) {
    const wx = v.x0 + px / v.ppu
    ctx.lineTo(px, fy - (Math.sin(wx * 0.013) * 6 + Math.sin(wx * 0.031) * 3) * v.ppu)
  }
  ctx.lineTo(v.w, v.h)
  ctx.closePath()
  ctx.fill()
  // Rocks.
  for (let i = from; i <= to; i++) {
    if (hash(i + 17) > 0.12) continue
    const rx = X(v, i * 40)
    const r = (18 + hash(i + 21) * 26) * v.ppu
    ctx.fillStyle = css(pal.rock)
    ctx.beginPath()
    ctx.ellipse(rx, fy, r * 1.4, r, 0, Math.PI, Math.PI * 2)
    ctx.fill()
    // Glowing moss over its face, and a rim of light.
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = 'rgba(111, 244, 255, 0.28)'
    ctx.lineWidth = Math.max(1.5, 2.2 * v.ppu)
    ctx.beginPath()
    ctx.ellipse(rx, fy, r * 1.4, r, 0, Math.PI, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    for (let k = 0; k < 6; k++) {
      const a = Math.PI + hash(i * 7 + k) * Math.PI
      const d = Math.sqrt(hash(i * 3 + k * 5)) * 0.8
      const mx = rx + Math.cos(a) * r * 1.4 * d
      const my = fy + Math.sin(a) * r * d
      const color = PLANKTON[(i + k) % PLANKTON.length]!
      ctx.fillStyle = color
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.arc(mx, my, Math.max(1, 1.8 * v.ppu), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      lights.push({ x: mx, y: my, r: 12 * v.ppu, color, strength: 0.5 })
    }
  }
}

/** Rock walls past the ocean's ends, so you can see where it stops. */
function drawWalls(ctx: CanvasRenderingContext2D, v: View, pal: Palette) {
  ctx.fillStyle = css(pal.rock)
  const lx = X(v, 0)
  if (lx > 0) ctx.fillRect(0, Math.max(0, Y(v, -20)), lx, v.h)
  const rx = X(v, OCEAN_W)
  if (rx < v.w) ctx.fillRect(rx, Math.max(0, Y(v, -20)), v.w - rx, v.h)
}

/** The surface: a band of waves, light on top. */
function drawSurface(ctx: CanvasRenderingContext2D, v: View, pal: Palette) {
  const sy = Y(v, 0)
  if (sy < -20 || sy > v.h + 20) return
  const t = v.s.time
  const wave = (px: number) => {
    const wx = v.x0 + px / v.ppu
    return sy + (Math.sin(wx * 0.04 + t * 2.2) * 2.2 + Math.sin(wx * 0.017 - t * 1.3) * 2.8) * v.ppu
  }
  ctx.fillStyle = css(mix(pal.shallow, [255, 255, 255], 0.25), 0.9)
  ctx.beginPath()
  ctx.moveTo(0, sy + 8 * v.ppu)
  for (let px = 0; px <= v.w + 12; px += 12) ctx.lineTo(px, wave(px))
  ctx.lineTo(v.w, sy + 8 * v.ppu)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = pal.dark ? 'rgba(220, 240, 255, 0.55)' : 'rgba(255, 255, 255, 0.95)'
  ctx.lineWidth = Math.max(1.5, 2.2 * v.ppu)
  ctx.beginPath()
  for (let px = 0; px <= v.w + 12; px += 12) (px === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, px, wave(px))
  ctx.stroke()
}

function drawGulls(ctx: CanvasRenderingContext2D, v: View) {
  for (const g of v.s.gulls) {
    const x = X(v, g.x)
    const y = Y(v, g.y)
    if (x < -40 || x > v.w + 40 || y < -40 || y > v.h + 40) continue
    const k = Math.max(0.8, v.ppu)
    const flap = Math.sin(g.flap) * 7 * k
    const dir = g.vx >= 0 ? 1 : -1
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(dir, 1)
    ctx.strokeStyle = '#3b4a56'
    ctx.lineWidth = 1.6 * k
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#c9d2d9'
    // Wings.
    ctx.beginPath()
    ctx.moveTo(-2 * k, 0)
    ctx.quadraticCurveTo(-10 * k, -8 * k - flap, -20 * k, -2 * k - flap)
    ctx.quadraticCurveTo(-10 * k, -1 * k, -2 * k, 3 * k)
    ctx.moveTo(2 * k, 0)
    ctx.quadraticCurveTo(8 * k, -8 * k - flap, 18 * k, -2 * k - flap)
    ctx.quadraticCurveTo(9 * k, -1 * k, 2 * k, 3 * k)
    ctx.fill()
    ctx.stroke()
    // Body, head, beak.
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(0, 2 * k, 8 * k, 4 * k, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(8 * k, -0.5 * k, 3.4 * k, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = PALETTE.orange
    ctx.beginPath()
    ctx.moveTo(11 * k, -1 * k)
    ctx.lineTo(15.5 * k, 0.4 * k)
    ctx.lineTo(11 * k, 1.2 * k)
    ctx.fill()
    ctx.fillStyle = '#16202a'
    ctx.beginPath()
    ctx.arc(9 * k, -1.4 * k, 0.9 * k, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/** Under the surface: the fisherman's line, his hook, and the worm on it (or whatever bit). */
function drawLine(ctx: CanvasRenderingContext2D, v: View, pal: Palette) {
  const b = v.s.boat
  if (b.stage === 'rest' || b.stage === 'sail') return
  const tip = rodTip(b)
  const tx = X(v, tip.x)
  const hy = Y(v, b.hookY)
  if (tx < -60 || tx > v.w + 60) return
  const k = Math.max(0.8, v.ppu)
  ctx.save()
  ctx.strokeStyle = pal.dark ? 'rgba(230, 236, 242, 0.7)' : 'rgba(30, 40, 50, 0.6)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(tx, Y(v, tip.y))
  ctx.quadraticCurveTo(tx + Math.sin(v.s.time * 1.3) * 6 * k, (Y(v, tip.y) + hy) / 2, tx, hy - 6 * k)
  ctx.stroke()
  const caught = b.caught
  if (caught && caught !== 'you') {
    const T = TIERS[caught.tier]!
    drawOne(ctx, v, pal, SPECIES[caught.species].art, { x: tip.x, y: b.hookY + T.r * 1.1, angle: -Math.PI / 2, roll: 1, swim: v.s.time * 9, mouth: 1, seed: 5 }, T.r, { amp: 1.6 })
  } else if (caught === 'you') {
    drawOne(ctx, v, pal, playerArt(v.s.player.size), { x: tip.x, y: b.hookY + playerRadius(v.s), angle: -Math.PI / 2, roll: 1, swim: v.s.time * 9, mouth: 1, seed: 7 }, playerRadius(v.s), { amp: 1.6, fill: 0.55 })
  } else if (b.stage === 'cast' || b.stage === 'wait') {
    // The worm, wriggling.
    ctx.strokeStyle = '#e85d9a'
    ctx.lineWidth = 3.2 * k
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i <= 8; i++) {
      const wx = tx + Math.sin(v.s.time * 7 + i * 0.9) * 3 * k
      const wy = hy - 2 * k + i * 1.6 * k
      if (i === 0) ctx.moveTo(wx, wy)
      else ctx.lineTo(wx, wy)
    }
    ctx.stroke()
  }
  // The hook.
  ctx.strokeStyle = pal.dark ? '#d8dee4' : '#55626d'
  ctx.lineWidth = 1.8 * k
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(tx, hy - 7 * k)
  ctx.lineTo(tx, hy + 6 * k)
  ctx.arc(tx - 4 * k, hy + 6 * k, 4 * k, 0, Math.PI, false)
  ctx.lineTo(tx - 8 * k, hy + 2 * k)
  ctx.stroke()
  ctx.restore()
}

/**
 * On the surface: the fisherman's trawler, rod out over the water. Ramsey picked B, Trawler captain, of three
 * on the "Frenzy fisherman" canvas (2026-10-07, "the fisherman needs a little redesign"): a little red fishing
 * boat with a white wheelhouse, a stack and a lifebuoy, the captain at the rail in his cap and a ginger beard.
 * The rod's tip stays where game.ts rodTip has it, so the line and hook hang from it as before.
 */
function drawBoat(ctx: CanvasRenderingContext2D, v: View) {
  const b = v.s.boat
  const x = X(v, b.x)
  const k = v.ppu
  if (x < -90 * k || x > v.w + 90 * k) return
  const bob = Math.sin(v.s.time * 1.6) * 2 * k
  const y = Y(v, 0) + bob
  const ink = '#3b2a1e'
  const line = (w: number) => Math.max(1, w * k)
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(b.dir, 1)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = ink
  ctx.lineWidth = line(2)

  // The wheelhouse behind him: white, a navy roof, a round window, a red stack, a lifebuoy on its side.
  ctx.fillStyle = '#f4f2ee'
  ctx.beginPath()
  ctx.roundRect(-40 * k, -34 * k, 22 * k, 22 * k, 3 * k)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#2f5d7c'
  ctx.beginPath()
  ctx.roundRect(-42 * k, -38 * k, 26 * k, 5 * k, 2 * k)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#9fd6f2'
  ctx.beginPath()
  ctx.arc(-29 * k, -24 * k, 4 * k, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = PALETTE.red
  ctx.beginPath()
  ctx.rect(-36 * k, -46 * k, 5 * k, 8 * k)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#1e2a33'
  ctx.fillRect(-36 * k, -47 * k, 5 * k, 2.4 * k)
  ctx.lineWidth = line(2.6)
  ctx.strokeStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(-40 * k, -18 * k, 3.4 * k, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = PALETTE.red
  ctx.setLineDash([2.6 * k, 2.6 * k])
  ctx.stroke()
  ctx.setLineDash([])

  // The captain: a navy sweater with pale stripes, his arm out to the rod.
  ctx.strokeStyle = ink
  ctx.lineWidth = line(1.8)
  ctx.fillStyle = '#2b3f5c'
  ctx.beginPath()
  ctx.moveTo(-15 * k, -12 * k)
  ctx.lineTo(-14 * k, -26 * k)
  ctx.quadraticCurveTo(-13 * k, -31 * k, -7 * k, -31 * k)
  ctx.quadraticCurveTo(-1 * k, -31 * k, 0, -26 * k)
  ctx.lineTo(1 * k, -12 * k)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.lineWidth = line(1)
  ctx.beginPath()
  for (const sy of [-24, -20, -16]) {
    ctx.moveTo(-13 * k, sy * k)
    ctx.lineTo(0, sy * k)
  }
  ctx.stroke()
  ctx.strokeStyle = ink
  ctx.lineWidth = line(1.8)
  ctx.fillStyle = '#2b3f5c'
  ctx.beginPath()
  ctx.moveTo(-5 * k, -27 * k)
  ctx.quadraticCurveTo(0, -27 * k, 1 * k, -22 * k)
  ctx.lineTo(-3 * k, -20 * k)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // His head, ginger beard and eye, and his white cap with its black peak and gold badge.
  ctx.fillStyle = '#f2c9a0'
  ctx.beginPath()
  ctx.arc(-7 * k, -36 * k, 5.4 * k, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#c4622e'
  ctx.beginPath()
  ctx.moveTo(-12 * k, -36 * k)
  ctx.quadraticCurveTo(-11 * k, -29 * k, -6 * k, -30 * k)
  ctx.quadraticCurveTo(-2 * k, -31 * k, -1.8 * k, -35 * k)
  ctx.quadraticCurveTo(-6 * k, -33 * k, -12 * k, -36 * k)
  ctx.fill()
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(-4.5 * k, -37.5 * k, 0.8 * k, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f4f2ee'
  ctx.beginPath()
  ctx.roundRect(-13 * k, -45 * k, 12 * k, 5 * k, 2 * k)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#1e2a33'
  ctx.beginPath()
  ctx.moveTo(-3 * k, -40.5 * k)
  ctx.lineTo(3 * k, -40 * k)
  ctx.lineTo(-2 * k, -39 * k)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = PALETTE.amber
  ctx.fillRect(-9 * k, -44 * k, 3 * k, 2 * k)

  // The rod: from his hands to its tip (game.ts rodTip), bent a little when something's on, a reel by his hands.
  ctx.strokeStyle = '#5a3d26'
  ctx.lineWidth = line(2.2)
  ctx.beginPath()
  ctx.moveTo(-2 * k, -22 * k)
  ctx.quadraticCurveTo(14 * k, (b.caught ? -30 : -36) * k, 30 * k, -38 * k)
  ctx.stroke()
  ctx.fillStyle = '#c9ced6'
  ctx.strokeStyle = ink
  ctx.lineWidth = line(1.2)
  ctx.beginPath()
  ctx.arc(3 * k, -25 * k, 2.6 * k, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // The hull: red over a dark waterline, a white rail, its name on the bow.
  ctx.lineWidth = line(2)
  ctx.fillStyle = '#d6453f'
  ctx.beginPath()
  ctx.moveTo(-46 * k, -13 * k)
  ctx.lineTo(34 * k, -16 * k)
  ctx.quadraticCurveTo(30 * k, 2 * k, 18 * k, 6 * k)
  ctx.lineTo(-38 * k, 6 * k)
  ctx.quadraticCurveTo(-46 * k, 0, -46 * k, -13 * k)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#1e2a33'
  ctx.beginPath()
  ctx.moveTo(-43 * k, 1 * k)
  ctx.lineTo(26 * k, 1 * k)
  ctx.quadraticCurveTo(22 * k, 5 * k, 18 * k, 6 * k)
  ctx.lineTo(-38 * k, 6 * k)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = line(1.6)
  ctx.beginPath()
  ctx.moveTo(-44 * k, -9 * k)
  ctx.lineTo(31 * k, -12 * k)
  ctx.stroke()
  // The name reads the right way round whichever way he's sailing.
  ctx.save()
  ctx.translate(20.5 * k, -4.5 * k)
  ctx.scale(b.dir, 1)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${4.4 * k}px Outfit, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('BLIP', 0, 0)
  ctx.restore()
  ctx.restore()
}

function drawOne(
  ctx: CanvasRenderingContext2D,
  v: View,
  pal: Palette,
  art: FishArt,
  at: { x: number; y: number; angle: number; roll: number; swim: number; mouth: number; seed: number },
  r: number,
  o: { alarm?: number; amp?: number; alpha?: number; fill?: number; threat?: number } = {},
) {
  const x = X(v, at.x)
  const y = Y(v, at.y)
  const reach = r * art.length * v.ppu
  if (x < -reach * 1.5 || x > v.w + reach * 1.5 || y < -reach || y > v.h + reach) return
  const alpha = o.alpha ?? 1
  const local: Glow[] = []
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(at.angle)
  ctx.scale(1, rollScale(at.roll))
  drawFish(
    ctx,
    art,
    { length: reach, swim: at.swim, amp: o.amp ?? 0.9, mouth: at.mouth, lookX: 1, lookY: 0.05, alarm: o.alarm ?? 0, puff: 0, time: v.s.time, biolume: lumAt(at.y) },
    at.seed,
    local,
    paintFor(art, pal, o.fill, o.threat !== undefined),
  )
  ctx.restore()
  placeLights(local, x, y, at.angle, at.roll, alpha)
  // A threat's red glow, stronger as it comes for you.
  if (o.threat !== undefined) lights.push({ x, y, r: reach * 0.95, color: DANGER, strength: (0.22 + 0.4 * o.threat) * alpha })
}

function drawFishes(ctx: CanvasRenderingContext2D, v: View, pal: Palette, threats: boolean) {
  const s = v.s
  const size = s.player.size
  const live = s.phase !== 'menu'
  for (const f of s.fishes) {
    const threat = live && !edible(f.tier, size)
    if (threat !== threats) continue
    // Anything that can eat you: a red outline and glow, and a red eye, redder as it comes for you.
    drawOne(ctx, v, pal, SPECIES[f.species].art, f, fishRadius(f), {
      alarm: threat ? Math.max(0.6, f.hunt) : 0,
      amp: f.hunt > 0.5 ? 1.3 : 0.85,
      alpha: f.fade,
      threat: threat ? f.hunt : undefined,
    })
  }
}

/** A red "!" over anything coming for you. */
function drawAlerts(ctx: CanvasRenderingContext2D, v: View) {
  const s = v.s
  if (s.phase !== 'playing') return
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 15px ${FONT}`
  for (const f of s.fishes) {
    if (f.hunt < 0.3 || edible(f.tier, s.player.size)) continue
    const x = X(v, f.x)
    const y = Y(v, f.y) - fishRadius(f) * v.ppu - 16
    if (x < -20 || x > v.w + 20 || y < -20 || y > v.h + 20) continue
    ctx.globalAlpha = Math.min(1, (f.hunt - 0.3) * 3)
    ctx.fillStyle = PALETTE.red
    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText('!', x, y + 1)
  }
  ctx.restore()
}

function drawPlayer(ctx: CanvasRenderingContext2D, v: View, pal: Palette) {
  const s = v.s
  const p = s.player
  if (s.phase !== 'playing') return
  // Blinks while it can't be hurt.
  if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 1) return
  const r = playerRadius(s)
  if (s.frenzy > 0) {
    const g = ctx.createRadialGradient(X(v, p.x), Y(v, p.y), 0, X(v, p.x), Y(v, p.y), r * 2.6 * v.ppu)
    g.addColorStop(0, `rgba(245, 185, 66, ${0.35 + 0.15 * Math.sin(s.time * 10)})`)
    g.addColorStop(1, 'rgba(245, 185, 66, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(X(v, p.x), Y(v, p.y), r * 2.6 * v.ppu, 0, Math.PI * 2)
    ctx.fill()
  }
  drawOne(ctx, v, pal, playerArt(p.size), { ...p, seed: 7 }, r, { amp: p.air ? 0.4 : 1.1, fill: 0.55 })
}

function drawShark(ctx: CanvasRenderingContext2D, v: View, pal: Palette) {
  const k = v.s.shark
  if (!k) return
  if (k.stage === 'warn') {
    // A "!" at the edge it will come from, at its depth, blinking.
    const blink = 0.55 + 0.45 * Math.sin(v.s.time * 18)
    const ex = k.dir > 0 ? 24 : v.w - 24
    const ey = Math.max(30, Math.min(v.h - 70, Y(v, k.y)))
    ctx.save()
    ctx.globalAlpha = blink
    ctx.fillStyle = PALETTE.red
    ctx.beginPath()
    ctx.arc(ex, ey, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 22px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', ex, ey + 1)
    ctx.strokeStyle = PALETTE.red
    ctx.lineWidth = 3
    ctx.setLineDash([8, 8])
    ctx.beginPath()
    ctx.moveTo(ex + k.dir * 26, ey)
    ctx.lineTo(ex + k.dir * 90, ey)
    ctx.stroke()
    ctx.restore()
    return
  }
  const art = SPECIES.shark.art
  drawOne(ctx, v, pal, art, { x: k.x, y: k.y, angle: k.dir > 0 ? 0 : Math.PI, roll: k.dir, swim: k.swim, mouth: 1, seed: 3 }, (k.r * 2.2) / art.length, {
    alarm: 1,
    amp: 1.4,
    fill: 0.5,
  })
}

function drawEffects(ctx: CanvasRenderingContext2D, v: View, pal: Palette) {
  const s = v.s
  for (const q of s.particles) {
    ctx.globalAlpha = 1 - q.t / q.life
    ctx.fillStyle = q.drop || !pal.dark ? 'rgba(255, 255, 255, 0.95)' : q.color
    ctx.beginPath()
    ctx.arc(X(v, q.x), Y(v, q.y), q.r * Math.max(0.8, v.ppu), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of s.floaters) {
    const big = f.tone === 'grow'
    const life = big ? 1.6 : 0.9
    ctx.globalAlpha = Math.min(1, (1 - f.t / life) * 1.6)
    const size = Math.round((big ? 22 : 15) * Math.max(0.85, Math.min(1.3, v.ppu)))
    ctx.font = `800 ${size}px ${FONT}`
    const deep = f.y > 260
    const colour = f.tone === 'hot' ? PALETTE.amber : f.tone === 'grow' ? PALETTE.green : f.tone === 'bad' ? PALETTE.red : deep ? pal.inkDeep : pal.inkShallow
    const x = X(v, f.x)
    const y = Y(v, f.y) - f.t * 36
    ctx.lineWidth = 4
    ctx.strokeStyle = deep || pal.dark ? 'rgba(8, 18, 28, 0.85)' : 'rgba(255, 255, 255, 0.9)'
    ctx.strokeText(f.text, x, y)
    ctx.fillStyle = colour
    ctx.fillText(f.text, x, y)
  }
  ctx.globalAlpha = 1
}

/** Along the bottom: your lives, the bar to your next size, and the chain. */
function drawBar(ctx: CanvasRenderingContext2D, v: View, pal: Palette) {
  const s = v.s
  if (s.phase === 'menu' || s.phase === 'gameover') return
  const bw = Math.min(240, v.w * 0.42)
  const bh = 14
  const bx = (v.w - bw) / 2
  const by = v.h - 30 - bh
  ctx.save()
  ctx.fillStyle = pal.dark ? 'rgba(8, 18, 28, 0.6)' : 'rgba(8, 18, 28, 0.45)'
  ctx.beginPath()
  ctx.roundRect(bx - 112, by - 8, bw + 166, bh + 16, 15)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, bh / 2)
  ctx.fill()
  const fill = barFill(s)
  if (fill > 0) {
    ctx.globalAlpha = s.frenzy > 0 ? 0.75 + 0.25 * Math.sin(s.time * 12) : 1
    ctx.fillStyle = s.player.size >= MAX_SIZE ? PALETTE.amber : PALETTE.green
    ctx.beginPath()
    ctx.roundRect(bx, by, Math.max(bh, bw * fill), bh, bh / 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  // What you are, and at the top what the bar fills toward.
  ctx.font = `800 12px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = s.frenzy > 0 || s.player.size >= MAX_SIZE ? PALETTE.amber : '#eef4f7'
  const label = s.frenzy > 0 ? 'FRENZY ×2' : s.player.size >= MAX_SIZE ? `${STAGES[s.player.size]} · fill for a frenzy` : `${STAGES[s.player.size]} → ${STAGES[s.player.size + 1]}`
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(8, 18, 28, 0.7)'
  ctx.strokeText(label.toUpperCase(), bx + bw / 2, by - 12)
  ctx.fillText(label.toUpperCase(), bx + bw / 2, by - 12)
  // Lives: little fish to the left of the bar.
  const art = playerArt(0)
  for (let i = 0; i < 3; i++) {
    const lx = bx - 22 - (2 - i) * 31
    ctx.save()
    ctx.globalAlpha = i < s.lives ? 1 : 0.25
    ctx.translate(lx, by + bh / 2)
    drawFish(ctx, art, { length: 18, swim: s.time * 4 + i, amp: 0.6, mouth: 0, lookX: 1, lookY: 0, alarm: 0, puff: 0, time: s.time }, i, null, paintFor(art, pal, 0.55))
    ctx.restore()
  }
  // The chain, to the right.
  const mult = chainOf(s)
  ctx.font = `800 16px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = mult > 2 ? PALETTE.amber : '#eef4f7'
  ctx.fillText(s.chain > 1 ? `×${mult}` : '', bx + bw + 12, by + bh / 2 + 1)
  ctx.restore()
}

export function renderGame(ctx: CanvasRenderingContext2D, s: GameState, width: number, height: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const canvas = ctx.canvas
  const cw = Math.floor(width * dpr)
  const ch = Math.floor(height * dpr)
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw
    canvas.height = ch
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const pal = paletteNow()
  const v: View = { s, w: width, h: height, ppu: s.ppu, x0: s.camX - width / 2 / s.ppu, y0: s.camY - height / 2 / s.ppu }
  lights = []
  ctx.fillStyle = css(pal.deep)
  ctx.fillRect(0, 0, width, height)
  drawSky(ctx, v, pal)
  drawWater(ctx, v, pal)
  drawPlankton(ctx, v)
  drawFloor(ctx, v, pal)
  drawWalls(ctx, v, pal)
  drawJellies(ctx, v)
  drawLine(ctx, v, pal)
  drawFishes(ctx, v, pal, false)
  drawGulls(ctx, v)
  drawPlayer(ctx, v, pal)
  drawFishes(ctx, v, pal, true)
  drawShark(ctx, v, pal)
  drawSurface(ctx, v, pal)
  drawBoat(ctx, v)
  drawDark(ctx, v)
  drawLights(ctx)
  drawAlerts(ctx, v)
  drawEffects(ctx, v, pal)
  drawBar(ctx, v, pal)
}
