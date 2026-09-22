/**
 * The cast: every critter in a Find the Bug scene, the Bug himself included.
 *
 * They are drawn front on, like a crowd in a picture book — a big round head
 * carrying the face, a body under it, and arms and legs enough to read as a
 * bug. Every one of them shares the same ink outline, the same proportions and
 * the same shading, which is what makes two hundred of them look like one
 * drawing rather than a pile of stickers.
 *
 * Geometry is in units of the critter's own height: feet at y = 0, antenna
 * tips at about y = -1, the body centred on x = 0. The caller scales that to
 * world units with `size`.
 *
 * A scene paints a couple of hundred of these, so the drawing is written to
 * be cheap: matching strokes go out as one path (both eyes, both arms), and
 * shading and stripes are drawn as shapes of their own rather than through a
 * clip, which costs far more than the fill it saves.
 *
 * Nothing here knows about rounds or scoring, so the start card and the
 * wanted poster can draw the Bug from the same function the scenes use.
 */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type Pt = readonly [number, number]

const TAU = Math.PI * 2

/** The one line colour everything is drawn in. A deep plum reads warmer than black. */
export const INK = '#2a2032'

/** Outline weight, in critter heights. */
const O = 0.034

export type Species =
  | 'beetle'
  | 'ant'
  | 'bee'
  | 'grasshopper'
  | 'spider'
  | 'butterfly'
  | 'caterpillar'
  | 'snail'
  | 'worm'

export type Pattern = 'plain' | 'spots' | 'stripes' | 'dots'

export type Hat =
  | 'none'
  | 'bobble'
  | 'beanie'
  | 'cap'
  | 'tophat'
  | 'party'
  | 'straw'
  | 'crown'
  | 'bow'
  | 'flower'
  | 'headphones'

export type Glasses = 'none' | 'round' | 'shades'

/**
 * Things a critter can have in its hands. One-handed ones are raised in the
 * right hand; `crumb`, `leaf` and `plush` are carried over the head with both.
 * `tube` is a swim ring worn round the middle.
 */
export type Held =
  | 'none'
  | 'balloon'
  | 'icecream'
  | 'flag'
  | 'lollipop'
  | 'token'
  | 'drink'
  | 'lantern'
  | 'spade'
  | 'crumb'
  | 'leaf'
  | 'plush'
  | 'tube'

export type Pose = 'stand' | 'wave' | 'cheer' | 'carry' | 'hold' | 'walk' | 'sit'

export type Mood = 'smile' | 'open' | 'sleepy' | 'o'

export type Look = {
  species: Species
  /** Shell, abdomen, wings — the biggest patch of colour. */
  body: string
  /** Pattern colour on the body: spots, stripes, wing markings. */
  trim: string
  pattern: Pattern
  head: string
  limb: string
  hat: Hat
  hatColour: string
  /** Band, pom-pom, ribbon. */
  hatTrim: string
  glasses: Glasses
  scarf: string | null
  held: Held
  heldColour: string
}

export type Critter = {
  id: number
  /** Feet, in world units. */
  x: number
  y: number
  /** Height in world units. */
  size: number
  look: Look
  pose: Pose
  /** 0 faces out of the picture; 1 is turned three-quarters to its right. */
  facing: 0 | 1
  /** Mirror the whole critter, which also turns `facing` the other way. */
  flip: boolean
  gazeX: number
  gazeY: number
  mood: Mood
  /** Height above the ground for anything flying, in critter heights. */
  lift: number
  /**
   * Draw-order key. Normally the feet; a critter standing on something takes
   * that thing's key plus a little, so it is drawn on top of what it stands on.
   */
  z: number
}

// ------------------------------------------------------------------ palette

export const RED = '#e2433b'
export const WHITE = '#f7f2e8'
export const CREAM = '#f7dfb6'
export const NAVY = '#35406e'

/**
 * The Bug. Red and white stripes, a red bobble hat with a white band, round
 * glasses. Everything else in a scene may share any of that — lots of them
 * will — but nobody else has all of it.
 */
export const THE_BUG: Look = {
  species: 'beetle',
  body: RED,
  trim: WHITE,
  pattern: 'stripes',
  head: CREAM,
  limb: NAVY,
  hat: 'bobble',
  hatColour: RED,
  hatTrim: WHITE,
  glasses: 'round',
  scarf: null,
  held: 'none',
  heldColour: RED,
}

// ------------------------------------------------------------------ helpers

const SHADE = 'rgba(42, 20, 64, 0.26)'
const SHADE_SOFT = 'rgba(42, 20, 64, 0.18)'

/**
 * Whether the critter being drawn is big enough on screen for the fine
 * detail — pupil glints, blush, knit ribs — to show. Set per critter by
 * `drawCritter`; drawing is synchronous, so a module variable is enough.
 */
let fine = true

/** Start a fresh path holding one ellipse. */
function ellipsePath(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU)
}

/** Add an ellipse to the current path without joining it to what is there. */
function ellipseSub(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot))
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU)
}

function ink(ctx: Ctx, w = O) {
  ctx.lineWidth = w
  ctx.strokeStyle = INK
  ctx.stroke()
}

function fillInk(ctx: Ctx, fill: string, w = O) {
  ctx.fillStyle = fill
  ctx.fill()
  ink(ctx, w)
}

/*
 * The shading crescent: the part of an ellipse that a copy of it nudged up and
 * to the left does not cover. In the ellipse's own unit circle the two circles
 * cross at fixed angles, so the crescent is two arcs, worked out once here.
 */
const CRESCENT_DX = -0.13
const CRESCENT_DY = -0.17
const CRESCENT = (() => {
  const sx = CRESCENT_DX
  const sy = CRESCENT_DY
  const len = Math.hypot(sx, sy)
  const half = Math.sqrt(1 - (len / 2) ** 2)
  const nx = -sy / len
  const ny = sx / len
  const p1 = [sx / 2 + half * nx, sy / 2 + half * ny]
  const p2 = [sx / 2 - half * nx, sy / 2 - half * ny]
  return {
    outerFrom: Math.atan2(p1[1], p1[0]),
    outerTo: Math.atan2(p2[1], p2[0]),
    innerFrom: Math.atan2(p2[1] - sy, p2[0] - sx),
    innerTo: Math.atan2(p1[1] - sy, p1[0] - sx),
  }
})()

function crescent(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0, fill = SHADE) {
  const ox = CRESCENT_DX * rx
  const oy = CRESCENT_DY * ry
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rot, CRESCENT.outerFrom, CRESCENT.outerTo, false)
  ctx.ellipse(x + ox * c - oy * s, y + ox * s + oy * c, rx, ry, rot, CRESCENT.innerFrom, CRESCENT.innerTo, true)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

/**
 * A horizontal band across an ellipse, from `y0` to `y1`, added to the
 * current path: its sides follow the ellipse, so stripes need no clip.
 */
