import { PALETTE, type Swatch } from '../../data/games'
import { isDarkTheme, playfieldColor } from '../../lib/theme'
import { drawFish, type FishPaint } from './fishArt'
import {
  GROW_MARKS,
  SHARK_RADIUS,
  barFill,
  chainOf,
  fishRadius,
  playerRadius,
  type GameState,
} from './game'
import { SPECIES, playerArt, type FishArt } from './species'

/*
 * The food chain's water, drawn back to front: the water (the site's playfield, deepening toward the
 * bottom), light from above and drifting specks, the shark's warning, the fish that are smaller than you,
 * you, the ones that can eat you (so a threat is never hidden behind a meal), the shark, bubbles and the
 * words that float up, and last the bar along the bottom with your lives.
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

/** The water: the site's playfield at the top, deepening toward the bottom, in either theme. */
type Water = { top: RGB; bottom: RGB; dark: boolean; ink: string; key: string }
let water: Water | null = null
const paints = new Map<string, FishPaint>()

function waterNow(): Water {
  const field = playfieldColor()
  const dark = isDarkTheme()
  const key = `${field}|${dark}`
  if (water?.key === key) return water
  const base = toRgb(field)
  const top = mix(base, toRgb(PALETTE.sky), dark ? 0.22 : 0.3)
  const bottom = mix(base, dark ? [6, 18, 30] : [38, 96, 140], dark ? 0.55 : 0.55)
  water = { top, bottom, dark, ink: lum(top) < 0.5 ? '#eef4f7' : '#16242f', key }
  paints.clear()
  return water
}

