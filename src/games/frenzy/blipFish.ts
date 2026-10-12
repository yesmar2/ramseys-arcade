import { finShapes, tailPath, type Glow } from './fishArt'
import type { FishArt } from './species'

/*
 * Blip as a fish: Frenzy's player in the skin `frenzy-blip` (lib/skins.ts), the site's mascot (BlipFigure.tsx) out
 * in the sea. His round mint body side-on, his face turned toward his nose, a tail and a top fin in his darker
 * mints, his little feet paddling under him as fins, and his spark hung out ahead on a lure, as the deep's anglers
 * carry theirs: it leads him about, marks him out among the other fish, and lights the dark round him down deep.
 *
 * Looks only: he's drawn to the usual fish's size, from its radius, so the hitbox, speed and score are the usual
 * fish's. He turns (his face coming round to you halfway), gulps (eyes shut in a grin, his mouth his happy D),
 * grows, winces when stung or hooked, blinks while he can't be hurt and is reeled up on the hook just as the usual
 * fish is. He grows its fins as he grows (its tail and top fin at each size, playerArt), so a Darter's sail and an
 * Apex's shark fin still say how big he's got.
 *
 * Drawn the sea's way, so he belongs in it: a clean outline round his fill, fins a wash the water shows through,
 * and his own shine. In BlipFigure's units, his body a circle of radius 7.35, here about the origin; +x is his
 * nose. The caller has translated to him, tilted him and flipped him to face the way he's going (render.ts).
 */

export const BLIP_FISH = 'frenzy-blip'

/** How much of the usual fish's radius his body fills: round, so he reads as big as he is. */
export const BLIP_BODY = 0.84

const TAU = Math.PI * 2
/** BlipFigure's body radius: his features are in its units, about his body's centre (BlipFigure's y less 1.26). */
const U = 7.35
const INK = '#0f2f2a'
/** How far his face turns toward his nose when he's side-on: enough to say which way he's going, not so far it stops being his face. */
const YAW = 0.66
/** How far he tilts toward where he's heading, at most: a round fish never noses straight up, so his face stays his face. */
const TILT = 0.7
/** The fins' heights are the usual fish's, against a body this tall in his units. */
const FIN_H = U * 0.95
/** His tail: its length against the usual fish's, its root's half height, and where it's rooted (inside his back). */
const TAIL = 0.95
const TAIL_ROOT_H = U * 0.3
const TAIL_ROOT_X = -U * 0.8

export type BlipPaint = {
  body: string
  /** The darker mint under his middle. */
  shade: string
  /** Tail and top fin: his darker mint, washed with the water. */
  fin: string
  /** His feet. */
  feet: string
  line: string
  /** His spark's glow, as "r, g, b", and its bright core. */
  glow: string
  core: string
  /** On pale water a white dot needs an edge. */
  ring: string | null
  /** The light he makes in the deep, a colour for render.ts's lights. */
  light: string
}

export type BlipPose = {
  /** His body's radius, px. */
  radius: number
  /** Swim phase, radians, and how hard he's swimming (the usual fish's: ~0.35 drifting, 1 cruising). */
  swim: number
  amp: number
  /** 0 closed … 1 a gulp. */
  mouth: number
  /** Seconds, for blinks and flutter. */
  time: number
  /** 1 side-on, 0 face to you: his face and fins come round through a turn. */
  turn: number
  /** 0..1: how much he lights himself, deep down. */
  biolume: number
  /** Stung by a jellyfish. */
  dazed: boolean
  /** The usual fish at his size: he grows its tail and top fin. */
  art: FishArt
  /** His spark, out ahead on its lure. */
  spark: boolean
}

/** How far he leans on the screen: toward where he's heading, softened, and level halfway through a turn. */
export function blipTilt(angle: number, roll: number) {
  return TILT * roll * Math.sin(angle)
}

/** A point on his front (as BlipFigure has it), once his face has turned `yaw`: where it lands across, and how much narrower it is there. */
function onFace(x: number, y: number, yaw: number): [number, number] {
  const rho = Math.sqrt(Math.max(0.01, U * U - y * y))
  const lon = Math.asin(Math.max(-1, Math.min(1, x / rho)))
  const to = Math.min(Math.PI / 2, lon + yaw)
  return [rho * Math.sin(to), Math.max(0, Math.cos(to) / Math.cos(lon))]
}

let shadePath: Path2D | null = null
/** BlipFigure's belly shade, as he's drawn everywhere, moved to be about his body's centre. */
function shade() {
  shadePath ??= new Path2D('M-5.88 2.94 A7.35 7.35 0 0 0 5.88 2.94 A8.4 6.3 0 0 1 -5.88 2.94 Z')
  return shadePath
}

