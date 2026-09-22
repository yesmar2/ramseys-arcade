import { isDarkTheme, playfieldColor, softFillAlpha, strokeOutlined } from '../../lib/theme'
import {
  CONTROL_HUE,
  CONTROL_LABEL,
  CONTROLS,
  PRESS_LIFE,
  QUICK_FRACTION,
  consoleLayout,
  type ConsoleLayout,
  type Control,
  type GameState,
  type Pop,
} from './game'

/*
 * Bop, drawn as a toy you hold.
 *
 * It was five controls floating on a dotted floor, with the call written over
 * them and the clock as a ring round the middle button. Now the controls are
 * mounted in a body, each in its own socket, the call comes up on a screen at
 * the top, and the body's own rim is the clock: it lights in the colour of the
 * call and drains away round the edge, so the time left is in view wherever
 * your eye has gone to find the control.
 *
 * Each control shows how it is worked: arrows round the knob, a track for the
 * lever, a chevron over the switch, a turning arrow on the wheel. With a mouse
 * and keyboard, the key for each is printed under its name.
 */

const TAU = Math.PI * 2
/** Canvas text cannot read the page's font variable, so the face is named here. */
const FONT = '"Outfit", system-ui, sans-serif'

/** The word printed under each control. */
const NAME: Record<Control, string> = {
  bop: 'BOP',
  twist: 'TWIST',
  pull: 'PULL',
  flick: 'FLICK',
  spin: 'SPIN',
}

/** The keys, for a player with a keyboard. */
const KEYS: Record<Control, string> = {
  bop: 'space',
  twist: '← →',
  pull: '↓',
  flick: '↑',
  spin: 'S',
}

/** In the menu the toy runs through its calls on its own, one every this many seconds. */
const DEMO_STEP = 1.2
const RED = 354

function hsla(h: number, s: number, l: number, a: number) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function easeOutBack(t: number) {
  const c = 1.7
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}

/**
 * A press, shaped over its life: in fast, back out slowly. `k` runs from 1 at
 * the moment of the press down to 0.
 */
function swing(k: number) {
  const t = 1 - k
  if (k <= 0) return 0
  return t < 0.25 ? easeOutCubic(t / 0.25) : 1 - easeOutCubic((t - 0.25) / 0.75)
}

type Paint = {
  fill: string
  hot: string
  line: string
  detail: string
  soft: string
  text: string
}

/** One control's colours: a soft wash inside a same-hue outline, as everything on the site is. */
function paint(hue: number, dark: boolean): Paint {
  return {
    fill: hsla(hue, 60, dark ? 60 : 58, softFillAlpha(dark ? 0.26 : 0.22)),
    hot: hsla(hue, 66, dark ? 62 : 56, softFillAlpha(dark ? 0.58 : 0.5)),
    line: hsla(hue, 62, dark ? 64 : 42, 0.95),
    detail: hsla(hue, 55, dark ? 80 : 30, 0.92),
    soft: hsla(hue, 62, dark ? 64 : 42, dark ? 0.42 : 0.36),
    text: hsla(hue, 70, dark ? 72 : 36, 1),
  }
}

type Sockets = { fill: string; line: string }

function sockets(dark: boolean): Sockets {
  return {
    fill: dark ? 'rgba(0, 0, 0, 0.26)' : 'rgba(26, 43, 60, 0.07)',
    line: dark ? 'rgba(231, 238, 243, 0.08)' : 'rgba(26, 43, 60, 0.12)',
  }
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
}

function socket(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, well: Sockets, u: number) {
  circle(ctx, x, y, r)
  ctx.fillStyle = well.fill
  ctx.fill()
  ctx.strokeStyle = well.line
  ctx.lineWidth = Math.max(1, u * 0.35)
  ctx.stroke()
}

/** An open chevron pointing up (dir -1) or down (dir 1). */
function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: 1 | -1) {
  ctx.beginPath()
  ctx.moveTo(x - size, y - (dir * size) / 2)
  ctx.lineTo(x, y + (dir * size) / 2)
  ctx.lineTo(x + size, y - (dir * size) / 2)
  ctx.stroke()
}

