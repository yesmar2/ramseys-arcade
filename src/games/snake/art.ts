import { PALETTE, type Swatch } from '../../data/games'
import type { FruitKind } from './game'
import type { Mouse } from './mouse'

/*
 * The things on the lawn, drawn the way the rest of the arcade is drawn: a
 * soft fill of a palette colour inside a clean outline of the same colour,
 * with the small marks that say what a thing is — a leaf, a stem, a crown —
 * and nothing that asks to be looked at for its own sake. Everything takes a
 * centre and a size in pixels and draws around it.
 */

export type RGB = [number, number, number]

/** How to colour a shape against whatever it sits on. */
export type Paint = {
  /** The ground under it, opaque. Fills are mixed over this so they hide what is behind. */
  ground: RGB
  /** Dark ground: lighter outlines, lighter marks. */
  dark: boolean
  ink: RGB
}

export function css(c: RGB, a = 1) {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

export function hexToRgb(hex: string): RGB {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHue([r, g, b]: RGB) {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  if (max === min) return 0
  const d = max - min
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return h * 60
}

const hues = new Map<Swatch, number>()

/** A palette colour's hue, so every outline and fill stays inside the site's ten colours. */
export function hueOf(swatch: Swatch) {
  let hue = hues.get(swatch)
  if (hue === undefined) {
    hue = Math.round(rgbToHue(hexToRgb(PALETTE[swatch])))
    hues.set(swatch, hue)
  }
  return hue
}

export function hsla(h: number, s: number, l: number, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

/**
 * A soft fill: the swatch mixed over the ground, opaque. Dark ground takes
 * more of it, or a fruit on the night lawn comes out the colour of mud.
 */
export function soft(p: Paint, swatch: Swatch, amount: number) {
  const a = p.dark ? Math.min(0.9, amount * 1.4) : amount
  return css(mixRgb(p.ground, hslToRgb(hueOf(swatch), 0.64, 0.58), a))
}

/** The outline a swatch is drawn with on this ground. */
export function line(p: Paint, swatch: Swatch, alpha = 0.95) {
  return hsla(hueOf(swatch), 64, p.dark ? 64 : 42, alpha)
}

/** Small marks inside a shape: light on dark ground, deep on pale. */
export function mark(p: Paint, swatch: Swatch, alpha = 0.9) {
  return hsla(hueOf(swatch), 60, p.dark ? 86 : 30, alpha)
}

/** A highlight, the glint that says a thing is round and shiny. */
function shine(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, from: number, to: number, alpha: number) {
  ctx.save()
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
  ctx.lineWidth = Math.max(1, r * 0.16)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(x, y, r, from, to)
  ctx.stroke()
  ctx.restore()
}

function outlineWidth(r: number) {
  return Math.min(3, Math.max(1.2, r * 0.13))
}

function leaf(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, len: number, angle: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0)
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0)
  ctx.closePath()
  ctx.fillStyle = soft(p, 'green', 0.5)
  ctx.fill()
  ctx.strokeStyle = line(p, 'green')
  ctx.lineWidth = Math.max(1, len * 0.12)
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(len * 0.12, 0)
  ctx.lineTo(len * 0.72, 0)
  ctx.strokeStyle = line(p, 'green', 0.55)
  ctx.lineWidth = Math.max(0.8, len * 0.07)
  ctx.stroke()
  ctx.restore()
}

function stem(ctx: CanvasRenderingContext2D, p: Paint, x0: number, y0: number, x1: number, y1: number, bend: number, w: number) {
  ctx.save()
  ctx.strokeStyle = css(p.ink, 0.72)
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1)
  ctx.stroke()
  ctx.restore()
}

function applePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - r * 0.62)
  ctx.bezierCurveTo(x + r * 0.35, y - r * 1.02, x + r * 1.08, y - r * 0.8, x + r, y - r * 0.05)
  ctx.bezierCurveTo(x + r * 0.94, y + r * 0.62, x + r * 0.5, y + r * 1.0, x + r * 0.18, y + r * 0.93)
  ctx.bezierCurveTo(x + r * 0.06, y + r * 0.89, x - r * 0.06, y + r * 0.89, x - r * 0.18, y + r * 0.93)
  ctx.bezierCurveTo(x - r * 0.5, y + r * 1.0, x - r * 0.94, y + r * 0.62, x - r, y - r * 0.05)
  ctx.bezierCurveTo(x - r * 1.08, y - r * 0.8, x - r * 0.35, y - r * 1.02, x, y - r * 0.62)
  ctx.closePath()
}

