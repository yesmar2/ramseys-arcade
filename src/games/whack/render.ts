import {
  PAD_INNER,
  bubbleRadius,
  bubbleSpot,
  fieldRect,
  type Burst,
  type Floater,
  type GameState,
  type Target,
} from './game'
import { isDarkTheme, playfieldColor } from '../../lib/theme'

/*
 * Pop, drawn as bubbles.
 *
 * It was nine rings in a grid, and a circle that filled one in: a target with
 * nothing to say about the name on the box. Now bubbles blow up anywhere on
 * the field and float: each wobbles as it fills, drifts upward with a sway,
 * carries a bright core in its middle where a tap pays the centre price, wears
 * a ring that runs down with the time it has left, sags as it goes, and bursts
 * into droplets when it is caught — a ring and a star for a centre, sparks for
 * gold, a fizzle for one let go. The core is exactly the centre the scoring
 * always used, and what is drawn is exactly what can be hit.
 */

const TAU = Math.PI * 2
/** Canvas text cannot read the page's font variable, so the face is named here. */
const FONT = '"Outfit", system-ui, sans-serif'

function hsla(h: number, s: number, l: number, a: number) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

/** Stable noise for a burst's droplets, so each one flies the same way every frame. */
function noise(seed: number, i: number) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
}

/** A four-pointed sparkle. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, turn: number) {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = turn + (i / 8) * TAU
    const d = i % 2 === 0 ? size : size * 0.28
    const px = x + Math.cos(a) * d
    const py = y + Math.sin(a) * d
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

/* ---- The field. ---- */

