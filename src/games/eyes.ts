/**
 * The one pair of eyes the arcade's creatures wear.
 *
 * Snake's head and Crosswalk's hopper had arrived at opposite answers: Snake
 * drew a white eye with a dark pupil sitting inside it, the hopper drew a dark
 * dot with a white glint sitting off to one side of it. Same two colours,
 * inverted — so the two animals read as coming from different hands.
 *
 * The geometry below is Snake's, down to the four facings. Snake has since
 * grown its own eyes for its new head, and they gained a ring round the white,
 * a glint on the pupil, a look toward what it is after, a blink and a pair of
 * X's for a crash. The same moves live here, at Snake's proportions, so the
 * hopper keeps wearing the pair it was given.
 *
 * Offsets are in half-widths and half-heights of the creature, so the same
 * numbers land correctly on a rounded square and on an ellipse. The eye's own
 * radius is passed in rather than derived: a body that squashes and stretches
 * should not have its pupils squash with it.
 */

/** Which way the face is pointing. */
export type Facing = 'up' | 'down' | 'left' | 'right'

const WHITE = '#fff'
const PUPIL = '#1a2b3c'
const TAU = Math.PI * 2

/** How much of the white the pupil takes up. */
const PUPIL_RATIO = 0.5
/** How far a looking pupil slides off centre, in radii of the white. */
const LOOK_SHIFT = 0.36

/**
 * Where the two eyes sit, in half-widths and half-heights from the centre.
 * These are Snake's hand-tuned figures, which is why they are not symmetric:
 * a face looking down shows more of itself than one looking away.
 */
const PLACEMENT: Record<Facing, [[number, number], [number, number]]> = {
  up: [
    [-0.36, -0.3],
    [0.36, -0.3],
  ],
  down: [
    [-0.36, 0.36],
    [0.36, 0.36],
  ],
  left: [
    [-0.44, -0.36],
    [-0.44, 0.36],
  ],
  right: [
    [0.44, -0.36],
    [0.44, 0.36],
  ],
}

export type EyeOpts = {
  /** Centre of the creature. */
  x: number
  y: number
  /** Half-width and half-height of the body the eyes sit on. */
  rx: number
  ry: number
  /** Radius of the white. The pupil is a fixed fraction of it. */
  radius: number
  facing?: Facing
  /**
   * Which way the pupils look. Any length from one up looks all the way; a
   * shorter one looks only that fraction of the way. Centred without one.
   */
  look?: { x: number; y: number }
  /**
   * The body's outline colour, ringed round each white — and the line a closed
   * eye becomes. Without it the whites are drawn bare.
   */
  line?: string
  /** Mid-blink: each eye shut to a line. */
  closed?: boolean
  /** Crossed out in this colour: a crash. */
  dead?: string
}

/** Draws both eyes: a white disc with a dark pupil inside it. */
export function drawEyes(ctx: CanvasRenderingContext2D, opts: EyeOpts) {
  const { x, y, rx, ry, radius, facing = 'up', look, line, closed = false, dead } = opts
  const eyes = PLACEMENT[facing].map(([ox, oy]) => [x + ox * rx, y + oy * ry] as const)

  // Round ends for the strokes below, handed back afterwards: a canvas keeps
  // its settings from one frame to the next, so a cap left behind reshapes
  // every dashed line drawn after it.
  const cap = ctx.lineCap

  if (dead) {
    const k = radius * 0.72
    ctx.strokeStyle = dead
    ctx.lineWidth = Math.max(1.4, radius * 0.42)
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (const [ex, ey] of eyes) {
      ctx.moveTo(ex - k, ey - k)
      ctx.lineTo(ex + k, ey + k)
      ctx.moveTo(ex + k, ey - k)
      ctx.lineTo(ex - k, ey + k)
    }
    ctx.stroke()
    ctx.lineCap = cap
    return
  }

  if (closed) {
    ctx.strokeStyle = line ?? PUPIL
    ctx.lineWidth = Math.max(1, radius * 0.3)
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (const [ex, ey] of eyes) {
      ctx.moveTo(ex - radius * 0.8, ey)
      ctx.lineTo(ex + radius * 0.8, ey)
    }
    ctx.stroke()
    ctx.lineCap = cap
    return
  }

  const circles = (r: number, dx = 0, dy = 0) => {
    ctx.beginPath()
    for (const [ex, ey] of eyes) {
      ctx.moveTo(ex + dx + r, ey + dy)
      ctx.arc(ex + dx, ey + dy, r, 0, TAU)
    }
  }

  circles(radius)
  ctx.fillStyle = WHITE
  ctx.fill()
  if (line) {
    ctx.strokeStyle = line
    ctx.lineWidth = Math.max(1, radius * 0.22)
    ctx.stroke()
  }

  let lx = 0
  let ly = 0
  if (look) {
    const d = Math.max(1, Math.hypot(look.x, look.y))
    lx = (look.x / d) * radius * LOOK_SHIFT
    ly = (look.y / d) * radius * LOOK_SHIFT
  }
  circles(radius * PUPIL_RATIO, lx, ly)
  ctx.fillStyle = PUPIL
  ctx.fill()
  circles(radius * 0.16, lx - radius * 0.16, ly - radius * 0.18)
  ctx.fillStyle = WHITE
  ctx.fill()
}
