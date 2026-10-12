import type { Dir } from './game'

/*
 * Blip, the site's mascot (components/BlipFigure.tsx), as Pellets' player: the skin `pellets-blip`, the Gulping
 * Blip (lib/skins.ts), won by answering his daily question. Looks only. Ramsey picked him whole (A on the "Blip in
 * other games" canvas, 2026-10-11) after a chomper with a bite cut out of him "looks funny": his round body, the
 * shade under his belly, his shine, his cheeks, his feet and his spark are all his figure's, drawn the house way
 * with an outline round him, bright over the dark theme's ground and deep over the light one. Everything is in his
 * figure's units (his body's radius is 7.35), from the middle of his body, and he is as big as the usual chomper.
 *
 * His heading is in his face, which turns on his round body toward it the way the Frenzy Blip fish's does, his
 * eyes looking on a little further; he leans into the way he goes across the screen, stretches going up and
 * squashes going down, and his feet step. Eating, his smile opens to a round "O" with his tongue in it, on the
 * usual chomper's beat. He grins after a chaser or a cleared maze, blinks now and then, and when he's caught he
 * winces and shrinks away while his spark floats up off him and goes out.
 */

/** The skin's id (lib/skins.ts). */
export const BLIP_SKIN = 'pellets-blip'

/** His mint, as a hue: the light on the floor under him, and the puff he goes out in. */
export const BLIP_HUE = 168

const TAU = Math.PI * 2
/** His body's radius in his figure's units. */
const R = 7.35

const BODY = '#34c6a8'
const SHADE = '#1f9b84'
const FEET = '#167a69'
const INK = '#0f2f2a'
const CHEEK = 'rgba(255, 143, 179, 0.7)'

/** His outline, in his own mint: near his spark's glow over the dark ground, near his feet's teal over the light. */
function outline(dark: boolean) {
  return dark ? 'hsla(164, 80%, 76%, 0.98)' : 'hsla(170, 70%, 27%, 0.98)'
}

/**
 * The blip itself: a glow and a bright core, `s` pixels to a unit. His figure's glow is a pale mint that the
 * light theme's ground would swallow, so over that it is his body's mint.
 */
function spark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dark: boolean, size: number, alpha: number) {
  const gr = Math.max(2.6, 2.7 * s) * size
  const rgb = dark ? '159, 247, 226' : '52, 198, 168'
  const glow = ctx.createRadialGradient(x, y, 0, x, y, gr)
  glow.addColorStop(0, `rgba(${rgb}, ${(dark ? 0.9 : 0.85) * alpha})`)
  glow.addColorStop(1, `rgba(${rgb}, 0)`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, gr, 0, TAU)
  ctx.fill()
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0.9, 0.85 * s), 0, TAU)
  ctx.fillStyle = '#f2fffb'
  ctx.fill()
  ctx.restore()
}

/** The shade under his belly. */
function belly(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(-5.88, 2.94)
  ctx.arc(0, 0, R, Math.atan2(2.94, -5.88), Math.atan2(2.94, 5.88), true)
  ctx.ellipse(0, -1.56, 8.4, 6.3, 0, Math.atan2(4.5 / 6.3, 0.7), Math.atan2(4.5 / 6.3, -0.7))
  ctx.closePath()
  ctx.fillStyle = SHADE
  ctx.fill()
}

/** The shine up on his left. */
function shine(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.ellipse(-2.52, -4.2, 2.52, 1.26, (-24 * Math.PI) / 180, 0, TAU)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.fill()
}

/**
 * The finest marks, `natural` units wide, kept to about `px` pixels at the least, `s` pixels to a unit, but
 * never past `most` units, so on the smallest board they can't swamp the eye they're on.
 */
function fine(natural: number, px: number, most: number, s: number) {
  return Math.min(most, Math.max(natural, px / s))
}

/** His blinks: a moment every few seconds of the game's clock. */
const blinking = (t: number) => t % 3.7 < 0.12

const AHEAD: Record<Dir, readonly [number, number]> = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }

