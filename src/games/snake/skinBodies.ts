import { css, mixRgb, type RGB } from './art'

/*
 * Snake's creature skins: a skin that is a whole animal (or a comet) instead of a bead tail. Each one lays
 * its pieces along the body by distance from the head, the way the bead tails lay their beads, so the
 * snake underneath is the same as ever and only the look changes. Previews and other players' snakes
 * never get one.
 *
 * Everything a frame needs comes in a Body. Distances (`at`) are in cells down the body, 0 at the head;
 * points and sizes come out in pixels. Nothing here makes a canvas, and the glows are made once and kept.
 */

export type BodyPose = { x: number; y: number; dx: number; dy: number }

export type Body = {
  ctx: CanvasRenderingContext2D
  /** A cell, in pixels. */
  c: number
  /** Head to tail tip, in cells. */
  length: number
  time: number
  dark: boolean
  /** The way the head points, radians. */
  angle: number
  /** The point `at` cells down the body, in pixels, and the way the body runs there (toward the head). */
  at(at: number): BodyPose
  /** How much a fruit on its way down swells the body at `at`: 1 where there's none. */
  swell(at: number): number
  /** How far the crash has drained the colour at `at`, 0 to 1 in steps. */
  drain(at: number): number
  deadFill: RGB
  deadLine: RGB
  dying: boolean
  blink: boolean
  /** A top chain: the pieces run through the ten colours, `rainbow(k)` the k-th piece's. */
  hot: boolean
  rainbow(k: number): RGB
  boosting: boolean
  /** What the eyes are on, in the head's own frame (nose along +x), in pixels. */
  look: { x: number; y: number } | null
}

const TAU = Math.PI * 2
const AMBER: RGB = [255, 200, 90]

const solid = new WeakMap<RGB, string>()

/** A colour drained toward `dead` by `d`. Undrained and opaque, the string is made once. */
function paint(rgb: RGB, d: number, dead: RGB, a = 1) {
  if (d <= 0 && a === 1) {
    let s = solid.get(rgb)
    if (!s) {
      s = css(rgb)
      solid.set(rgb, s)
    }
    return s
  }
  return css(d > 0 ? mixRgb(rgb, dead, d) : rgb, a)
}

/** A colour along three stops, `t` from 0 to 1. */
function along3(a: RGB, b: RGB, c: RGB, t: number): RGB {
  const k = Math.min(1, Math.max(0, t))
  return k < 0.5 ? mixRgb(a, b, k * 2) : mixRgb(b, c, k * 2 - 1)
}

const glows = new Map<string, CanvasGradient>()

/** A soft round glow centred on the origin, made once for each size and kept. */
function glow(ctx: CanvasRenderingContext2D, name: string, r: number, rgb: RGB, a: number) {
  const key = `${name}|${Math.round(r * 2)}`
  let g = glows.get(key)
  if (!g) {
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
    g.addColorStop(0, css(rgb, a))
    g.addColorStop(0.55, css(rgb, a * 0.45))
    g.addColorStop(1, css(rgb, 0))
    if (glows.size > 48) glows.clear()
    glows.set(key, g)
  }
  return g
}

/** A point `u` along the body and `v` across it (to the body's right) from `p`. */
function off(p: BodyPose, u: number, v: number) {
  return { x: p.x + p.dx * u - p.dy * v, y: p.y + p.dy * u + p.dx * v }
}

/**
 * A pair of eyes in the head's frame (the context already turned to it): open and looking at what the
 * snake's after, shut for a blink, crossed out in a crash. `ink` is what the shut and crossed eyes are drawn in.
 */
