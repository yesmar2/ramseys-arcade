import { luminance, mixColor } from '../../lib/color'
import { isFlatTheme } from '../../lib/theme'
import { drawBug } from './bugSprite'
import { catchRadius, fieldRect, type GameState, type RoundState } from './game'
import {
  ARCADE_FLOOR,
  ARCADE_WALL,
  boardRowY,
  BOARD_GROUND,
  cableY,
  CARPET_GROUND,
  COUNTER_FELT,
  type Block,
  type Cabinet,
  type Cable,
  type Machine,
  type Motif,
  type Person,
  type Poster,
  type Prop,
  type Scene,
  type Sign,
  type Tie,
  type Token,
} from './scenes'

/**
 * Scene geometry is normalized: x against width, y against height. Everything
 * here paints a real surface in its own colours rather than a wash of the app
 * playfield — the bug hides against the one thing it is sitting on, not against
 * a drained room, so the scenes are free to be as saturated as they like.
 */

const HINT_RADIUS = 0.22

/**
 * Floor on how close the bug may get to the surface it is sitting on, in
 * perceived brightness out of 255. Some perches — a dark carpet, a brass token
 * face — landed the camouflaged body within five or six of the ground, which is
 * not difficulty, it is invisibility. Anything under this gets pushed away from
 * the perch: lighter on a dark surface, darker on a light one.
 */
const MIN_BUG_CONTRAST = 14

function bugBody(base: string, camo: number): string {
  const lit = mixColor(base, '#ffffff', 0.5)
  const target = mixColor(lit, base, camo)
  const baseLum = luminance(base)
  if (Math.abs(luminance(target) - baseLum) >= MIN_BUG_CONTRAST) return target

  const away = baseLum < 128 ? '#ffffff' : '#000000'
  for (let t = 0.05; t <= 0.7; t += 0.05) {
    const lifted = mixColor(target, away, t)
    if (Math.abs(luminance(lifted) - baseLum) >= MIN_BUG_CONTRAST) return lifted
  }
  return mixColor(target, away, 0.7)
}

/** Hard outline. Crispness is mostly a matter of committing to an edge. */
function edge(ctx: CanvasRenderingContext2D, colour: string, width: number) {
  if (isFlatTheme()) return
  ctx.strokeStyle = colour
  ctx.lineWidth = Math.max(1, width)
  ctx.stroke()
}

function groundFor(scene: Scene): string {
  if (scene.kind === 'arcade') return ARCADE_FLOOR
  if (scene.kind === 'tokens') return COUNTER_FELT
  if (scene.kind === 'carpet') return CARPET_GROUND
  if (scene.kind === 'board') return BOARD_GROUND
  if (scene.kind === 'loom') return '#171d29'
  return '#151a24'
}

function drawBackground(ctx: CanvasRenderingContext2D, scene: Scene, w: number, h: number) {
  ctx.fillStyle = groundFor(scene)
  ctx.fillRect(0, 0, w, h)
}

// ----------------------------------------------------------- arcade floor

/** A jointed limb: shoulder to elbow to hand, or hip to knee to foot. */
function limb(
  ctx: CanvasRenderingContext2D,
  a: [number, number],
  b: [number, number],
  c: [number, number],
  width: number,
  colour: string,
) {
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(a[0], a[1])
  ctx.lineTo(b[0], b[1])
  ctx.lineTo(c[0], c[1])
  ctx.stroke()
}

/**
 * Where each arm bends and where its hand ends up, per pose, as fractions of
 * height. Authored facing right; the whole figure is mirrored for the other
 * way round.
 *
 * Each shoulder owns exactly one arm. The previous version sent both hands to
 * the same side, which drew the far arm as a bar straight across the chest —
 * that is where the spare limbs were coming from.
 */
const ARMS: Record<
  Person['pose'],
  { back: [[number, number], [number, number]]; front: [[number, number], [number, number]] }
> = {
  // Hands converge on the control deck, elbows tucked in at the sides.
  play: { back: [[-0.15, -0.63], [-0.07, -0.55]], front: [[0.15, -0.63], [0.07, -0.55]] },
  stand: { back: [[-0.14, -0.62], [-0.15, -0.48]], front: [[0.14, -0.62], [0.15, -0.48]] },
  cheer: { back: [[-0.19, -0.79], [-0.15, -0.98]], front: [[0.19, -0.79], [0.15, -0.98]] },
  walk: { back: [[-0.15, -0.63], [-0.1, -0.5]], front: [[0.15, -0.62], [0.19, -0.55]] },
  point: { back: [[-0.14, -0.62], [-0.15, -0.48]], front: [[0.18, -0.68], [0.31, -0.72]] },
}

/** Knee and foot per leg, same idea. */
const LEGS_POSE: Record<
  Person['pose'],
  { back: [[number, number], [number, number]]; front: [[number, number], [number, number]] }
> = {
  play: { back: [[-0.07, -0.24], [-0.08, -0.01]], front: [[0.07, -0.24], [0.08, -0.01]] },
  stand: { back: [[-0.07, -0.24], [-0.08, -0.01]], front: [[0.07, -0.24], [0.08, -0.01]] },
  cheer: { back: [[-0.08, -0.24], [-0.1, -0.01]], front: [[0.08, -0.24], [0.1, -0.01]] },
  walk: { back: [[-0.11, -0.25], [-0.16, -0.01]], front: [[0.09, -0.23], [0.14, -0.02]] },
  point: { back: [[-0.07, -0.24], [-0.09, -0.01]], front: [[0.08, -0.24], [0.1, -0.01]] },
}

