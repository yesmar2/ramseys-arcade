import { SWIFT_BEAK, SWIFT_BELLY, SWIFT_BEAT, SWIFT_BODY, SWIFT_EYE, SWIFT_WING_FOLDED, SWIFT_WING_ROOT, SWIFT_WING_UP } from './birdShape'

/*
 * Swoop's season skins (lib/skins.ts): Season 2's snow swift on the free pass, and the penguin and the aurora
 * phoenix on Pass+, as Ramsey approved them from the season's skin mocks. Your own bird wears yours, and a ghost
 * the one its run was flown in, lighter (scene.ts drawGhost); the blue bird and the pictures keep the usual
 * look. Looks only, like every skin: each is drawn in the
 * swift's unit frame (birdShape.ts), facing right with the body's middle at the origin, the same size and the
 * same height off the hill, so it flies, dives and lands exactly as the red swift does.
 *
 * Like the rest of scene.ts they're fills and strokes only, never shadowBlur: the phoenix's glow is wide,
 * faint strokes of its own outline.
 */

export const SNOW_SWIFT = 'swoop-snow-swift'
export const PENGUIN = 'swoop-penguin'
export const AURORA_PHOENIX = 'swoop-aurora-phoenix'

/** How a skinned bird is posed this frame, as scene.ts drawBird has it. */
export type SkinPose = {
  /** The wing beat's phase, in radians. */
  flap: number
  /** Held: diving, the wing folded and the bird stretched. */
  dive: boolean
  /** Sitting on the hill, the wing folded. */
  ground: boolean
  /** Seconds the scene has been running, for what flutters on its own. */
  time: number
  /** A screen pixel, in the unit frame. */
  px1: number
  /** The outline's width in the unit frame, for a picture drawn far bigger than the game's bird; else the game's. */
  line?: number
}

type Painter = (ctx: CanvasRenderingContext2D, pose: SkinPose) => void

const TAU = Math.PI * 2

/** The swift's parts as paths, made the first time a skin is drawn (Path2D needs a browser). */
let swift: { body: Path2D; belly: Path2D; beak: Path2D; up: Path2D; folded: Path2D; tipUp: Path2D } | null = null
const SWIFT = () =>
  (swift ??= {
    body: new Path2D(SWIFT_BODY),
    belly: new Path2D(SWIFT_BELLY),
    beak: new Path2D(SWIFT_BEAK),
    up: new Path2D(SWIFT_WING_UP),
    folded: new Path2D(SWIFT_WING_FOLDED),
    // The raised wing's last third, from where it narrows to its point.
    tipUp: new Path2D('M-0.85 -1.27 C-1.1 -1.45 -1.35 -1.56 -1.65 -1.6 C-1.38 -1.38 -1.18 -1.18 -1.02 -0.98 Z'),
  })

/** The two line widths drawBird uses: the body's, and the beak's. */
const lineOf = (p: SkinPose) => p.line ?? Math.max(1.5 * p.px1, 0.1)
const fineOf = (p: SkinPose) => lineOf(p) * 0.7

/** Turns the frame about the wing's root to where the beat has it; nothing when the wing's folded. */
function beatWing(ctx: CanvasRenderingContext2D, p: SkinPose) {
  if (p.dive || p.ground) return
  const [rx, ry] = SWIFT_WING_ROOT
  ctx.translate(rx, ry)
  ctx.rotate((0.5 - 0.5 * Math.sin(p.flap)) * SWIFT_BEAT)
  ctx.translate(-rx, -ry)
}

/** The swift's eye: white with a dark pupil, looking ahead, or down in a dive. */
function swiftEye(ctx: CanvasRenderingContext2D, p: SkinPose, pupil: string) {
  const e = SWIFT_EYE
  ctx.beginPath()
  ctx.arc(e.x, e.y, e.r, 0, TAU)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = lineOf(p) * 0.5
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(e.px, e.y + (p.dive ? e.r * 0.35 : 0), e.pr, 0, TAU)
  ctx.fillStyle = pupil
  ctx.fill()
}