function bandSub(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, y0: number, y1: number) {
  const a0 = Math.asin(Math.max(-1, Math.min(1, (y0 - cy) / ry)))
  const a1 = Math.asin(Math.max(-1, Math.min(1, (y1 - cy) / ry)))
  ctx.moveTo(cx + rx * Math.cos(a0), y0)
  ctx.ellipse(cx, cy, rx, ry, 0, a0, a1, false)
  ctx.lineTo(cx - rx * Math.cos(a1), y1)
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI - a1, Math.PI - a0, false)
  ctx.closePath()
}

function gloss(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.5) {
  ctx.fillStyle = alpha === 0.5 ? 'rgba(255, 255, 255, 0.5)' : `rgba(255, 255, 255, ${alpha})`
  ellipsePath(ctx, x - rx * 0.4, y - ry * 0.46, rx * 0.26, ry * 0.15, -0.55)
  ctx.fill()
}

/** A shaded, outlined ball — heads, thoraxes, pom-poms. */
function orb(ctx: Ctx, x: number, y: number, rx: number, ry: number, colour: string, shine = true) {
  ellipsePath(ctx, x, y, rx, ry)
  ctx.fillStyle = colour
  ctx.fill()
  crescent(ctx, x, y, rx, ry)
  ellipsePath(ctx, x, y, rx, ry)
  ink(ctx)
  if (shine && fine) gloss(ctx, x, y, rx, ry, 0.45)
}

type Limb = readonly [Pt, Pt, Pt]