/** A blink every few seconds, from the clock, so a still is the same frame however often it's drawn. */
const blinking = (time: number) => (time + 0.6) % 3.7 < 0.13

/**
 * His top fin, the usual fish's at his size, rooted round the top of his body from his crown down his back
 * (`u` along the usual fish, 0 its nose to 1 its tail), clear of his face and his spark.
 */
function dorsalPath(ctx: CanvasRenderingContext2D, art: FishArt, time: number) {
  const shapes = finShapes(art.dorsal, art.dorsalSize, -1, FIN_H, time)
  if (art.dorsal === 'sail') {
    // The swordfish's ragged sail reads as a flag on a round fish: his is smooth, rising fast and sloping back.
    const h = FIN_H * art.dorsalSize
    for (const fin of shapes) fin.height = (t) => h * (t < 0.14 ? t / 0.14 : 1 - ((t - 0.14) / 0.86) * 0.8) * (1 + 0.07 * Math.sin(time * 6 + t * 4))
  }
  const at = (u: number) => -Math.PI / 2 + 0.12 - u * 1.5
  ctx.beginPath()
  for (const fin of shapes) {
    const M = 10
    for (let k = 0; k <= M; k++) {
      const a = at(fin.a + ((fin.b - fin.a) * k) / M)
      const x = Math.cos(a) * U * 0.8
      const y = Math.sin(a) * U * 0.8
      if (k === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    for (let k = M; k >= 0; k--) {
      const t = k / M
      const a = at(fin.a + (fin.b - fin.a) * t)
      // Out from his edge by the fin's height, swept back along it.
      const h = fin.height(t) * 0.8
      const nx = Math.cos(a)
      const ny = Math.sin(a)
      const back = fin.sweep * h * (0.3 + t)
      ctx.lineTo(nx * (U + h) + ny * back, ny * (U + h) - nx * back)
    }
    ctx.closePath()
  }
}

/** One of his feet, as a fin under his belly: rooted at (x, y), paddling. */
function footPath(ctx: CanvasRenderingContext2D, x: number, y: number, swing: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(swing)
  ctx.beginPath()
  ctx.ellipse(0, 0.95, 1.79, 0.95, 0, 0, TAU)
  ctx.restore()
}

/** Draw Blip in his own frame (see the top of the file); his lure's light, if he has one out, goes to `glows`. */
export function drawBlipFish(ctx: CanvasRenderingContext2D, pose: BlipPose, paint: BlipPaint, glows: Glow[] | null = null) {
  const R = pose.radius
  const k = R / U
  /** One screen pixel, in his units. */
  const px = 1 / k
  const art = pose.art
  // The sea's outline: heavy, but capped so a Leviathan isn't drawn in marker pen (fishArt's, for a fish his length).
  const lineW = Math.min(3.4, Math.max(1.3, R * 0.075)) * px
  const turn = Math.max(0.12, pose.turn)
  const swim = pose.swim
  ctx.save()
  ctx.scale(k, k)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Tail and fins come round with him through a turn, so they're seen edge on halfway.
  ctx.save()
  ctx.scale(turn, 1)
  // The tail, wagging from inside his back: a round fish swims with its tail. A round tail on a round body reads
  // as a second ball, so his is the notched fan; never so small it stops saying "fish", nor a Leviathan's so big it
  // outgrows him, and a crescent a little flatter than a shark's.
  ctx.save()
  ctx.translate(TAIL_ROOT_X, 0)
  ctx.rotate(Math.PI + 0.36 * pose.amp * Math.sin(swim - 2.4))
  if (art.tail === 'lunate') ctx.scale(1, 0.86)
  const tailLong = U * Math.min(1.3, Math.max(0.95, art.tailSize)) * TAIL * (R < 8 ? 1.15 : 1)
  tailPath(ctx, art.tail === 'round' ? 'fan' : art.tail, tailLong, TAIL_ROOT_H, Math.sin(swim * 0.7))
  ctx.fillStyle = paint.fin
  ctx.fill()
  ctx.lineWidth = lineW * 0.85
  ctx.strokeStyle = paint.line
  ctx.stroke()
  ctx.restore()
  // The top fin, behind him, its outline softer so his own carries the shape. Too small to say anything, it's left off.
  if (R >= 6) {
    dorsalPath(ctx, art, pose.time)
    ctx.fillStyle = paint.fin
    ctx.fill()
    ctx.lineWidth = lineW * 0.75
    // The tail's line went with its restore: his own, set again.
    ctx.strokeStyle = paint.line
    ctx.globalAlpha *= 0.55
    ctx.stroke()
    ctx.globalAlpha /= 0.55
  }
  // His feet, paddling out of step under his belly.
  if (R >= 8) {
    ctx.fillStyle = paint.feet
    for (const [fx, phase] of [
      [1.9, 0],
      [-2.6, Math.PI],
    ] as const) {
      footPath(ctx, fx, 6.6, 0.32 * Math.sin(swim * 1.1 + phase) * Math.min(1.3, pose.amp + 0.3))
      ctx.fill()
    }
  }
  ctx.restore()

  // His body, the belly shade (turned with his face) and his outline.
  ctx.beginPath()
  ctx.arc(0, 0, U, 0, TAU)
  ctx.fillStyle = paint.body
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.translate(2.7 * pose.turn, 0)
  ctx.fillStyle = paint.shade
  ctx.fill(shade())
  ctx.restore()
  ctx.beginPath()
  ctx.arc(0, 0, U, 0, TAU)
  ctx.lineWidth = lineW
  ctx.strokeStyle = paint.line
  ctx.stroke()

  // At the top size he glows, as the usual Leviathan does; deep down, his edge glows as every fish's does there.
  const lum = pose.biolume
  if (art.glow) glows?.push({ x: 0, y: 0, r: R * 1.7, color: paint.light, strength: 0.3 })
  if (lum > 0.02) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha *= 0.42 * lum
    ctx.lineWidth = lineW * 2.2
    ctx.strokeStyle = `rgb(${paint.glow})`
    ctx.stroke()
    ctx.restore()
  }

  drawFace(ctx, pose, R, px)

  if (!pose.spark) {
    ctx.restore()
    return
  }
  // His spark, out ahead on a lure as the deep's anglers carry theirs: a stalk from his crown, swaying as he swims,
  // and the spark hung on it in front of his face, so the light leads him wherever he goes.
  const sway = Math.sin(pose.time * 2.2) * 0.6 + Math.sin(swim) * 0.25 * pose.amp
  const bob = Math.cos(pose.time * 1.7) * 0.4
  const tx = (9.8 + sway) * turn
  const ty = -9.5 + bob
  ctx.beginPath()
  ctx.moveTo(2.9 * turn, -6.6)
  ctx.quadraticCurveTo(6.4 * turn, -14, tx, ty)
  ctx.lineWidth = Math.max(1, R * 0.05) * px
  ctx.strokeStyle = paint.line
  ctx.stroke()
  ctx.restore()
  const glowR = drawBlipSpark(ctx, tx * k, ty * k, R, paint, pose.time)
  glows?.push({ x: tx * k, y: ty * k, r: glowR * 3, color: paint.light, strength: 0.25 + 0.65 * lum })
}

/** His face, BlipFigure's, turned toward his nose: tall dark eyes, his cheeks and smile; a gulp, a wince, a blink. */
function drawFace(ctx: CanvasRenderingContext2D, pose: BlipPose, R: number, px: number) {
  const yaw = YAW * pose.turn
  const m = pose.mouth
  const happy = !pose.dazed && m > 0.45
  const shut = !happy && !pose.dazed && blinking(pose.time)
  // Small, his eyes are bigger for his size, as a baby's are, and he's only eyes, so his face still reads.
  const boost = Math.min(1.45, Math.max(1, 1 + (10 - R) / 12))
  const tiny = R < 6
  const eyeY = -0.21

  // Cheeks: the near one full, the far one round his side.
  for (const side of [-1, 1]) {
    const [cx, fs] = onFace(side * 3.57, 1.89, yaw)
    if (fs < (R < 9 ? 0.6 : 0.25)) continue
    ctx.beginPath()
    ctx.ellipse(cx, 1.89, 0.95 * fs, 0.53, 0, 0, TAU)
    ctx.fillStyle = `rgba(255, 143, 179, ${happy ? 0.85 : 0.7})`
    ctx.fill()
  }

  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  const stroke = (w: number) => {
    ctx.lineWidth = Math.max(w, 0.9 * px)
    ctx.stroke()
  }
  for (const side of [-1, 1]) {
    const [ex, fs] = onFace(side * 1.89, eyeY, yaw)
    if (fs < 0.08) continue
    const w = fs * boost
    ctx.beginPath()
    if (pose.dazed) {
      // Stung, or on the hook: screwed up tight, > <.
      const d = side < 0 ? 1 : -1
      ctx.moveTo(ex - 0.75 * w * d, eyeY - 0.95 * boost)
      ctx.lineTo(ex + 0.65 * w * d, eyeY)
      ctx.lineTo(ex - 0.75 * w * d, eyeY + 0.95 * boost)
      stroke(0.5 * boost)
    } else if (happy) {
      // A gulp shuts his eyes in a grin.
      ctx.moveTo(ex - w, eyeY + 0.05)
      ctx.quadraticCurveTo(ex, eyeY - 1.25 * boost, ex + w, eyeY + 0.05)
      stroke(0.55 * boost)
    } else if (shut) {
      ctx.moveTo(ex - 0.95 * w, eyeY + 0.2)
      ctx.quadraticCurveTo(ex, eyeY + 0.75 * boost, ex + 0.95 * w, eyeY + 0.2)
      stroke(0.5 * boost)
    } else {
      ctx.ellipse(ex, eyeY, 0.95 * w, 1.58 * boost, 0, 0, TAU)
      ctx.fill()
      if (!tiny) {
        ctx.beginPath()
        ctx.arc(ex + 0.31 * w, eyeY - 0.73 * boost, Math.max(0.36 * boost, 0.5 * px), 0, TAU)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.fillStyle = INK
      }
    }
  }
  if (tiny && !pose.dazed && m <= 0.12) return

  // His mouth: the smile, or open in a gulp (his happy D, wider the wider it opens), or an "o" when stung or hooked.
  ctx.beginPath()
  if (pose.dazed) {
    const [mx, fs] = onFace(0, 3.1, yaw)
    ctx.ellipse(mx, 3.1, (0.55 + 0.5 * m) * fs + 0.2, 0.62 + 0.7 * m, 0, 0, TAU)
    ctx.fill()
  } else if (m > 0.12) {
    const top = 2.14 - 0.45 * m
    const half = 1.6 + 0.6 * m
    const depth = 1.9 + 3.4 * m
    const [x0] = onFace(-half, top, yaw)
    const [x1] = onFace(half, top, yaw)
    const [xc, fs] = onFace(0, top + depth * 0.5, yaw)
    ctx.moveTo(x0, top)
    ctx.quadraticCurveTo(xc, top + depth, x1, top)
    ctx.closePath()
    ctx.fill()
    if (R >= 12 && m > 0.3) {
      ctx.save()
      ctx.clip()
      ctx.beginPath()
      ctx.ellipse(xc, top + depth * 0.5, half * 0.55 * fs, depth * 0.2, 0, 0, TAU)
      ctx.fillStyle = '#ff8fb3'
      ctx.fill()
      ctx.restore()
    }
  } else {
    const [x0] = onFace(-1.26, 2.31, yaw)
    const [xc] = onFace(0, 3.47, yaw)
    const [x1] = onFace(1.26, 2.31, yaw)
    ctx.moveTo(x0, 2.31)
    ctx.quadraticCurveTo(xc, 3.47, x1, 2.31)
    stroke(0.47)
  }
}

/** His shine, BlipFigure's, on the screen's frame: the light comes from above whichever way he faces. */
export function drawBlipShine(ctx: CanvasRenderingContext2D, x: number, y: number, R: number) {
  const k = R / U
  ctx.save()
  ctx.translate(x - 2.52 * k, y - 4.2 * k)
  ctx.rotate((-24 * Math.PI) / 180)
  ctx.beginPath()
  ctx.ellipse(0, 0, 2.52 * k, 1.26 * k, 0, 0, TAU)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.fill()
  ctx.restore()
}

/** His spark: BlipFigure's glow under a bright core, breathing a little, `R` his body's radius. Its radius of light is returned. */
function drawBlipSpark(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, paint: BlipPaint, time: number) {
  const glowR = Math.max(3.4, R * 0.42) * (1 + 0.08 * Math.sin(time * 4.2))
  const g = ctx.createRadialGradient(x, y, 0, x, y, glowR)
  g.addColorStop(0, `rgba(${paint.glow}, 0.9)`)
  g.addColorStop(1, `rgba(${paint.glow}, 0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, glowR, 0, TAU)
  ctx.fill()
  const core = Math.max(1.15, R * 0.13)
  ctx.beginPath()
  ctx.arc(x, y, core, 0, TAU)
  ctx.fillStyle = paint.core
  ctx.fill()
  if (paint.ring) {
    ctx.lineWidth = Math.max(0.8, core * 0.35)
    ctx.strokeStyle = paint.ring
    ctx.stroke()
  }
  return glowR
}