/** The swift in a skin's colours, its wingtip a colour of its own. */
function paintSwift(
  ctx: CanvasRenderingContext2D,
  p: SkinPose,
  c: { body: string; belly: string; beak: string; wing: string; tip: string; line: string; pupil: string },
  overBody?: () => void,
) {
  const S = SWIFT()
  ctx.lineJoin = 'round'
  ctx.strokeStyle = c.line
  ctx.lineWidth = lineOf(p)
  ctx.fillStyle = c.body
  ctx.fill(S.body)
  ctx.stroke(S.body)
  ctx.fillStyle = c.belly
  ctx.fill(S.belly)
  overBody?.()
  ctx.fillStyle = c.beak
  ctx.fill(S.beak)
  ctx.lineWidth = fineOf(p)
  ctx.stroke(S.beak)
  // The wing, with its tip: the raised wing's own tip shape, or the folded wing's back end, cut to the wing.
  ctx.save()
  beatWing(ctx, p)
  const folded = p.dive || p.ground
  const wing = folded ? S.folded : S.up
  ctx.fillStyle = c.wing
  ctx.fill(wing)
  ctx.fillStyle = c.tip
  if (folded) {
    ctx.save()
    ctx.clip(wing)
    ctx.fillRect(-2.2, -0.6, 0.75, 0.7)
    ctx.restore()
  } else ctx.fill(S.tipUp)
  ctx.lineWidth = lineOf(p)
  ctx.stroke(wing)
  ctx.restore()
  swiftEye(ctx, p, c.pupil)
}

/* ---------- the snow swift ---------- */

const FROST_INK = '#2b3446'

/** White, with a pale grey-blue wing, a black wingtip and a little black cap: a winter swift. */
const snowSwift: Painter = (ctx, p) =>
  paintSwift(
    ctx,
    p,
    { body: '#f4f8ff', belly: 'rgba(200, 215, 232, 0.7)', beak: '#3a4a60', wing: '#dbe6f2', tip: FROST_INK, line: '#7f93ad', pupil: '#1a2b3c' },
    () => {
      // The cap, on the crown, under the eye.
      ctx.fillStyle = FROST_INK
      ctx.beginPath()
      ctx.ellipse(0.6, -0.41, 0.42, 0.18, 0.17, Math.PI, TAU)
      ctx.fill()
    },
  )

/**
 * A frost sparkle, for the snow swift's trail: a four-pointed star `r` across, at a screen point. The game draws
 * them where the bird has been (scene.ts drawTrail); the pass's picture draws a few behind it.
 */
export function frostSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const w = r * 0.32
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + w, y - w)
  ctx.lineTo(x + r, y)
  ctx.lineTo(x + w, y + w)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - w, y + w)
  ctx.lineTo(x - r, y)
  ctx.lineTo(x - w, y - w)
  ctx.closePath()
  ctx.fill()
}

/** The frost's colour on the theme's sky: pale on the dusk, a cold grey-blue on the afternoon's light sky. */
export const frostColour = (dark: boolean) => (dark ? '#e6f3ff' : '#8aa3c2')

/* ---------- the penguin ---------- */

const PEN_INK = '#0d1424'
const PEN_BACK = '#1b2233'
const PEN_FLIPPER = '#121826'
const PEN_ORANGE = '#f2a03a'
const SCARF = '#e8564f'
const GOGGLES = '#5cf2b0'
/** The body: an egg, longer than it's tall, its bottom on the hill where the swift's is (SWIFT_LIFT). */
const PEN = { x: 0, y: -0.03, rx: 1.02, ry: 0.59 }
/** Where the scarf's end leaves the knot at the back of the neck. */
const KNOT = { x: 0.2, y: -0.6 }

/** The scarf's loose end, from the knot over the back and streaming out behind, fluttering with the beat. */
function scarfTail(ctx: CanvasRenderingContext2D, p: SkinPose) {
  const calm = p.ground ? 0.35 : p.dive ? 0.55 : 1
  const phase = p.time * 11 + p.flap * 0.25
  const N = 14
  const top: [number, number][] = []
  const low: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const x = KNOT.x - t * 2.15
    const y = KNOT.y + t * (p.dive ? 0.02 : 0.12) + Math.sin(phase - t * 5.5) * 0.15 * t ** 1.3 * calm
    const w = 0.24 * (1 - t * 0.2)
    top.push([x, y - w / 2])
    low.push([x, y + w / 2])
  }
  const tail = new Path2D()
  for (const [x, y] of top) tail.lineTo(x, y)
  for (let i = low.length - 1; i >= 0; i--) tail.lineTo(low[i]![0], low[i]![1])
  tail.closePath()
  ctx.fillStyle = SCARF
  ctx.fill(tail)
  // Two white stripes near its end, then a fringe.
  ctx.fillStyle = '#ffffff'
  for (const at of [10, 12]) {
    ctx.beginPath()
    ctx.moveTo(top[at]![0], top[at]![1])
    ctx.lineTo(top[at + 1]![0] + 0.04, top[at + 1]![1])
    ctx.lineTo(low[at + 1]![0] + 0.04, low[at + 1]![1])
    ctx.lineTo(low[at]![0], low[at]![1])
    ctx.closePath()
    ctx.fill()
  }
  ctx.lineWidth = fineOf(p)
  ctx.stroke(tail)
  const [ex, ey1] = top[N]!
  const ey2 = low[N]![1]
  ctx.strokeStyle = SCARF
  ctx.lineWidth = fineOf(p) * 0.9
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let k = 0; k < 3; k++) {
    const y = ey1 + ((ey2 - ey1) * (k + 0.5)) / 3
    ctx.moveTo(ex, y)
    ctx.lineTo(ex - 0.17, y + Math.sin(phase + k * 1.3) * 0.05 * calm)
  }
  ctx.stroke()
  ctx.lineCap = 'butt'
  ctx.strokeStyle = PEN_INK
}