function drawField(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, dark: boolean) {
  const f = fieldRect(w, h, state.stageTop)
  const pad = bubbleRadius(w, h, state.stageTop) * 0.35
  ctx.beginPath()
  ctx.roundRect(f.x - pad, f.y - pad, f.w + pad * 2, f.h + pad * 2, pad * 2.2)
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(255, 255, 255, 0.45)'
  ctx.fill()
  ctx.strokeStyle = dark ? 'rgba(231, 238, 243, 0.09)' : 'rgba(26, 43, 60, 0.09)'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

/** The last five seconds, counted out large behind the bubbles. */
function drawCountdown(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, dark: boolean) {
  if (state.phase !== 'playing' || state.timeLeft > 5 || state.timeLeft <= 0) return
  const f = fieldRect(w, h, state.stageTop)
  const n = Math.ceil(state.timeLeft)
  // Each number lands big and settles over its second.
  const into = n - state.timeLeft
  const scale = 1 + (1 - easeOutCubic(clamp01(into / 0.35))) * 0.25
  ctx.save()
  ctx.font = `600 ${Math.round(Math.min(f.w, f.h) * 0.6 * scale)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = dark ? `rgba(231, 238, 243, ${0.12 - into * 0.05})` : `rgba(26, 43, 60, ${0.1 - into * 0.04})`
  ctx.fillText(String(n), f.x + f.w / 2, f.y + f.h / 2)
  ctx.restore()
}

/* ---- Bubbles. ---- */

function drawBubble(
  ctx: CanvasRenderingContext2D,
  target: Target,
  w: number,
  h: number,
  top: number,
  dark: boolean,
  time: number,
) {
  const spot = bubbleSpot(target, w, h, top)
  const { x, y } = spot
  const size = spot.r
  const R = bubbleRadius(w, h, top)
  const hue = target.hue
  const gold = target.kind === 'gold'
  // It thins as it sags, rather than just shrinking.
  const sagging = target.age >= target.life * 0.6
  const fade = sagging ? clamp01(0.25 + target.rise * 0.9) : 1
  // A wobble that settles once it is blown up, and never quite stops.
  const amp = 0.06 * Math.exp(-target.age * 5) + 0.014
  const wob = Math.sin(target.age * 17 + target.sway * 3) * amp
  const rx = size * (1 + wob)
  const ry = size * (1 - wob)

  ctx.save()
  ctx.globalAlpha = fade

  // The film: nearly clear in the middle and gathering colour at the edge, as soap does.
  // Gold is a denser film: a thin amber over the dark floor mixes to olive.
  const film = ctx.createRadialGradient(x - size * 0.22, y - size * 0.26, size * 0.08, x, y, size)
  if (gold) {
    film.addColorStop(0, hsla(48, 96, dark ? 72 : 80, dark ? 0.42 : 0.5))
    film.addColorStop(0.68, hsla(44, 92, dark ? 58 : 62, dark ? 0.5 : 0.55))
    film.addColorStop(1, hsla(38, 92, dark ? 56 : 54, dark ? 0.72 : 0.7))
  } else {
    film.addColorStop(0, hsla(hue, 70, dark ? 72 : 82, 0.06))
    film.addColorStop(0.68, hsla(hue, 72, dark ? 60 : 62, dark ? 0.15 : 0.17))
    film.addColorStop(1, hsla(hue, 76, dark ? 62 : 55, dark ? 0.36 : 0.32))
  }
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
  ctx.fillStyle = film
  ctx.fill()
  ctx.strokeStyle = hsla(hue, 72, dark ? 66 : 44, 0.95)
  ctx.lineWidth = Math.max(2, R * 0.06)
  ctx.stroke()

  // The shimmer that runs round a soap film, a shifted colour along one side.
  // Gold shines paler instead: a shifted hue on gold is green, and reads as mould.
  ctx.lineCap = 'round'
  ctx.strokeStyle = gold
    ? hsla(50, 100, dark ? 84 : 78, dark ? 0.55 : 0.8)
    : hsla(hue + 70, 80, dark ? 74 : 60, dark ? 0.4 : 0.5)
  ctx.lineWidth = Math.max(1.5, R * 0.05)
  ctx.beginPath()
  ctx.ellipse(x, y, rx * 0.86, ry * 0.86, 0, Math.PI * 0.08, Math.PI * 0.55)
  ctx.stroke()

  // The core: where a tap pays the centre price, exactly as big as the scoring says.
  const core = size * PAD_INNER
  circle(ctx, x, y, core)
  ctx.fillStyle = gold ? hsla(46, 96, dark ? 70 : 66, dark ? 0.45 : 0.5) : hsla(hue, 76, dark ? 62 : 58, dark ? 0.24 : 0.22)
  ctx.fill()
  ctx.strokeStyle = hsla(hue, 72, dark ? 68 : 44, 0.6)
  ctx.lineWidth = Math.max(1.2, R * 0.035)
  ctx.stroke()
  circle(ctx, x, y, Math.max(1.5, R * 0.06))
  ctx.fillStyle = hsla(hue, 76, dark ? 76 : 40, 0.85)
  ctx.fill()

  // Light on it.
  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.95)'
  ctx.lineWidth = Math.max(2, R * 0.07)
  ctx.beginPath()
  ctx.ellipse(x, y, rx * 0.72, ry * 0.72, 0, Math.PI * 1.1, Math.PI * 1.36)
  ctx.stroke()
  circle(ctx, x - rx * 0.28, y - ry * 0.66, Math.max(1.5, R * 0.05))
  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.95)'
  ctx.fill()

  // The time it has left, running down round it.
  const left = clamp01(1 - target.age / target.life)
  ctx.strokeStyle = dark ? 'rgba(231, 238, 243, 0.34)' : 'rgba(26, 43, 60, 0.3)'
  ctx.lineWidth = Math.max(1.5, R * 0.045)
  ctx.beginPath()
  ctx.arc(x, y, size + Math.max(4, R * 0.14), -Math.PI / 2, -Math.PI / 2 + TAU * left)
  ctx.stroke()

  if (gold) {
    // Gold glitters: three sparks turning round it.
    for (let i = 0; i < 3; i++) {
      const a = time * 1.8 + (i / 3) * TAU + target.sway
      const tw = 0.5 + 0.5 * Math.sin(time * 9 + i * 2.1)
      sparkle(ctx, x + Math.cos(a) * size * 1.2, y + Math.sin(a) * size * 1.2, R * (0.08 + tw * 0.08), time * 2)
      ctx.fillStyle = hsla(46, 96, dark ? 74 : 52, 0.5 + tw * 0.5)
      ctx.fill()
    }
  }
  ctx.restore()
}

/* ---- What a bubble leaves. ---- */

function drawBurst(ctx: CanvasRenderingContext2D, b: Burst, w: number, h: number, R: number, dark: boolean) {
  const t = clamp01(b.age / b.life)
  const out = easeOutCubic(t)
  const x = b.u * w
  const y = b.v * h
  const r = R * b.size
  const hue = b.hue
  const colour = (a: number) => hsla(hue, 76, dark ? 66 : 50, a)

  if (b.kind === 'fizzle') {
    // Let go: a sag and a few drops falling off it.
    ctx.fillStyle = hsla(hue, 30, dark ? 62 : 55, (1 - t) * 0.55)
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      const dx = (noise(b.seed, i) - 0.5) * r * 0.9
      const dy = r * 0.2 + t * r * (0.5 + noise(b.seed, i + 5) * 0.5)
      const s = R * 0.07 * (1 - t * 0.6)
      ctx.moveTo(x + dx + s, y + dy)
      ctx.arc(x + dx, y + dy, s, 0, TAU)
    }
    ctx.fill()
    return
  }

  const big = b.kind === 'center' || b.kind === 'gold'
  // The shock of it, a ring thrown off the skin.
  circle(ctx, x, y, r * (0.95 + out * (big ? 0.75 : 0.55)))
  ctx.strokeStyle = colour((1 - t) * 0.75)
  ctx.lineWidth = Math.max(1, R * 0.09 * (1 - t))
  ctx.stroke()

  // Droplets flung out, and falling a little as they go.
  const n = b.kind === 'end' ? 7 : big ? 12 : 9
  ctx.fillStyle = b.kind === 'gold' ? hsla(46, 96, dark ? 70 : 50, 1 - t) : colour(1 - t)
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + noise(b.seed, i) * 0.5
    const speed = 0.7 + noise(b.seed, i + 11) * 0.6
    const d = r * (0.8 + out * (big ? 1.15 : 0.9) * speed)
    const dx = x + Math.cos(a) * d
    const dy = y + Math.sin(a) * d + t * t * r * 0.45
    const s = R * (0.06 + noise(b.seed, i + 23) * 0.05) * (1 - t * 0.8)
    ctx.moveTo(dx + s, dy)
    ctx.arc(dx, dy, s, 0, TAU)
  }
  ctx.fill()

  if (b.kind === 'center') {
    // A centre gets a star where it landed, and a second ring close behind the first.
    const s = r * 0.62 * Math.sqrt(1 - t)
    sparkle(ctx, x, y, s, t * 1.4)
    ctx.fillStyle = dark ? `rgba(255, 244, 214, ${1 - t})` : `rgba(255, 214, 110, ${1 - t})`
    ctx.fill()
    if (t > 0.12) {
      const t2 = (t - 0.12) / 0.88
      circle(ctx, x, y, r * (0.7 + easeOutCubic(t2) * 1.1))
      ctx.strokeStyle = hsla(44, 92, dark ? 70 : 50, (1 - t2) * 0.6)
      ctx.lineWidth = Math.max(1, R * 0.06 * (1 - t2))
      ctx.stroke()
    }
  } else if (b.kind === 'gold') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + noise(b.seed, i + 40) * 1.2
      const d = r * (0.5 + out * 1.3)
      sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, R * 0.16 * (1 - t), t * 3 + i)
      ctx.fillStyle = hsla(46, 96, dark ? 76 : 54, 1 - t)
      ctx.fill()
    }
  }
}

/* ---- Words. ---- */

function floaterColour(f: Floater, dark: boolean) {
  switch (f.tone) {
    case 'center':
      return hsla(40, 88, dark ? 66 : 40, 1)
    case 'gold':
      return hsla(46, 92, dark ? 64 : 38, 1)
    case 'lost':
      return hsla(350, 64, dark ? 72 : 44, 0.95)
    default:
      return hsla(f.hue, 70, dark ? 74 : 36, 1)
  }
}

function drawFloaters(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number, dark: boolean) {
  if (!state.floaters.length) return
  const field = playfieldColor()
  const R = bubbleRadius(w, h, state.stageTop)
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const f of state.floaters) {
    const age = 1 - f.life / f.max
    const land = age < 0.12 ? 1 + (0.12 - age) * 2.2 : 1
    const base = f.tone === 'center' ? 22 : f.tone === 'gold' ? 21 : f.tone === 'lost' ? 15 : 19
    const size = Math.max(12, base * state.scale * land)
    const x = f.u * w
    const y = f.v * h - R * 1.15 - age * 34 * state.scale
    ctx.globalAlpha = Math.min(1, (1 - age) * 2.5)
    ctx.font = `600 ${Math.round(size)}px ${FONT}`
    // A halo of the floor behind the words, so they read over a bubble in either theme.
    ctx.strokeStyle = field
    ctx.lineWidth = Math.max(3, size * 0.28)
    ctx.strokeText(f.text, x, y)
    ctx.fillStyle = floaterColour(f, dark)
    ctx.fillText(f.text, x, y)
  }
  ctx.restore()
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (ctx.canvas.width !== Math.floor(w * dpr) || ctx.canvas.height !== Math.floor(h * dpr)) {
    ctx.canvas.width = Math.floor(w * dpr)
    ctx.canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const dark = isDarkTheme()
  const time = performance.now() / 1000
  const top = state.stageTop

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

  // The field is bare behind the bubbles: the ninths the number keys still pick
  // were labelled here from the days of a grid of pads, and are not any more.
  drawField(ctx, state, w, h, dark)
  drawCountdown(ctx, state, w, h, dark)

  for (const pad of state.pads) {
    const target = pad.target
    // A caught bubble is gone at once; the burst is what is left of it.
    if (!target || target.hit || target.rise <= 0.04) continue
    drawBubble(ctx, target, w, h, top, dark, time)
  }

  ctx.lineCap = 'butt'
  const R = bubbleRadius(w, h, top)
  for (const b of state.bursts) drawBurst(ctx, b, w, h, R, dark)

  // A tap on nothing still lands somewhere you can see.
  for (const tap of state.taps) {
    const t = clamp01(tap.age / 0.35)
    circle(ctx, tap.u * w, tap.v * h, 6 + easeOutCubic(t) * 20)
    ctx.strokeStyle = dark ? `rgba(231, 238, 243, ${(1 - t) * 0.45})` : `rgba(26, 43, 60, ${(1 - t) * 0.4})`
    ctx.lineWidth = 2
    ctx.stroke()
  }

  drawFloaters(ctx, state, w, h, dark)
}