/** Outlined limbs: every ink stroke in one pass, every coloured one in another. */
function limbs(ctx: Ctx, list: readonly Limb[], colour: string, w: number) {
  ctx.beginPath()
  for (const [a, b, c] of list) {
    ctx.moveTo(a[0], a[1])
    ctx.quadraticCurveTo(b[0], b[1], c[0], c[1])
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = INK
  ctx.lineWidth = w + O * 1.7
  ctx.stroke()
  ctx.strokeStyle = colour
  ctx.lineWidth = w
  ctx.stroke()
}

/** Several outlined blobs of one colour: hands, feet, spots. */
function blobs(ctx: Ctx, pts: readonly Pt[], rx: number, ry: number, colour: string, outline = O * 0.85) {
  ctx.beginPath()
  for (const [x, y] of pts) ellipseSub(ctx, x, y, rx, ry)
  ctx.fillStyle = colour
  ctx.fill()
  if (outline > 0) ink(ctx, outline)
}

// -------------------------------------------------------------------- faces

type HeadSpec = { x: number; y: number; r: number }

function drawFace(ctx: Ctx, head: HeadSpec, c: Critter, facing: number) {
  const { x, y, r } = head
  const look = c.look
  const shift = facing * r * 0.26
  const eyeY = y - r * 0.02
  const eyeRx = r * 0.28
  const eyeRy = r * 0.34

  // Left eye first; the one on the far side of a turned head is squashed.
  const far = facing !== 0
  const lx = x + shift - r * 0.42 * (far ? 0.8 : 1)
  const rxEye = x + shift + r * 0.42
  const lSquash = far ? 0.8 : 1
  const eyes: [number, number][] = [
    [lx, lSquash],
    [rxEye, 1],
  ]

  if (c.mood === 'sleepy') {
    ctx.beginPath()
    for (const [ex, sq] of eyes) {
      ctx.moveTo(ex + eyeRx * 0.9 * sq * Math.cos(0.15 * Math.PI), eyeY - eyeRy * 0.2 + eyeRx * 0.9 * Math.sin(0.15 * Math.PI))
      ctx.arc(ex, eyeY - eyeRy * 0.2, eyeRx * 0.9 * sq, 0.15 * Math.PI, 0.85 * Math.PI)
    }
    ctx.lineCap = 'round'
    ink(ctx, O * 0.9)
  } else {
    ctx.beginPath()
    for (const [ex, sq] of eyes) ellipseSub(ctx, ex, eyeY, eyeRx * sq, eyeRy)
    fillInk(ctx, '#ffffff', O * 0.7)
    const pupils: Pt[] = eyes.map(([ex]) => [
      ex + (c.gazeX * 0.38 + facing * 0.22) * eyeRx,
      eyeY + (c.gazeY * 0.3 + 0.1) * eyeRy,
    ])
    ctx.beginPath()
    for (let i = 0; i < 2; i++) ellipseSub(ctx, pupils[i][0], pupils[i][1], eyeRx * 0.56 * eyes[i][1], eyeRx * 0.62)
    ctx.fillStyle = INK
    ctx.fill()
    if (fine) {
      ctx.beginPath()
      for (const [px, py] of pupils) ellipseSub(ctx, px - eyeRx * 0.2, py - eyeRx * 0.24, eyeRx * 0.2, eyeRx * 0.2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }
  }

  if (fine) {
    ctx.beginPath()
    ellipseSub(ctx, lx - r * 0.1, y + r * 0.36, r * 0.15, r * 0.1)
    ellipseSub(ctx, rxEye + r * 0.1, y + r * 0.36, r * 0.15, r * 0.1)
    ctx.fillStyle = 'rgba(255, 105, 125, 0.4)'
    ctx.fill()
  }

  const mx = x + shift * 1.15
  const my = y + r * 0.5
  ctx.lineCap = 'round'
  if (c.mood === 'open') {
    ctx.beginPath()
    ctx.moveTo(mx - r * 0.2, my - r * 0.06)
    ctx.quadraticCurveTo(mx, my + r * 0.34, mx + r * 0.2, my - r * 0.06)
    ctx.closePath()
    fillInk(ctx, '#8c2b3c', O * 0.8)
  } else if (c.mood === 'o') {
    ellipsePath(ctx, mx, my + r * 0.04, r * 0.08, r * 0.1)
    fillInk(ctx, '#8c2b3c', O * 0.8)
  } else {
    ctx.beginPath()
    ctx.arc(mx, my - r * 0.14, r * 0.2, 0.2 * Math.PI, 0.8 * Math.PI)
    ink(ctx, O * 0.9)
  }

  if (look.glasses === 'round') {
    const ring = r * 0.38
    ctx.beginPath()
    for (const [ex, sq] of eyes) ellipseSub(ctx, ex, eyeY, ring * sq, ring)
    ctx.fillStyle = 'rgba(220, 240, 255, 0.22)'
    ctx.fill()
    ctx.moveTo(lx + ring * lSquash, eyeY - r * 0.06)
    ctx.quadraticCurveTo((lx + rxEye) / 2, eyeY - r * 0.2, rxEye - ring, eyeY - r * 0.06)
    ink(ctx, O * 1.05)
  } else if (look.glasses === 'shades') {
    ctx.beginPath()
    for (const [ex, sq] of eyes) ctx.roundRect(ex - r * 0.36 * sq, eyeY - r * 0.26, r * 0.72 * sq, r * 0.46, r * 0.16)
    ctx.moveTo(lx + r * 0.34 * lSquash, eyeY - r * 0.08)
    ctx.lineTo(rxEye - r * 0.34, eyeY - r * 0.08)
    fillInk(ctx, '#1d1826', O * 0.85)
    if (fine) {
      ctx.beginPath()
      for (const [ex, sq] of eyes) ctx.roundRect(ex - r * 0.24 * sq, eyeY - r * 0.18, r * 0.16 * sq, r * 0.1, r * 0.05)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.fill()
    }
  }
}

// --------------------------------------------------------------------- hats

function domeSub(ctx: Ctx, cx: number, baseY: number, rx: number, ry: number) {
  ctx.moveTo(cx - rx, baseY)
  ctx.ellipse(cx, baseY, rx, ry, 0, Math.PI, TAU)
  ctx.closePath()
}

/** Shade down the right side of a dome, the way `crescent` shades a ball. */
function domeShade(ctx: Ctx, cx: number, baseY: number, rx: number, ry: number) {
  ctx.beginPath()
  ctx.ellipse(cx, baseY, rx, ry, 0, -0.42 * Math.PI, 0)
  ctx.lineTo(cx + rx * 0.74, baseY)
  ctx.ellipse(cx - rx * 0.12, baseY, rx * 0.86, ry * 0.9, 0, 0, -0.4 * Math.PI, true)
  ctx.closePath()
  ctx.fillStyle = SHADE_SOFT
  ctx.fill()
}

function drawHat(ctx: Ctx, head: HeadSpec, look: Look, facing: number) {
  const { x, y, r } = head
  const lean = facing * r * 0.12
  const colour = look.hatColour
  const trim = look.hatTrim

  switch (look.hat) {
    case 'bobble':
    case 'beanie': {
      const base = y - r * 0.4
      const cx = x + lean
      ctx.beginPath()
      domeSub(ctx, cx, base, r * 1.0, r * 0.74)
      ctx.fillStyle = colour
      ctx.fill()
      domeShade(ctx, cx, base, r, r * 0.74)
      ctx.beginPath()
      domeSub(ctx, cx, base, r * 1.0, r * 0.74)
      ink(ctx)
      if (fine) {
        // Knit ribs, so a beanie reads as wool rather than a helmet.
        ctx.beginPath()
        for (const k of [-0.45, 0, 0.45]) {
          ctx.moveTo(cx + k * r, base)
          ctx.quadraticCurveTo(cx + k * r * 1.1, base - r * 0.4, cx + k * r * 0.5, base - r * 0.66)
        }
        ctx.strokeStyle = 'rgba(42, 20, 64, 0.22)'
        ctx.lineWidth = O * 0.6
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.roundRect(cx - r * 1.08, base - r * 0.1, r * 2.16, r * 0.36, r * 0.16)
      fillInk(ctx, trim)
      if (look.hat === 'bobble') orb(ctx, x + lean * 1.6, base - r * 0.82, r * 0.3, r * 0.3, colour)
      return
    }
    case 'cap': {
      const base = y - r * 0.38
      const cx = x + lean
      ctx.beginPath()
      domeSub(ctx, cx, base, r * 0.98, r * 0.7)
      ctx.fillStyle = colour
      ctx.fill()
      domeShade(ctx, cx, base, r * 0.98, r * 0.7)
      ctx.beginPath()
      domeSub(ctx, cx, base, r * 0.98, r * 0.7)
      ink(ctx)
      ctx.beginPath()
      ellipseSub(ctx, cx, base - r * 0.68, r * 0.12, r * 0.08)
      if (facing === 0) ellipseSub(ctx, x, base + r * 0.02, r * 0.86, r * 0.2)
      else ellipseSub(ctx, x + Math.sign(facing) * r * 0.78, base + r * 0.02, r * 0.66, r * 0.16)
      fillInk(ctx, trim)
      return
    }
    case 'tophat': {
      const brim = y - r * 0.62
      const cx = x + lean
      ctx.beginPath()
      ctx.roundRect(cx - r * 0.58, brim - r * 1.0, r * 1.16, r * 1.02, r * 0.1)
      fillInk(ctx, colour)
      ctx.fillStyle = trim
      ctx.fillRect(cx - r * 0.56, brim - r * 0.3, r * 1.12, r * 0.22)
      ellipsePath(ctx, cx, brim + r * 0.02, r * 0.98, r * 0.2)
      fillInk(ctx, colour)
      return
    }
    case 'party': {
      const base = y - r * 0.55
      const tipX = x + lean * 3
      const tipY = base - r * 1.25
      const half = r * 0.56
      ctx.beginPath()
      ctx.moveTo(x - half, base)
      ctx.lineTo(tipX, tipY)
      ctx.lineTo(x + half, base)
      ctx.closePath()
      ctx.fillStyle = colour
      ctx.fill()
      // Bands across the cone, cut to its sides by hand.
      const at = (t: number): [number, number, number] => {
        const yy = base + (tipY - base) * t
        return [x - half + (tipX - (x - half)) * t, x + half + (tipX - (x + half)) * t, yy]
      }
      ctx.beginPath()
      for (const [t0, t1] of [[0.18, 0.34], [0.5, 0.64]] as const) {
        const [l0, r0, y0] = at(t0)
        const [l1, r1, y1] = at(t1)
        ctx.moveTo(l0, y0)
        ctx.lineTo(r0, y0)
        ctx.lineTo(r1, y1)
        ctx.lineTo(l1, y1)
        ctx.closePath()
      }
      ctx.fillStyle = trim
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x - half, base)
      ctx.lineTo(tipX, tipY)
      ctx.lineTo(x + half, base)
      ctx.closePath()
      ctx.lineJoin = 'round'
      ink(ctx)
      orb(ctx, tipX, tipY, r * 0.2, r * 0.2, trim, false)
      return
    }
    case 'straw': {
      const brim = y - r * 0.5
      const cx = x + lean
      ellipsePath(ctx, cx, brim, r * 1.55, r * 0.36)
      fillInk(ctx, colour)
      ctx.beginPath()
      domeSub(ctx, cx, brim, r * 0.82, r * 0.62)
      fillInk(ctx, colour)
      ctx.beginPath()
      ctx.roundRect(cx - r * 0.82, brim - r * 0.24, r * 1.64, r * 0.2, r * 0.05)
      fillInk(ctx, trim, O * 0.8)
      return
    }
    case 'crown': {
      const base = y - r * 0.62
      const cx = x + lean
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.66, base)
      ctx.lineTo(cx - r * 0.72, base - r * 0.62)
      ctx.lineTo(cx - r * 0.36, base - r * 0.32)
      ctx.lineTo(cx, base - r * 0.78)
      ctx.lineTo(cx + r * 0.36, base - r * 0.32)
      ctx.lineTo(cx + r * 0.72, base - r * 0.62)
      ctx.lineTo(cx + r * 0.66, base)
      ctx.closePath()
      ctx.lineJoin = 'round'
      fillInk(ctx, colour)
      blobs(
        ctx,
        [
          [cx - r * 0.72, base - r * 0.64],
          [cx, base - r * 0.8],
          [cx + r * 0.72, base - r * 0.64],
        ],
        r * 0.1,
        r * 0.1,
        trim,
        O * 0.6,
      )
      return
    }
    case 'bow': {
      const bx = x + r * 0.5
      const by = y - r * 0.82
      ctx.beginPath()
      for (const side of [-1, 1]) {
        ctx.moveTo(bx, by)
        ctx.lineTo(bx + side * r * 0.48, by - r * 0.3)
        ctx.lineTo(bx + side * r * 0.48, by + r * 0.3)
        ctx.closePath()
      }
      ctx.lineJoin = 'round'
      fillInk(ctx, colour)
      ellipsePath(ctx, bx, by, r * 0.13, r * 0.13)
      fillInk(ctx, trim, O * 0.7)
      return
    }
    case 'flower': {
      const fx = x + r * 0.62
      const fy = y - r * 0.72
      const petals: Pt[] = []
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU - Math.PI / 2
        petals.push([fx + Math.cos(a) * r * 0.26, fy + Math.sin(a) * r * 0.26])
      }
      blobs(ctx, petals, r * 0.2, r * 0.2, colour, O * 0.7)
      ellipsePath(ctx, fx, fy, r * 0.16, r * 0.16)
      fillInk(ctx, trim, O * 0.7)
      return
    }
    case 'headphones': {
      ctx.beginPath()
      ctx.arc(x, y - r * 0.05, r * 1.08, Math.PI * 1.08, Math.PI * 1.92)
      ctx.lineCap = 'round'
      ctx.strokeStyle = INK
      ctx.lineWidth = r * 0.24 + O * 1.6
      ctx.stroke()
      ctx.strokeStyle = colour
      ctx.lineWidth = r * 0.24
      ctx.stroke()
      ctx.beginPath()
      for (const side of [-1, 1]) ctx.roundRect(x + side * r * 1.02 - r * 0.2, y - r * 0.32, r * 0.4, r * 0.62, r * 0.16)
      fillInk(ctx, trim)
      return
    }
    default:
      return
  }
}

