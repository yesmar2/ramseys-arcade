import { PALETTE, type Swatch } from '../../data/games'
import { isDarkTheme, playfieldColor } from '../../lib/theme'
import { drawFish, type FishPaint } from './fishArt'
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
function paintFor(art: FishArt, pal: Palette, fill = 0.42): FishPaint {
  const key = `${art.swatch}|${art.tailSwatch ?? ''}|${art.pattern}|${fill}`
  const cached = paints.get(key)
  if (cached) return cached
  const under = mix(pal.shallow, pal.deep, 0.35)
  const hue = hueOf(toRgb(PALETTE[art.swatch as Swatch]))
  const tailHue = art.tailSwatch ? hueOf(toRgb(PALETTE[art.tailSwatch])) : hue
  const lineL = pal.dark ? 66 : 40
  const soft = (h: number, amount: number) => css(mix(under, hslToRgb(h, 0.66, 0.58), amount))
  const line = `hsla(${hue}, 64%, ${lineL}%, 0.95)`
  const fin = soft(hue, fill * 0.62)
  const lightMarks = art.pattern === 'bands' || art.pattern === 'lateral'
  const made: FishPaint = {
    body: soft(hue, fill),
    fin,
    tail: art.tailSwatch ? soft(tailHue, Math.min(0.9, fill * 2)) : fin,
    line,
    tailLine: `hsla(${tailHue}, 64%, ${lineL}%, 0.95)`,
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

/** On the surface: the fisherman in his boat, rod out over the water. */
function drawBoat(ctx: CanvasRenderingContext2D, v: View) {
  const b = v.s.boat
  const x = X(v, b.x)
  const k = v.ppu
  if (x < -90 * k || x > v.w + 90 * k) return
  const bob = Math.sin(v.s.time * 1.6) * 2 * k
  const y = Y(v, 0) + bob
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(b.dir, 1)
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1.2, 2 * k)
  ctx.strokeStyle = '#3b2a1e'
  // The fisherman: hat, head, coat, arm out to the rod.
  ctx.fillStyle = PALETTE.amber
  ctx.beginPath()
  ctx.roundRect(-14 * k, -30 * k, 14 * k, 18 * k, 4 * k)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#f2c9a0'
  ctx.beginPath()
  ctx.arc(-7 * k, -36 * k, 6 * k, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#2f5d7c'
  ctx.beginPath()
  ctx.ellipse(-7 * k, -41 * k, 10 * k, 2.5 * k, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(-12 * k, -48 * k, 10 * k, 8 * k, 2 * k)
  ctx.fill()
  // The rod: from his hands to its tip (game.ts rodTip), bent a little when something's on.
  ctx.strokeStyle = '#5a3d26'
  ctx.lineWidth = Math.max(1.2, 2.2 * k)
  ctx.beginPath()
  ctx.moveTo(-2 * k, -22 * k)
  ctx.quadraticCurveTo(14 * k, (b.caught ? -30 : -36) * k, 30 * k, -38 * k)
  ctx.stroke()
  // The hull.
  ctx.fillStyle = PALETTE.red
  ctx.strokeStyle = '#3b2a1e'
  ctx.lineWidth = Math.max(1.2, 2 * k)
  ctx.beginPath()
  ctx.moveTo(-40 * k, -12 * k)
  ctx.lineTo(30 * k, -12 * k)
  ctx.lineTo(22 * k, 6 * k)
  ctx.lineTo(-32 * k, 6 * k)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.fillRect(-36 * k, -9 * k, 62 * k, 3 * k)
  ctx.restore()
}

function drawOne(
  ctx: CanvasRenderingContext2D,
  v: View,
  pal: Palette,
  art: FishArt,
  at: { x: number; y: number; angle: number; roll: number; swim: number; mouth: number; seed: number },
  r: number,
  o: { alarm?: number; amp?: number; alpha?: number; fill?: number } = {},
) {
  const x = X(v, at.x)
  const y = Y(v, at.y)
  const reach = r * art.length * v.ppu
  if (x < -reach * 1.5 || x > v.w + reach * 1.5 || y < -reach || y > v.h + reach) return
  ctx.save()
  ctx.globalAlpha = o.alpha ?? 1
  ctx.translate(x, y)
  ctx.rotate(at.angle)
  ctx.scale(1, rollScale(at.roll))
  drawFish(
    ctx,
    art,
    { length: reach, swim: at.swim, amp: o.amp ?? 0.9, mouth: at.mouth, lookX: 1, lookY: 0.05, alarm: o.alarm ?? 0, puff: 0, time: v.s.time },
    at.seed,
    null,
    paintFor(art, pal, o.fill),
  )
  ctx.restore()
}

function drawFishes(ctx: CanvasRenderingContext2D, v: View, pal: Palette, threats: boolean) {
  const s = v.s
  const size = s.player.size
  const live = s.phase !== 'menu'
  for (const f of s.fishes) {
    const threat = live && !edible(f.tier, size)
    if (threat !== threats) continue
    // Anything that can eat you has a red eye, redder as it comes for you.
    drawOne(ctx, v, pal, SPECIES[f.species].art, f, fishRadius(f), {
      alarm: threat ? Math.max(0.45, f.hunt) : 0,
      amp: f.hunt > 0.5 ? 1.3 : 0.85,
      alpha: f.fade,
    })
  }
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
  ctx.fillStyle = css(pal.deep)
  ctx.fillRect(0, 0, width, height)
  drawSky(ctx, v, pal)
  drawWater(ctx, v, pal)
  drawFloor(ctx, v, pal)
  drawWalls(ctx, v, pal)
  drawLine(ctx, v, pal)
  drawFishes(ctx, v, pal, false)
  drawGulls(ctx, v)
  drawPlayer(ctx, v, pal)
  drawFishes(ctx, v, pal, true)
  drawShark(ctx, v, pal)
  drawSurface(ctx, v, pal)
  drawBoat(ctx, v)
  drawEffects(ctx, v, pal)
  drawBar(ctx, v, pal)
}