/**
 * One person, built rather than stamped. Drawn back arm first, then legs and
 * torso, then front arm and head, so the limbs layer the way a body does.
 */
function drawPerson(ctx: CanvasRenderingContext2D, pr: Person, w: number, h: number) {
  const ph = pr.h * h
  const headR = ph * 0.092
  const headY = -ph * 0.9
  const shoulderY = -ph * 0.755
  const shoulderX = ph * 0.125
  const hipY = -ph * 0.45
  const hipX = ph * 0.055
  const armW = ph * 0.062
  const legW = ph * 0.078

  const arms = ARMS[pr.pose]
  const legs = LEGS_POSE[pr.pose]
  const at = (v: [number, number]): [number, number] => [v[0] * ph, v[1] * ph]

  ctx.save()
  ctx.translate(pr.x * w, pr.y * h)
  if (pr.flip) ctx.scale(-1, 1)

  // Contact shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.26)'
  ctx.beginPath()
  ctx.ellipse(0, 0, ph * 0.14, ph * 0.03, 0, 0, Math.PI * 2)
  ctx.fill()

  const shade = (colour: string) => mixColor(colour, '#000000', 0.26)

  // Far side of the body sits in shadow so the near side reads forward.
  limb(ctx, [-shoulderX, shoulderY], at(arms.back[0]), at(arms.back[1]), armW, shade(pr.shirt))
  limb(ctx, [-hipX, hipY], at(legs.back[0]), at(legs.back[1]), legW, shade(pr.legs))

  // Shoes.
  const shoe = (v: [number, number], colour: string) => {
    const pt = at(v)
    ctx.fillStyle = colour
    ctx.beginPath()
    ctx.roundRect(pt[0] - ph * 0.045, pt[1] - ph * 0.018, ph * 0.105, ph * 0.04, ph * 0.018)
    ctx.fill()
  }
  shoe(legs.back[1], shade(pr.shoes))

  // Near leg and torso.
  limb(ctx, [hipX, hipY], at(legs.front[0]), at(legs.front[1]), legW, pr.legs)
  shoe(legs.front[1], pr.shoes)

  ctx.fillStyle = pr.shirt
  ctx.beginPath()
  ctx.roundRect(
    -shoulderX - armW * 0.2,
    shoulderY - ph * 0.02,
    (shoulderX + armW * 0.2) * 2,
    hipY - shoulderY + ph * 0.06,
    ph * 0.05,
  )
  ctx.fill()

  limb(ctx, [shoulderX, shoulderY], at(arms.front[0]), at(arms.front[1]), armW, pr.shirt)

  // Hands.
  ctx.fillStyle = pr.skin
  for (const hand of [arms.back[1], arms.front[1]]) {
    const pt = at(hand)
    ctx.beginPath()
    ctx.arc(pt[0], pt[1], ph * 0.036, 0, Math.PI * 2)
    ctx.fill()
  }

  // Neck and head.
  ctx.fillStyle = shade(pr.skin)
  ctx.fillRect(-ph * 0.028, headY + headR * 0.55, ph * 0.056, ph * 0.055)
  ctx.fillStyle = pr.skin
  ctx.beginPath()
  ctx.arc(0, headY, headR, 0, Math.PI * 2)
  ctx.fill()

  // Ear on the far side of the head.
  ctx.beginPath()
  ctx.arc(-headR * 0.92, headY + headR * 0.08, headR * 0.22, 0, Math.PI * 2)
  ctx.fill()

  // Hair. Players are seen from behind, so their hair wraps the whole skull.
  const fromBehind = pr.pose === 'play' || pr.pose === 'cheer'
  ctx.fillStyle = pr.hair
  if (fromBehind) {
    ctx.beginPath()
    ctx.arc(0, headY, headR * 1.06, 0, Math.PI * 2)
    ctx.fill()
    if (pr.hairStyle === 1) {
      ctx.beginPath()
      ctx.arc(0, headY + headR * 0.95, headR * 0.45, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (pr.hairStyle === 0) {
    ctx.beginPath()
    ctx.arc(0, headY, headR * 1.05, Math.PI * 1.02, Math.PI * 2.08)
    ctx.fill()
  } else if (pr.hairStyle === 1) {
    ctx.beginPath()
    ctx.arc(0, headY - headR * 0.08, headR * 1.12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = pr.skin
    ctx.beginPath()
    ctx.arc(headR * 0.16, headY + headR * 0.26, headR * 0.85, 0, Math.PI * 2)
    ctx.fill()
  } else if (pr.hairStyle === 2) {
    ctx.beginPath()
    ctx.arc(0, headY, headR * 1.04, Math.PI * 1.02, Math.PI * 2.05)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-headR * 0.95, headY + headR * 0.2, headR * 0.4, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(0, headY, headR * 1.04, Math.PI * 1.05, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-headR * 0.2, headY - headR * 0.92, headR * 0.34, 0, Math.PI * 2)
    ctx.fill()
  }

  // Hat.
  if (pr.hat === 1) {
    ctx.fillStyle = mixColor(pr.shirt, '#000000', 0.15)
    ctx.beginPath()
    ctx.arc(0, headY - headR * 0.12, headR * 1.03, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(headR * 0.3, headY - headR * 0.22, headR * 1.15, headR * 0.26, headR * 0.12)
    ctx.fill()
  } else if (pr.hat === 2) {
    ctx.fillStyle = mixColor(pr.shirt, '#ffffff', 0.2)
    ctx.beginPath()
    ctx.arc(0, headY - headR * 0.1, headR * 1.06, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(-headR * 1.06, headY - headR * 0.24, headR * 2.12, headR * 0.3)
  }

  // Face, only on the people actually turned toward the room.
  if (!fromBehind) {
    ctx.fillStyle = '#1a1622'
    for (const ex of [0.18, 0.5]) {
      ctx.beginPath()
      ctx.arc(headR * ex, headY + headR * 0.08, headR * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}

/** Back wall, signage, framed art, and the carpet running away from you. */
function drawArcadeRoom(
  ctx: CanvasRenderingContext2D,
  signs: Sign[],
  posters: Poster[],
  w: number,
  h: number,
) {
  const wallBottom = 0.24 * h

  ctx.fillStyle = ARCADE_WALL
  ctx.fillRect(0, 0, w, wallBottom)

  // Carpet. Motifs bunch up and shrink toward the wall, which is all the
  // perspective a flat scene like this needs.
  ctx.fillStyle = ARCADE_FLOOR
  ctx.fillRect(0, wallBottom, w, h - wallBottom)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, wallBottom, w, h - wallBottom)
  ctx.clip()
  const carpet = ['#e0574f', '#3f8fd8', '#e8b13c', '#4cb377', '#9a6fd0']
  for (let i = 1; i <= 130; i++) {
    const fx = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1)
    const fy = Math.abs((Math.sin(i * 78.233) * 12345.6789) % 1)
    const y = wallBottom + (h - wallBottom) * (fy * fy)
    const size = w * 0.012 * (0.3 + fy)
    ctx.globalAlpha = 0.14 + fy * 0.18
    ctx.fillStyle = carpet[i % carpet.length]
    ctx.beginPath()
    if (i % 3 === 0) {
      ctx.arc(fx * w, y, size, 0, Math.PI * 2)
    } else {
      ctx.moveTo(fx * w, y - size)
      ctx.lineTo(fx * w + size, y + size)
      ctx.lineTo(fx * w - size, y + size)
      ctx.closePath()
    }
    ctx.fill()
  }
  ctx.restore()

  // Skirting.
  ctx.fillStyle = '#15102a'
  ctx.fillRect(0, wallBottom - h * 0.014, w, h * 0.018)

  for (const poster of posters) {
    const x = poster.x * w
    const y = poster.y * h
    const pw = poster.w * w
    const phh = poster.h * h
    ctx.fillStyle = '#120f22'
    ctx.beginPath()
    ctx.roundRect(x, y, pw, phh, pw * 0.05)
    ctx.fill()
    ctx.fillStyle = poster.colour
    ctx.save()
    ctx.beginPath()
    ctx.rect(x + pw * 0.08, y + phh * 0.07, pw * 0.84, phh * 0.86)
    ctx.clip()
    if (poster.kind === 0) {
      ctx.fillRect(x + pw * 0.08, y + phh * 0.5, pw * 0.84, phh * 0.43)
      ctx.beginPath()
      ctx.arc(x + pw * 0.5, y + phh * 0.34, pw * 0.2, 0, Math.PI * 2)
      ctx.fill()
    } else if (poster.kind === 1) {
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + pw * (0.16 + i * 0.26), y + phh * (0.62 - i * 0.14), pw * 0.16, phh * 0.3)
      }
    } else if (poster.kind === 2) {
      ctx.beginPath()
      ctx.moveTo(x + pw * 0.5, y + phh * 0.16)
      ctx.lineTo(x + pw * 0.86, y + phh * 0.78)
      ctx.lineTo(x + pw * 0.14, y + phh * 0.78)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.fillRect(x + pw * 0.14, y + phh * 0.2, pw * 0.72, phh * 0.16)
      ctx.fillRect(x + pw * 0.14, y + phh * 0.46, pw * 0.44, phh * 0.14)
      ctx.fillRect(x + pw * 0.14, y + phh * 0.68, pw * 0.6, phh * 0.14)
    }
    ctx.restore()
  }

  for (const sign of signs) {
    const x = sign.x * w
    const y = sign.y * h
    const sw = sign.w * w
    const sh = sign.h * h
    ctx.strokeStyle = sign.colour
    ctx.lineWidth = Math.max(1.5, sw * 0.055)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.92
    ctx.beginPath()
    if (sign.kind === 0) {
      ctx.rect(x, y, sw, sh)
      ctx.moveTo(x + sw * 0.2, y + sh * 0.52)
      ctx.lineTo(x + sw * 0.8, y + sh * 0.52)
    } else if (sign.kind === 1) {
      ctx.arc(x + sw / 2, y + sh / 2, Math.min(sw, sh) * 0.5, 0, Math.PI * 2)
      ctx.moveTo(x + sw * 0.3, y + sh * 0.5)
      ctx.lineTo(x + sw * 0.7, y + sh * 0.5)
    } else {
      ctx.moveTo(x, y + sh)
      ctx.lineTo(x + sw * 0.3, y)
      ctx.lineTo(x + sw * 0.6, y + sh)
      ctx.lineTo(x + sw, y)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

function drawScreenArt(
  ctx: CanvasRenderingContext2D,
  m: Machine,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(sx, sy, sw, sh)
  ctx.clip()
  ctx.fillStyle = m.accent
  if (m.screen === 0) {
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(sx + sw * (0.12 + i * 0.17), sy + sh * 0.18, sw * 0.09, sh * 0.14)
    }
    ctx.fillRect(sx + sw * 0.42, sy + sh * 0.7, sw * 0.18, sh * 0.12)
  } else if (m.screen === 1) {
    ctx.beginPath()
    ctx.arc(sx + sw * 0.5, sy + sh * 0.5, sh * 0.3, 0.42, Math.PI * 2 - 0.42)
    ctx.lineTo(sx + sw * 0.5, sy + sh * 0.5)
    ctx.fill()
  } else if (m.screen === 2) {
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(sx + sw * (0.1 + i * 0.23), sy + sh * (0.6 - i * 0.1), sw * 0.13, sh * 0.34)
    }
  } else {
    ctx.fillRect(sx + sw * 0.14, sy + sh * 0.74, sw * 0.72, sh * 0.08)
    ctx.beginPath()
    ctx.arc(sx + sw * 0.5, sy + sh * 0.34, sh * 0.13, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawMachine(ctx: CanvasRenderingContext2D, m: Machine, w: number, h: number) {
  const x = m.x * w
  const bottom = m.y * h
  const mw = m.w * w
  const mh = m.h * h
  const top = bottom - mh
  const r = mw * 0.09
  const dark = mixColor(m.cab, '#000000', 0.38)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
  ctx.beginPath()
  ctx.ellipse(x + mw / 2, bottom + mh * 0.025, mw * 0.56, mh * 0.045, 0, 0, Math.PI * 2)
  ctx.fill()

  if (m.kind === 'claw') {
    // Glass box on a plinth, prizes heaped in the bottom.
    ctx.fillStyle = dark
    ctx.beginPath()
    ctx.roundRect(x, bottom - mh * 0.34, mw, mh * 0.34, r * 0.6)
    ctx.fill()
    ctx.fillStyle = 'rgba(150, 200, 235, 0.16)'
    ctx.beginPath()
    ctx.roundRect(x + mw * 0.04, top, mw * 0.92, mh * 0.68, r * 0.5)
    ctx.fill()
    ctx.strokeStyle = m.accent
    ctx.lineWidth = Math.max(1.2, mw * 0.045)
    ctx.stroke()
    const prizes = ['#e07ab0', '#e8b13c', '#4cb377', '#3f8fd8']
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = prizes[i % prizes.length]
      ctx.beginPath()
      ctx.arc(x + mw * (0.2 + i * 0.16), bottom - mh * (0.4 + (i % 2) * 0.06), mw * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = '#cfd6e0'
    ctx.lineWidth = Math.max(1, mw * 0.035)
    ctx.beginPath()
    ctx.moveTo(x + mw * 0.5, top + mh * 0.06)
    ctx.lineTo(x + mw * 0.5, top + mh * 0.3)
    ctx.moveTo(x + mw * 0.4, top + mh * 0.42)
    ctx.lineTo(x + mw * 0.5, top + mh * 0.3)
    ctx.lineTo(x + mw * 0.6, top + mh * 0.42)
    ctx.stroke()
    return
  }

  if (m.kind === 'change') {
    ctx.fillStyle = m.cab
    ctx.beginPath()
    ctx.roundRect(x + mw * 0.1, top, mw * 0.8, mh, r * 0.7)
    ctx.fill()
    ctx.fillStyle = m.accent
    ctx.beginPath()
    ctx.roundRect(x + mw * 0.2, top + mh * 0.07, mw * 0.6, mh * 0.13, r * 0.4)
    ctx.fill()
    ctx.fillStyle = '#d9a441'
    ctx.beginPath()
    ctx.arc(x + mw * 0.5, top + mh * 0.42, mw * 0.16, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0d0f18'
    ctx.fillRect(x + mw * 0.34, top + mh * 0.66, mw * 0.32, mh * 0.05)
    return
  }

  if (m.kind === 'pinball') {
    // Backbox with a low table sloping toward you.
    ctx.fillStyle = m.cab
    ctx.beginPath()
    ctx.roundRect(x + mw * 0.06, top, mw * 0.88, mh * 0.46, r * 0.5)
    ctx.fill()
    ctx.fillStyle = m.accent
    ctx.beginPath()
    ctx.roundRect(x + mw * 0.14, top + mh * 0.06, mw * 0.72, mh * 0.3, r * 0.35)
    ctx.fill()
    ctx.fillStyle = dark
    ctx.beginPath()
    ctx.moveTo(x, bottom)
    ctx.lineTo(x + mw * 0.08, top + mh * 0.46)
    ctx.lineTo(x + mw * 0.92, top + mh * 0.46)
    ctx.lineTo(x + mw, bottom)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = mixColor(m.accent, '#ffffff', 0.25)
    for (const bx of [0.3, 0.52, 0.72]) {
      ctx.beginPath()
      ctx.arc(x + mw * bx, top + mh * 0.66, mw * 0.05, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }

  // Upright.
  ctx.fillStyle = m.cab
  ctx.beginPath()
  ctx.roundRect(x, top, mw, mh, r)
  ctx.fill()
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.roundRect(x + mw * 0.83, top, mw * 0.17, mh, r)
  ctx.fill()

  ctx.fillStyle = m.accent
  ctx.beginPath()
  ctx.roundRect(x + mw * 0.07, top + mh * 0.03, mw * 0.72, mh * 0.12, r * 0.5)
  ctx.fill()
  ctx.fillStyle = mixColor(m.accent, '#ffffff', 0.45)
  ctx.beginPath()
  ctx.roundRect(x + mw * 0.11, top + mh * 0.05, mw * 0.64, mh * 0.04, r * 0.3)
  ctx.fill()

  const sx = x + mw * 0.1
  const sy = top + mh * 0.19
  const sw = mw * 0.66
  const sh = mh * 0.33
  ctx.fillStyle = '#06080f'
  ctx.beginPath()
  ctx.roundRect(sx, sy, sw, sh, r * 0.35)
  ctx.fill()
  drawScreenArt(ctx, m, sx, sy, sw, sh)

  ctx.fillStyle = mixColor(m.cab, '#000000', 0.22)
  ctx.beginPath()
  ctx.roundRect(x + mw * 0.04, top + mh * 0.58, mw * 0.78, mh * 0.13, r * 0.3)
  ctx.fill()
  ctx.strokeStyle = '#d9d9e2'
  ctx.lineWidth = Math.max(1, mw * 0.028)
  ctx.beginPath()
  ctx.moveTo(x + mw * 0.26, top + mh * 0.64)
  ctx.lineTo(x + mw * 0.26, top + mh * 0.58)
  ctx.stroke()
  ctx.fillStyle = '#e0574f'
  ctx.beginPath()
  ctx.arc(x + mw * 0.26, top + mh * 0.565, mw * 0.042, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e8b13c'
  for (const bx of [0.48, 0.6]) {
    ctx.beginPath()
    ctx.arc(x + mw * bx, top + mh * 0.63, mw * 0.032, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#0d0f18'
  ctx.fillRect(x + mw * 0.38, top + mh * 0.8, mw * 0.16, mh * 0.028)
}

function drawProp(ctx: CanvasRenderingContext2D, pr: Prop, w: number, h: number) {
  const s = pr.s * w

  ctx.save()
  ctx.translate(pr.x * w, pr.y * h)
  ctx.fillStyle = pr.colour
  ctx.strokeStyle = pr.colour
  ctx.lineWidth = Math.max(1, s * 0.14)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (pr.kind === 'cup') {
    ctx.beginPath()
    ctx.moveTo(-s * 0.3, -s * 0.8)
    ctx.lineTo(s * 0.3, -s * 0.8)
    ctx.lineTo(s * 0.2, 0)
    ctx.lineTo(-s * 0.2, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#e8e8ee'
    ctx.fillRect(-s * 0.34, -s * 0.92, s * 0.68, s * 0.14)
    ctx.fillRect(-s * 0.06, -s * 1.25, s * 0.12, s * 0.35)
  } else if (pr.kind === 'popcorn') {
    ctx.fillStyle = '#e0574f'
    ctx.beginPath()
    ctx.moveTo(-s * 0.34, -s * 0.75)
    ctx.lineTo(s * 0.34, -s * 0.75)
    ctx.lineTo(s * 0.24, 0)
    ctx.lineTo(-s * 0.24, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#f2e0b0'
    const kernels: [number, number][] = [
      [-0.2, -0.86],
      [0.05, -0.95],
      [0.26, -0.82],
    ]
    for (const k of kernels) {
      ctx.beginPath()
      ctx.arc(k[0] * s, k[1] * s, s * 0.16, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (pr.kind === 'token') {
    ctx.fillStyle = '#d9a441'
    ctx.beginPath()
    ctx.ellipse(0, -s * 0.1, s * 0.3, s * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (pr.kind === 'balloon') {
    ctx.strokeStyle = '#c9c2e0'
    ctx.lineWidth = Math.max(1, s * 0.07)
    ctx.beginPath()
    ctx.moveTo(0, s * 1.6)
    ctx.quadraticCurveTo(s * 0.25, s * 0.8, 0, s * 0.45)
    ctx.stroke()
    ctx.fillStyle = pr.colour
    ctx.beginPath()
    ctx.ellipse(0, 0, s * 0.44, s * 0.54, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.beginPath()
    ctx.ellipse(-s * 0.15, -s * 0.18, s * 0.11, s * 0.16, -0.4, 0, Math.PI * 2)
    ctx.fill()
  } else if (pr.kind === 'plush') {
    ctx.beginPath()
    ctx.arc(0, -s * 0.35, s * 0.36, 0, Math.PI * 2)
    ctx.fill()
    for (const ex of [-0.32, 0.32]) {
      ctx.beginPath()
      ctx.arc(ex * s, -s * 0.68, s * 0.16, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#181422'
    for (const ex of [-0.14, 0.14]) {
      ctx.beginPath()
      ctx.arc(ex * s, -s * 0.4, s * 0.06, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (pr.kind === 'cone') {
    ctx.fillStyle = '#f07a3f'
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.lineTo(s * 0.34, 0)
    ctx.lineTo(-s * 0.34, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#f2e8e0'
    ctx.fillRect(-s * 0.24, -s * 0.55, s * 0.48, s * 0.14)
  } else if (pr.kind === 'skate') {
    ctx.beginPath()
    ctx.roundRect(-s * 0.5, -s * 0.34, s, s * 0.16, s * 0.08)
    ctx.fill()
    ctx.fillStyle = '#d9d9e2'
    for (const wx of [-0.3, 0.3]) {
      ctx.beginPath()
      ctx.arc(wx * s, -s * 0.1, s * 0.12, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (pr.kind === 'cat') {
    ctx.fillStyle = '#4a4450'
    ctx.beginPath()
    ctx.ellipse(0, -s * 0.26, s * 0.5, s * 0.26, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-s * 0.45, -s * 0.48, s * 0.22, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-s * 0.58, -s * 0.62)
    ctx.lineTo(-s * 0.52, -s * 0.86)
    ctx.lineTo(-s * 0.4, -s * 0.64)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#4a4450'
    ctx.lineWidth = Math.max(1, s * 0.1)
    ctx.beginPath()
    ctx.moveTo(s * 0.46, -s * 0.3)
    ctx.quadraticCurveTo(s * 0.8, -s * 0.5, s * 0.66, -s * 0.78)
    ctx.stroke()
  } else if (pr.kind === 'bag') {
    ctx.beginPath()
    ctx.roundRect(-s * 0.32, -s * 0.7, s * 0.64, s * 0.7, s * 0.06)
    ctx.fill()
    ctx.strokeStyle = mixColor(pr.colour, '#000000', 0.4)
    ctx.lineWidth = Math.max(1, s * 0.08)
    ctx.beginPath()
    ctx.arc(0, -s * 0.7, s * 0.2, Math.PI, Math.PI * 2)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

// ---------------------------------------------------------------- cabinets

function drawCabinet(ctx: CanvasRenderingContext2D, cab: Cabinet, w: number, h: number) {
  const x = cab.x * w
  const y = cab.y * h
  const cw = cab.w * w
  const ch = cab.h * h
  const radius = Math.min(cw, ch) * 0.1

  // Enamel body, with a lit edge down one side so it reads as a solid object.
  ctx.fillStyle = cab.body
  ctx.beginPath()
  ctx.roundRect(x, y, cw, ch, radius)
  ctx.fill()
  edge(ctx, mixColor(cab.body, '#000000', 0.45), cw * 0.022)

  ctx.fillStyle = mixColor(cab.body, '#ffffff', 0.1)
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.03, y + ch * 0.04, cw * 0.07, ch * 0.92, radius * 0.5)
  ctx.fill()

  // Marquee — the brightest thing on the cabinet, as it should be.
  ctx.fillStyle = cab.accent
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.12, y + ch * 0.07, cw * 0.76, ch * 0.15, radius * 0.45)
  ctx.fill()
  ctx.fillStyle = mixColor(cab.accent, '#ffffff', 0.5)
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.16, y + ch * 0.09, cw * 0.68, ch * 0.05, radius * 0.3)
  ctx.fill()

  // Screen: a dark well washed with the cabinet's own glow, plus scanlines.
  const sx = x + cw * 0.13
  const sy = y + ch * 0.29
  const sw = cw * 0.74
  const sh = ch * 0.44
  ctx.fillStyle = mixColor('#05070c', cab.accent, 0.32 * cab.tone)
  ctx.beginPath()
  ctx.roundRect(sx, sy, sw, sh, radius * 0.4)
  ctx.fill()
  edge(ctx, '#0a0d14', cw * 0.02)

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(sx, sy, sw, sh, radius * 0.4)
  ctx.clip()
  ctx.globalAlpha = 0.18
  ctx.fillStyle = mixColor(cab.accent, '#ffffff', 0.55)
  const lines = 7
  for (let i = 0; i < lines; i++) {
    ctx.fillRect(sx, sy + (sh * (i + 0.25)) / lines, sw, Math.max(1, sh * 0.035))
  }
  ctx.restore()

  // Control deck.
  ctx.fillStyle = mixColor(cab.body, '#000000', 0.32)
  ctx.beginPath()
  ctx.roundRect(x + cw * 0.1, y + ch * 0.78, cw * 0.8, ch * 0.12, radius * 0.4)
  ctx.fill()
}

// ------------------------------------------------------------------- board

const MEDALS = ['#f5c542', '#cfd6e0', '#d08a45'] as const

function drawBoardScene(
  ctx: CanvasRenderingContext2D,
  rows: readonly { rank: number; name: string; score: number }[],
  w: number,
  h: number,
) {
  const fontPx = Math.min(h * 0.032, w * 0.05)
  ctx.textBaseline = 'middle'

  ctx.font = `700 ${fontPx * 0.78}px Outfit, system-ui, sans-serif`
  ctx.fillStyle = '#5f7fae'
  ctx.textAlign = 'left'
  ctx.fillText('RANK', w * 0.1, h * 0.07)
  ctx.fillText('NAME', w * 0.24, h * 0.07)
  ctx.textAlign = 'right'
  ctx.fillText('SCORE', w * 0.9, h * 0.07)

  rows.forEach((row, i) => {
    const y = boardRowY(i, rows.length) * h
    const pill = i % 2 === 0 ? '#1d2740' : '#222c47'
    const medal: string | null = MEDALS[i] ?? null

    ctx.fillStyle = pill
    ctx.beginPath()
    ctx.roundRect(w * 0.07, y - fontPx * 0.92, w * 0.86, fontPx * 1.84, fontPx * 0.42)
    ctx.fill()

    ctx.font = `800 ${fontPx}px Outfit, system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillStyle = medal ?? '#556f96'
    ctx.fillText(String(row.rank), w * 0.1, y)
    ctx.fillStyle = medal ?? '#dce6f5'
    ctx.fillText(row.name, w * 0.24, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = medal ?? '#7fe0b0'
    ctx.fillText(row.score.toLocaleString(), w * 0.9, y)
  })
}

// -------------------------------------------------------------------- loom

function drawCable(ctx: CanvasRenderingContext2D, c: Cable, w: number, h: number) {
  const path = () => {
    ctx.beginPath()
    ctx.moveTo(c.x0 * w, cableY(0) * h)
    ctx.bezierCurveTo(
      c.x1 * w,
      cableY(1 / 3) * h,
      c.x2 * w,
      cableY(2 / 3) * h,
      c.x3 * w,
      cableY(1) * h,
    )
  }

  ctx.lineCap = 'round'

  // Dark casing, sheath colour, then a highlight down one side.
  ctx.strokeStyle = mixColor(c.colour, '#000000', 0.55)
  ctx.lineWidth = c.width * w
  path()
  ctx.stroke()

  ctx.strokeStyle = c.colour
  ctx.lineWidth = c.width * w * 0.72
  path()
  ctx.stroke()

  ctx.save()
  ctx.translate(-c.width * w * 0.2, 0)
  ctx.strokeStyle = mixColor(c.colour, '#ffffff', 0.45)
  ctx.lineWidth = c.width * w * 0.18
  path()
  ctx.stroke()
  ctx.restore()
}

function drawTie(ctx: CanvasRenderingContext2D, tie: Tie, w: number, h: number) {
  const th = w * 0.015
  ctx.fillStyle = '#39414f'
  ctx.beginPath()
  ctx.roundRect(tie.x * w, tie.y * h - th / 2, tie.w * w, th, th * 0.35)
  ctx.fill()
  edge(ctx, '#20252e', w * 0.003)
}

function drawBlock(ctx: CanvasRenderingContext2D, b: Block, w: number, h: number) {
  const x = b.x * w
  const y = b.y * h
  const bw = b.w * w
  const bh = b.h * h
  const radius = Math.min(bw, bh) * 0.14

  ctx.fillStyle = '#4a5468'
  ctx.beginPath()
  ctx.roundRect(x, y, bw, bh, radius)
  ctx.fill()
  edge(ctx, '#262c38', bw * 0.02)

  // Brass pins.
  ctx.fillStyle = '#d9a441'
  const pinW = bw / (b.pins * 2 + 1)
  for (let i = 0; i < b.pins; i++) {
    ctx.beginPath()
    ctx.roundRect(x + pinW * (i * 2 + 1), y + bh * 0.62, pinW, bh * 0.3, pinW * 0.3)
    ctx.fill()
  }
}

// ------------------------------------------------------------------ tokens

function drawToken(ctx: CanvasRenderingContext2D, t: Token, w: number, h: number) {
  const x = t.x * w
  const y = t.y * h
  const r = t.r * w
  const face = mixColor(t.colour, '#000000', (1 - t.tone) * 0.3)

  // Rim, struck face, milled edge.
  ctx.fillStyle = mixColor(face, '#000000', 0.4)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = face
  ctx.beginPath()
  ctx.arc(x, y - r * 0.05, r * 0.88, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = mixColor(face, '#ffffff', 0.42)
  ctx.lineWidth = Math.max(1, r * 0.1)
  ctx.beginPath()
  ctx.arc(x, y - r * 0.05, r * 0.62, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = Math.max(1, r * 0.08)
  ctx.strokeStyle = mixColor(face, '#000000', 0.32)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 0.88, y - r * 0.05 + Math.sin(a) * r * 0.88)
    ctx.lineTo(x + Math.cos(a) * r, y - r * 0.05 + Math.sin(a) * r)
    ctx.stroke()
  }
}

// ------------------------------------------------------------------ carpet

function drawMotif(ctx: CanvasRenderingContext2D, m: Motif, w: number, h: number) {
  const size = m.size * w
  ctx.save()
  ctx.translate(m.x * w, m.y * h)
  ctx.rotate(m.rot)
  ctx.fillStyle = m.accent
  ctx.strokeStyle = m.accent
  ctx.lineWidth = Math.max(1.5, size * 0.16)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (m.kind === 'dot') {
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = mixColor(m.accent, '#ffffff', 0.5)
    ctx.lineWidth = Math.max(1, size * 0.08)
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2)
    ctx.stroke()
  } else if (m.kind === 'tri') {
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.48)
    ctx.lineTo(size * 0.44, size * 0.34)
    ctx.lineTo(-size * 0.44, size * 0.34)
    ctx.closePath()
    ctx.fill()
  } else if (m.kind === 'zig') {
    ctx.beginPath()
    ctx.moveTo(-size * 0.5, size * 0.24)
    ctx.lineTo(-size * 0.17, -size * 0.24)
    ctx.lineTo(size * 0.17, size * 0.24)
    ctx.lineTo(size * 0.5, -size * 0.24)
    ctx.stroke()
  } else {
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const rr = i % 2 === 0 ? size * 0.5 : size * 0.2
      const px = Math.cos(a) * rr
      const py = Math.sin(a) * rr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

// ------------------------------------------------------------------ shared

function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, w: number, h: number) {
  if (scene.kind === 'arcade') {
    drawArcadeRoom(ctx, scene.signs, scene.posters, w, h)
    // Back to front, so somebody stands behind the machine they are playing and
    // the litter on the carpet sits in front of everything.
    const machines = [...scene.machines].sort((a, b) => a.y - b.y)
    const people = [...scene.people].sort((a, b) => a.y - b.y)
    let next = 0
    for (const machine of machines) {
      while (next < people.length && people[next].y <= machine.y) {
        drawPerson(ctx, people[next], w, h)
        next += 1
      }
      drawMachine(ctx, machine, w, h)
    }
    while (next < people.length) {
      drawPerson(ctx, people[next], w, h)
      next += 1
    }
    for (const prop of scene.props) drawProp(ctx, prop, w, h)
    return
  }
  if (scene.kind === 'cabinets') {
    for (const cab of scene.cabinets) drawCabinet(ctx, cab, w, h)
    return
  }
  if (scene.kind === 'board') {
    drawBoardScene(ctx, scene.rows, w, h)
    return
  }
  if (scene.kind === 'loom') {
    for (const c of scene.cables) drawCable(ctx, c, w, h)
    for (const t of scene.ties) drawTie(ctx, t, w, h)
    for (const b of scene.blocks) drawBlock(ctx, b, w, h)
    return
  }
  if (scene.kind === 'tokens') {
    for (const t of scene.tokens) drawToken(ctx, t, w, h)
    return
  }
  for (const m of scene.motifs) drawMotif(ctx, m, w, h)
}

/**
 * Decoys take the colour of the ground they lie on, so they read as grit in the
 * scene rather than as a layer painted over it.
 */
function drawDecoys(ctx: CanvasRenderingContext2D, scene: Scene, w: number, h: number) {
  ctx.fillStyle = mixColor(groundFor(scene), '#ffffff', 0.34)
  for (const d of scene.decoys) {
    const x = d.x * w
    const y = d.y * h
    const r = d.r * w

    if (d.kind === 'screw') {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    // Specks read as a resting body at a glance — that is the whole point.
    ctx.beginPath()
    ctx.ellipse(x, y, r * 1.25, r * 0.8, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawHintVeil(ctx: CanvasRenderingContext2D, round: RoundState, w: number, h: number) {
  const bx = round.x * w
  const by = round.y * h
  ctx.save()
  ctx.fillStyle = '#05070c'
  ctx.globalAlpha = 0.8
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  // Reversed arc punches the hole the player still has to search.
  ctx.arc(bx, by, HINT_RADIUS * w, 0, Math.PI * 2, true)
  ctx.fill()
  ctx.restore()
}

function drawReticle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const px = x * w
  const py = y * h
  const r = w * 0.05
  ctx.strokeStyle = 'hsl(198, 70%, 52%)'
  ctx.lineWidth = Math.max(1.5, w * 0.005)
  ctx.beginPath()
  ctx.arc(px, py, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(px - r * 1.5, py)
  ctx.lineTo(px - r * 0.4, py)
  ctx.moveTo(px + r * 0.4, py)
  ctx.lineTo(px + r * 1.5, py)
  ctx.moveTo(px, py - r * 1.5)
  ctx.lineTo(px, py - r * 0.4)
  ctx.moveTo(px, py + r * 0.4)
  ctx.lineTo(px, py + r * 1.5)
  ctx.stroke()
}

function drawMissFlash(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const t = state.missFlash
  if (t <= 0) return
  ctx.strokeStyle = `hsla(352, 62%, 54%, ${t})`
  ctx.lineWidth = Math.max(2, w * 0.008)
  ctx.beginPath()
  ctx.arc(state.missX * w, state.missY * h, w * 0.03 * (1.6 - t), 0, Math.PI * 2)
  ctx.stroke()
}

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const field = fieldRect(w, h, state.round.aspect)

  // Carry the surround in the scene's own ground, so a window that does not
  // match the board reads as more of the same surface rather than as bars.
  ctx.fillStyle = groundFor(state.round.scene)
  ctx.fillRect(0, 0, w, h)

  // Everything below is authored against a canvas that is exactly the scene, so
  // shift into the field and hand it the field's size.
  ctx.save()
  ctx.translate(field.x, field.y)
  drawField(ctx, state, field.w, field.h)
  ctx.restore()
}

function drawField(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const round = state.round
  const scene = round.scene

  drawBackground(ctx, scene, w, h)
  drawScene(ctx, scene, w, h)
  drawDecoys(ctx, scene, w, h)

  if (round.hintUsed && !round.found) drawHintVeil(ctx, round, w, h)

  /*
   * Camouflage is against the one surface the bug is perched on, not against a
   * drained scene — that is what lets everything above stay saturated. It sinks
   * toward that colour as the rounds get harder, while the legs stay a hard
   * dark line so the silhouette is crisp however close the match gets.
   */
  const body = bugBody(round.camoBase, round.config.camo)

  drawBug(ctx, round.x * w, round.y * h, round.config.bugSize * w, {
    angle: round.angle,
    // The legs stay darker than the shell so the silhouette holds together,
    // but not so dark that a hard black outline points straight at it.
    look: { body, leg: mixColor(body, '#05070c', 0.42) },
    flash: round.found ? Math.max(0, 0.7 - round.foundAge) : 0,
  })

  if (round.found) {
    ctx.strokeStyle = 'hsl(150, 60%, 50%)'
    ctx.lineWidth = Math.max(2, w * 0.009)
    ctx.beginPath()
    ctx.arc(
      round.x * w,
      round.y * h,
      catchRadius(round) * w * (1 + round.foundAge * 0.6),
      0,
      Math.PI * 2,
    )
    ctx.stroke()
  }

  drawMissFlash(ctx, state, w, h)

  if (state.keyboardMode && state.phase === 'playing' && !round.found) {
    drawReticle(ctx, state.reticleX, state.reticleY, w, h)
  }
}