// ------------------------------------------------------------------ antennae

function antennae(ctx: Ctx, head: HeadSpec, colour: string, facing: number, kind: 'bob' | 'elbow' | 'curl' | 'long') {
  const { x, y, r } = head
  const shift = facing * r * 0.25
  const tips: Pt[] = []
  ctx.beginPath()
  for (const side of [-1, 1]) {
    const fx = x + side * r * 0.34 + shift * 0.4
    const fy = y - r * 0.8
    let bend: Pt
    let tip: Pt
    if (kind === 'elbow') {
      bend = [x + side * r * 0.5 + shift, y - r * 1.55]
      tip = [x + side * r * 1.15 + shift, y - r * 1.62]
    } else if (kind === 'long') {
      bend = [x + side * r * 0.5 + shift, y - r * 1.9]
      tip = [x + side * r * 1.5 + shift, y - r * 2.3]
    } else if (kind === 'curl') {
      bend = [x + side * r * 0.45 + shift, y - r * 1.35]
      tip = [x + side * r * 0.9 + shift, y - r * 1.38]
    } else {
      bend = [x + side * r * 0.45 + shift, y - r * 1.5]
      tip = [x + side * r * 0.95 + shift, y - r * 1.62]
    }
    ctx.moveTo(fx, fy)
    ctx.quadraticCurveTo(bend[0], bend[1], tip[0], tip[1])
    if (kind === 'curl') {
      const cx = tip[0] + side * r * 0.1
      const cy = tip[1] + r * 0.12
      ctx.moveTo(cx + r * 0.13 * Math.cos(Math.PI * 1.2), cy + r * 0.13 * Math.sin(Math.PI * 1.2))
      ctx.arc(cx, cy, r * 0.13, Math.PI * 1.2, Math.PI * 2.4)
    }
    tips.push(tip)
  }
  ctx.lineCap = 'round'
  ink(ctx, O * 1.25)
  if (kind !== 'curl') blobs(ctx, tips, r * 0.15, r * 0.15, colour, O * 0.75)
}

// -------------------------------------------------------------- held things

function drawHeldUp(ctx: Ctx, at: Pt, look: Look) {
  const [hx, hy] = at
  const colour = look.heldColour
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (look.held) {
    case 'balloon': {
      ctx.beginPath()
      ctx.moveTo(hx, hy)
      ctx.quadraticCurveTo(hx + 0.08, hy - 0.22, hx + 0.02, hy - 0.42)
      ink(ctx, O * 0.7)
      orb(ctx, hx + 0.02, hy - 0.58, 0.14, 0.17, colour)
      ctx.beginPath()
      ctx.moveTo(hx - 0.02, hy - 0.4)
      ctx.lineTo(hx + 0.06, hy - 0.4)
      ctx.lineTo(hx + 0.02, hy - 0.43)
      ctx.closePath()
      fillInk(ctx, colour, O * 0.6)
      return
    }
    case 'icecream': {
      ctx.beginPath()
      ctx.moveTo(hx - 0.06, hy - 0.08)
      ctx.lineTo(hx, hy + 0.06)
      ctx.lineTo(hx + 0.06, hy - 0.08)
      ctx.closePath()
      fillInk(ctx, '#e0a458', O * 0.8)
      ellipsePath(ctx, hx, hy - 0.13, 0.075, 0.07)
      fillInk(ctx, colour, O * 0.8)
      ellipsePath(ctx, hx + 0.01, hy - 0.2, 0.014, 0.014)
      ctx.fillStyle = RED
      ctx.fill()
      return
    }
    case 'flag': {
      ctx.beginPath()
      ctx.moveTo(hx, hy + 0.05)
      ctx.lineTo(hx, hy - 0.36)
      ink(ctx, O * 1.4)
      ctx.beginPath()
      ctx.moveTo(hx, hy - 0.36)
      ctx.lineTo(hx + 0.22, hy - 0.3)
      ctx.lineTo(hx, hy - 0.22)
      ctx.closePath()
      fillInk(ctx, colour, O * 0.8)
      return
    }
    case 'lollipop': {
      ctx.beginPath()
      ctx.moveTo(hx, hy + 0.04)
      ctx.lineTo(hx, hy - 0.2)
      ctx.strokeStyle = '#f2ece0'
      ctx.lineWidth = O * 0.9
      ctx.stroke()
      ellipsePath(ctx, hx, hy - 0.26, 0.085, 0.085)
      fillInk(ctx, colour, O * 0.8)
      ctx.beginPath()
      ctx.arc(hx, hy - 0.26, 0.045, 0, Math.PI * 1.5)
      ctx.strokeStyle = WHITE
      ctx.lineWidth = O * 0.8
      ctx.stroke()
      return
    }
    case 'token': {
      ellipsePath(ctx, hx, hy - 0.06, 0.07, 0.07)
      fillInk(ctx, '#f1b93a', O * 0.8)
      ellipsePath(ctx, hx, hy - 0.06, 0.036, 0.036)
      ctx.strokeStyle = '#b57a18'
      ctx.lineWidth = O * 0.6
      ctx.stroke()
      return
    }
    case 'drink': {
      ctx.beginPath()
      ctx.moveTo(hx - 0.055, hy - 0.16)
      ctx.lineTo(hx + 0.055, hy - 0.16)
      ctx.lineTo(hx + 0.04, hy + 0.02)
      ctx.lineTo(hx - 0.04, hy + 0.02)
      ctx.closePath()
      ctx.moveTo(hx + 0.01, hy - 0.16)
      ctx.lineTo(hx + 0.04, hy - 0.28)
      fillInk(ctx, colour, O * 0.8)
      return
    }
    case 'lantern': {
      ctx.beginPath()
      ctx.moveTo(hx, hy + 0.04)
      ctx.lineTo(hx, hy - 0.2)
      ink(ctx, O)
      ellipsePath(ctx, hx, hy - 0.3, 0.085, 0.1)
      fillInk(ctx, colour, O * 0.8)
      ctx.fillStyle = 'rgba(255, 244, 200, 0.75)'
      ellipsePath(ctx, hx, hy - 0.3, 0.04, 0.06)
      ctx.fill()
      return
    }
    case 'spade': {
      ctx.beginPath()
      ctx.moveTo(hx, hy + 0.05)
      ctx.lineTo(hx, hy - 0.24)
      ink(ctx, O * 1.6)
      ctx.beginPath()
      ctx.moveTo(hx - 0.07, hy - 0.22)
      ctx.lineTo(hx + 0.07, hy - 0.22)
      ctx.lineTo(hx + 0.05, hy - 0.38)
      ctx.quadraticCurveTo(hx, hy - 0.44, hx - 0.05, hy - 0.38)
      ctx.closePath()
      fillInk(ctx, colour, O * 0.8)
      return
    }
    default:
      return
  }
}

