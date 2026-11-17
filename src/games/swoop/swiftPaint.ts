import { mixColor } from '../../lib/color'
import { SWIFT, type BirdDesign, type Patch, type Tone } from './birdDesigns'

/*
 * How a bird is painted in Swoop's look on test (vista.ts). Ramsey, 2026-11-17, once the new hills were flying:
 * "can we redesign the birds too, to match new look?" The bird is whichever of birdDesigns.ts is chosen (the
 * swift he picked on 2026-10-06, unless he picks another): the same outline, size and place on the hill as
 * ever, so it flies, dives and lands exactly as it did. What's new is the painting, to sit in a world that has
 * light in it:
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

/** A bird's colours, worked out once from the one it's known by: a colour for each of a design's tones, and its line. */
export type SwiftColours = Record<Tone, string> & {
  /** Its outline, or none for a cut-out. */
  line: string | null
  /** The shadow under a cut-out. */
  shadow: string | null
  eye: string
}

/** The colours of a bird known by `colour`, on the light theme or the dark, outlined the `style` way. */
export function swiftColours(colour: string, dark: boolean, style: SwiftStyle): SwiftColours {
  return {
    body: colour,
    lit: mixColor(colour, '#ffffff', 0.34),
    belly: mixColor('#fff6e6', colour, 0.06),
    under: mixColor(colour, '#3a1830', 0.35),
    wing: mixColor(colour, '#2a0f2c', 0.3),
    wingLit: mixColor(colour, '#ffffff', 0.16),
    wingFar: mixColor(colour, '#2a0f2c', 0.5),
    beak: '#f8c24e',
    beakLow: '#e39a2c',
    line: style === 'paper' ? null : style === 'soft' ? mixColor(colour, '#2a0f2c', 0.62) : dark ? mixColor(colour, '#ffffff', 0.42) : '#1a2b3c',
    shadow: style === 'paper' ? (dark ? 'rgba(2, 4, 16, 0.42)' : 'rgba(26, 30, 60, 0.26)') : null,
    eye: '#1a2b3c',
  }
}

/** How a bird is posed this frame, as scene.ts drawBird has it. */
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

type Shape = { path: Path2D; tone: Tone; alpha: number; fine: boolean }

/** A design's shapes as paths, made the first time it's painted (Path2D needs a browser). */
type Built = {
  behind: Shape[]
  body: Path2D
  patches: Shape[]
  beak: Path2D
  beakTop: Path2D
  beakLow: Path2D
  wing: Path2D
  wingPatches: Shape[]
  folded: Path2D
  foldedPatches: Shape[]
}

const built = new Map<BirdDesign, Built>()

function build(design: BirdDesign): Built {
  let made = built.get(design)
  if (made) return made
  const shapes = (list: readonly Patch[]): Shape[] => list.map((p) => ({ path: new Path2D(p.d), tone: p.tone, alpha: p.alpha ?? 1, fine: p.fine ?? false }))
  made = {
    behind: shapes(design.behind),
    body: new Path2D(design.body),
    patches: shapes(design.patches),
    beak: new Path2D(design.beak),
    beakTop: new Path2D(design.beakTop),
    beakLow: new Path2D(design.beakLow),
    wing: new Path2D(design.wing),
    wingPatches: shapes(design.wingPatches),
    folded: new Path2D(design.folded),
    foldedPatches: shapes(design.foldedPatches),
  }
  built.set(design, made)
  return made
}

/** Fills each patch in its tone: all of them, or only the bold ones for a bird of the flock. */
function fillPatches(ctx: CanvasRenderingContext2D, list: Shape[], c: SwiftColours, small: boolean) {
  for (const s of list) {
    if (small && s.fine) continue
    ctx.fillStyle = c[s.tone]
    if (s.alpha < 1) {
      ctx.globalAlpha *= s.alpha
      ctx.fill(s.path)
      ctx.globalAlpha /= s.alpha
    } else ctx.fill(s.path)
  }
}

/** Turns the frame about the wing's root to where a beat at `flap` has it. */
function beat(ctx: CanvasRenderingContext2D, design: BirdDesign, flap: number) {
  const [rx, ry] = design.wingRoot
  ctx.translate(rx, ry)
  ctx.rotate((0.5 - 0.5 * Math.sin(flap)) * design.beat)
  ctx.translate(-rx, -ry)
}

