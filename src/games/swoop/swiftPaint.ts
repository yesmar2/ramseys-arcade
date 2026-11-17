import { mixColor } from '../../lib/color'
import { SWIFT_BEAK, SWIFT_BEAT, SWIFT_BODY, SWIFT_EYE, SWIFT_WING_FOLDED, SWIFT_WING_ROOT, SWIFT_WING_UP } from './birdShape'

/*
 * The swift, painted for Swoop's look on test (vista.ts). Ramsey, 2026-11-17, once the new hills were flying:
 * "can we redesign the birds too, to match new look?" It's the same bird he picked (the swift, birdShape.ts,
 * 2026-10-06), the same outline and the same size, so it flies, dives and lands exactly as it did; what's new
 * is how it's painted, to sit in a world that has light in it:
 * - a back the sun catches, a pale throat and belly with shade under it, and a tail and wings a tone deeper;
 * - a wing with a bright leading edge and a shoulder, and the far wing showing behind it, a beat late;
 * - an eye big enough to read, with a glint, that blinks, shuts with joy on a clean landing and winces at a thump.
 *
 * Three ways of outlining it, to choose between (vista.ts BIRD_STYLE): 'ink', the site's own dark line, which
 * keeps the bird the clearest thing on the screen; 'soft', a deeper shade of its own colour; and 'paper', no line,
 * a shadow under it instead, like a cut-out. Your bird and the blue bird are painted here each frame; the flock
 * is painted here once, onto its sheet (flock.ts). The season's skins paint themselves, as they always have
 * (birdSkins.ts), and a ghost with no skin is still its outline (scene.ts).
 *
 * Drawn in the swift's unit frame: facing right, the body's middle at the origin.
 */

const TAU = Math.PI * 2

export type SwiftStyle = 'ink' | 'soft' | 'paper'

/** A bird's colours, worked out once from the one it's known by. */
export type SwiftColours = {
  body: string
  lit: string
  belly: string
  under: string
  wing: string
  wingLit: string
  wingFar: string
  beak: string
  beakLow: string
  /** Its outline, or none for a cut-out. */
  line: string | null
  /** The shadow under a cut-out. */
  shadow: string | null
  eye: string
}

/** The colours of a swift known by `colour`, on the light theme or the dark, outlined the `style` way. */
export function swiftColours(colour: string, dark: boolean, style: SwiftStyle): SwiftColours {
  const deep = mixColor(colour, '#2a0f2c', 0.5)
  return {
    body: colour,
    lit: mixColor(colour, '#ffffff', 0.34),
    belly: mixColor('#fff6e6', colour, 0.06),
    under: mixColor(colour, '#3a1830', 0.35),
    wing: mixColor(colour, '#2a0f2c', 0.3),
    wingLit: mixColor(colour, '#ffffff', 0.16),
    wingFar: deep,
    beak: '#f8c24e',
    beakLow: '#e39a2c',
    line: style === 'paper' ? null : style === 'soft' ? mixColor(colour, '#2a0f2c', 0.62) : dark ? mixColor(colour, '#ffffff', 0.42) : '#1a2b3c',
    shadow: style === 'paper' ? (dark ? 'rgba(2, 4, 16, 0.42)' : 'rgba(26, 30, 60, 0.26)') : null,
    eye: '#1a2b3c',
  }
}

/** How a swift is posed this frame, as scene.ts drawBird has it. */
export type SwiftPose = {
  /** The wing beat's phase, in radians. */
  flap: number
  /** Held: diving, the wings folded. */
  dive: boolean
  /** Sitting on the hill, the wings folded. */
  ground: boolean
  /** A screen pixel, in the unit frame. */
  px1: number
  /** How its last landing went, for a moment: its eye shows it. */
  mood?: 'happy' | 'ouch' | null
  /** Mid-blink. */
  blink?: boolean
  /** Drawn very small (one of the flock): the fine parts are left out. */
  small?: boolean
}

type Parts = {
  body: Path2D
  tail: Path2D
  belly: Path2D
  back: Path2D
  under: Path2D
  beak: Path2D
  beakTop: Path2D
  beakLow: Path2D
  wing: Path2D
  wingEdge: Path2D
  shoulder: Path2D
  folded: Path2D
  foldedEdge: Path2D
}

