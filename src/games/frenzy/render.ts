import { PALETTE, type Swatch } from '../../data/games'
import { isDarkTheme, playfieldColor } from '../../lib/theme'
import { BLIP_BODY, BLIP_FISH, blipTilt, drawBlipFish, drawBlipShine, type BlipPaint } from './blipFish'
import { drawFish, type FishPaint, type Glow } from './fishArt'
import {
  FLOOR,
  JELLY_REACH,
  MAX_SIZE,
  MINE_BLAST,
  OCEAN_W,
  STAGES,
  TIERS,
  barFill,
  chainOf,
  edible,
  fishRadius,
  hookX,
  playerRadius,
  rodTip,
  viewHalf,
  type GameState,
} from './game'
import { SPECIES, playerArt, type FishArt } from './species'

/*
 * The open ocean, drawn back to front through the camera: the sky and its sun, the water deepening down
 * to the sea floor with its sand, kelp and rocks, light from above and drifting specks, the rock walls at
 * the ocean's ends, the jellyfish and the sea mines, the fisherman's line and hook, the fish smaller than you,
 * you, the ones that can eat you (so a threat is never hidden behind a meal), the shark and its warning, a
 * mine's blast, the surface's waves, the
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

let blipPaint: { key: string; paint: BlipPaint } | null = null

/**
 * Blip's colours (the skin frenzy-blip, blipFish.ts): his own mints from BlipFigure, sunk a touch into the water as
 * everything in it is, his fins a thinner wash, and the sea's outline in his hue, light on the dark water as every
 * fish's is and dark on the pale.
 */