/** Held over the head in both hands: a crumb, a leaf for shade, a prize. */
function drawCarried(ctx: Ctx, cx: number, cy: number, look: Look) {
  const colour = look.heldColour
  if (look.held === 'crumb') {
    ctx.beginPath()
    ctx.moveTo(cx - 0.2, cy + 0.05)
    ctx.lineTo(cx - 0.16, cy - 0.1)
    ctx.lineTo(cx - 0.02, cy - 0.15)
    ctx.lineTo(cx + 0.14, cy - 0.12)
    ctx.lineTo(cx + 0.21, cy + 0.02)
    ctx.lineTo(cx + 0.08, cy + 0.08)
    ctx.closePath()
    ctx.lineJoin = 'round'
    fillInk(ctx, colour)
    if (fine) {
      ctx.beginPath()
      for (const [dx, dy] of [[-0.08, -0.04], [0.06, -0.06], [0.1, 0.02]] as const) ellipseSub(ctx, cx + dx, cy + dy, 0.018, 0.014)
      ctx.fillStyle = 'rgba(120, 70, 20, 0.35)'
      ctx.fill()
    }
    return
  }
  if (look.held === 'leaf') {
    ctx.beginPath()
    ctx.moveTo(cx - 0.34, cy + 0.04)
    ctx.quadraticCurveTo(cx - 0.1, cy - 0.28, cx + 0.34, cy - 0.02)
    ctx.quadraticCurveTo(cx + 0.02, cy + 0.14, cx - 0.34, cy + 0.04)
    ctx.closePath()
    fillInk(ctx, colour)
    ctx.beginPath()
    ctx.moveTo(cx - 0.3, cy + 0.03)
    ctx.quadraticCurveTo(cx, cy - 0.06, cx + 0.3, cy - 0.02)
    ctx.strokeStyle = 'rgba(30, 60, 20, 0.45)'
    ctx.lineWidth = O * 0.8
    ctx.stroke()
    return
  }
  if (look.held === 'plush') {
    blobs(
      ctx,
      [
        [cx - 0.1, cy - 0.13],
        [cx + 0.1, cy - 0.13],
      ],
      0.05,
      0.05,
      colour,
      O * 0.7,
    )
    orb(ctx, cx, cy - 0.02, 0.15, 0.13, colour)
    blobs(
      ctx,
      [
        [cx - 0.05, cy - 0.03],
        [cx + 0.05, cy - 0.03],
      ],
      0.017,
      0.017,
      INK,
      0,
    )
  }
}

function drawTube(ctx: Ctx, cy: number, look: Look) {
  const rx = 0.4
  const ry = 0.13
  const irx = rx * 0.55
  const iry = ry * 0.4
  ctx.beginPath()
  ellipseSub(ctx, 0, cy, rx, ry)
  ellipseSub(ctx, 0, cy, irx, iry)
  ctx.fillStyle = look.heldColour
  ctx.fill('evenodd')
  // Candy stripes round the ring: each one a slice between the two rims.
  ctx.beginPath()
  for (let k = 0; k < 8; k += 2) {
    const a0 = (k / 8) * TAU
    const a1 = ((k + 1) / 8) * TAU
    ctx.moveTo(rx * Math.cos(a0), cy + ry * Math.sin(a0))
    ctx.ellipse(0, cy, rx, ry, 0, a0, a1, false)
    ctx.lineTo(irx * Math.cos(a1), cy + iry * Math.sin(a1))
    ctx.ellipse(0, cy, irx, iry, 0, a1, a0, true)
    ctx.closePath()
  }
  ctx.fillStyle = WHITE
  ctx.fill()
  ctx.beginPath()
  ellipseSub(ctx, 0, cy, rx, ry)
  ellipseSub(ctx, 0, cy, irx, iry)
  ink(ctx, O * 0.9)
}

// ------------------------------------------------------------------- arms

type Arms = { left: [Pt, Pt]; right: [Pt, Pt] }

/**
 * Elbow and hand for each arm, relative to the shoulder, per pose. Written for
 * the right arm (positive x) and mirrored for the left.
 */
function armsFor(pose: Pose, held: Held): Arms {
  const down: [Pt, Pt] = [[0.1, 0.1], [0.08, 0.2]]
  const up: [Pt, Pt] = [[0.14, -0.08], [0.15, -0.26]]
  const raise: [Pt, Pt] = [[0.14, 0.04], [0.15, -0.08]]
  const front: [Pt, Pt] = [[0.1, 0.12], [-0.06, 0.16]]

  const oneHanded = held !== 'none' && held !== 'crumb' && held !== 'leaf' && held !== 'plush' && held !== 'tube'
  if (oneHanded) {
    const other: [Pt, Pt] = pose === 'cheer' ? up : down
    return { left: other, right: raise }
  }
  switch (pose) {
    case 'wave':
      return { left: down, right: up }
    case 'cheer':
      return { left: up, right: up }
    case 'hold':
      return { left: front, right: front }
    case 'walk':
      return { left: [[0.06, 0.12], [0.0, 0.2]], right: [[0.14, 0.06], [0.17, 0.14]] }
    default:
      return { left: down, right: down }
  }
}

type Frame = {
  head: HeadSpec
  shoulderX: number
  shoulderY: number
  armW: number
}