function filled(ctx: CanvasRenderingContext2D, fill: string, stroke: string, width: number) {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function drawApple(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, r: number, swatch: Swatch = 'red', fill = 0.42) {
  const lw = outlineWidth(r)
  stem(ctx, p, x, y - r * 0.55, x + r * 0.14, y - r * 1.12, -r * 0.08, Math.max(1.2, r * 0.13))
  applePath(ctx, x, y, r)
  filled(ctx, soft(p, swatch, fill), line(p, swatch), lw)
  leaf(ctx, p, x + r * 0.1, y - r * 0.86, r * 0.62, -0.5)
  shine(ctx, x - r * 0.12, y + r * 0.02, r * 0.56, Math.PI * 1.08, Math.PI * 1.42, p.dark ? 0.5 : 0.85)
}

function drawCherry(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, r: number) {
  const lw = outlineWidth(r * 0.8)
  const a = { x: x - r * 0.44, y: y + r * 0.34, r: r * 0.52 }
  const b = { x: x + r * 0.42, y: y + r * 0.46, r: r * 0.5 }
  const top = { x: x + r * 0.16, y: y - r * 0.98 }
  stem(ctx, p, a.x + r * 0.05, a.y - a.r * 0.8, top.x, top.y, -r * 0.3, Math.max(1.1, r * 0.1))
  stem(ctx, p, b.x, b.y - b.r * 0.8, top.x, top.y, r * 0.12, Math.max(1.1, r * 0.1))
  for (const c of [a, b]) {
    ctx.beginPath()
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
    filled(ctx, soft(p, 'pink', 0.46), line(p, 'pink'), lw)
    shine(ctx, c.x - c.r * 0.12, c.y - c.r * 0.1, c.r * 0.55, Math.PI * 1.1, Math.PI * 1.45, p.dark ? 0.5 : 0.85)
  }
  leaf(ctx, p, top.x, top.y, r * 0.58, 0.25)
}

function drawGrapes(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, r: number) {
  const g = r * 0.34
  const lw = outlineWidth(g * 1.5)
  const berries = [
    [-1, -0.62],
    [0, -0.62],
    [1, -0.62],
    [-0.5, 0.2],
    [0.5, 0.2],
    [0, 1.02],
  ].map(([bx, by]) => ({ x: x + bx * g * 1.62, y: y + by * g * 1.45 + r * 0.08 }))
  stem(ctx, p, x, berries[1].y - g, x + r * 0.08, y - r * 1.05, r * 0.1, Math.max(1.1, r * 0.1))
  leaf(ctx, p, x + r * 0.06, y - r * 0.92, r * 0.55, -0.35)
  // Back row first, so the front berries overlap it.
  for (const b of berries) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, g, 0, Math.PI * 2)
    filled(ctx, soft(p, 'violet', 0.46), line(p, 'violet'), lw)
  }
  for (const b of berries) shine(ctx, b.x - g * 0.1, b.y - g * 0.1, g * 0.55, Math.PI * 1.1, Math.PI * 1.45, p.dark ? 0.45 : 0.8)
}