/**
 * How he turns his face for a heading (radians across, + to the right, and up and down, + down), how far his eyes
 * look on beyond that (units), and how far he leans into it (radians).
 */
type Turn = { yaw: number; pitch: number; look: number; lean: number }
const ACROSS: Turn = { yaw: 0.3, pitch: 0, look: 0.7, lean: 0.15 }
const ALONG: Turn = { yaw: 0, pitch: 0.26, look: 0.55, lean: 0 }

/**
 * A point on his front, as his figure has it, once his face has turned `yaw` across and `pitch` up or down:
 * where it lands, and how much narrower and shorter a mark there is drawn, round toward his edge. (After the
 * Frenzy Blip fish's, with the second turn added.)
 */
function onFace(x: number, y: number, yaw: number, pitch: number): [number, number, number, number] {
  const ring = Math.sqrt(Math.max(0.01, R * R - y * y))
  const lon = Math.asin(Math.max(-1, Math.min(1, x / ring)))
  const lon2 = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, lon + yaw))
  const X = ring * Math.sin(lon2)
  const sx = Math.max(0, Math.cos(lon2) / Math.cos(lon))
  const meridian = Math.sqrt(Math.max(0.01, R * R - X * X))
  const lat = Math.asin(Math.max(-1, Math.min(1, y / meridian)))
  const lat2 = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, lat + pitch))
  return [X, meridian * Math.sin(lat2), sx, Math.max(0, Math.cos(lat2) / Math.cos(lat))]
}

/**
 * His mouth, about the middle of his smile (2.6 below his body's middle), from his smile at `m` 0 to a round "O"
 * at 1. The path only, for the caller to fill and stroke; and where his tongue goes, its middle (`at`) and size.
 */
function mouthPath(ctx: CanvasRenderingContext2D, m: number) {
  ctx.beginPath()
  const w = 1.26 - 0.21 * m
  const c = -0.29 + 0.59 * m
  const top = (4 / 3) * (-0.42 + 1.42 * m)
  const depth = 0.62 + 0.58 * m
  ctx.moveTo(-w, c)
  ctx.bezierCurveTo(-w, c - top, w, c - top, w, c)
  ctx.bezierCurveTo(w, c + (4 / 3) * depth, -w, c + (4 / 3) * depth, -w, c)
  ctx.closePath()
  return { at: c + depth * 0.95, w: w * 0.66, h: depth * 0.55 }
}

type Mood = 'hi' | 'happy' | 'caught'

/** Which way his face is turned (see `onFace`), and how far on his eyes look, across and up or down, in units. */
type View = { yaw: number; pitch: number; lookX: number; lookY: number }
const FACING_YOU: View = { yaw: 0, pitch: 0, lookX: 0, lookY: 0 }