/** The bird's parts as paths, made the first time one is painted (Path2D needs a browser). */
let parts: Parts | null = null
const PARTS = (): Parts =>
  (parts ??= {
    body: new Path2D(SWIFT_BODY),
    // The forked tail, from where it leaves the body.
    tail: new Path2D('M-0.8 -0.3 L-1.75 -0.62 L-1.28 -0.04 L-1.8 0.34 L-0.8 0.21 C-0.96 0.06 -0.96 -0.14 -0.8 -0.3 Z'),
    // The pale throat and belly: under a line from the beak back to the vent, down to the body's own edge.
    belly: new Path2D('M1.22 -0.03 C0.95 0.12 0.55 0.16 0.15 0.14 C-0.2 0.12 -0.55 0.16 -0.82 0.2 C-0.3 0.58 0.85 0.52 1.25 -0.05 Z'),
    // Where the light lies along the back, from the nape to the rump.
    back: new Path2D('M0.98 -0.36 C0.7 -0.64 -0.15 -0.68 -0.76 -0.31 C-0.2 -0.5 0.55 -0.5 0.98 -0.36 Z'),
    // The shade under the belly.
    under: new Path2D('M1.02 0.2 C0.6 0.5 -0.25 0.52 -0.76 0.24 C-0.25 0.4 0.5 0.4 1.02 0.2 Z'),
    // The beak whole, for its outline; and its two halves, the lower a tone deeper.
    beak: new Path2D(SWIFT_BEAK),
    beakTop: new Path2D('M1.2 -0.14 L1.62 -0.02 L1.2 -0.01 Z'),
    beakLow: new Path2D('M1.2 -0.01 L1.62 -0.02 L1.2 0.07 Z'),
    wing: new Path2D(SWIFT_WING_UP),
    // The raised wing's leading edge, from its root to its tip: the light catches it.
    wingEdge: new Path2D('M0.25 -0.32 C-0.15 -1.0 -0.85 -1.5 -1.65 -1.6 C-0.92 -1.36 -0.3 -0.94 0.0 -0.3 Z'),
    // The shoulder: the small feathers over the wing's root, in the body's own colour.
    shoulder: new Path2D('M0.22 -0.3 C0.0 -0.62 -0.3 -0.8 -0.62 -0.86 C-0.5 -0.6 -0.42 -0.36 -0.36 -0.14 Z'),
    folded: new Path2D(SWIFT_WING_FOLDED),
    foldedEdge: new Path2D('M0.35 -0.24 C-0.25 -0.48 -1.1 -0.5 -2.0 -0.22 C-1.1 -0.38 -0.3 -0.36 0.3 -0.17 Z'),
  })

/** Turns the frame about the wing's root to where a beat at `flap` has it. */
function beat(ctx: CanvasRenderingContext2D, flap: number) {
  const [rx, ry] = SWIFT_WING_ROOT
  ctx.translate(rx, ry)
  ctx.rotate((0.5 - 0.5 * Math.sin(flap)) * SWIFT_BEAT)
  ctx.translate(-rx, -ry)
}