function drawOrange(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, r: number) {
  const lw = outlineWidth(r)
  ctx.beginPath()
  ctx.arc(x, y + r * 0.04, r * 0.92, 0, Math.PI * 2)
  filled(ctx, soft(p, 'orange', 0.44), line(p, 'orange'), lw)
  // Pores.
  ctx.fillStyle = line(p, 'orange', 0.45)
  for (const [px, py] of [
    [0.3, 0.2],
    [-0.2, 0.42],
    [0.46, -0.18],
    [-0.42, -0.02],
    [0.08, 0.56],
  ]) {
    ctx.beginPath()
    ctx.arc(x + px * r, y + py * r, Math.max(0.7, r * 0.045), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(x, y - r * 0.8, Math.max(1, r * 0.1), 0, Math.PI * 2)
  ctx.fillStyle = css(p.ink, 0.72)
  ctx.fill()
  leaf(ctx, p, x + r * 0.04, y - r * 0.82, r * 0.6, -0.15)
  shine(ctx, x - r * 0.1, y, r * 0.58, Math.PI * 1.08, Math.PI * 1.42, p.dark ? 0.5 : 0.85)
}

function drawLemon(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, r: number) {
  const lw = outlineWidth(r)
  ctx.save()
  ctx.translate(x, y + r * 0.04)
  ctx.rotate(-0.4)
  // An oval with a little nub at each end.
  const rx = r * 0.84
  const ry = r * 0.66
  const tip = rx + r * 0.2
  ctx.beginPath()
  ctx.moveTo(-tip, 0)
  ctx.quadraticCurveTo(-rx - r * 0.02, -ry * 0.1, -rx, -ry * 0.26)
  ctx.bezierCurveTo(-rx * 0.94, -ry * 0.8, -rx * 0.5, -ry, 0, -ry)
  ctx.bezierCurveTo(rx * 0.5, -ry, rx * 0.94, -ry * 0.8, rx, -ry * 0.26)
  ctx.quadraticCurveTo(rx + r * 0.02, -ry * 0.1, tip, 0)
  ctx.quadraticCurveTo(rx + r * 0.02, ry * 0.1, rx, ry * 0.26)
  ctx.bezierCurveTo(rx * 0.94, ry * 0.8, rx * 0.5, ry, 0, ry)
  ctx.bezierCurveTo(-rx * 0.5, ry, -rx * 0.94, ry * 0.8, -rx, ry * 0.26)
  ctx.quadraticCurveTo(-rx - r * 0.02, ry * 0.1, -tip, 0)
  ctx.closePath()
  filled(ctx, soft(p, 'amber', 0.5), line(p, 'amber'), lw)
  shine(ctx, -r * 0.06, r * 0.14, r * 0.5, Math.PI * 1.12, Math.PI * 1.52, p.dark ? 0.5 : 0.85)
  ctx.restore()
  leaf(ctx, p, x + r * 0.62, y - r * 0.5, r * 0.5, -1.45)
}

function drawBerry(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, r: number) {
  const lw = outlineWidth(r)
  const small = { x: x + r * 0.5, y: y - r * 0.42, r: r * 0.46 }
  const big = { x: x - r * 0.12, y: y + r * 0.14, r: r * 0.74 }
  for (const b of [small, big]) {
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    filled(ctx, soft(p, 'indigo', 0.46), line(p, 'indigo'), lw)
    // The five-pointed crown a blueberry wears where its flower was.
    const cr = b.r * 0.3
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
      const rr = i % 2 === 0 ? cr : cr * 0.45
      const px = b.x + b.r * 0.12 + Math.cos(a) * rr
      const py = b.y - b.r * 0.12 + Math.sin(a) * rr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.strokeStyle = line(p, 'indigo')
    ctx.lineWidth = Math.max(0.9, lw * 0.75)
    ctx.stroke()
    shine(ctx, b.x - b.r * 0.1, b.y - b.r * 0.05, b.r * 0.6, Math.PI * 0.95, Math.PI * 1.3, p.dark ? 0.45 : 0.8)
  }
}

function drawPlum(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, r: number) {
  const lw = outlineWidth(r)
  stem(ctx, p, x + r * 0.05, y - r * 0.78, x + r * 0.2, y - r * 1.1, 0, Math.max(1.2, r * 0.12))
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.06, r * 0.86, r * 0.94, 0.18, 0, Math.PI * 2)
  filled(ctx, soft(p, 'magenta', 0.44), line(p, 'magenta'), lw)
  // The crease down one side.
  ctx.beginPath()
  ctx.moveTo(x + r * 0.05, y - r * 0.8)
  ctx.bezierCurveTo(x + r * 0.46, y - r * 0.3, x + r * 0.46, y + r * 0.4, x + r * 0.12, y + r * 0.92)
  ctx.strokeStyle = line(p, 'magenta', 0.55)
  ctx.lineWidth = Math.max(1, lw * 0.8)
  ctx.lineCap = 'round'
  ctx.stroke()
  shine(ctx, x - r * 0.16, y, r * 0.55, Math.PI * 1.05, Math.PI * 1.4, p.dark ? 0.5 : 0.85)
}

/** A fruit, centred on (x, y), about 2r across. */
export function drawFruit(ctx: CanvasRenderingContext2D, p: Paint, kind: FruitKind, x: number, y: number, r: number) {
  switch (kind) {
    case 'apple':
      drawApple(ctx, p, x, y, r)
      break
    case 'cherry':
      drawCherry(ctx, p, x, y, r)
      break
    case 'grape':
      drawGrapes(ctx, p, x, y, r)
      break
    case 'orange':
      drawOrange(ctx, p, x, y, r)
      break
    case 'lemon':
      drawLemon(ctx, p, x, y, r)
      break
    case 'berry':
      drawBerry(ctx, p, x, y, r)
      break
    case 'plum':
      drawPlum(ctx, p, x, y, r)
      break
  }
}

/** Four-pointed twinkle. */
export function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.quadraticCurveTo(x, y, x, y + r)
  ctx.quadraticCurveTo(x, y, x - r, y)
  ctx.quadraticCurveTo(x, y, x, y - r)
  ctx.closePath()
  ctx.fill()
}

/** The golden apple: an apple in the arcade's gold, with a glint going round it. */
export function drawGoldenApple(ctx: CanvasRenderingContext2D, p: Paint, x: number, y: number, r: number, time: number) {
  drawApple(ctx, p, x, y, r, 'amber', p.dark ? 0.62 : 0.72)
  const star = p.dark ? '#fff6d6' : hsla(hueOf('amber'), 80, 44)
  for (let i = 0; i < 3; i++) {
    const a = time * 2.2 + (i / 3) * Math.PI * 2
    const tw = 0.55 + 0.45 * Math.sin(time * 7 + i * 2)
    sparkle(ctx, x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.15, r * 0.26 * tw, star)
  }
}