function eyes(b: Body, x: number, gap: number, r: number, ink: string, white = '#ffffff', pupil = '#10161c') {
  const { ctx } = b
  ctx.lineCap = 'round'
  for (const side of [-1, 1]) {
    const ey = side * gap
    if (b.dying) {
      // Once the head has drained to the dead snake's grey, the crosses are drawn to read on that instead.
      const k = r * 0.8
      ctx.strokeStyle = b.drain(0) > 0.5 ? (b.dark ? '#e7eef3' : '#1a2b3c') : ink
      ctx.lineWidth = Math.max(1.2, r * 0.42)
      ctx.beginPath()
      ctx.moveTo(x - k, ey - k)
      ctx.lineTo(x + k, ey + k)
      ctx.moveTo(x + k, ey - k)
      ctx.lineTo(x - k, ey + k)
      ctx.stroke()
      continue
    }
    if (b.blink) {
      ctx.strokeStyle = ink
      ctx.lineWidth = Math.max(1, r * 0.4)
      ctx.beginPath()
      ctx.moveTo(x, ey - r * 0.9)
      ctx.lineTo(x, ey + r * 0.9)
      ctx.stroke()
      continue
    }
    let lx = r * 0.32
    let ly = 0
    if (b.look) {
      const dx = b.look.x - x
      const dy = b.look.y - ey
      const d = Math.hypot(dx, dy) || 1
      lx = (dx / d) * r * 0.36
      ly = (dy / d) * r * 0.36
    }
    ctx.fillStyle = white
    ctx.beginPath()
    ctx.arc(x, ey, r, 0, TAU)
    ctx.fill()
    ctx.fillStyle = pupil
    ctx.beginPath()
    ctx.arc(x + lx, ey + ly, r * 0.56, 0, TAU)
    ctx.fill()
  }
}

/** Turn the context to the head: the origin on it, the nose along +x. */
function toHead(b: Body) {
  const h = b.at(0)
  b.ctx.save()
  b.ctx.translate(h.x, h.y)
  b.ctx.rotate(b.angle)
}

// Comet --------------------------------------------------------------------------

/** The fire's colours, head to tip: white-gold, gold, orange, red, a dusky ember. Deeper on the light lawn. */
const FIRE_DARK: RGB[] = [
  [255, 246, 214],
  [255, 214, 120],
  [255, 150, 55],
  [232, 80, 70],
  [150, 52, 86],
]
const FIRE_LIGHT: RGB[] = [
  [255, 214, 104],
  [255, 172, 52],
  [242, 112, 38],
  [214, 58, 58],
  [140, 40, 72],
]
const FIRE_STEPS = 32

/** The fire's colour at `t` (0 at the head, 1 at the tip), its alpha already in, one string per step. */
const fireCss = new Map<boolean, string[]>()
function fireAt(dark: boolean, t: number) {
  let list = fireCss.get(dark)
  if (!list) {
    const stops = dark ? FIRE_DARK : FIRE_LIGHT
    list = []
    for (let i = 0; i <= FIRE_STEPS; i++) list.push(css(fireRgb(stops, i / FIRE_STEPS), fireAlpha(i / FIRE_STEPS)))
    fireCss.set(dark, list)
  }
  return list[Math.round(Math.min(1, Math.max(0, t)) * FIRE_STEPS)]!
}
function fireRgb(stops: RGB[], t: number): RGB {
  const at = [0, 0.16, 0.4, 0.7, 1]
  let i = 1
  while (i < at.length - 1 && t > at[i]!) i++
  const u = Math.min(1, Math.max(0, (t - at[i - 1]!) / (at[i]! - at[i - 1]!)))
  return mixRgb(stops[i - 1]!, stops[i]!, u)
}
/** Solid down most of the tail (see-through puffs laid over each other show their edges), fading over the last of it. */
function fireAlpha(t: number) {
  const u = Math.max(0, (t - 0.62) / 0.38)
  return 1 - 0.8 * u * Math.sqrt(u)
}