function drawUpperArms(ctx: Ctx, c: Critter, f: Frame): { right: Pt; left: Pt } {
  const segs: Limb[] = []
  let left: Pt = [0, 0]
  let right: Pt = [0, 0]
  if (c.pose === 'carry') {
    // Carrying something overhead: the hands go up past the sides of the head,
    // wherever the shoulders are, or a narrow ant's hands vanish behind it.
    const top = f.head.y - f.head.r - 0.07
    for (const side of [-1, 1] as const) {
      const s: Pt = [side * f.shoulderX, f.shoulderY]
      const h: Pt = [side * f.head.r * 0.92, top]
      const b: Pt = [side * (f.head.r + 0.13), f.shoulderY - 0.16]
      segs.push([s, b, h])
      if (side === 1) right = h
      else left = h
    }
  } else {
    const arms = armsFor(c.pose, c.look.held)
    for (const side of [-1, 1] as const) {
      const [bend, reach] = side === 1 ? arms.right : arms.left
      const s: Pt = [side * f.shoulderX, f.shoulderY]
      const b: Pt = [s[0] + side * bend[0], s[1] + bend[1]]
      const h: Pt = [s[0] + side * reach[0], s[1] + reach[1]]
      segs.push([s, b, h])
      if (side === 1) right = h
      else left = h
    }
  }
  limbs(ctx, segs, c.look.limb, f.armW)
  blobs(ctx, [left, right], 0.038, 0.038, c.look.limb)
  return { left, right }
}

function drawLegs(ctx: Ctx, c: Critter, hipX: number, hipY: number, w: number) {
  const walking = c.pose === 'walk'
  const sitting = c.pose === 'sit'
  const segs: Limb[] = []
  const feet: Pt[] = []
  for (const side of [-1, 1]) {
    const lift = walking && side === 1 ? 0.05 : 0
    const footX = side * (sitting ? hipX + 0.1 : hipX + 0.03)
    segs.push([[side * hipX, hipY], [side * (hipX + 0.02), -0.05 - lift], [footX, -0.03 - lift]])
    feet.push([footX + side * 0.02, -0.028 - lift])
  }
  limbs(ctx, segs, c.look.limb, w)
  blobs(ctx, feet, 0.068, 0.036, c.look.limb)
}

/** The second pair of arms, tucked behind the body: what makes a figure a bug. */
function drawBackArms(ctx: Ctx, c: Critter, x: number, y: number, w: number) {
  limbs(
    ctx,
    [
      [[-x, y], [-(x + 0.1), y + 0.04], [-(x + 0.11), y + 0.13]],
      [[x, y], [x + 0.1, y + 0.04], [x + 0.11, y + 0.13]],
    ],
    c.look.limb,
    w,
  )
}

function drawScarf(ctx: Ctx, y: number, colour: string) {
  ctx.beginPath()
  ctx.roundRect(-0.2, y - 0.045, 0.4, 0.09, 0.045)
  ctx.roundRect(0.06, y, 0.08, 0.2, 0.03)
  fillInk(ctx, colour)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.fillRect(0.065, y + 0.12, 0.07, 0.025)
}

// ---------------------------------------------------------------- species

function beetleShell(ctx: Ctx, look: Look, x: number, y: number, rx: number, ry: number) {
  ellipsePath(ctx, x, y, rx, ry)
  ctx.fillStyle = look.body
  ctx.fill()

  if (look.pattern !== 'plain') {
    ctx.beginPath()
    if (look.pattern === 'stripes') {
      const top = y - ry
      const band = (ry * 2) / 5
      for (const k of [1, 3]) bandSub(ctx, x, y, rx, ry, top + band * k, top + band * (k + 1))
    } else if (look.pattern === 'spots') {
      const spots: [number, number, number][] = [
        [-0.46, -0.4, 0.2],
        [0.46, -0.4, 0.2],
        [-0.56, 0.12, 0.18],
        [0.56, 0.12, 0.18],
        [-0.22, 0.56, 0.16],
        [0.22, 0.56, 0.16],
      ]
      for (const [sx, sy, sr] of spots) ellipseSub(ctx, x + sx * rx, y + sy * ry, sr * rx, sr * rx)
    } else {
      for (let k = 0; k < 11; k++) {
        const a = k * 2.39996
        const d = Math.sqrt((k + 0.5) / 11) * 0.8
        ellipseSub(ctx, x + Math.cos(a) * d * rx, y + Math.sin(a) * d * ry, rx * 0.09, rx * 0.09)
      }
    }
    ctx.fillStyle = look.trim
    ctx.fill()
  }

  crescent(ctx, x, y, rx, ry)
  ellipsePath(ctx, x, y, rx, ry)
  // The split between the wing cases goes out with the outline.
  ctx.moveTo(x, y - ry * 0.98)
  ctx.lineTo(x, y + ry * 0.88)
  ink(ctx)
  gloss(ctx, x - rx * 0.1, y, rx * 0.9, ry)
}