/**
 * The mouse, from above: a grey teardrop with round pink-lined ears, a pink
 * nose and a long pink tail, facing `m.angle`. It paddles when it runs,
 * twitches its nose when it stops, and shivers when it is boxed in.
 */
export function drawMouse(ctx: CanvasRenderingContext2D, p: Paint, m: Mouse, X: number, Y: number, cell: number, time: number) {
  const running = m.mode === 'flee' || m.mode === 'leave' || m.mode === 'enter'
  const still = m.mode === 'sniff' || m.mode === 'trapped'
  const u = cell
  const lw = Math.min(2.6, Math.max(1.1, u * 0.055))
  const grey = css(mixRgb(p.ground, p.dark ? [168, 182, 194] : [120, 134, 148], p.dark ? 0.34 : 0.3))
  const edge = css(p.ink, p.dark ? 0.78 : 0.72)
  const pinkLine = line(p, 'pink')
  const pinkFill = soft(p, 'pink', 0.55)
  const shiver = m.mode === 'trapped' ? Math.sin(time * 70) * u * 0.025 : 0
  const stride = running ? Math.sin(time * 26 + m.seed) : still ? 0 : Math.sin(time * 14 + m.seed)

  ctx.save()
  ctx.globalAlpha *= m.fade
  ctx.translate(X + shiver, Y)
  ctx.rotate(m.angle)

  // Tail, swishing more the faster it goes.
  const swish = (running ? 0.16 : 0.08) * u
  const wave = Math.sin(time * (running ? 16 : 5) + m.seed)
  ctx.strokeStyle = pinkLine
  ctx.lineWidth = Math.max(1, u * 0.05)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-u * 0.3, 0)
  ctx.bezierCurveTo(-u * 0.5, wave * swish, -u * 0.62, -wave * swish, -u * 0.86, wave * swish * 0.6)
  ctx.stroke()

  // Feet, paddling.
  ctx.fillStyle = pinkFill
  for (const [fx, fy, ph] of [
    [0.1, 0.17, 0],
    [0.1, -0.17, Math.PI],
    [-0.16, 0.19, Math.PI],
    [-0.16, -0.19, 0],
  ]) {
    ctx.beginPath()
    ctx.arc(u * fx + Math.sin(stride * Math.PI + ph) * u * 0.04, u * fy, u * 0.045, 0, Math.PI * 2)
    ctx.fill()
  }

  // Body and head as one outline.
  const bob = 1 + (running ? Math.abs(stride) * 0.05 : 0)
  ctx.beginPath()
  ctx.ellipse(-u * 0.06, 0, u * 0.28 * bob, u * 0.19, 0, 0, Math.PI * 2)
  ctx.moveTo(u * 0.36, 0)
  ctx.ellipse(u * 0.2, 0, u * 0.16, u * 0.13, 0, 0, Math.PI * 2)
  ctx.fillStyle = edge
  ctx.save()
  ctx.lineWidth = lw * 2
  ctx.strokeStyle = edge
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = grey
  ctx.fill()

  // Ears: round, pink inside.
  for (const side of [-1, 1]) {
    const ex = u * 0.1
    const ey = side * u * 0.15
    ctx.beginPath()
    ctx.arc(ex, ey, u * 0.1, 0, Math.PI * 2)
    ctx.fillStyle = grey
    ctx.fill()
    ctx.strokeStyle = edge
    ctx.lineWidth = lw
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ex + u * 0.01, ey + side * u * 0.01, u * 0.055, 0, Math.PI * 2)
    ctx.fillStyle = pinkFill
    ctx.fill()
  }

  // Whiskers, twitching while it sniffs.
  const twitch = m.mode === 'sniff' ? Math.sin(time * 30) * u * 0.02 : 0
  ctx.strokeStyle = css(p.ink, 0.45)
  ctx.lineWidth = Math.max(0.6, u * 0.018)
  for (const side of [-1, 1]) {
    for (const k of [-1, 0, 1]) {
      ctx.beginPath()
      ctx.moveTo(u * 0.3, side * u * 0.04)
      ctx.lineTo(u * 0.42 + twitch, side * (u * 0.14 + k * u * 0.05))
      ctx.stroke()
    }
  }

  // Eyes and nose.
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(u * 0.25, side * u * 0.065, Math.max(1, u * 0.03), 0, Math.PI * 2)
    ctx.fillStyle = '#1a2b3c'
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(u * 0.365 + twitch * 0.4, 0, Math.max(1, u * 0.035), 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.pink
  ctx.fill()

  ctx.restore()
}