/** An arc with a head on its far end, to say which way something turns. */
function turnArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  from: number,
  to: number,
  head: number,
) {
  ctx.beginPath()
  ctx.arc(x, y, r, from, to, to < from)
  ctx.stroke()
  const dir = to > from ? 1 : -1
  const tip = { x: x + Math.cos(to) * r, y: y + Math.sin(to) * r }
  // The tangent at the tip, pointing the way the arc runs.
  const tx = -Math.sin(to) * dir
  const ty = Math.cos(to) * dir
  const nx = Math.cos(to)
  const ny = Math.sin(to)
  ctx.beginPath()
  ctx.moveTo(tip.x - tx * head + nx * head * 0.7, tip.y - ty * head + ny * head * 0.7)
  ctx.lineTo(tip.x, tip.y)
  ctx.lineTo(tip.x - tx * head - nx * head * 0.7, tip.y - ty * head - ny * head * 0.7)
  ctx.stroke()
}

/**
 * The ring drawn round a control when a run ends on it, which is also as far
 * as the control reaches: its name goes underneath.
 */
function outline(ctx: CanvasRenderingContext2D, L: ConsoleLayout, control: Control, grow = 0) {
  const { x, y, r } = L[control]
  const g = grow * r
  ctx.beginPath()
  if (control === 'pull') ctx.roundRect(x - r * 1.02 - g, y - r * 1.36 - g, r * 2.04 + g * 2, r * 2.84 + g * 2, r * 0.5)
  else if (control === 'flick') ctx.roundRect(x - r * 0.9 - g, y - r * 1.24 - g, r * 1.8 + g * 2, r * 2.48 + g * 2, r * 0.5)
  else ctx.arc(x, y, r * (control === 'bop' ? 1.24 : 1.3) + g, 0, TAU)
}

/** How far below its centre a control's outline reaches, in its own radii. */
const FOOT: Record<Control, number> = {
  bop: 1.24,
  twist: 1.3,
  pull: 1.48,
  flick: 1.24,
  spin: 1.3,
}

/* ---- The controls. `k` is how pressed each one is, from 1 at the press to 0. ---- */