function drawBiped(ctx: Ctx, c: Critter, facing: number) {
  const look = c.look
  const sp = look.species

  let head: HeadSpec = { x: 0, y: -0.63, r: 0.235 }
  let shoulderY = -0.43
  let shoulderX = 0.2
  let hipX = 0.1
  let armW = 0.052
  let antenna: 'bob' | 'elbow' | 'curl' | 'long' = 'bob'
  let neckY = -0.45

  if (sp === 'ant') {
    head = { x: 0, y: -0.65, r: 0.225 }
    shoulderX = 0.08
    hipX = 0.07
    armW = 0.04
    antenna = 'elbow'
    neckY = -0.47
  } else if (sp === 'bee') {
    head = { x: 0, y: -0.66, r: 0.225 }
    shoulderY = -0.45
    shoulderX = 0.19
    antenna = 'curl'
  } else if (sp === 'grasshopper') {
    head = { x: 0, y: -0.7, r: 0.215 }
    shoulderY = -0.5
    shoulderX = 0.13
    hipX = 0.08
    armW = 0.042
    antenna = 'long'
    neckY = -0.5
  } else if (sp === 'butterfly') {
    head = { x: 0, y: -0.64, r: 0.2 }
    shoulderY = -0.46
    shoulderX = 0.07
    hipX = 0.05
    armW = 0.036
    antenna = 'long'
    neckY = -0.46
  }

  // Wings sit behind everything else.
  if (sp === 'bee') {
    ctx.beginPath()
    for (const side of [-1, 1]) ellipseSub(ctx, side * 0.27, -0.6, 0.2, 0.12, side * -0.55)
    ctx.fillStyle = 'rgba(214, 238, 255, 0.78)'
    ctx.fill()
    ink(ctx, O * 0.8)
  } else if (sp === 'butterfly') {
    ctx.beginPath()
    for (const side of [-1, 1]) ellipseSub(ctx, side * 0.23, -0.25, 0.2, 0.16, side * 0.55)
    fillInk(ctx, look.trim)
    ctx.beginPath()
    for (const side of [-1, 1]) ellipseSub(ctx, side * 0.3, -0.52, 0.3, 0.22, side * -0.4)
    ctx.fillStyle = look.body
    ctx.fill()
    for (const side of [-1, 1]) crescent(ctx, side * 0.3, -0.52, 0.3, 0.22, side * -0.4, SHADE_SOFT)
    ctx.beginPath()
    for (const side of [-1, 1]) ellipseSub(ctx, side * 0.3, -0.52, 0.3, 0.22, side * -0.4)
    ink(ctx)
    blobs(
      ctx,
      [
        [-0.38, -0.56],
        [0.38, -0.56],
      ],
      0.085,
      0.085,
      look.trim,
      O * 0.7,
    )
    if (fine) blobs(ctx, [[-0.38, -0.56], [0.38, -0.56]], 0.035, 0.035, WHITE, 0)
  }

  // Grasshoppers fold their big jumping legs at their sides.
  if (sp === 'grasshopper') {
    limbs(
      ctx,
      [
        [[-0.12, -0.3], [-0.36, -0.62], [-0.3, -0.02]],
        [[0.12, -0.3], [0.36, -0.62], [0.3, -0.02]],
      ],
      look.limb,
      0.07,
    )
    blobs(ctx, [[-0.32, -0.028], [0.32, -0.028]], 0.068, 0.036, look.limb)
  }

  if (sp === 'beetle' || sp === 'bee') drawBackArms(ctx, c, 0.25, -0.27, armW * 0.85)
  if (sp === 'ant') drawBackArms(ctx, c, 0.09, -0.4, armW * 0.9)

  drawLegs(ctx, c, hipX, sp === 'ant' ? -0.12 : -0.1, armW)

  if (sp === 'beetle') {
    beetleShell(ctx, look, 0, -0.27, 0.29, 0.26)
  } else if (sp === 'ant') {
    orb(ctx, 0, -0.2, 0.2, 0.165, look.body)
    orb(ctx, 0, -0.42, 0.105, 0.09, look.body, false)
  } else if (sp === 'bee') {
    const by = -0.29
    ellipsePath(ctx, 0, by, 0.26, 0.27)
    ctx.fillStyle = look.body
    ctx.fill()
    ctx.beginPath()
    bandSub(ctx, 0, by, 0.26, 0.27, -0.36, -0.285)
    bandSub(ctx, 0, by, 0.26, 0.27, -0.2, -0.125)
    ctx.fillStyle = look.trim
    ctx.fill()
    crescent(ctx, 0, by, 0.26, 0.27)
    ellipsePath(ctx, 0, by, 0.26, 0.27)
    ink(ctx)
    if (fine) {
      gloss(ctx, 0, by, 0.26, 0.27, 0.4)
      // Fuzz on the shoulders.
      ctx.beginPath()
      for (const k of [-0.13, -0.04, 0.05, 0.14]) {
        ctx.moveTo(k - 0.035, -0.54)
        ctx.arc(k, -0.54, 0.035, Math.PI, TAU)
      }
      ink(ctx, O * 0.8)
    }
  } else if (sp === 'grasshopper') {
    orb(ctx, 0, -0.33, 0.15, 0.25, look.body)
    if (fine) {
      ctx.beginPath()
      for (const k of [-0.25, -0.15, -0.05]) {
        ctx.moveTo(-0.12, k - 0.14)
        ctx.quadraticCurveTo(0, k - 0.1, 0.12, k - 0.14)
      }
      ctx.strokeStyle = 'rgba(42, 20, 64, 0.3)'
      ctx.lineWidth = O * 0.7
      ctx.stroke()
    }
  } else if (sp === 'butterfly') {
    ctx.beginPath()
    ctx.roundRect(-0.06, -0.5, 0.12, 0.44, 0.06)
    fillInk(ctx, look.limb)
  }

  if (look.held === 'tube') drawTube(ctx, -0.2, look)
  if (look.scarf) drawScarf(ctx, neckY, look.scarf)

  const hands = drawUpperArms(ctx, c, { head, shoulderX, shoulderY, armW })

  antennae(ctx, head, look.limb, facing, antenna)
  orb(ctx, head.x, head.y, head.r, head.r * (sp === 'grasshopper' ? 1.08 : 1), look.head)
  drawFace(ctx, head, c, facing)
  drawHat(ctx, head, look, facing)

  if (c.pose === 'carry') {
    drawCarried(ctx, (hands.left[0] + hands.right[0]) / 2, Math.min(hands.left[1], hands.right[1]) - 0.06, look)
  } else if (look.held !== 'none' && look.held !== 'tube') {
    drawHeldUp(ctx, hands.right, look)
  }
}

function drawSpider(ctx: Ctx, c: Critter, facing: number) {
  const look = c.look
  const segs: Limb[] = []
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const y0 = -0.5 + k * 0.08
      segs.push([
        [side * 0.18, y0],
        [side * (0.44 + k * 0.03), y0 - 0.2 + k * 0.03],
        [side * (0.44 + k * 0.05), -0.04 - (3 - k) * 0.02],
      ])
    }
  }
  limbs(ctx, segs, look.limb, 0.036)
  orb(ctx, 0, -0.4, 0.3, 0.3, look.body)
  ctx.fillStyle = look.trim
  ellipsePath(ctx, 0, -0.62, 0.1, 0.045)
  ctx.fill()
  drawFace(ctx, { x: 0, y: -0.42, r: 0.25 }, c, facing)
  // Two little eyes over the big two.
  blobs(
    ctx,
    [
      [-0.07 + facing * 0.05, -0.56],
      [0.07 + facing * 0.05, -0.56],
    ],
    0.025,
    0.025,
    INK,
    0,
  )
  drawHat(ctx, { x: 0, y: -0.5, r: 0.25 }, look, facing)
}

function drawCaterpillar(ctx: Ctx, c: Critter) {
  const look = c.look
  // Body trails off behind the head: back segments first so the front ones overlap.
  const feet: Pt[] = []
  for (let k = 0; k < 5; k++) {
    const sx = -0.16 + k * 0.17
    feet.push([sx - 0.05, -0.02], [sx + 0.05, -0.02])
  }
  blobs(ctx, feet, 0.026, 0.02, INK, 0)
  for (let k = 4; k >= 0; k--) {
    const sx = -0.16 + k * 0.17
    const sy = -0.15 - (k % 2) * 0.035
    const r = 0.15 - k * 0.006
    ellipsePath(ctx, sx, sy, r, r)
    ctx.fillStyle = k % 2 === 0 ? look.body : look.trim
    ctx.fill()
    crescent(ctx, sx, sy, r, r)
    ellipsePath(ctx, sx, sy, r, r)
    ink(ctx)
  }
  const head: HeadSpec = { x: -0.36, y: -0.36, r: 0.22 }
  antennae(ctx, head, look.limb, 0, 'bob')
  orb(ctx, head.x, head.y, head.r, head.r, look.head)
  drawFace(ctx, head, c, 0)
  drawHat(ctx, head, look, 0)
}