function blipPaintFor(pal: Palette): BlipPaint {
  if (blipPaint?.key === pal.key) return blipPaint.paint
  const under = mix(pal.shallow, pal.deep, 0.35)
  const paint: BlipPaint = {
    body: css(mix(under, [52, 198, 168], 0.92)),
    shade: css(mix(under, [31, 155, 132], 0.92)),
    fin: css(mix(under, [31, 155, 132], 0.78)),
    feet: css(mix(under, [22, 122, 105], 0.94)),
    line: pal.dark ? 'hsla(166, 70%, 72%, 0.95)' : 'hsla(168, 78%, 24%, 0.95)',
    glow: pal.dark ? '159, 247, 226' : '52, 198, 168',
    core: '#f2fffb',
    ring: pal.dark ? null : 'rgba(22, 122, 105, 0.9)',
    light: '#9ff7e2',
  }
  blipPaint = { key: pal.key, paint }
  return paint
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
 * The jellyfish (game.ts moveJellies), which sting: each bobbing on its pulse, its bell's edge bright and its
 * tentacles trailing, ending in points of light that glow in the deep. They used to be scenery, drifting
 * harmless in the deep; since they sting (Ramsey, 2026-10-09: "maybe we can also add jelly fish that sting and
 * stun") they're game things, and none are drawn that can't sting, so there's no telling the two apart.
 */
function drawJellies(ctx: CanvasRenderingContext2D, v: View) {
  const s = v.s
  for (const j of s.jellies) {
    const R = j.r * v.ppu
    const x = X(v, j.x)
    const y = Y(v, j.y)
    if (x < -R * 3 || x > v.w + R * 3 || y < -R * 4 || y > v.h + R * 2) continue
    const lum = lumAt(j.y)
    const hue = j.hue
    const beat = Math.sin(j.beat)
    const rx = R * (1 - 0.1 * beat)
    const ry = R * 0.82 * (1 + 0.14 * beat)
    ctx.save()
    ctx.globalAlpha = j.fade
    ctx.lineCap = 'round'
    ctx.strokeStyle = `hsla(${hue}, 75%, 70%, 0.8)`
    ctx.lineWidth = Math.max(1.2, R * 0.07)
    for (let i = 0; i < 7; i++) {
      const bx = x + (i / 6 - 0.5) * 1.5 * rx * 0.8
      const len = R * (JELLY_REACH - 0.35 + (i % 3) * 0.2)
      ctx.beginPath()
      ctx.moveTo(bx, y)
      for (let k = 1; k <= 7; k++) {
        const t = k / 7
        ctx.lineTo(bx + Math.sin(s.time * 2.4 + i * 1.3 + j.seed * 9 + t * 5) * R * 0.18 * t, y + len * t)
      }
      ctx.stroke()
      if (i % 2 === 0) lights.push({ x: bx + Math.sin(s.time * 2.4 + i * 1.3 + j.seed * 9 + 5) * R * 0.18, y: y + len, r: R * 0.6, color: `hsl(${hue}, 92%, 76%)`, strength: 0.6 * lum })
    }
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0)
    ctx.closePath()
    ctx.fillStyle = `hsla(${hue}, 72%, 60%, 0.42)`
    ctx.fill()
    ctx.strokeStyle = `hsla(${hue}, 85%, 74%, 1)`
    ctx.lineWidth = Math.max(1.5, R * 0.1)
    ctx.stroke()
    // A shine across the bell.
    ctx.beginPath()
    ctx.ellipse(x - rx * 0.3, y - ry * 0.55, rx * 0.28, ry * 0.14, -0.3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.fill()
    ctx.restore()
    lights.push({ x, y: y - ry * 0.2, r: R * 2.6, color: `hsl(${hue}, 85%, 72%)`, strength: 0.55 * lum })
  }
}

/**
 * The sea mines (game.ts moveMines), drawn as the old open-ocean Frenzy drew them: a dark ball on a chain into
 * the deep, six horns and a band round its middle, and a red light on top that blinks slowly while it waits and
 * fast once it ticks, when the reach of its blast shows as a dashed red ring. In the dark a red glow keeps it in
 * sight.
 */
function drawMines(ctx: CanvasRenderingContext2D, v: View) {
  const s = v.s
  const hot = PALETTE.red
  for (const m of s.mines) {
    const R = m.r * v.ppu
    const x = X(v, m.x)
    const y = Y(v, m.y + Math.sin(m.bob * 1.3) * m.r * 0.15)
    const armed = m.fuse >= 0
    const reach = armed ? m.r * MINE_BLAST * v.ppu : R * 1.4
    if (x < -reach - 10 || x > v.w + reach + 10 || y < -reach - 10 || y > v.h + reach + R * 5) continue
    const lum = lumAt(m.y)
    ctx.save()
    ctx.globalAlpha = m.fade
    ctx.lineCap = 'round'
    // Its chain, down into the dark.
    ctx.lineWidth = Math.max(1, R * 0.08)
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = `rgba(206, 214, 224, ${0.4 * (1 - i / 9)})`
      ctx.beginPath()
      ctx.ellipse(x, y + R * 1.05 + i * R * 0.42, R * (i % 2 ? 0.05 : 0.1), R * 0.2, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    // Six horns.
    ctx.strokeStyle = hot
    ctx.lineWidth = Math.min(3.5, Math.max(1.5, R * 0.16))
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8)
      ctx.lineTo(x + Math.cos(a) * R * 1.3, y + Math.sin(a) * R * 1.3)
      ctx.stroke()
    }
    // The ball, lit from above, and the band round it.
    const shade = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R)
    shade.addColorStop(0, '#6b5866')
    shade.addColorStop(1, '#251b24')
    ctx.beginPath()
    ctx.arc(x, y, R, 0, Math.PI * 2)
    ctx.fillStyle = shade
    ctx.fill()
    ctx.lineWidth = Math.min(3, Math.max(1.5, R * 0.1))
    ctx.stroke()
    ctx.strokeStyle = 'rgba(232, 86, 79, 0.45)'
    ctx.lineWidth = Math.max(1, R * 0.06)
    ctx.beginPath()
    ctx.ellipse(x, y, R * 0.98, R * 0.3, 0, 0, Math.PI * 2)
    ctx.stroke()
    // Its light: a slow blink while it waits, a fast one once it ticks.
    const on = armed ? Math.sin(s.time * 10 * Math.PI * 2) > 0 : (s.time * 0.9 + m.id * 0.37) % 1 < 0.14
    ctx.fillStyle = on ? '#ff4d6d' : 'rgba(120, 40, 52, 0.9)'
    ctx.beginPath()
    ctx.arc(x, y - R * 0.45, R * 0.17, 0, Math.PI * 2)
    ctx.fill()
    if (on) lights.push({ x, y: y - R * 0.45, r: R * (armed ? 2.4 : 1.4), color: '#ff4d6d', strength: armed ? 0.9 : 0.55 })
    if (armed) {
      // How far it will reach, dashed and pulsing.
      ctx.globalAlpha = m.fade * (0.5 + 0.25 * Math.sin(s.time * 20))
      ctx.strokeStyle = hot
      ctx.lineWidth = 2
      ctx.lineCap = 'butt'
      ctx.setLineDash([8, 7])
      ctx.beginPath()
      ctx.arc(x, y, reach, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = m.fade * 0.1
      ctx.fillStyle = hot
      ctx.fill()
    }
    ctx.restore()
    lights.push({ x, y, r: R * 2.2, color: '#ff4d6d', strength: 0.3 * lum * m.fade })
  }
}

/** A mine going off: a hot flash swelling out to its reach, and a white ring running ahead of it. */
function drawBlasts(ctx: CanvasRenderingContext2D, v: View) {
  for (const b of v.s.blasts) {
    const x = X(v, b.x)
    const y = Y(v, b.y)
    const R = b.r * v.ppu
    const t = 1 - b.life
    const core = R * (0.3 + 0.7 * t)
    ctx.save()
    const grad = ctx.createRadialGradient(x, y, 0, x, y, core)
    grad.addColorStop(0, `rgba(255, 250, 225, ${0.95 * b.life})`)
    grad.addColorStop(0.4, `rgba(255, 196, 92, ${0.7 * b.life})`)
    grad.addColorStop(1, 'rgba(255, 110, 50, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, core, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * b.life})`
    ctx.lineWidth = Math.max(1, R * 0.08 * b.life)
    ctx.beginPath()
    ctx.arc(x, y, R * (0.2 + 0.95 * t), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    lights.push({ x, y, r: R * 1.3, color: '#ffb347', strength: b.life })
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
function drawLine(ctx: CanvasRenderingContext2D, v: View, pal: Palette, skin: string | null) {
  const b = v.s.boat
  if (b.stage === 'rest' || b.stage === 'sail') return
  const tip = rodTip(b)
  const rx = X(v, tip.x)
  // The hook hangs where the line has swung to, after you.
  const hx = hookX(b)
  const tx = X(v, hx)
  const hy = Y(v, b.hookY)
  if (Math.max(tx, rx) < -60 || Math.min(tx, rx) > v.w + 60) return
  const k = Math.max(0.8, v.ppu)
  ctx.save()
  ctx.strokeStyle = pal.dark ? 'rgba(230, 236, 242, 0.7)' : 'rgba(30, 40, 50, 0.6)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(rx, Y(v, tip.y))
  ctx.quadraticCurveTo((rx + tx) / 2 + Math.sin(v.s.time * 1.3) * 6 * k, (Y(v, tip.y) + hy) / 2, tx, hy - 6 * k)
  ctx.stroke()
  const caught = b.caught
  if (caught && caught !== 'you') {
    const T = TIERS[caught.tier]!
    drawOne(ctx, v, pal, SPECIES[caught.species].art, { x: hx, y: b.hookY + T.r * 1.1, angle: -Math.PI / 2, roll: 1, swim: v.s.time * 9, mouth: 1, seed: 5 }, T.r, { amp: 1.6 })
  } else if (caught === 'you') {
    const r = playerRadius(v.s)
    const at = { x: hx, y: b.hookY + r, angle: -Math.PI / 2, roll: 1, swim: v.s.time * 9, mouth: 1 }
    // Blip's mouth is low on his face, so he hangs leaning back, the hook in his mouth.
    if (skin === BLIP_FISH) drawBlip(ctx, v, pal, playerArt(v.s.player.size), { ...at, x: hx - r * 0.17, y: b.hookY + r * 0.57, angle: -Math.PI / 2 - 0.35 }, r, { amp: 1.6, hooked: true })
    else drawOne(ctx, v, pal, playerArt(v.s.player.size), { ...at, seed: 7 }, r, { amp: 1.6, fill: 0.55 })
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

/*
 * Fish on pictures of their own. A fish is a few dozen small shapes, most of them outlined, and a laptop's graphics
 * chip pays dearly for each: the shallows' schools took Frenzy's frame to three times Crosswalk's (2026-10-22). The
 * computer's own processor gets through small shapes quickly. So a fish of everyday size is painted on a canvas the
 * processor paints, lined up with the screen's pixels, and goes into the frame as one copy. One fading in or out
 * (its parts see-through over each other) or too big to gain from it is drawn straight onto the screen as before.
 *
 * "Still a little choppy when things get busy" (2026-10-22), on his laptop's screen at twice the density. So a
 * picture is kept to its fish, a box round it turned as it's turned, since all of it is copied on its way to the
 * screen, and its canvas is made again only when outgrown or far too big, since a canvas made again costs the
 * processor and the graphics chip both. And in a frame bigger than his 1536 x 730 window's at that density, where
 * every fish is bigger and the graphics chip has more to fill, pictures take more of the work (bigFrame).
 */

/**
 * The most pixels across the square round a fish's reach for it to go on a picture; a bigger fish is drawn straight
 * onto the screen.
 */
const PICTURE_MAX = 320

/** His laptop's 1536 x 730 window at twice the density, in pixels: the frame `PICTURE_MAX` was set for. */
const LAPTOP_FRAME = 3072 * 1460

/**
 * How much bigger than `LAPTOP_FRAME` this frame is, across (1 when it's no bigger). A bigger frame's pictures
 * may be that much bigger across, and a fish's light in the deep goes on a picture too: there it's the graphics
 * chip that falls behind, where in a smaller frame it's the processor, painting the pictures.
 */
let bigFrame = 1

type Picture = { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D }

/** The pictures, used in turn by each frame's fish, from the first again at each frame. */
const pictures: Picture[] = []
let picturesUsed = 0

function nextPicture(w: number, h: number): Picture | null {
  let p = pictures[picturesUsed]
  if (!p) {
    const canvas = document.createElement('canvas')
    // Painted by the processor, not the graphics chip: the point of it.
    const g = canvas.getContext('2d', { willReadFrequently: true })
    if (!g) return null
    p = { canvas, g }
    pictures.push(p)
  }
  picturesUsed++
  // Made again, in steps of 32 pixels, only when the drawing has outgrown it or it's over three times the size
  // needed, so a fish turning, or the next one along, seldom has it made again.
  const c = p.canvas
  if (c.width < w || c.height < h || c.width * c.height > 3 * w * h + 8192) {
    c.width = Math.ceil(w / 32) * 32
    c.height = Math.ceil(h / 32) * 32
  }
  return p
}

/**
 * How far a drawing reaches in its own frame, in CSS pixels: forward (+x, a fish's nose), back, up (-y) and
 * down. Its box.
 */
type Box = { front: number; back: number; top: number; bottom: number }

/**
 * A fish's box, with room to spare, since nothing of it may be cut off (fishbounds.mjs in the 2026-10-22 check
 * drew every look at every pose against it): its nose and bill in front; behind, its tail round the tail's root
 * or a long fin swept back; to each side, the body as it waves and the tallest fin, or the tail swung round, or
 * the lure. Four pixels more all round for the outlines.
 */
export function drawnBox(art: FishArt, length: number, amp: number): Box {
  const H = length * art.height
  const T = H * art.tailSize
  const wave = 0.17 * amp * H
  const side = Math.max(0.5 * H + wave + 1.13 * art.dorsalSize * H, wave + 1.4 * T, art.lure ? 1.3 * H : 0) + 4
  return {
    front: length / 2 + 0.15 * H + (art.bill ?? 0) * length + (art.lure ? 0.3 * length : 0) + 4,
    back: length / 2 + Math.max(1.4 * T, 1.3 * H) + 4,
    top: side,
    bottom: side,
  }
}

/**
 * Draw a fish with `paint` on a picture of its own, if it can be: in its own frame, at (x, y), turned by `angle`,
 * squeezed by `squeeze`, all of it within `radius` CSS pixels of (x, y) and inside `box`. False, having drawn
 * nothing, when it should go straight onto the screen.
 */
function onPicture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  squeeze: number,
  radius: number,
  box: Box,
  paint: (g: CanvasRenderingContext2D, glowOver: (draw: (g: CanvasRenderingContext2D) => void) => void) => void,
): boolean {
  const m = ctx.getTransform()
  // Only onto a frame drawn square on, as renderGame sets it, and laid over it as it is.
  if (m.b !== 0 || m.c !== 0 || m.a !== m.d || ctx.globalCompositeOperation !== 'source-over') return false
  const k = m.a
  if (Math.ceil(2 * radius * k) + 4 > PICTURE_MAX * bigFrame) return false
  const cx = m.e + x * k
  const cy = m.f + y * k
  // The box's corners on the screen, turned and squeezed with the fish.
  const cos = Math.cos(angle) * k
  const sin = Math.sin(angle) * k
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const bx of [box.front, -box.back]) {
    for (const by of [-box.top * squeeze, box.bottom * squeeze]) {
      const px = cx + cos * bx - sin * by
      const py = cy + sin * bx + cos * by
      if (px < x0) x0 = px
      if (px > x1) x1 = px
      if (py < y0) y0 = py
      if (py > y1) y1 = py
    }
  }
  // On the screen's whole pixels, so the copy lands pixel for pixel.
  const left = Math.floor(x0) - 2
  const top = Math.floor(y0) - 2
  const w = Math.ceil(x1) + 2 - left
  const h = Math.ceil(y1) + 2 - top
  const pic = nextPicture(w, h)
  if (!pic) return false
  const g = pic.g
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, w, h)
  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'
  // The fish's open lines end as the screen's drawing has it.
  g.lineCap = ctx.lineCap
  g.lineJoin = ctx.lineJoin
  g.miterLimit = ctx.miterLimit
  g.setTransform(k, 0, 0, k, m.e - left, m.f - top)
  g.translate(x, y)
  g.rotate(angle)
  g.scale(1, squeeze)
  const put = () => {
    ctx.save()
    ctx.globalAlpha = 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(pic.canvas, 0, 0, w, h, left, top, w, h)
    ctx.restore()
  }
  paint(g, (draw) => {
    // The fish's back goes on, then its light over it and the water, then its front, painted on the same picture
    // afresh. The light adds to what's under it ('lighter'): straight onto the screen, or in a big frame painted,
    // adding, on a clear picture of its own, and that picture added in, the same sums.
    put()
    const glow = bigFrame > 1 ? nextPicture(w, h) : null
    if (glow) {
      const gg = glow.g
      gg.setTransform(1, 0, 0, 1, 0, 0)
      gg.clearRect(0, 0, w, h)
      gg.globalAlpha = 1
      gg.globalCompositeOperation = 'source-over'
      gg.lineCap = g.lineCap
      gg.lineJoin = g.lineJoin
      gg.miterLimit = g.miterLimit
      gg.setTransform(g.getTransform())
      draw(gg)
      ctx.save()
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'lighter'
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(glow.canvas, 0, 0, w, h, left, top, w, h)
      ctx.restore()
    } else {
      ctx.save()
      ctx.globalAlpha = 1
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.scale(1, squeeze)
      ctx.lineJoin = g.lineJoin
      draw(ctx)
      ctx.restore()
    }
    const at = g.getTransform()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, w, h)
    g.setTransform(at)
  })
  put()
  return true
}

/** How far from its middle a fish's drawing reaches: tail, fins, bill and lure, with room for the outlines. */
function drawnReach(art: FishArt, length: number) {
  return length * (0.5 + (art.bill ?? 0) + (art.lure ? 0.25 : 0)) + 2.2 * length * art.height + 4
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
  const pose = { length: reach, swim: at.swim, amp: o.amp ?? 0.9, mouth: at.mouth, lookX: 1, lookY: 0.05, alarm: o.alarm ?? 0, puff: 0, time: v.s.time, biolume: lumAt(at.y) }
  const paint = paintFor(art, pal, o.fill, o.threat !== undefined)
  const squeeze = rollScale(at.roll)
  // Not while it rolls over to turn, squeezed toward a sliver, nor with a bill or a lure: the processor draws an
  // outline that thin, or a point that fine, a little fainter than the graphics chip does.
  const pictured =
    alpha === 1 &&
    Math.abs(squeeze) >= 0.95 &&
    !art.bill &&
    !art.lure &&
    onPicture(ctx, x, y, at.angle, squeeze, drawnReach(art, reach), drawnBox(art, reach, pose.amp), (g, glowOver) => drawFish(g, art, pose, at.seed, local, paint, glowOver))
  if (!pictured) {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(x, y)
    ctx.rotate(at.angle)
    ctx.scale(1, squeeze)
    drawFish(ctx, art, pose, at.seed, local, paint)
    ctx.restore()
  }
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

/**
 * You as Blip (the skin frenzy-blip, blipFish.ts): where the usual fish would be and as big as it is, turning,
 * gulping and swimming as it does. He leans toward where he's going rather than pointing at it, so his face stays
 * his face, and through a turn his face comes round to you. His spark, out ahead on its lure, lights the dark round
 * him in the deep. On the hook he hangs by his mouth, wincing.
 */
function drawBlip(
  ctx: CanvasRenderingContext2D,
  v: View,
  pal: Palette,
  art: FishArt,
  at: { x: number; y: number; angle: number; roll: number; swim: number; mouth: number },
  r: number,
  o: { amp: number; dazed?: boolean; shake?: number; hooked?: boolean },
) {
  const x = X(v, at.x)
  const y = Y(v, at.y)
  // A gulp puffs him up a little.
  const R = r * BLIP_BODY * v.ppu * (1 + 0.06 * at.mouth)
  if (x < -R * 4 || x > v.w + R * 4 || y < -R * 4 || y > v.h + R * 4) return
  const rot = (o.hooked ? at.angle : blipTilt(at.angle, at.roll)) + (o.shake ?? 0)
  const flip = !o.hooked && at.roll < 0 ? -1 : 1
  const local: Glow[] = []
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(flip, 1)
  drawBlipFish(
    ctx,
    {
      radius: R,
      swim: at.swim,
      amp: o.amp,
      mouth: at.mouth,
      time: v.s.time,
      turn: o.hooked ? 1 : Math.abs(at.roll),
      biolume: lumAt(at.y),
      dazed: !!(o.dazed || o.hooked),
      art,
      spark: true,
    },
    blipPaintFor(pal),
    local,
  )
  ctx.restore()
  drawBlipShine(ctx, x, y, R)
  // His spark's light, from his frame to the screen's.
  const c = Math.cos(rot)
  const sn = Math.sin(rot)
  for (const g of local) lights.push({ ...g, x: x + c * g.x * flip - sn * g.y, y: y + sn * g.x * flip + c * g.y })
}

function drawPlayer(ctx: CanvasRenderingContext2D, v: View, pal: Palette, skin: string | null) {
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
  // Stung: it shakes, and sparks crackle round it while the stun lasts.
  const stunned = p.stun > 0
  const shake = stunned ? Math.sin(s.time * 60) * 0.18 * Math.min(1, p.stun) : 0
  const amp = p.air ? 0.4 : stunned ? 0.3 : 1.1
  if (skin === BLIP_FISH) drawBlip(ctx, v, pal, playerArt(p.size), p, r, { amp, dazed: stunned, shake })
  else drawOne(ctx, v, pal, playerArt(p.size), { ...p, angle: p.angle + shake, seed: 7 }, r, { amp, fill: 0.55 })
  if (stunned) drawStun(ctx, v, r)
}

/** The sparks round a stung fish: three little bolts circling it, flickering. */
function drawStun(ctx: CanvasRenderingContext2D, v: View, r: number) {
  const s = v.s
  const p = s.player
  const cx = X(v, p.x)
  const cy = Y(v, p.y)
  const R = r * v.ppu
  ctx.save()
  ctx.globalAlpha = Math.min(1, p.stun * 2)
  ctx.strokeStyle = '#ffe066'
  ctx.lineWidth = Math.max(1.5, R * 0.1)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 0; i < 3; i++) {
    if ((Math.floor(s.time * 20) + i) % 4 === 0) continue
    const a = s.time * 5 + (i * Math.PI * 2) / 3
    const bx = cx + Math.cos(a) * R * 1.35
    const by = cy + Math.sin(a) * R * 1.0 - R * 0.2
    const z = R * 0.32
    ctx.beginPath()
    ctx.moveTo(bx - z * 0.4, by - z)
    ctx.lineTo(bx + z * 0.3, by - z * 0.15)
    ctx.lineTo(bx - z * 0.2, by + z * 0.1)
    ctx.lineTo(bx + z * 0.45, by + z)
    ctx.stroke()
  }
  ctx.restore()
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
function drawBar(ctx: CanvasRenderingContext2D, v: View, pal: Palette, skin: string | null) {
  const s = v.s
  if (s.phase === 'menu' || s.phase === 'gameover') return
  // The pill reaches 112 left of the bar for the lives and 54 right of it for the chain. The bar is centred, but on
  // a phone that ran the pill off the left edge: there the pill is centred instead, the bar a little right of the
  // middle, and on a narrow one the bar gives way to keep the pill clear of both edges.
  const bw = Math.min(240, v.w * 0.42, v.w - 166 - 24)
  const bh = 14
  const centred = (v.w - bw) / 2
  const bx = centred - 112 < 12 ? (v.w - bw - 166) / 2 + 112 : centred
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
  // Lives: little fish to the left of the bar (little Blips, in his skin).
  const art = playerArt(0)
  const blip = skin === BLIP_FISH
  for (let i = 0; i < 3; i++) {
    const lx = bx - 22 - (2 - i) * 31
    // A life still held, on a picture of its own (onPicture); a spent one, see-through, straight on.
    if (!blip && i < s.lives) {
      const pose = { length: 18, swim: s.time * 4 + i, amp: 0.6, mouth: 0, lookX: 1, lookY: 0, alarm: 0, puff: 0, time: s.time }
      if (onPicture(ctx, lx, by + bh / 2, 0, 1, drawnReach(art, 18), drawnBox(art, 18, pose.amp), (g) => drawFish(g, art, pose, i, null, paintFor(art, pal, 0.55)))) continue
    }
    ctx.save()
    ctx.globalAlpha = i < s.lives ? 1 : 0.25
    ctx.translate(lx, by + bh / 2)
    if (blip) {
      const R = 6.4
      drawBlipFish(ctx, { radius: R, swim: s.time * 4 + i, amp: 0.6, mouth: 0, time: s.time + i * 1.1, turn: 1, biolume: 0, dazed: false, art, spark: true }, blipPaintFor(pal))
      drawBlipShine(ctx, 0, 0, R)
    } else {
      drawFish(ctx, art, { length: 18, swim: s.time * 4 + i, amp: 0.6, mouth: 0, lookX: 1, lookY: 0, alarm: 0, puff: 0, time: s.time }, i, null, paintFor(art, pal, 0.55))
    }
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

/**
 * Draw a frame. `skin`: the player's chosen skin (lib/skins.ts), worn by their own fish only (frenzy-blip draws
 * them as Blip); null for the usual look.
 */
export function renderGame(ctx: CanvasRenderingContext2D, s: GameState, width: number, height: number, skin: string | null = null) {
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
  picturesUsed = 0
  bigFrame = Math.max(1, Math.sqrt((cw * ch) / LAPTOP_FRAME))
  ctx.fillStyle = css(pal.deep)
  ctx.fillRect(0, 0, width, height)
  drawSky(ctx, v, pal)
  drawWater(ctx, v, pal)
  drawPlankton(ctx, v)
  drawFloor(ctx, v, pal)
  drawWalls(ctx, v, pal)
  drawJellies(ctx, v)
  drawMines(ctx, v)
  drawLine(ctx, v, pal, skin)
  drawFishes(ctx, v, pal, false)
  drawGulls(ctx, v)
  drawPlayer(ctx, v, pal, skin)
  drawFishes(ctx, v, pal, true)
  drawShark(ctx, v, pal)
  drawBlasts(ctx, v)
  drawSurface(ctx, v, pal)
  drawBoat(ctx, v)
  drawDark(ctx, v)
  drawLights(ctx)
  drawAlerts(ctx, v)
  drawEffects(ctx, v, pal)
  drawBar(ctx, v, pal, skin)
}