/** A lumpy round rock, radius 1, a little out of round so it reads as stone. */
const ROCK = Array.from({ length: 11 }, (_, i) => {
  const a = (i / 11) * TAU
  const r = 1 + [0.02, -0.07, 0.05, -0.03, 0.06, -0.06, 0.03, -0.04, 0.07, -0.05, 0][i]!
  return [Math.cos(a) * r, Math.sin(a) * r] as const
})
const ROCK_FILL: RGB = [90, 74, 94]
const ROCK_PIT: RGB = [122, 104, 128]
const ROCK_EDGE: RGB = [58, 46, 64]

/**
 * The Blazing comet (Season 1): a pitted grey-violet rock for a head in a gold glow, and behind it a fire
 * tail that cools from white-gold to orange to red, thinning and fading to the tip, its edges licking.
 */
function comet(b: Body) {
  const { ctx, c, length, time } = b
  const lick = b.dying ? 0 : 1
  const boost = b.boosting && !b.dying ? 1.12 : 1
  const step = 0.16
  const span = Math.max(length, 0.01)
  for (let at = length, k = 0; at > 0.2; at -= step, k++) {
    const t = at / span
    const p = b.at(at)
    const flick = Math.sin(at * 7.3 - time * 13) * 0.55 + Math.sin(at * 3.1 + time * 8.5) * 0.45
    const r = c * (0.4 * (1 - t) ** 0.8 + 0.05) * b.swell(at) * (1 + 0.16 * flick * lick) * boost
    const side = c * 0.1 * t * flick * lick
    const d = b.drain(at)
    ctx.fillStyle = b.hot
      ? css(b.rainbow(Math.floor(at / 0.55)), fireAlpha(t))
      : d > 0
        ? css(mixRgb(fireRgb(b.dark ? FIRE_DARK : FIRE_LIGHT, t), b.deadFill, d), fireAlpha(t))
        : fireAt(b.dark, t)
    ctx.beginPath()
    ctx.arc(p.x - p.dy * side, p.y + p.dx * side, r, 0, TAU)
    ctx.fill()
  }

  // Embers shed off the tail, drifting out and going dark.
  if (!b.dying && length > 0.8) {
    ctx.fillStyle = b.dark ? 'rgba(255, 196, 96, 0.9)' : 'rgba(226, 104, 40, 0.9)'
    for (let i = 0; i < 6; i++) {
      const ph = (time * 0.9 + i / 6) % 1
      const at = length * (0.3 + 0.6 * ((i * 0.618) % 1)) + ph * 0.4
      if (at > length) continue
      const p = b.at(at)
      const v = (i % 2 ? 1 : -1) * c * (0.25 + ph * 0.45)
      ctx.globalAlpha = 1 - ph
      ctx.beginPath()
      ctx.arc(p.x - p.dy * v, p.y + p.dx * v, c * 0.045 * (1 - ph * 0.5), 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  const d = b.drain(0)
  toHead(b)
  // The glow round the rock, its own colour fading out with the crash.
  ctx.globalAlpha = (1 - d) * (b.dark ? 1 : 0.85)
  ctx.fillStyle = glow(ctx, 'comet', c * 1.05, [255, 200, 90], b.dark ? 0.55 : 0.6)
  ctx.beginPath()
  ctx.arc(0, 0, c * 1.05, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
  const r = c * 0.43
  ctx.beginPath()
  for (const [x, y] of ROCK) ctx.lineTo(x * r, y * r)
  ctx.closePath()
  ctx.fillStyle = paint(ROCK_FILL, d, b.deadFill)
  ctx.fill()
  ctx.lineWidth = Math.max(1, c * 0.04)
  ctx.strokeStyle = paint(ROCK_EDGE, d, b.deadLine)
  ctx.stroke()
  ctx.fillStyle = paint(ROCK_PIT, d, b.deadFill)
  for (const [x, y, pr] of [
    [-0.4, -0.36, 0.24],
    [-0.12, 0.46, 0.17],
    [-0.52, 0.22, 0.13],
  ] as const) {
    ctx.beginPath()
    ctx.arc(x * r, y * r, pr * r, 0, TAU)
    ctx.fill()
  }
  // Its front lit gold, where it meets the air.
  ctx.strokeStyle = b.hot ? css(b.rainbow(0)) : paint([255, 210, 122], d, b.deadLine)
  ctx.lineWidth = Math.max(1.4, c * 0.075)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.98, -1.15, 1.15)
  ctx.stroke()
  eyes(b, c * 0.14, c * 0.16, c * 0.11, '#f3e8f7')
  ctx.restore()
}

// Astro worm -------------------------------------------------------------------

const SUIT: RGB = [244, 242, 250]
const SUIT_LINE_DARK: RGB = [154, 160, 184]
const SUIT_LINE_LIGHT: RGB = [104, 112, 140]
const BAND: RGB = [242, 129, 58]
const LEG_DARK: RGB = [200, 204, 218]
const LEG_LIGHT: RGB = [120, 128, 152]
const VISOR: RGB = [22, 48, 90]

/**
 * The Astro worm (Season 1's Pass+): a caterpillar in a spacesuit. White segments with an orange band
 * across each and a tiny leg either side that walk, a helmet for a head with a navy visor and an aerial.
 */
function astroWorm(b: Body) {
  const { ctx, c, length, time } = b
  const step = 0.36
  const suitLine = b.dark ? SUIT_LINE_DARK : SUIT_LINE_LIGHT
  const leg = b.dark ? LEG_DARK : LEG_LIGHT
  const walking = b.dying ? 0 : 1
  ctx.lineCap = 'butt'
  for (let k = Math.floor((length - 0.12) / step); k >= 1; k--) {
    const at = k * step
    const t = at / Math.max(length, 0.01)
    const p = b.at(at)
    const r = c * (0.35 - 0.1 * t) * b.swell(at)
    const d = b.drain(at)
    // The legs, one either side, stepping in a ripple down the body.
    const stride = Math.sin(time * 12 - k * 1.1) * c * 0.06 * walking
    ctx.strokeStyle = paint(leg, d, b.deadLine)
    ctx.lineWidth = Math.max(1.2, c * 0.09)
    ctx.beginPath()
    for (const side of [-1, 1]) {
      const u = stride * side
      const a = off(p, u, side * (r - c * 0.04))
      const e = off(p, u - c * 0.03, side * (r + c * 0.1))
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(e.x, e.y)
    }
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, TAU)
    ctx.fillStyle = paint(SUIT, d, b.deadFill)
    ctx.fill()
    ctx.lineWidth = Math.max(1, c * 0.04)
    ctx.strokeStyle = paint(suitLine, d, b.deadLine)
    ctx.stroke()
    // The band across it.
    const a = off(p, 0, -(r - c * 0.035))
    const e = off(p, 0, r - c * 0.035)
    ctx.strokeStyle = b.hot ? css(b.rainbow(k)) : b.boosting && !b.dying ? paint(AMBER, 0, b.deadLine) : paint(BAND, d, b.deadLine)
    ctx.lineWidth = Math.max(1.4, c * 0.1)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(e.x, e.y)
    ctx.stroke()
  }

  const d = b.drain(0)
  toHead(b)
  const r = c * 0.45
  // The aerial first, so the helmet sits over its foot; its tip bobs.
  const bob = b.dying ? 0 : Math.sin(time * 5) * c * 0.04
  const tip = { x: -c * 0.36 + bob, y: -c * 0.62 }
  ctx.strokeStyle = paint(suitLine, d, b.deadLine)
  ctx.lineWidth = Math.max(1, c * 0.045)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-c * 0.18, -c * 0.32)
  ctx.lineTo(tip.x, tip.y)
  ctx.stroke()
  ctx.fillStyle = paint([232, 86, 79], d, b.deadFill)
  ctx.beginPath()
  ctx.arc(tip.x, tip.y, c * 0.08, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.fillStyle = paint(SUIT, d, b.deadFill)
  ctx.fill()
  ctx.lineWidth = Math.max(1.2, c * 0.05)
  ctx.strokeStyle = paint(suitLine, d, b.deadLine)
  ctx.stroke()
  // The visor, its glint, and the eyes behind it.
  ctx.beginPath()
  ctx.ellipse(c * 0.13, 0, c * 0.26, c * 0.33, 0, 0, TAU)
  ctx.fillStyle = paint(VISOR, d, b.deadLine)
  ctx.fill()
  eyes(b, c * 0.16, c * 0.13, c * 0.085, '#e8eefc')
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.beginPath()
  ctx.ellipse(c * 0.25, -c * 0.17, c * 0.06, c * 0.095, 0.5, 0, TAU)
  ctx.fill()
  ctx.restore()
}

// Aurora serpent ---------------------------------------------------------------

const AURORA: readonly [RGB, RGB, RGB] = [
  [92, 242, 176],
  [70, 228, 255],
  [155, 123, 255],
]
const AURORA_STEPS = 14
/** The ribbon's colours, one string per step down the body. */
const auroraCss = Array.from({ length: AURORA_STEPS + 1 }, (_, i) => css(along3(AURORA[0], AURORA[1], AURORA[2], i / AURORA_STEPS)))
const SERPENT_HEAD: RGB = [15, 42, 68]
const FIN_DARK: RGB = [155, 123, 255]
const FIN_LIGHT: RGB = [124, 92, 236]
const CORE: RGB = [232, 255, 246]

/** The ribbon's points, kept between frames: x, y and distance down the body, then the wave's push. */
let ribbon = new Float32Array(0)
let bend = new Float32Array(0)

/**
 * The Aurora serpent (Season 2's Pass+): a ribbon of light for a body, green to cyan to violet, with a
 * faint halo and a bright core, waving gently; a ridge of violet fins down its back, and a sea serpent's
 * head with whiskers.
 */
function auroraSerpent(b: Body) {
  const { ctx, c, length, time } = b
  const step = 0.12
  const n = Math.max(2, Math.ceil(length / step) + 1)
  if (ribbon.length < n * 4) {
    ribbon = new Float32Array(n * 8)
    bend = new Float32Array(n * 4)
  }
  // The centre line first.
  for (let i = 0; i < n; i++) {
    const at = Math.min(length, i * step)
    const p = b.at(at)
    ribbon[i * 4] = p.x
    ribbon[i * 4 + 1] = p.y
    ribbon[i * 4 + 2] = at
  }
  // Then the wave, across a direction smoothed over a few points so it rounds the corners.
  const sway = b.dying ? 0 : time * 2.2
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2)
    const e = Math.min(n - 1, i + 2)
    let dx = ribbon[a * 4]! - ribbon[e * 4]!
    let dy = ribbon[a * 4 + 1]! - ribbon[e * 4 + 1]!
    const l = Math.hypot(dx, dy) || 1
    dx /= l
    dy /= l
    const at = ribbon[i * 4 + 2]!
    const wob = Math.sin(at * 2.4 - sway) * c * 0.1 * Math.min(1, at / 0.8)
    bend[i * 2] = -dy * wob
    bend[i * 2 + 1] = dx * wob
  }
  for (let i = 0; i < n; i++) {
    ribbon[i * 4] += bend[i * 2]!
    ribbon[i * 4 + 1] += bend[i * 2 + 1]!
  }
  const span = Math.max(length, 0.01)
  const widthAt = (i: number) => {
    const at = ribbon[i * 4 + 2]!
    return Math.round(c * 0.5 * (1 - 0.55 * (at / span)) * b.swell(at) * 2) / 2
  }

  /** Strokes the ribbon in runs, a new run wherever the width or the colour changes. */
  const strokeRuns = (wide: number, scale: number, colorAt: (i: number) => string) => {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    let runW = -1
    let runC = ''
    for (let i = 1; i < n; i++) {
      const w = widthAt(i) * scale + wide
      const col = colorAt(i)
      if (w !== runW || col !== runC) {
        if (runW > 0) ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(ribbon[(i - 1) * 4]!, ribbon[(i - 1) * 4 + 1]!)
        ctx.lineWidth = w
        ctx.strokeStyle = col
        runW = w
        runC = col
      }
      ctx.lineTo(ribbon[i * 4]!, ribbon[i * 4 + 1]!)
    }
    if (runW > 0) ctx.stroke()
  }
  const bucket = (i: number) => Math.round((ribbon[i * 4 + 2]! / span) * AURORA_STEPS)

  if (b.dark) {
    // The halo: the light the ribbon gives off, one faint wide stroke.
    const d = b.drain(0)
    ctx.globalAlpha = 0.17 * (1 - d)
    strokeRuns(c * 0.34, 1, () => paint(AURORA[1], 0, b.deadFill))
    ctx.globalAlpha = 1
  } else {
    // On the light lawn the ribbon keeps a night edge, so its pale colours still read.
    strokeRuns(Math.max(2, c * 0.1), 1, (i) => paint(SERPENT_HEAD, b.drain(ribbon[i * 4 + 2]!), b.deadLine, 0.9))
  }
  strokeRuns(0, 1, (i) => {
    const d = b.drain(ribbon[i * 4 + 2]!)
    const k = bucket(i)
    if (b.hot) return css(b.rainbow(Math.floor(k / 2)))
    if (d > 0) return css(mixRgb(along3(AURORA[0], AURORA[1], AURORA[2], k / AURORA_STEPS), b.deadFill, d))
    return auroraCss[k]!
  })
  ctx.globalAlpha = 0.8
  strokeRuns(0, 0.28, (i) =>
    b.boosting && !b.dying ? paint(AMBER, 0, b.deadFill) : paint(CORE, b.drain(ribbon[i * 4 + 2]!), b.deadFill),
  )
  ctx.globalAlpha = 1

  // The fins, a ridge down its back, leaning forward and stirring.
  const fin = b.dark ? FIN_DARK : FIN_LIGHT
  for (let at = 0.75, k = 0; at < length - 0.2; at += 0.45, k++) {
    const i = Math.min(n - 1, Math.round(at / step))
    const x = ribbon[i * 4]!
    const y = ribbon[i * 4 + 1]!
    const p = b.at(at)
    const t = at / span
    const h = c * 0.42 * (1 - 0.5 * t) * b.swell(at)
    const lean = c * (0.05 + (b.dying ? 0 : 0.05 * Math.sin(time * 3 + k * 0.9)))
    const q = { x, y, dx: p.dx, dy: p.dy }
    const a = off(q, -c * 0.17 * (1 - 0.4 * t), 0)
    const tipP = off(q, lean, -h)
    const e = off(q, c * 0.15 * (1 - 0.4 * t), 0)
    ctx.fillStyle = b.hot ? css(b.rainbow(k + 5), 0.9) : paint(fin, b.drain(at), b.deadFill, 0.9)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(tipP.x, tipP.y)
    ctx.lineTo(e.x, e.y)
    ctx.closePath()
    ctx.fill()
  }

  const d = b.drain(0)
  toHead(b)
  // Whiskers, swaying.
  const stir = b.dying ? 0 : Math.sin(time * 4) * c * 0.06
  ctx.strokeStyle = paint(AURORA[1], d, b.deadLine)
  ctx.lineWidth = Math.max(1.1, c * 0.05)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const side of [-1, 1]) {
    ctx.moveTo(c * 0.4, side * c * 0.15)
    ctx.quadraticCurveTo(c * 0.68 + stir, side * c * 0.45, c * 0.42 + stir * 1.5, side * c * 0.66)
  }
  ctx.stroke()
  // Side fins.
  ctx.fillStyle = paint(fin, d, b.deadFill)
  ctx.beginPath()
  for (const side of [-1, 1]) {
    ctx.moveTo(-c * 0.15, side * c * 0.25)
    ctx.lineTo(-c * 0.5, side * c * 0.58)
    ctx.lineTo(-c * 0.02, side * c * 0.36)
    ctx.closePath()
  }
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(c * 0.1, 0, c * 0.5, c * 0.38, 0, 0, TAU)
  ctx.fillStyle = paint(SERPENT_HEAD, d, b.deadFill)
  ctx.fill()
  ctx.lineWidth = Math.max(1.4, c * 0.065)
  ctx.strokeStyle = b.hot ? css(b.rainbow(0)) : paint(AURORA[0], d, b.deadLine)
  ctx.stroke()
  eyes(b, c * 0.24, c * 0.16, c * 0.105, '#e8fff6')
  ctx.restore()
}