/** His face, turned, in his figure's units, `s` pixels to a unit. `m`: how far his mouth is open to its "O". */
function face(ctx: CanvasRenderingContext2D, v: View, mood: Mood, m: number, blink: boolean, s: number) {
  const at = (x: number, y: number) => onFace(x, y, v.yaw, v.pitch)
  // Cheeks, the near one fuller, and none going round his edge.
  for (const side of [-1, 1]) {
    const [x, y, sx, sy] = at(side * 3.57, 1.89)
    if (sx < (s < 1.5 ? 0.6 : 0.5)) continue
    ctx.beginPath()
    ctx.ellipse(x, y, 0.95 * sx, 0.53 * sy, 0, 0, TAU)
    ctx.fillStyle = mood === 'happy' ? 'rgba(255, 143, 179, 0.85)' : CHEEK
    ctx.fill()
  }
  // His eyes, looking on a little further than his face is turned.
  const { lookX, lookY } = v
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const side of [-1, 1]) {
    const [ex0, ey0, sx, sy] = at(side * 1.89, -0.21)
    if (sx < 0.1) continue
    const ex = ex0 + lookX * sx
    const ey = ey0 + lookY
    ctx.beginPath()
    if (mood === 'caught') {
      // Screwed up tight, > <.
      const d = side < 0 ? 1 : -1
      ctx.moveTo(ex - 0.75 * sx * d, ey - 0.95 * sy)
      ctx.lineTo(ex + 0.65 * sx * d, ey)
      ctx.lineTo(ex - 0.75 * sx * d, ey + 0.95 * sy)
      ctx.lineWidth = fine(0.55, 0.9, 1.1, s)
      ctx.stroke()
    } else if (mood === 'happy') {
      ctx.moveTo(ex - sx, ey + 0.05)
      ctx.quadraticCurveTo(ex, ey - 1.25 * sy, ex + sx, ey + 0.05)
      ctx.lineWidth = fine(0.55, 0.9, 1.1, s)
      ctx.stroke()
    } else if (blink) {
      ctx.moveTo(ex - 0.95 * sx, ey + 0.2)
      ctx.quadraticCurveTo(ex, ey + 0.75 * sy, ex + 0.95 * sx, ey + 0.2)
      ctx.lineWidth = fine(0.5, 0.9, 1.0, s)
      ctx.stroke()
    } else {
      ctx.ellipse(ex, ey, 0.95 * sx, 1.58 * sy, 0, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ex + (0.31 + 0.25 * lookX) * sx, ey - 0.73 * sy + 0.25 * lookY, fine(0.36, 0.55, 0.6, s), 0, TAU)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.fillStyle = INK
    }
  }

  // His mouth, turned with his face.
  const [mx, my, msx, msy] = at(0, 2.6)
  ctx.save()
  ctx.translate(mx + lookX * 0.3 * msx, my + lookY * 0.3)
  ctx.scale(Math.max(0.35, msx), Math.max(0.5, msy))
  if (mood === 'caught') {
    // A little "o".
    ctx.beginPath()
    ctx.ellipse(0, 0.5, 0.62, 0.78, 0, 0, TAU)
    ctx.fill()
  } else if (mood === 'happy') {
    // His figure's happy D.
    ctx.beginPath()
    ctx.moveTo(-1.6, -0.46)
    ctx.quadraticCurveTo(0, 1.44, 1.6, -0.46)
    ctx.closePath()
    ctx.fill()
  } else {
    const tongue = mouthPath(ctx, m)
    if (m > 0.04) ctx.fill()
    ctx.lineWidth = fine(0.47, 0.9, 0.8, s)
    ctx.stroke()
    if (m > 0.2) {
      // His tongue, at the bottom of the gulp.
      ctx.save()
      ctx.clip()
      ctx.beginPath()
      ctx.ellipse(0, tongue.at, tongue.w, tongue.h, 0, 0, TAU)
      ctx.fillStyle = '#ff8fb3'
      ctx.fill()
      ctx.restore()
    }
  }
  ctx.restore()
}

/**
 * His feet, his figure's, behind him, each at `x` and `lift` units off the ground; `line` is his outline's width.
 * Their outline is softer than his: his body carries his shape, and a bright rim round a dark foot reads as a ring.
 */
function feet(ctx: CanvasRenderingContext2D, at: readonly (readonly [number, number])[], dark: boolean, line: number) {
  ctx.fillStyle = FEET
  ctx.strokeStyle = dark ? 'hsla(166, 52%, 46%, 0.9)' : 'hsla(170, 70%, 20%, 0.9)'
  ctx.lineWidth = line * 0.55
  for (const [x, lift] of at) {
    ctx.beginPath()
    ctx.ellipse(x, 7.56 - lift, 1.79, 0.95, 0, 0, TAU)
    ctx.fill()
    ctx.stroke()
  }
}

/** His body, never cut, with his face on it: in his units, after the caller's scale. */
function body(ctx: CanvasRenderingContext2D, v: View, mood: Mood, m: number, blink: boolean, s: number, dark: boolean, line: number) {
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, TAU)
  ctx.fillStyle = BODY
  ctx.fill()
  ctx.save()
  ctx.clip()
  belly(ctx)
  shine(ctx)
  face(ctx, v, mood, m, blink, s)
  ctx.restore()
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, TAU)
  ctx.strokeStyle = outline(dark)
  ctx.lineWidth = line
  ctx.stroke()
}