/**
 * A penguin that flies anyway: a round black-backed body with a white front, one stubby flipper beating hard,
 * orange beak and feet, green goggles pushed up on its head, and a red knitted scarf round its neck, the end
 * streaming out behind. In a dive the flipper's tucked flat; on the hill it slides on its white front, as
 * penguins do.
 */
const penguin: Painter = (ctx, p) => {
  ctx.lineJoin = 'round'
  ctx.strokeStyle = PEN_INK
  // Feet, tucked back under the tail.
  ctx.fillStyle = PEN_ORANGE
  ctx.lineWidth = fineOf(p)
  for (const [x, y, a] of [
    [-0.92, 0.33, 0.45],
    [-0.72, 0.42, 0.3],
  ] as const) {
    ctx.beginPath()
    ctx.ellipse(x, y, 0.25, 0.09, a, 0, TAU)
    ctx.fill()
    ctx.stroke()
  }
  // The body, its white front, and the scarf wound round the neck, knitted in ribs, all cut to the body.
  const body = new Path2D()
  body.ellipse(PEN.x, PEN.y, PEN.rx, PEN.ry, 0, 0, TAU)
  ctx.fillStyle = PEN_BACK
  ctx.fill(body)
  ctx.save()
  ctx.clip(body)
  ctx.fillStyle = '#f6f8fc'
  ctx.beginPath()
  ctx.ellipse(0.2, 0.17, 0.84, 0.45, 0.04, 0, TAU)
  ctx.fill()
  const band = new Path2D()
  band.moveTo(0.06, -0.75)
  band.quadraticCurveTo(0.14, -0.05, 0.28, 0.7)
  band.lineTo(0.54, 0.7)
  band.quadraticCurveTo(0.4, -0.05, 0.32, -0.75)
  band.closePath()
  ctx.fillStyle = SCARF
  ctx.fill(band)
  ctx.save()
  ctx.clip(band)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = fineOf(p) * 0.6
  ctx.beginPath()
  for (let y = -0.7; y < 0.7; y += 0.13) {
    ctx.moveTo(0, y)
    ctx.lineTo(0.6, y + 0.1)
  }
  ctx.stroke()
  ctx.restore()
  ctx.lineWidth = fineOf(p)
  ctx.stroke(band)
  ctx.restore()
  ctx.lineWidth = lineOf(p)
  ctx.stroke(body)
  // The scarf's end, over the back, and its knot.
  scarfTail(ctx, p)
  ctx.fillStyle = SCARF
  ctx.lineWidth = fineOf(p)
  ctx.beginPath()
  ctx.ellipse(KNOT.x, KNOT.y, 0.15, 0.12, 0.3, 0, TAU)
  ctx.fill()
  ctx.stroke()
  // The beak.
  ctx.fillStyle = PEN_ORANGE
  ctx.beginPath()
  ctx.moveTo(0.96, -0.16)
  ctx.lineTo(1.42, -0.04)
  ctx.lineTo(0.96, 0.08)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  // The eye, looking ahead, or down in a dive.
  ctx.beginPath()
  ctx.arc(0.72, -0.17, 0.12, 0, TAU)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0.76, -0.17 + (p.dive ? 0.04 : 0), 0.065, 0, TAU)
  ctx.fillStyle = PEN_INK
  ctx.fill()
  // Goggles, pushed up on its head: two green lenses on a strap, each with a glint.
  ctx.lineWidth = lineOf(p)
  ctx.beginPath()
  ctx.moveTo(0.36, -0.6)
  ctx.lineTo(0.84, -0.42)
  ctx.stroke()
  ctx.lineWidth = fineOf(p)
  for (const [x, y] of [
    [0.52, -0.56],
    [0.8, -0.45],
  ] as const) {
    ctx.beginPath()
    ctx.arc(x, y, 0.13, 0, TAU)
    ctx.fillStyle = GOGGLES
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x - 0.04, y - 0.04, 0.04, 0, TAU)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.fill()
  }
  // The flipper: stubby, beating hard to keep a penguin up, or flat along its side in a dive and on the hill.
  ctx.save()
  ctx.translate(-0.1, -0.2)
  const folded = p.dive || p.ground
  ctx.rotate(folded ? 0.14 : 1.0 - (0.5 - 0.5 * Math.sin(p.flap * 1.4)) * 1.45)
  ctx.beginPath()
  ctx.ellipse(-0.42, 0, folded ? 0.46 : 0.5, 0.15, 0, 0, TAU)
  ctx.fillStyle = PEN_FLIPPER
  ctx.fill()
  ctx.lineWidth = lineOf(p)
  ctx.stroke()
  ctx.restore()
}