/** The eye: open with a glint, looking ahead (or down in a dive); shut in a blink; an arch of joy; a wince. */
function paintEye(ctx: CanvasRenderingContext2D, c: SwiftColours, p: SwiftPose, line: number) {
  const e = SWIFT_EYE
  const r = e.r * 1.14
  if (p.small) {
    ctx.fillStyle = c.eye
    ctx.beginPath()
    ctx.arc(e.px - 0.02, e.y, e.pr * 1.3, 0, TAU)
    ctx.fill()
    return
  }
  if (p.mood || p.blink) {
    ctx.strokeStyle = c.eye
    ctx.lineWidth = Math.max(line * 0.9, 0.075)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    if (p.mood === 'ouch') {
      ctx.moveTo(e.x - r * 0.75, e.y - r * 0.6)
      ctx.lineTo(e.x + r * 0.5, e.y)
      ctx.lineTo(e.x - r * 0.75, e.y + r * 0.6)
    } else if (p.mood === 'happy') {
      ctx.moveTo(e.x - r * 0.85, e.y + r * 0.35)
      ctx.quadraticCurveTo(e.x, e.y - r * 1.05, e.x + r * 0.85, e.y + r * 0.35)
    } else {
      ctx.moveTo(e.x - r * 0.8, e.y)
      ctx.quadraticCurveTo(e.x, e.y + r * 0.5, e.x + r * 0.8, e.y)
    }
    ctx.stroke()
    ctx.lineCap = 'butt'
    return
  }
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(e.x, e.y, r, 0, TAU)
  ctx.fill()
  if (c.line) {
    ctx.strokeStyle = c.line
    ctx.lineWidth = line * 0.5
    ctx.stroke()
  }
  const py = e.y + (p.dive ? e.r * 0.35 : 0)
  ctx.fillStyle = c.eye
  ctx.beginPath()
  ctx.arc(e.px + 0.01, py, e.pr * 1.25, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(e.px + 0.055, py - 0.055, 0.042, 0, TAU)
  ctx.fill()
}

/** Paints a swift in the unit frame the canvas is already turned and sized to. */
export function paintSwift(ctx: CanvasRenderingContext2D, c: SwiftColours, p: SwiftPose) {
  const P = PARTS()
  const folded = p.dive || p.ground
  const line = Math.max(1.5 * p.px1, 0.1)
  ctx.lineJoin = 'round'

  if (c.shadow) {
    // A cut-out's shadow: the whole bird again, set down and back a little.
    ctx.save()
    ctx.translate(-0.07, 0.11)
    ctx.fillStyle = c.shadow
    ctx.fill(P.body)
    ctx.save()
    if (!folded) beat(ctx, p.flap)
    ctx.fill(folded ? P.folded : P.wing)
    ctx.restore()
    ctx.restore()
  }

  // The far wing, behind the body: a beat late, raised a little higher and smaller, so it shows over the back
  // and not as the near wing's twin. Gone when the wings are folded.
  if (!folded) {
    const [rx, ry] = SWIFT_WING_ROOT
    ctx.save()
    ctx.translate(0.2, -0.02)
    beat(ctx, p.flap - 0.9)
    ctx.translate(rx, ry)
    ctx.rotate(-0.26)
    ctx.scale(0.84, 0.84)
    ctx.translate(-rx, -ry)
    ctx.fillStyle = c.wingFar
    ctx.fill(P.wing)
    if (c.line) {
      ctx.strokeStyle = c.line
      ctx.lineWidth = line
      ctx.stroke(P.wing)
    }
    ctx.restore()
  }

  // The body, its tail a tone deeper, its throat and belly pale; then its outline over all of them.
  ctx.fillStyle = c.body
  ctx.fill(P.body)
  ctx.fillStyle = c.wing
  ctx.fill(P.tail)
  ctx.fillStyle = c.belly
  ctx.fill(P.belly)
  if (!p.small) {
    ctx.fillStyle = c.under
    ctx.globalAlpha *= 0.3
    ctx.fill(P.under)
    ctx.globalAlpha /= 0.3
    ctx.fillStyle = c.lit
    ctx.fill(P.back)
  }
  if (c.line) {
    ctx.strokeStyle = c.line
    ctx.lineWidth = line
    ctx.stroke(P.body)
  }

  ctx.fillStyle = c.beak
  ctx.fill(P.beakTop)
  ctx.fillStyle = c.beakLow
  ctx.fill(P.beakLow)
  if (c.line) {
    ctx.strokeStyle = c.line
    ctx.lineWidth = line * 0.7
    ctx.stroke(P.beak)
  }

  // The near wing: beating about its root in the air, laid along the body in a dive and on the hill.
  ctx.save()
  if (!folded) beat(ctx, p.flap)
  const wing = folded ? P.folded : P.wing
  ctx.fillStyle = c.wing
  ctx.fill(wing)
  if (!p.small && !folded) {
    ctx.fillStyle = c.body
    ctx.fill(P.shoulder)
  }
  ctx.fillStyle = c.wingLit
  ctx.fill(folded ? P.foldedEdge : P.wingEdge)
  if (c.line) {
    ctx.strokeStyle = c.line
    ctx.lineWidth = line
    ctx.stroke(wing)
  }
  ctx.restore()

  paintEye(ctx, c, p, line)
}