function drawBop(
  ctx: CanvasRenderingContext2D,
  L: ConsoleLayout,
  k: number,
  dark: boolean,
  well: Sockets,
) {
  const { x, y, r } = L.bop
  const p = paint(CONTROL_HUE.bop, dark)
  const depth = swing(k)
  socket(ctx, x, y, r * 1.16, well, L.u)

  const cr = r * (1 - depth * 0.07)
  circle(ctx, x, y, cr)
  ctx.fillStyle = p.fill
  ctx.fill()
  if (k > 0) {
    ctx.globalAlpha = clamp01(k * 1.4)
    ctx.fillStyle = p.hot
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.strokeStyle = p.line
  ctx.lineWidth = Math.max(2, L.u * 0.9)
  strokeOutlined(ctx)

  // The dome, and light on it.
  circle(ctx, x, y, cr * 0.72)
  ctx.strokeStyle = p.soft
  ctx.lineWidth = Math.max(1.5, L.u * 0.6)
  ctx.stroke()
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = Math.max(2, L.u * 0.8)
  ctx.beginPath()
  ctx.arc(x, y, cr * 0.84, Math.PI * 1.08, Math.PI * 1.42)
  ctx.stroke()

  ctx.fillStyle = p.text
  ctx.font = `600 ${Math.round(cr * 0.36)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(NAME.bop, x, y + cr * 0.03)
}

function drawTwist(
  ctx: CanvasRenderingContext2D,
  L: ConsoleLayout,
  k: number,
  angle: number,
  dark: boolean,
  well: Sockets,
) {
  const { x, y, r } = L.twist
  const p = paint(CONTROL_HUE.twist, dark)
  socket(ctx, x, y, r * 1.2, well, L.u)

  // The knob turns a quarter on each twist, with a little overshoot to snap home.
  const a = -Math.PI / 2 + angle - (Math.PI / 2) * (1 - easeOutBack(1 - k))
  circle(ctx, x, y, r)
  ctx.fillStyle = k > 0 ? p.hot : p.fill
  ctx.fill()
  ctx.strokeStyle = p.line
  ctx.lineWidth = Math.max(2, L.u * 0.8)
  strokeOutlined(ctx)

  // Grip round the edge, turning with it.
  ctx.strokeStyle = p.soft
  ctx.lineWidth = Math.max(1.2, L.u * 0.45)
  ctx.beginPath()
  for (let i = 0; i < 16; i++) {
    const b = a + (i / 16) * TAU
    ctx.moveTo(x + Math.cos(b) * r * 0.8, y + Math.sin(b) * r * 0.8)
    ctx.lineTo(x + Math.cos(b) * r * 0.94, y + Math.sin(b) * r * 0.94)
  }
  ctx.stroke()

  ctx.strokeStyle = p.detail
  ctx.lineWidth = Math.max(2.5, r * 0.15)
  ctx.beginPath()
  ctx.moveTo(x + Math.cos(a) * r * 0.16, y + Math.sin(a) * r * 0.16)
  ctx.lineTo(x + Math.cos(a) * r * 0.68, y + Math.sin(a) * r * 0.68)
  ctx.stroke()

  // Which way it goes: a turn either way over the top.
  ctx.strokeStyle = p.soft
  ctx.lineWidth = Math.max(1.5, L.u * 0.55)
  const ar = r * 1.44
  turnArrow(ctx, x, y, ar, Math.PI * 1.36, Math.PI * 1.14, r * 0.2)
  turnArrow(ctx, x, y, ar, Math.PI * 1.64, Math.PI * 1.86, r * 0.2)
}

function drawPull(
  ctx: CanvasRenderingContext2D,
  L: ConsoleLayout,
  k: number,
  dark: boolean,
  well: Sockets,
) {
  const { x, y, r } = L.pull
  const p = paint(CONTROL_HUE.pull, dark)
  const top = y - r * 1.16
  const bottom = y + r * 1.3
  const slotW = r * 0.62

  // The track it runs in, with the way it goes marked down it.
  ctx.beginPath()
  ctx.roundRect(x - slotW / 2, top, slotW, bottom - top, slotW / 2)
  ctx.fillStyle = well.fill
  ctx.fill()
  ctx.strokeStyle = well.line
  ctx.lineWidth = Math.max(1, L.u * 0.35)
  ctx.stroke()
  ctx.strokeStyle = p.soft
  ctx.lineWidth = Math.max(1.5, L.u * 0.55)
  chevron(ctx, x, y + r * 0.2, r * 0.16, 1)
  chevron(ctx, x, y + r * 0.62, r * 0.16, 1)

  // The handle: a T that comes down the track and springs back.
  const rest = top + r * 0.34
  const hy = rest + (bottom - r * 0.34 - rest) * swing(k)
  ctx.fillStyle = p.line
  ctx.fillRect(x - r * 0.1, hy, r * 0.2, r * 0.4)
  ctx.beginPath()
  ctx.roundRect(x - r * 0.84, hy - r * 0.3, r * 1.68, r * 0.6, r * 0.3)
  ctx.fillStyle = k > 0 ? p.hot : hsla(CONTROL_HUE.pull, 60, dark ? 60 : 58, softFillAlpha(dark ? 0.4 : 0.34))
  ctx.fill()
  ctx.strokeStyle = p.line
  ctx.lineWidth = Math.max(2, L.u * 0.8)
  strokeOutlined(ctx)
  ctx.strokeStyle = p.detail
  ctx.lineWidth = Math.max(1.2, L.u * 0.45)
  ctx.beginPath()
  for (const gx of [-0.34, 0, 0.34]) {
    ctx.moveTo(x + r * gx, hy - r * 0.12)
    ctx.lineTo(x + r * gx, hy + r * 0.12)
  }
  ctx.stroke()
}

function drawFlick(
  ctx: CanvasRenderingContext2D,
  L: ConsoleLayout,
  k: number,
  dark: boolean,
  well: Sockets,
) {
  const { x, y, r } = L.flick
  const p = paint(CONTROL_HUE.flick, dark)
  const pw = r * 1.3
  const ph = r * 2.02

  // The plate, the slot the bat rides in, and which way to send it.
  ctx.beginPath()
  ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, r * 0.36)
  ctx.fillStyle = p.fill
  ctx.fill()
  ctx.strokeStyle = p.line
  ctx.lineWidth = Math.max(2, L.u * 0.8)
  strokeOutlined(ctx)
  ctx.beginPath()
  ctx.roundRect(x - r * 0.15, y - ph * 0.3, r * 0.3, ph * 0.6, r * 0.15)
  ctx.fillStyle = well.fill
  ctx.fill()

  ctx.strokeStyle = p.soft
  ctx.lineWidth = Math.max(1.5, L.u * 0.55)
  chevron(ctx, x, y - r * 1.46, r * 0.2, -1)

  // The bat: down at rest, snapped up by a flick and dropping back.
  const up = swing(k)
  const by = y + ph * 0.22 - up * ph * 0.44
  ctx.beginPath()
  ctx.roundRect(x - r * 0.4, by - r * 0.32, r * 0.8, r * 0.64, r * 0.26)
  ctx.fillStyle = k > 0 ? p.hot : hsla(CONTROL_HUE.flick, 60, dark ? 60 : 58, softFillAlpha(dark ? 0.46 : 0.4))
  ctx.fill()
  ctx.strokeStyle = p.line
  ctx.lineWidth = Math.max(2, L.u * 0.7)
  strokeOutlined(ctx)
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.8)'
  ctx.lineWidth = Math.max(1.2, L.u * 0.45)
  ctx.beginPath()
  ctx.moveTo(x - r * 0.18, by - r * 0.14)
  ctx.lineTo(x + r * 0.18, by - r * 0.14)
  ctx.stroke()
}

function drawSpin(
  ctx: CanvasRenderingContext2D,
  L: ConsoleLayout,
  k: number,
  angle: number,
  dark: boolean,
  well: Sockets,
) {
  const { x, y, r } = L.spin
  const p = paint(CONTROL_HUE.spin, dark)
  socket(ctx, x, y, r * 1.2, well, L.u)

  // A whole turn per spin, fast off the mark and coasting to a stop.
  const a = angle - TAU * (1 - easeOutCubic(1 - k))
  circle(ctx, x, y, r)
  ctx.fillStyle = k > 0 ? p.hot : p.fill
  ctx.fill()
  ctx.strokeStyle = p.line
  ctx.lineWidth = Math.max(2, L.u * 0.8)
  strokeOutlined(ctx)
  circle(ctx, x, y, r * 0.8)
  ctx.strokeStyle = p.soft
  ctx.lineWidth = Math.max(1.2, L.u * 0.45)
  ctx.stroke()

  ctx.strokeStyle = p.detail
  ctx.lineWidth = Math.max(1.5, L.u * 0.55)
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const b = a + (i / 5) * TAU
    ctx.moveTo(x + Math.cos(b) * r * 0.2, y + Math.sin(b) * r * 0.2)
    ctx.lineTo(x + Math.cos(b) * r * 0.8, y + Math.sin(b) * r * 0.8)
  }
  ctx.stroke()
  // The crank knob on the rim, so the turn is easy to follow.
  circle(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.17)
  ctx.fillStyle = p.line
  ctx.fill()
  circle(ctx, x, y, r * 0.2)
  ctx.fillStyle = p.hot
  ctx.fill()
  ctx.strokeStyle = p.line
  ctx.lineWidth = Math.max(1.5, L.u * 0.5)
  ctx.stroke()

  ctx.strokeStyle = p.soft
  ctx.lineWidth = Math.max(1.5, L.u * 0.55)
  turnArrow(ctx, x, y, r * 1.44, Math.PI * 1.1, Math.PI * 1.9, r * 0.2)
}

/** The name under a control, and on a keyboard the key that works it. */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  L: ConsoleLayout,
  control: Control,
  dark: boolean,
  keys: boolean,
) {
  // The big button wears its own name; only its key goes underneath.
  const name = control === 'bop' ? '' : NAME[control]
  const key = keys ? KEYS[control] : ''
  if (!name && !key) return
  const spot = L[control]
  const size = Math.max(10.5, L.u * 3.4)
  const y = spot.y + spot.r * FOOT[control] + size * 1.1
  const nameFont = `600 ${Math.round(size)}px ${FONT}`
  const keyFont = `500 ${Math.round(size * 0.9)}px ${FONT}`
  ctx.font = nameFont
  const nw = name ? ctx.measureText(name).width : 0
  ctx.font = keyFont
  const kw = key ? ctx.measureText(key).width : 0
  const gap = name && key ? size * 0.55 : 0
  let x = spot.x - (nw + gap + kw) / 2
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  if (name) {
    ctx.font = nameFont
    ctx.fillStyle = paint(CONTROL_HUE[control], dark).text
    ctx.globalAlpha = 0.85
    ctx.fillText(name, x, y)
    ctx.globalAlpha = 1
    x += nw + gap
  }
  if (key) {
    ctx.font = keyFont
    ctx.fillStyle = dark ? 'rgba(231, 238, 243, 0.45)' : 'rgba(26, 43, 60, 0.48)'
    ctx.fillText(key, x, y)
  }
}

/* ---- The body and its screen. ---- */

function rimPath(ctx: CanvasRenderingContext2D, b: ConsoleLayout['body']) {
  const { x, y, w, h, r } = b
  const mid = x + w / 2
  ctx.beginPath()
  ctx.moveTo(mid, y)
  ctx.lineTo(x + w - r, y)
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
  ctx.lineTo(x + w, y + h - r)
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
  ctx.lineTo(x + r, y + h)
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  ctx.lineTo(x, y + r)
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5)
  ctx.lineTo(mid, y)
}

function rimLength(b: ConsoleLayout['body']) {
  return 2 * (b.w - 2 * b.r) + 2 * (b.h - 2 * b.r) + TAU * b.r
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  L: ConsoleLayout,
  dark: boolean,
  hue: number | null,
  /** Time left on the call, 1 → 0, or null when nothing is being timed. */
  left: number | null,
  time: number,
) {
  const b = L.body
  const u = L.u
  rimPath(ctx, b)
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(255, 255, 255, 0.62)'
  ctx.fill()
  if (hue !== null) {
    ctx.fillStyle = hsla(hue, 70, 55, dark ? 0.055 : 0.045)
    ctx.fill()
  }
  ctx.strokeStyle = dark ? 'rgba(231, 238, 243, 0.14)' : 'rgba(26, 43, 60, 0.13)'
  ctx.lineWidth = Math.max(2, u * 1.1)
  ctx.stroke()

  // Screws in the corners: it is a thing someone put together.
  ctx.fillStyle = dark ? 'rgba(231, 238, 243, 0.12)' : 'rgba(26, 43, 60, 0.12)'
  const inset = b.r * 0.62
  for (const [sx, sy] of [
    [b.x + inset, b.y + inset],
    [b.x + b.w - inset, b.y + inset],
    [b.x + inset, b.y + b.h - inset],
    [b.x + b.w - inset, b.y + b.h - inset],
  ]) {
    circle(ctx, sx, sy, Math.max(1.5, u * 0.9))
    ctx.fill()
  }

  if (hue === null || left === null) return
  /*
   * The clock, round the rim. Bright and heavy while an answer still pays
   * double, lighter once it only pays one, and beating in the last fifth.
   */
  const quick = left > QUICK_FRACTION
  const beat = left < 0.2 ? 0.55 + 0.45 * Math.sin(time * 30) : 1
  const len = rimLength(b)
  ctx.save()
  rimPath(ctx, b)
  ctx.setLineDash([len * left, len + 1])
  ctx.lineCap = 'round'
  ctx.strokeStyle = hsla(hue, 70, dark ? (quick ? 66 : 58) : quick ? 46 : 52, (quick ? 0.95 : 0.7) * beat)
  ctx.lineWidth = Math.max(3, u * (quick ? 1.9 : 1.3))
  ctx.stroke()
  ctx.restore()
}

/** Text fitted to a width, never above `size`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, size: number, maxW: number, weight = 600) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`
  const w = ctx.measureText(text).width
  if (w > maxW) {
    ctx.font = `${weight} ${Math.round((size * maxW) / w)}px ${FONT}`
  }
}

function drawScreen(
  ctx: CanvasRenderingContext2D,
  L: ConsoleLayout,
  state: GameState,
  dark: boolean,
  hue: number | null,
  word: string | null,
) {
  const s = L.screen
  const u = L.u
  ctx.beginPath()
  ctx.roundRect(s.x, s.y, s.w, s.h, s.r)
  ctx.fillStyle = dark ? 'rgba(5, 9, 15, 0.5)' : 'rgba(255, 255, 255, 0.85)'
  ctx.fill()
  if (hue !== null) {
    ctx.fillStyle = hsla(hue, 70, 55, dark ? 0.1 : 0.07)
    ctx.fill()
  }
  ctx.strokeStyle =
    hue !== null ? hsla(hue, 62, dark ? 64 : 44, 0.55) : dark ? 'rgba(231, 238, 243, 0.14)' : 'rgba(26, 43, 60, 0.14)'
  ctx.lineWidth = Math.max(1.5, u * 0.6)
  ctx.stroke()

  // A sheen across the top of the glass.
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = Math.max(1, u * 0.5)
  ctx.beginPath()
  ctx.moveTo(s.x + s.r, s.y + u * 1.1)
  ctx.lineTo(s.x + s.w - s.r, s.y + u * 1.1)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = s.x + s.w / 2

  if (state.phase === 'gameover' && state.ended) {
    const headline = state.ended === 'late' ? 'TOO SLOW' : 'WRONG ONE'
    fitFont(ctx, headline, s.h * 0.38, s.w * 0.86)
    ctx.fillStyle = hsla(RED, 72, dark ? 68 : 48, 1)
    ctx.fillText(headline, cx, s.y + s.h * 0.36)
    if (state.call) {
      // What it wanted, in that control's colour.
      const lead = 'it said '
      const want = CONTROL_LABEL[state.call].toLowerCase()
      const size = Math.max(11, s.h * 0.22)
      ctx.font = `500 ${Math.round(size)}px ${FONT}`
      const lw = ctx.measureText(lead).width
      ctx.font = `600 ${Math.round(size)}px ${FONT}`
      const ww = ctx.measureText(want).width
      const x0 = cx - (lw + ww) / 2
      const ty = s.y + s.h * 0.72
      ctx.textAlign = 'left'
      ctx.font = `500 ${Math.round(size)}px ${FONT}`
      ctx.fillStyle = dark ? 'rgba(231, 238, 243, 0.7)' : 'rgba(26, 43, 60, 0.7)'
      ctx.fillText(lead, x0, ty)
      ctx.font = `600 ${Math.round(size)}px ${FONT}`
      ctx.fillStyle = paint(CONTROL_HUE[state.call], dark).text
      ctx.fillText(want, x0 + lw, ty)
      ctx.textAlign = 'center'
    }
    return
  }

  if (!word || hue === null) return
  fitFont(ctx, word, s.h * 0.5, s.w * 0.86)
  ctx.fillStyle = hsla(hue, 72, dark ? 70 : 42, 1)
  ctx.fillText(word, cx, s.y + s.h * 0.53)
}

/* ---- Words off the controls. ---- */

function popColour(pop: Pop, dark: boolean) {
  if (pop.tone === 'plain') return paint(CONTROL_HUE[pop.control], dark).text
  return hsla(40, 88, dark ? 66 : 40, 1)
}

function drawPops(ctx: CanvasRenderingContext2D, L: ConsoleLayout, state: GameState, dark: boolean) {
  if (!state.pops.length) return
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  const field = playfieldColor()
  for (const pop of state.pops) {
    const age = 1 - pop.life / pop.max
    const spot = L[pop.control]
    const land = age < 0.12 ? 1 + (0.12 - age) * 2.2 : 1
    const base = pop.tone === 'streak' ? 5.2 : pop.tone === 'quick' ? 5.4 : 4.4
    const size = Math.max(12, L.u * base * land)
    const x = spot.x
    const y =
      pop.tone === 'streak'
        ? spot.y - spot.r * 1.55 - age * L.u * 3
        : spot.y - spot.r * 1.3 - age * L.u * 5
    ctx.globalAlpha = Math.min(1, (1 - age) * 2.5)
    ctx.font = `600 ${Math.round(size)}px ${FONT}`
    // A halo of the floor behind the words, so they read over the controls.
    ctx.strokeStyle = field
    ctx.lineWidth = Math.max(3, size * 0.28)
    ctx.strokeText(pop.text, x, y)
    ctx.fillStyle = popColour(pop, dark)
    ctx.fillText(pop.text, x, y)
  }
  ctx.restore()
}

/* ---- The whole frame. ---- */

let keysQuery: MediaQueryList | null = null

/** Keys are printed only for a player who has them: a mouse, not a thumb. */
function hasKeys() {
  if (typeof matchMedia !== 'function') return false
  keysQuery ??= matchMedia('(hover: hover) and (pointer: fine)')
  return keysQuery.matches
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const dark = isDarkTheme()
  const time = performance.now() / 1000
  const L = consoleLayout(w, h, state.stageTop)
  const well = sockets(dark)

  ctx.fillStyle = playfieldColor()
  ctx.fillRect(0, 0, w, h)
  const step = 26 * Math.max(0.7, Math.min(w, h) / 540)
  ctx.fillStyle = dark ? 'rgba(74, 168, 232, 0.07)' : 'rgba(74, 168, 232, 0.1)'
  ctx.beginPath()
  for (let py = step * 0.5; py < h; py += step) {
    for (let px = step * 0.5; px < w; px += step) {
      ctx.moveTo(px + 1.1, py)
      ctx.arc(px, py, 1.1, 0, TAU)
    }
  }
  ctx.fill()

  /*
   * What the toy is doing. In a run: the call, and how much time is left on
   * it. In the menu, behind the start card, it plays itself, one call after
   * another with the right control answering each, so the words and the
   * controls they mean are shown together before anyone has to be quick.
   */
  let hue: number | null = null
  let word: string | null = null
  let left: number | null = null
  const press = (control: Control) =>
    state.pressed === control ? clamp01(state.pressLife / PRESS_LIFE) : 0
  let pressOf = press
  let twistAngle = state.twistAngle
  let spinAngle = state.spinAngle

  if (state.phase === 'call' && state.call) {
    hue = CONTROL_HUE[state.call]
    if (state.gap <= 0) {
      word = CONTROL_LABEL[state.call].toUpperCase() + '!'
      left = clamp01(state.timer / state.window)
    }
  } else if (state.phase === 'gameover' && state.call) {
    hue = RED
  } else if (state.phase === 'menu') {
    const n = Math.floor(time / DEMO_STEP)
    const demo = CONTROLS[n % CONTROLS.length]!
    const since = time - n * DEMO_STEP - 0.42
    const k = since >= 0 && since < PRESS_LIFE ? 1 - since / PRESS_LIFE : 0
    hue = CONTROL_HUE[demo]
    word = CONTROL_LABEL[demo].toUpperCase() + '!'
    pressOf = (control) => (control === demo ? k : 0)
    // Turns already taken, so the knob and the wheel carry on from where they stopped.
    const taken = (control: Control) => {
      const i = CONTROLS.indexOf(control)
      const before = Math.floor(n / CONTROLS.length) + (n % CONTROLS.length > i ? 1 : 0)
      return before + (demo === control && since >= 0 ? 1 : 0)
    }
    twistAngle = (Math.PI / 2) * taken('twist')
    spinAngle = TAU * taken('spin')
  }

  ctx.save()
  if (state.shake > 0) {
    const s = state.shake * L.u * 2.2
    ctx.translate(Math.sin(time * 71) * s, Math.cos(time * 53) * s * 0.4)
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  drawBody(ctx, L, dark, hue, left, time)
  drawScreen(ctx, L, state, dark, hue, word)

  drawBop(ctx, L, pressOf('bop'), dark, well)
  drawTwist(ctx, L, pressOf('twist'), twistAngle, dark, well)
  drawPull(ctx, L, pressOf('pull'), dark, well)
  drawFlick(ctx, L, pressOf('flick'), dark, well)
  drawSpin(ctx, L, pressOf('spin'), spinAngle, dark, well)

  const keys = hasKeys()
  for (const control of CONTROLS) drawLabel(ctx, L, control, dark, keys)

  /*
   * How a run ended, shown on the toy itself: the control that was pressed
   * wrongly ringed in red, and the one that was called beating in its own
   * colour, so a miss says what it should have been.
   */
  if (state.phase === 'gameover') {
    ctx.lineWidth = Math.max(2.5, L.u * 1)
    if (state.wrong) {
      ctx.strokeStyle = hsla(RED, 75, dark ? 66 : 50, 0.95)
      outline(ctx, L, state.wrong)
      ctx.stroke()
    }
    if (state.call) {
      const beat = 0.5 + 0.5 * Math.sin(time * 7)
      ctx.strokeStyle = hsla(CONTROL_HUE[state.call], 70, dark ? 66 : 46, 0.45 + beat * 0.5)
      outline(ctx, L, state.call, beat * 0.06)
      ctx.stroke()
    }
  }

  drawPops(ctx, L, state, dark)
  ctx.restore()

  if (state.flash > 0) {
    ctx.fillStyle = hsla(RED, 80, 55, state.flash * (dark ? 0.5 : 0.35))
    ctx.fillRect(0, 0, w, h)
  }
}