/* ---------- the aurora phoenix ---------- */

const AURORA_GREEN = '#5cf2b0'

/** The plumes, top to bottom: where each leaves the tail, how far it waves, and how wide it starts. */
const PLUMES = [
  [-0.3, 0.32, 0.15],
  [0.0, 0.24, 0.19],
  [0.26, 0.28, 0.12],
] as const

/** Long ribbon plumes from the tail, green into cyan into violet, fading out, rippling in the wind. */
function plumes(ctx: CanvasRenderingContext2D, p: SkinPose) {
  const calm = p.ground ? 0.35 : p.dive ? 0.5 : 1
  const grad = ctx.createLinearGradient(-1.2, 0, -4.4, 0)
  grad.addColorStop(0, 'rgba(92, 242, 176, 0.95)')
  grad.addColorStop(0.5, 'rgba(70, 228, 255, 0.7)')
  grad.addColorStop(1, 'rgba(155, 123, 255, 0)')
  ctx.fillStyle = grad
  const N = 16
  for (const [dy, amp, w] of PLUMES) {
    const wave = (t: number) => dy * (p.ground ? 0.5 : 1) + Math.sin(t * 5 + dy * 4 - p.time * 7) * amp * t * calm
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const t = i / N
      ctx.lineTo(-1.2 - t * 3.2, wave(t) - w / 2)
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N
      ctx.lineTo(-1.2 - t * 3.2, wave(t) + (w / 2) * (1 - t * 0.6))
    }
    ctx.closePath()
    ctx.fill()
  }
}

/** Navy, with a violet wing, edged in the aurora's green, a crest of three feathers, and plumes trailing. */
const auroraPhoenix: Painter = (ctx, p) => {
  const S = SWIFT()
  plumes(ctx, p)
  // The glow: wide, faint strokes of the outline, under the bird.
  const wing = p.dive || p.ground ? S.folded : S.up
  const alpha = ctx.globalAlpha
  ctx.lineJoin = 'round'
  ctx.strokeStyle = AURORA_GREEN
  for (const [w, a] of [
    [0.42, 0.1],
    [0.24, 0.16],
  ] as const) {
    ctx.globalAlpha = alpha * a
    ctx.lineWidth = w
    ctx.stroke(S.body)
    ctx.save()
    beatWing(ctx, p)
    ctx.stroke(wing)
    ctx.restore()
  }
  ctx.globalAlpha = alpha
  paintSwift(
    ctx,
    p,
    { body: '#16305a', belly: 'rgba(92, 242, 176, 0.55)', beak: '#d8fff2', wing: '#9b7bff', tip: AURORA_GREEN, line: AURORA_GREEN, pupil: '#0b1a33' },
    () => {
      // A crest of three feathers on the crown, swept back, clear of the wing.
      ctx.fillStyle = AURORA_GREEN
      for (const [x, y, a] of [
        [0.82, -0.37, -0.35],
        [0.66, -0.45, -0.65],
        [0.5, -0.5, -0.95],
      ] as const) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(a)
        ctx.beginPath()
        ctx.ellipse(0, -0.22, 0.07, 0.28, 0, 0, TAU)
        ctx.fill()
        ctx.restore()
      }
    },
  )
}

const PAINTERS: Record<string, Painter> = {
  [SNOW_SWIFT]: snowSwift,
  [PENGUIN]: penguin,
  [AURORA_PHOENIX]: auroraPhoenix,
}

/** How a skin draws the bird, in its unit frame, or null for a skin Swoop doesn't know: the usual red swift. */
export function skinPainter(skin: string | null | undefined): Painter | null {
  return (skin && PAINTERS[skin]) || null
}