function drawSnail(ctx: Ctx, c: Critter) {
  const look = c.look
  // The foot, a long soft blob along the ground.
  ctx.beginPath()
  ctx.moveTo(-0.46, -0.02)
  ctx.quadraticCurveTo(-0.5, -0.16, -0.36, -0.2)
  ctx.lineTo(-0.3, -0.52)
  ctx.quadraticCurveTo(-0.2, -0.56, -0.16, -0.46)
  ctx.lineTo(-0.1, -0.14)
  ctx.lineTo(0.4, -0.08)
  ctx.quadraticCurveTo(0.5, -0.04, 0.44, -0.01)
  ctx.closePath()
  ctx.lineJoin = 'round'
  fillInk(ctx, look.head)

  // Eye stalks.
  const stalks: Limb[] = [
    [[-0.29, -0.5], [-0.31, -0.66], [-0.4, -0.8]],
    [[-0.2, -0.5], [-0.22, -0.66], [-0.14, -0.84]],
  ]
  limbs(ctx, stalks, look.head, 0.035)
  blobs(
    ctx,
    [
      [-0.4, -0.8],
      [-0.14, -0.84],
    ],
    0.07,
    0.075,
    '#ffffff',
    O * 0.7,
  )
  blobs(
    ctx,
    [
      [-0.41 + c.gazeX * 0.02, -0.79],
      [-0.15 + c.gazeX * 0.02, -0.83],
    ],
    0.035,
    0.04,
    INK,
    0,
  )
  ctx.beginPath()
  ctx.arc(-0.3, -0.34, 0.05, 0.1 * Math.PI, 0.9 * Math.PI)
  ink(ctx, O * 0.8)

  // Shell, with its spiral.
  orb(ctx, 0.12, -0.33, 0.28, 0.27, look.body)
  ctx.beginPath()
  for (let k = 0; k <= 32; k++) {
    const t = k / 32
    const a = t * Math.PI * 3.4
    const r = 0.22 * (1 - t * 0.85)
    const px = 0.13 + Math.cos(a) * r
    const py = -0.33 + Math.sin(a) * r * 0.96
    if (k === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.strokeStyle = look.trim
  ctx.lineWidth = O * 1.5
  ctx.lineCap = 'round'
  ctx.stroke()

  if (look.hat !== 'none') drawHat(ctx, { x: 0.12, y: -0.44, r: 0.2 }, look, 0)
}

function drawWorm(ctx: Ctx, c: Critter, facing: number) {
  const look = c.look
  ellipsePath(ctx, 0, -0.03, 0.27, 0.075)
  fillInk(ctx, '#4a3326')
  ellipsePath(ctx, 0, -0.035, 0.19, 0.045)
  ctx.fillStyle = '#20150f'
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(-0.1, -0.04)
  ctx.quadraticCurveTo(-0.14, -0.3, 0.02, -0.46)
  ctx.lineTo(0.14, -0.4)
  ctx.quadraticCurveTo(0.06, -0.26, 0.1, -0.04)
  ctx.closePath()
  fillInk(ctx, look.body)
  if (fine) {
    ctx.beginPath()
    for (const k of [-0.12, -0.2, -0.28]) {
      ctx.moveTo(-0.1, k)
      ctx.quadraticCurveTo(0, k + 0.03, 0.09, k - 0.01)
    }
    ctx.strokeStyle = 'rgba(42, 20, 64, 0.25)'
    ctx.lineWidth = O * 0.8
    ctx.stroke()
  }
  const head: HeadSpec = { x: 0.04, y: -0.56, r: 0.19 }
  orb(ctx, head.x, head.y, head.r, head.r, look.head)
  drawFace(ctx, head, c, facing)
  drawHat(ctx, head, look, facing)
}

// ------------------------------------------------------------------ drawing

/** Shadow on the ground under a critter, left behind when it flies. */
function groundShadow(ctx: Ctx, c: Critter) {
  const wide = c.look.species === 'snail' || c.look.species === 'caterpillar' ? 1.5 : 1
  const fade = 1 / (1 + c.lift * 1.6)
  ctx.fillStyle = c.lift === 0 ? 'rgba(20, 10, 40, 0.22)' : `rgba(20, 10, 40, ${0.22 * fade})`
  ellipsePath(ctx, 0, 0, 0.32 * wide * (0.7 + fade * 0.3), 0.07 * (0.7 + fade * 0.3))
  ctx.fill()
}

export function drawCritter(ctx: Ctx, c: Critter) {
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.scale(c.flip ? -c.size : c.size, c.size)
  // How many device pixels tall this critter is, to decide on fine detail.
  const m = ctx.getTransform()
  fine = Math.hypot(m.b, m.d) > 64
  groundShadow(ctx, c)
  if (c.lift > 0) ctx.translate(0, -c.lift)
  const facing = c.facing

  switch (c.look.species) {
    case 'spider':
      drawSpider(ctx, c, facing)
      break
    case 'caterpillar':
      drawCaterpillar(ctx, c)
      break
    case 'snail':
      drawSnail(ctx, c)
      break
    case 'worm':
      drawWorm(ctx, c, facing)
      break
    default:
      drawBiped(ctx, c, facing)
  }
  ctx.restore()
}

/**
 * Where the face is, in world units. A tap near it is a tap on the critter,
 * and it is the part that has to stay in view when something stands in front.
 */
export function faceCentre(c: Critter): { x: number; y: number } {
  const sp = c.look.species
  let fx = 0
  let fy = -0.62
  if (sp === 'caterpillar') {
    fx = -0.36
    fy = -0.4
  } else if (sp === 'snail') {
    fx = -0.1
    fy = -0.5
  } else if (sp === 'spider') {
    fy = -0.44
  } else if (sp === 'worm') {
    fx = 0.04
    fy = -0.56
  }
  return {
    x: c.x + (c.flip ? -fx : fx) * c.size,
    y: c.y + (fy - c.lift) * c.size,
  }
}

/** A loose box round the whole critter, for culling and overlap checks. */
export function critterBounds(c: Critter): { x0: number; y0: number; x1: number; y1: number } {
  const s = c.size
  const sp = c.look.species
  const wide = sp === 'snail' || sp === 'caterpillar' || sp === 'spider' || sp === 'butterfly'
  const halfW = (wide ? 0.62 : 0.46) * s
  const top = (c.look.held === 'balloon' ? 1.45 : 1.15) * s + c.lift * s
  return { x0: c.x - halfW, y0: c.y - top, x1: c.x + halfW, y1: c.y + 0.06 * s }
}

/** Draw a critter centred in a box, for the portrait on the wanted card. */
export function drawPortrait(
  ctx: Ctx,
  look: Look,
  cx: number,
  cy: number,
  height: number,
  opts: { pose?: Pose; mood?: Mood } = {},
) {
  drawCritter(ctx, {
    id: -1,
    x: cx,
    y: cy + height * 0.52,
    size: height,
    look,
    pose: opts.pose ?? 'wave',
    facing: 0,
    flip: false,
    gazeX: 0,
    gazeY: 0.2,
    mood: opts.mood ?? 'smile',
    lift: 0,
    z: 0,
  })
}
