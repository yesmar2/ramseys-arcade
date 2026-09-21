/**
 * The one pair of eyes the arcade's creatures wear.
 *
 * Snake's head and Crosswalk's hopper had arrived at opposite answers: Snake
 * drew a white eye with a dark pupil sitting inside it, the hopper drew a dark
 * dot with a white glint sitting off to one side of it. Same two colours,
 * inverted — so the two animals read as coming from different hands.
 *
 * The geometry below is Snake's, unchanged, down to the four facings. Snake was
 * the one that looked right and it is the one on the home page, so it sets the
 * house style and the hopper comes to it.
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

/** How much of the white the pupil takes up. */
const PUPIL_RATIO = 0.45

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
}

/** Draws both eyes: a white disc with a dark pupil concentric inside it. */
export function drawEyes(ctx: CanvasRenderingContext2D, opts: EyeOpts) {
  const { x, y, rx, ry, radius, facing = 'up' } = opts
  const [a, b] = PLACEMENT[facing]
  const ax = x + a[0] * rx
  const ay = y + a[1] * ry
  const bx = x + b[0] * rx
  const by = y + b[1] * ry

  ctx.fillStyle = WHITE
  ctx.beginPath()
  ctx.arc(ax, ay, radius, 0, Math.PI * 2)
  ctx.arc(bx, by, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = PUPIL
  ctx.beginPath()
  ctx.arc(ax, ay, radius * PUPIL_RATIO, 0, Math.PI * 2)
  ctx.arc(bx, by, radius * PUPIL_RATIO, 0, Math.PI * 2)
  ctx.fill()
}