export type BlipPose = {
  /** The middle of his body and its radius, the usual chomper's. */
  x: number
  y: number
  r: number
  dir: Dir
  /** How far his mouth is open, 0 to 1, on the usual chomper's beat. */
  open: number
  /** The usual chomper's chomp, which runs on as he goes: his feet step to it. */
  stride: number
  dark: boolean
  /** The outline's width, the usual chomper's. */
  lw: number
  /** The game's clock, for his spark's float and his blinks. */
  t: number
  /** Eyes shut in a grin: a chaser eaten, a maze cleared. */
  happy: boolean
  /** The chasers are blue: his spark burns bigger. */
  power: boolean
}

/** Blip at play. */
export function drawBlip(ctx: CanvasRenderingContext2D, p: BlipPose) {
  const [dx, dy] = AHEAD[p.dir]
  const across = dx !== 0
  const turn = across ? ACROSS : ALONG
  const s = p.r / R
  // He steps as he goes: a foot up in turn, and a bob.
  const step = Math.sin(p.stride * Math.PI)
  const bob = -0.35 * Math.abs(step)
  // Into the way he goes: leaning across, stretched going up and squashed going down.
  const kx = dy < 0 ? 0.96 : dy > 0 ? 1.04 : 1
  const ky = dy < 0 ? 1.05 : dy > 0 ? 0.95 : 1

  ctx.save()
  ctx.translate(p.x, p.y)
  // His spark, over his head, bobbing, and trailing behind him: back and a touch down going across, up going down.
  const glow = p.power ? 1.28 + Math.sin(p.t * 9) * 0.08 : 1
  const sparkY = -9.24 * ky + bob + Math.sin(p.t * 2.6) * 0.45 + (across ? 0.4 : dy > 0 ? -0.5 : 0)
  spark(ctx, -dx * 2 * s, sparkY * s, s, p.dark, glow, 1)

  ctx.rotate(turn.lean * dx)
  ctx.scale(s * kx, s * ky)
  ctx.translate(0, bob)
  const line = p.lw / s
  feet(
    ctx,
    [
      [-2.31, 0.8 * Math.max(0, step)],
      [2.31, 0.8 * Math.max(0, -step)],
    ],
    p.dark,
    line,
  )
  const view: View = { yaw: turn.yaw * dx, pitch: across ? turn.pitch : turn.pitch * dy, lookX: turn.look * dx, lookY: turn.look * dy }
  body(ctx, view, p.happy ? 'happy' : 'hi', Math.max(0, Math.min(1, p.open)), blinking(p.t), s, p.dark, line)
  ctx.restore()
}

/**
 * Caught: he turns to you and winces, squashed by the hit, then shrinks away on the usual chomper's clock (`k`
 * from 0 to 1; he is gone as the puff goes off), while his spark floats up off him and goes out.
 */
export function drawBlipCaught(ctx: CanvasRenderingContext2D, p: { x: number; y: number; r: number; k: number; dark: boolean; lw: number }) {
  const q = Math.max(0, Math.min(1, p.k / 0.62))
  const shrink = 1 - q * q
  const s = p.r / R
  ctx.save()
  ctx.translate(p.x, p.y)
  const lift = Math.min(1, p.k / 0.6)
  if (lift < 1) spark(ctx, 0, (-9.24 - lift * 7) * s, s, p.dark, 1 + lift * 0.4, 1 - lift)
  if (shrink > 0.02) {
    ctx.scale(s * shrink * (1.08 + 0.12 * q), s * shrink * (0.92 - 0.12 * q))
    const line = p.lw / (s * Math.max(0.3, shrink))
    feet(
      ctx,
      [
        [-2.31, 0],
        [2.31, 0],
      ],
      p.dark,
      line,
    )
    body(ctx, FACING_YOU, 'caught', 0, false, s * shrink, p.dark, line)
  }
  ctx.restore()
}