// Ice dragon -------------------------------------------------------------------

const ICE: RGB = [232, 247, 255]
const ICE_LINE_DARK: RGB = [95, 184, 224]
const ICE_LINE_LIGHT: RGB = [52, 140, 190]
const ICE_INNER_DARK: RGB = [159, 220, 255]
const ICE_INNER_LIGHT: RGB = [130, 200, 240]
const SPIKE_DARK: RGB = [191, 233, 255]
const SPIKE_LIGHT: RGB = [126, 192, 230]
const HORN_DARK: RGB = [127, 200, 238]
const HORN_LIGHT: RGB = [84, 164, 214]
const DRAGON_HEAD: RGB = [216, 242, 255]
const EYE_GLOW: RGB = [70, 228, 255]

/**
 * The Ice dragon (Season 2's Pass+): diamond scales of pale ice down the body, an ice spike either side of
 * each, smaller toward the tail; a horned head with glowing cyan eyes, breathing frost.
 */
function iceDragon(b: Body) {
  const { ctx, c, length, time } = b
  const step = 0.32
  const line = b.dark ? ICE_LINE_DARK : ICE_LINE_LIGHT
  const inner = b.dark ? ICE_INNER_DARK : ICE_INNER_LIGHT
  const spike = b.dark ? SPIKE_DARK : SPIKE_LIGHT
  const count = Math.floor((length - 0.1) / step)
  // A glint that runs down the scales now and then, head to tail.
  const glint = b.dying ? -1 : Math.floor(((time * 7) % (count + 14)) - 2)
  ctx.lineJoin = 'round'
  for (let k = count; k >= 1; k--) {
    const at = k * step
    const t = at / Math.max(length, 0.01)
    const p = b.at(at)
    const r = c * (0.37 - 0.16 * t) * b.swell(at)
    const d = b.drain(at)
    ctx.fillStyle = paint(spike, d, b.deadFill)
    ctx.beginPath()
    for (const side of [-1, 1]) {
      const a = off(p, -r * 0.3, side * r * 0.55)
      const e = off(p, -r * 0.72, side * r * 1.62)
      const f = off(p, r * 0.28, side * r * 0.55)
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(e.x, e.y)
      ctx.lineTo(f.x, f.y)
      ctx.closePath()
    }
    ctx.fill()
    const n = off(p, r, 0)
    const s = off(p, -r, 0)
    ctx.beginPath()
    ctx.moveTo(n.x, n.y)
    ctx.lineTo(p.x - p.dy * r, p.y + p.dx * r)
    ctx.lineTo(s.x, s.y)
    ctx.lineTo(p.x + p.dy * r, p.y - p.dx * r)
    ctx.closePath()
    ctx.fillStyle = paint(ICE, d, b.deadFill)
    ctx.fill()
    ctx.lineWidth = Math.max(1, c * 0.04)
    ctx.strokeStyle = paint(line, d, b.deadLine)
    ctx.stroke()
    const h = r * 0.5
    ctx.beginPath()
    ctx.moveTo(p.x + p.dx * h, p.y + p.dy * h)
    ctx.lineTo(p.x - p.dy * h, p.y + p.dx * h)
    ctx.lineTo(p.x - p.dx * h, p.y - p.dy * h)
    ctx.lineTo(p.x + p.dy * h, p.y - p.dx * h)
    ctx.closePath()
    ctx.fillStyle = b.hot
      ? css(b.rainbow(k))
      : b.boosting && !b.dying
        ? paint(AMBER, 0, b.deadFill)
        : k === glint || k === glint + 1
          ? '#ffffff'
          : paint(inner, d, b.deadFill)
    ctx.fill()
  }

  const d = b.drain(0)
  toHead(b)
  // Frost breath, puffing out ahead.
  if (!b.dying) {
    const breath = b.boosting ? 0.95 : 0.7
    // On the night lawn the puffs add their light to it, rather than greying it.
    if (b.dark) ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = b.dark ? 'rgb(150, 200, 230)' : 'rgb(120, 190, 232)'
    for (let i = 0; i < 3; i++) {
      const ph = (time * 1.3 + i / 3) % 1
      ctx.globalAlpha = breath * (1 - ph) * Math.min(1, ph * 5)
      ctx.beginPath()
      ctx.arc(c * (0.72 + ph * 0.5), Math.sin(i * 2.1 + time * 3) * c * 0.07, c * (0.07 + ph * 0.13), 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
  // Horns, swept back.
  ctx.fillStyle = paint(b.dark ? HORN_DARK : HORN_LIGHT, d, b.deadFill)
  ctx.beginPath()
  for (const side of [-1, 1]) {
    ctx.moveTo(-c * 0.2, side * c * 0.22)
    ctx.lineTo(-c * 0.68, side * c * 0.56)
    ctx.lineTo(-c * 0.06, side * c * 0.34)
    ctx.closePath()
  }
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(c * 0.66, 0)
  ctx.lineTo(c * 0.26, -c * 0.36)
  ctx.lineTo(-c * 0.34, -c * 0.3)
  ctx.lineTo(-c * 0.4, 0)
  ctx.lineTo(-c * 0.34, c * 0.3)
  ctx.lineTo(c * 0.26, c * 0.36)
  ctx.closePath()
  ctx.fillStyle = paint(DRAGON_HEAD, d, b.deadFill)
  ctx.fill()
  ctx.lineWidth = Math.max(1.2, c * 0.05)
  ctx.strokeStyle = paint(line, d, b.deadLine)
  ctx.stroke()
  // A ridge down the snout.
  ctx.beginPath()
  ctx.moveTo(c * 0.5, 0)
  ctx.lineTo(-c * 0.3, 0)
  ctx.lineWidth = Math.max(1, c * 0.03)
  ctx.stroke()
  // The eyes glow.
  if (!b.dying && !b.blink) {
    ctx.globalAlpha = 1 - d
    ctx.fillStyle = glow(ctx, 'ice-eye', c * 0.2, EYE_GLOW, b.dark ? 0.7 : 0.5)
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(c * 0.1, side * c * 0.17)
      ctx.beginPath()
      ctx.arc(0, 0, c * 0.2, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
  eyes(b, c * 0.1, c * 0.17, c * 0.09, '#1d4f6e', paint(EYE_GLOW, d, b.deadLine), '#ffffff')
  ctx.restore()
}

/** Snake's creature skins, by id. Any other Snake skin is a bead tail (lib/skinArt.ts's SNAKE_TAILS). */
export const SNAKE_BODIES: Record<string, (b: Body) => void> = {
  'snake-comet-tail': comet,
  'snake-nebula-tail': astroWorm,
  'snake-aurora-tail': auroraSerpent,
  'snake-fireside-tail': iceDragon,
}