/** A fish's colours: its palette colour as a soft fill over the water, the same colour for its outline. */
function paintFor(art: FishArt, w: Water, fill = 0.42): FishPaint {
  const key = `${art.swatch}|${art.tailSwatch ?? ''}|${art.pattern}|${fill}`
  const cached = paints.get(key)
  if (cached) return cached
  const under = mix(w.top, w.bottom, 0.4)
  const hue = hueOf(toRgb(PALETTE[art.swatch as Swatch]))
  const tailHue = art.tailSwatch ? hueOf(toRgb(PALETTE[art.tailSwatch])) : hue
  const lineL = w.dark ? 66 : 40
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
    pattern: lightMarks ? `hsla(${hue}, 60%, ${w.dark ? 88 : 97}%, 0.95)` : line,
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

type View = { ppu: number; ox: number; oy: number; w: number; h: number }
const X = (v: View, x: number) => v.ox + x * v.ppu
const Y = (v: View, y: number) => v.oy + y * v.ppu

function drawWater(ctx: CanvasRenderingContext2D, v: View, s: GameState, w: Water) {
  const g = ctx.createLinearGradient(0, 0, 0, v.h)
  g.addColorStop(0, css(w.top))
  g.addColorStop(1, css(w.bottom))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, v.w, v.h)
  // Light from above, slowly drifting.
  ctx.save()
  ctx.globalAlpha = w.dark ? 0.05 : 0.12
  ctx.fillStyle = '#ffffff'
  const span = v.w + v.h * 0.6
  for (let i = 0; i < 5; i++) {
    const x = ((i * span) / 5 + s.time * 14) % span - v.h * 0.3
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + v.w * 0.06, 0)
    ctx.lineTo(x + v.w * 0.06 + v.h * 0.3, v.h)
    ctx.lineTo(x + v.h * 0.3 - v.w * 0.02, v.h)
    ctx.fill()
  }
  ctx.restore()
  // Specks drifting up, the same ones every visit.
  ctx.fillStyle = w.dark ? 'rgba(200, 230, 255, 0.22)' : 'rgba(255, 255, 255, 0.55)'
  for (let i = 0; i < 46; i++) {
    const sx = ((i * 97.13) % 1) * v.w + Math.sin(s.time * 0.4 + i) * 6
    const rise = 8 + ((i * 37) % 14)
    const sy = (((i * 61.7) % 1) * v.h - s.time * rise) % v.h
    ctx.beginPath()
    ctx.arc(sx, sy < 0 ? sy + v.h : sy, 0.8 + ((i * 13) % 5) * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawOne(
  ctx: CanvasRenderingContext2D,
  v: View,
  s: GameState,
  art: FishArt,
  at: { x: number; y: number; angle: number; roll: number; swim: number; mouth: number; seed: number },
  r: number,
  w: Water,
  o: { alarm?: number; amp?: number; alpha?: number; fill?: number } = {},
) {
  ctx.save()
  ctx.globalAlpha = o.alpha ?? 1
  ctx.translate(X(v, at.x), Y(v, at.y))
  ctx.rotate(at.angle)
  ctx.scale(1, rollScale(at.roll))
  drawFish(
    ctx,
    art,
    { length: r * art.length * v.ppu, swim: at.swim, amp: o.amp ?? 0.9, mouth: at.mouth, lookX: 1, lookY: 0.05, alarm: o.alarm ?? 0, puff: 0, time: s.time },
    at.seed,
    null,
    paintFor(art, w, o.fill),
  )
  ctx.restore()
}

function drawFishes(ctx: CanvasRenderingContext2D, v: View, s: GameState, w: Water, bigger: boolean) {
  const size = s.player.size
  const live = s.phase !== 'menu'
  for (const f of s.fishes) {
    const threat = live && f.tier > size
    if (threat !== bigger) continue
    // Anything that can eat you has a red eye, redder as it comes for you.
    drawOne(ctx, v, s, SPECIES[f.species].art, f, fishRadius(f), w, {
      alarm: threat ? Math.max(0.45, f.hunt) : 0,
      amp: f.hunt > 0.5 ? 1.3 : 0.85,
      alpha: f.fade,
    })
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, v: View, s: GameState, w: Water) {
  const p = s.player
  if (s.phase === 'menu' || s.phase === 'gameover') return
  if (s.phase === 'dying') return
  // Blinks while it can't be hurt.
  if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 1) return
  const r = playerRadius(s)
  drawOne(ctx, v, s, playerArt(p.size * 2), { ...p, seed: 7 }, r, w, { amp: 1.1, fill: 0.55 })
}

function drawShark(ctx: CanvasRenderingContext2D, v: View, s: GameState, w: Water) {
  const k = s.shark
  if (!k) return
  if (k.stage === 'warn') {
    // A "!" at the edge it will come from, at its height, blinking.
    const blink = 0.55 + 0.45 * Math.sin(s.time * 18)
    const ex = k.dir > 0 ? X(v, 0) + 22 : X(v, s.W) - 22
    const ey = Y(v, k.y)
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
    // The way it will go.
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
  drawOne(ctx, v, s, art, { x: k.x, y: k.y, angle: k.dir > 0 ? 0 : Math.PI, roll: k.dir, swim: k.swim, mouth: 1, seed: 3 }, SHARK_RADIUS / (art.length / 2.2), w, {
    alarm: 1,
    amp: 1.4,
    fill: 0.5,
  })
}

function drawEffects(ctx: CanvasRenderingContext2D, v: View, s: GameState, w: Water) {
  for (const q of s.particles) {
    ctx.globalAlpha = 1 - q.t / q.life
    ctx.fillStyle = w.dark ? q.color : 'rgba(255, 255, 255, 0.95)'
    ctx.beginPath()
    ctx.arc(X(v, q.x), Y(v, q.y), q.r * Math.max(0.8, v.ppu), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of s.floaters) {
    const big = f.tone === 'grow'
    const life = big ? 1.3 : 0.9
    ctx.globalAlpha = Math.min(1, (1 - f.t / life) * 1.6)
    const size = Math.round((big ? 26 : 15) * Math.max(0.85, Math.min(1.3, v.ppu)))
    ctx.font = `800 ${size}px ${FONT}`
    const colour = f.tone === 'hot' ? PALETTE.amber : f.tone === 'grow' ? PALETTE.green : f.tone === 'bad' ? PALETTE.red : w.ink
    const x = X(v, f.x)
    const y = Y(v, f.y) - f.t * 36
    ctx.lineWidth = 4
    ctx.strokeStyle = w.dark ? 'rgba(8, 18, 28, 0.85)' : 'rgba(255, 255, 255, 0.9)'
    ctx.strokeText(f.text, x, y)
    ctx.fillStyle = colour
    ctx.fillText(f.text, x, y)
  }
  ctx.globalAlpha = 1
}

/** Along the bottom: your lives, the bar with its two grow marks, and the chain. */
function drawBar(ctx: CanvasRenderingContext2D, v: View, s: GameState, w: Water) {
  if (s.phase === 'menu' || s.phase === 'gameover') return
  const bw = Math.min(260, v.w * 0.5)
  const bh = 14
  const bx = (v.w - bw) / 2
  const by = v.h - 30 - bh
  ctx.save()
  ctx.fillStyle = w.dark ? 'rgba(8, 18, 28, 0.55)' : 'rgba(255, 255, 255, 0.6)'
  ctx.beginPath()
  ctx.roundRect(bx - 8, by - 8, bw + 16, bh + 16, 15)
  ctx.fill()
  ctx.fillStyle = w.dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(22, 36, 47, 0.12)'
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, bh / 2)
  ctx.fill()
  const fill = barFill(s)
  if (fill > 0) {
    ctx.fillStyle = PALETTE.green
    ctx.beginPath()
    ctx.roundRect(bx, by, Math.max(bh, bw * fill), bh, bh / 2)
    ctx.fill()
  }
  ctx.fillStyle = w.ink
  for (const m of GROW_MARKS) ctx.fillRect(bx + bw * m - 1, by - 3, 2, bh + 6)
  // Lives: little fish to the left of the bar.
  const art = playerArt(0)
  for (let i = 0; i < 3; i++) {
    const lx = bx - 26 - (2 - i) * 27
    if (lx < 6) continue
    ctx.save()
    ctx.globalAlpha = i < s.lives ? 1 : 0.25
    ctx.translate(lx, by + bh / 2)
    drawFish(ctx, art, { length: 18, swim: s.time * 4 + i, amp: 0.6, mouth: 0, lookX: 1, lookY: 0, alarm: 0, puff: 0, time: s.time }, i, null, paintFor(art, w, 0.55))
    ctx.restore()
  }
  // The chain, to the right.
  const mult = chainOf(s)
  if (s.chain > 1) {
    ctx.font = `800 18px ${FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = mult > 2 ? PALETTE.amber : w.ink
    ctx.fillText(`×${mult}`, bx + bw + 14, by + bh / 2 + 1)
  }
  ctx.restore()
}

function drawBanner(ctx: CanvasRenderingContext2D, v: View, s: GameState, w: Water) {
  if (s.phase !== 'clear') return
  const a = Math.min(1, s.phaseTime * 4)
  ctx.save()
  ctx.globalAlpha = a
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${Math.round(34 * Math.max(0.8, Math.min(1.3, v.ppu)))}px ${FONT}`
  ctx.lineWidth = 6
  ctx.strokeStyle = w.dark ? 'rgba(8, 18, 28, 0.85)' : 'rgba(255, 255, 255, 0.92)'
  const text = `Level ${s.level} clear!`
  ctx.strokeText(text, v.w / 2, v.h * 0.4)
  ctx.fillStyle = PALETTE.amber
  ctx.fillText(text, v.w / 2, v.h * 0.4)
  ctx.font = `700 ${Math.round(16 * Math.max(0.85, Math.min(1.2, v.ppu)))}px ${FONT}`
  ctx.lineWidth = 4
  const sub = 'Next: faster water'
  ctx.strokeText(sub, v.w / 2, v.h * 0.4 + 34)
  ctx.fillStyle = w.ink
  ctx.fillText(sub, v.w / 2, v.h * 0.4 + 34)
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
  const w = waterNow()
  const v: View = { ppu: s.ppu, ox: s.offX, oy: s.offY, w: width, h: height }
  drawWater(ctx, v, s, w)
  drawFishes(ctx, v, s, w, false)
  drawPlayer(ctx, v, s, w)
  drawFishes(ctx, v, s, w, true)
  drawShark(ctx, v, s, w)
  drawEffects(ctx, v, s, w)
  drawBar(ctx, v, s, w)
  drawBanner(ctx, v, s, w)
}