/** The eye: open with a glint, looking ahead (or down in a dive); shut in a blink; an arch of joy; a wince. */
function paintEye(ctx: CanvasRenderingContext2D, design: BirdDesign, c: SwiftColours, p: SwiftPose, line: number) {
  const e = design.eye
  if (p.small || e.dot) {
    ctx.fillStyle = c.eye
    ctx.beginPath()
    ctx.arc(e.px - (e.dot ? 0 : 0.03), e.y, e.dot ? e.pr : e.pr * 1.05, 0, TAU)
    ctx.fill()
    return
  }
  const r = e.r
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
  const py = e.y + (p.dive ? r * 0.3 : 0)
  ctx.fillStyle = c.eye
  ctx.beginPath()
  ctx.arc(e.px, py, e.pr, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(e.px + e.pr * 0.4, py - e.pr * 0.45, e.pr * 0.38, 0, TAU)
  ctx.fill()
}

/** Paints a bird of a design in the unit frame the canvas is already turned and sized to. */
export function paintBird(ctx: CanvasRenderingContext2D, design: BirdDesign, c: SwiftColours, p: SwiftPose) {
  const B = build(design)
  const folded = p.dive || p.ground
  const small = p.small ?? false
  const line = Math.max(1.5 * p.px1, 0.1)
  ctx.lineJoin = 'round'
  const wing = folded ? B.folded : B.wing

  if (c.shadow) {
    // A cut-out's shadow: the whole bird again, set down and back a little.
    ctx.save()
    ctx.translate(-0.07, 0.11)
    ctx.fillStyle = c.shadow
    ctx.fill(B.body)
    for (const s of B.behind) ctx.fill(s.path)
    ctx.save()
    if (!folded) beat(ctx, design, p.flap)
    ctx.fill(wing)
    ctx.restore()
    ctx.restore()
  }

  // The far wing, behind the body: a beat late, raised a little higher and smaller, so it shows over the back
  // and not as the near wing's twin. Gone when the wings are folded.
  if (!folded) {
    const [rx, ry] = design.wingRoot
    ctx.save()
    ctx.translate(0.2, -0.02)
    beat(ctx, design, p.flap - 0.9)
    ctx.translate(rx, ry)
    ctx.rotate(-0.26)
    ctx.scale(0.84, 0.84)
    ctx.translate(-rx, -ry)
    ctx.fillStyle = c.wingFar
    ctx.fill(B.wing)
    if (c.line) {
      ctx.strokeStyle = c.line
      ctx.lineWidth = line
      ctx.stroke(B.wing)
    }
    ctx.restore()
  }

  // What stands behind the body (a crest), with its own outline.
  for (const s of B.behind) {
    ctx.fillStyle = c[s.tone]
    ctx.fill(s.path)
    if (c.line) {
      ctx.strokeStyle = c.line
      ctx.lineWidth = line
      ctx.stroke(s.path)
    }
  }

  // The body and the patches of colour on it; then its outline over all of them.
  ctx.fillStyle = c.body
  ctx.fill(B.body)
  fillPatches(ctx, B.patches, c, small)
  if (c.line) {
    ctx.strokeStyle = c.line
    ctx.lineWidth = line
    ctx.stroke(B.body)
  }

  ctx.fillStyle = c.beak
  ctx.fill(B.beakTop)
  ctx.fillStyle = c.beakLow
  ctx.fill(B.beakLow)
  if (c.line) {
    ctx.strokeStyle = c.line
    ctx.lineWidth = line * 0.7
    ctx.stroke(B.beak)
  }

  // The near wing: beating about its root in the air, laid along the body in a dive and on the hill.
  ctx.save()
  if (!folded) beat(ctx, design, p.flap)
  ctx.fillStyle = c.wing
  ctx.fill(wing)
  fillPatches(ctx, folded ? B.foldedPatches : B.wingPatches, c, small)
  if (c.line) {
    ctx.strokeStyle = c.line
    ctx.lineWidth = line
    ctx.stroke(wing)
  }
  ctx.restore()

  paintEye(ctx, design, c, p, line)
}

/** Paints the swift: the bird as it's flown unless another design is chosen. */
export function paintSwift(ctx: CanvasRenderingContext2D, c: SwiftColours, p: SwiftPose) {
  paintBird(ctx, SWIFT, c, p)
}
