import { SWIFT_BEAK, SWIFT_BELLY, SWIFT_BEAT, SWIFT_BODY, SWIFT_EYE, SWIFT_LIFT, SWIFT_WING_FOLDED, SWIFT_WING_ROOT, SWIFT_WING_UP } from './birdShape'

/*
 * Swoop's season skins (lib/skins.ts): Season 2's snow swift on the free pass, and the penguin and the aurora
 * phoenix on Pass+, as Ramsey approved them from the season's skin mocks; and Blip, the site's mascot, with
 * wings. Your own bird wears yours, and a ghost the one its run was flown in, lighter (scene.ts drawGhost); the
 * blue bird and the pictures keep the usual look. Looks only, like every skin: each is drawn in the swift's unit
 * frame (birdShape.ts), facing right with the body's middle at the origin, the same size and the same height off
 * the hill, so it flies, dives and lands exactly as the red swift does.
 *
 * Like the rest of scene.ts they're fills and strokes only, never shadowBlur: the phoenix's glow is wide,
 * faint strokes of its own outline; Blip's spark is a gradient's fade.
 */

export const SNOW_SWIFT = 'swoop-snow-swift'
export const PENGUIN = 'swoop-penguin'
export const AURORA_PHOENIX = 'swoop-aurora-phoenix'
export const BLIP = 'swoop-blip'

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
  /** The sky's dusk (the dark theme): a glow that adds light at dusk is a deeper colour on the afternoon's pale sky. */
  dark?: boolean
  /** How the last landing went, for a face that shows it: clean, or a thump. Your own bird's, for a moment. */
  mood?: 'happy' | 'ouch' | null
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

/* ---------- Blip, with wings ---------- */

/** Blip's colours, as BlipFigure.tsx draws him; glows as `r, g, b`, for their fades. */
const BLIP_LOOK = {
  body: '#34c6a8',
  shade: '#1f9b84',
  feet: '#167a69',
  ink: '#0f2f2a',
  core: '#f2fffb',
  cheek: '255, 143, 179',
  /** His spark's glow at dusk; on the afternoon's pale sky a deeper mint, so it shows (as Wobble Run's does). */
  glow: '159, 247, 226',
  glowDay: '64, 204, 174',
  /** His wings: his mint a shade lighter, the far one a shade deeper, behind him. */
  wing: '#74dac5',
  wingFar: '#28ab91',
  /** Swoop's outline, round his own flat colours: a deep teal. */
  line: '#0e4a40',
}

/**
 * Blip is drawn in BlipFigure's own units (his body a circle of 7.35 about (0, 1.26), y down, his feet's soles at
 * 9.77), this many of the swift's units to one: rounder than the swift, and big enough that his face reads at the
 * game's size.
 */
const BLIP_K = 0.9 / 7.35
/** Where BlipFigure's origin sits in the swift's frame: his soles on the hill, where the swift's belly is. */
const BLIP_Y = SWIFT_LIFT - 9.77 * BLIP_K
/** His face, turned to look where he's going: this far forward. */
const BLIP_FACE = 2.4

/**
 * A wing, from its root, pointing straight back, as ellipses [x, y, rx, ry, turn]: its arm, and three feathers
 * fanned out behind it, the top one the longest. Filled as one, and outlined round the outside only.
 */
const WING_PARTS = [
  [-2.9, -0.7, 3.5, 2.35, -0.05],
  [-6.4, -1.45, 3.9, 1.3, -0.08],
  [-6.0, 0.55, 3.4, 1.25, 0.12],
  [-4.9, 2.15, 2.8, 1.15, 0.34],
] as const

/**
 * His parts as paths, made the first time he's drawn: his body, its belly shade (BlipFigure's own), a wing, and
 * its leading edge, for the soft white edge along it.
 */
let blipPaths: { body: Path2D; belly: Path2D; wing: Path2D; lead: Path2D } | null = null
const BLIP_PATHS = () => {
  if (blipPaths) return blipPaths
  const wing = new Path2D()
  for (const [x, y, rx, ry, a] of WING_PARTS) {
    wing.moveTo(x + rx * Math.cos(a), y + rx * Math.sin(a))
    wing.ellipse(x, y, rx, ry, a, 0, TAU)
  }
  return (blipPaths = {
    body: new Path2D('M7.35 1.26 A7.35 7.35 0 1 1 -7.35 1.26 A7.35 7.35 0 1 1 7.35 1.26 Z'),
    belly: new Path2D('M-5.88 4.2 A7.35 7.35 0 0 0 5.88 4.2 A8.4 6.3 0 0 1 -5.88 4.2 Z'),
    wing,
    lead: new Path2D('M0.6 -2.6 Q-2.9 -3.75 -6.4 -2.85 Q-9.0 -2.5 -10.4 -1.6'),
  })
}

/**
 * Where each wing turns from, how big it's drawn, and how much higher it's turned: on his back, clear of his face,
 * the near one over his side, the far one behind him, fanned a little higher, so both show as they beat.
 */
const NEAR_WING = { x: -5.3, y: 1.4, s: 0.8, up: 0 }
const FAR_WING = { x: -4.4, y: -0.4, s: 0.74, up: 0.32 }

/** His feet, [x, y, turn]: on the hill, tucked back in the air, tighter in a dive. */
const FEET_DOWN = [
  [-1.7, 8.82, 0],
  [2.9, 8.82, 0],
] as const
const FEET_UP = [
  [-3.0, 8.1, 0.5],
  [-0.7, 8.55, 0.35],
] as const
const FEET_DIVE = [
  [-3.7, 7.5, 0.7],
  [-1.7, 8.1, 0.55],
] as const

/**
 * Where his spark floats, in his units: over his head, bobbing, and swept back by the wind the faster he goes,
 * streaming behind him in a dive.
 */
export function blipSparkAt(dive: boolean, ground: boolean, time: number): [number, number] {
  const bob = Math.sin(time * 5.3) * 0.45
  if (ground) return [-0.9, -7.98 + bob]
  return dive ? [-3.9, -7.1 + bob * 0.5] : [-2.4, -7.7 + bob]
}

/**
 * Where his spark is from the bird's point on the hill (scene.ts's x, y), on the screen in the bird's drawn size,
 * for a bird headed at `angle` (radians, up positive; drawBird turns the canvas by −angle): so the glitter he leaves
 * flying comes off the spark itself (scene.ts drawTrail).
 */
export function blipSparkOffset(angle: number, dive: boolean, time: number): [number, number] {
  const [bx, by] = blipSparkAt(dive, false, time)
  const stretch = dive ? 1.12 : 1
  const x = bx * BLIP_K * stretch
  const y = (BLIP_Y + by * BLIP_K) / stretch - SWIFT_LIFT
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [x * c + y * s, -x * s + y * c]
}

/**
 * A speck of the glitter his spark leaves as he flies (scene.ts drawTrail): a tiny blip, the glow `r` across, at a
 * screen point, fading out in steps so it's soft without a gradient a speck. Its core is white at dusk; on the
 * afternoon's pale sky a white core would vanish and leave a ring, so it's his belly's deeper mint.
 */
export function blipGlitter(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dark: boolean) {
  const glow = dark ? BLIP_LOOK.glow : BLIP_LOOK.glowDay
  for (const [k, a] of [
    [1, 0.18],
    [0.68, 0.3],
    [0.45, 0.45],
  ] as const) {
    ctx.fillStyle = `rgba(${glow}, ${a})`
    ctx.beginPath()
    ctx.arc(x, y, r * k, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = dark ? BLIP_LOOK.core : BLIP_LOOK.shade
  ctx.beginPath()
  ctx.arc(x, y, r * (dark ? 0.26 : 0.3), 0, TAU)
  ctx.fill()
}

/** His spark's glow's radius, in the swift's units: for the glitter, a fraction of it. */
export const BLIP_SPARK_R = 2.7 * BLIP_K

/** One wing, beating as the swift's does: raised and lowered in the air, folded along his side in a dive and on the hill. */
function blipWing(ctx: CanvasRenderingContext2D, p: SkinPose, at: { x: number; y: number; s: number; up: number }, fill: string, line: number) {
  const W = BLIP_PATHS()
  const folded = p.dive || p.ground
  // Straight back is 0; up turns it clockwise on the canvas. Little wings, so a quicker beat than the swift's, as
  // the penguin's flipper; folded, it lies back and down along his side.
  const turn = folded ? (p.dive ? -0.42 : -0.5) : 0.24 + 0.74 * Math.sin(p.flap * 1.4) + at.up
  ctx.save()
  ctx.translate(at.x, at.y)
  ctx.rotate(turn)
  const s = at.s * (folded ? 0.78 : 1)
  ctx.scale(s, s)
  // The outline at twice its width under the fill, so only its outer half shows: round the wing, not each part.
  ctx.lineWidth = (line * 2) / s
  ctx.stroke(W.wing)
  ctx.fillStyle = fill
  ctx.fill(W.wing)
  ctx.save()
  ctx.clip(W.wing)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
  ctx.lineWidth = 1.8
  ctx.stroke(W.lead)
  ctx.restore()
  ctx.restore()
}

/** His face, as BlipFigure has it, turned forward and looking down the slope in a dive; grinning after a clean landing. */
function blipFace(ctx: CanvasRenderingContext2D, p: SkinPose) {
  const L = BLIP_LOOK
  // Never thinner than a pixel, so it reads at the game's size.
  const px = p.px1 / BLIP_K
  ctx.save()
  ctx.translate(BLIP_FACE, p.dive ? 0.55 : 0)
  ctx.strokeStyle = L.ink
  ctx.fillStyle = L.ink
  if (p.mood === 'happy') {
    ctx.lineWidth = Math.max(0.55, px * 1.1)
    ctx.beginPath()
    ctx.moveTo(-2.9, 1.1)
    ctx.quadraticCurveTo(-1.9, -0.2, -0.9, 1.1)
    ctx.moveTo(0.9, 1.1)
    ctx.quadraticCurveTo(1.9, -0.2, 2.9, 1.1)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-1.6, 3.4)
    ctx.quadraticCurveTo(0, 5.3, 1.6, 3.4)
    ctx.closePath()
    ctx.fill()
  } else if (p.mood === 'ouch') {
    // Screwed shut, and an "o".
    ctx.lineWidth = Math.max(0.55, px * 1.1)
    ctx.beginPath()
    ctx.moveTo(-2.7, 0.1)
    ctx.lineTo(-1.4, 1.05)
    ctx.lineTo(-2.7, 2.0)
    ctx.moveTo(2.7, 0.1)
    ctx.lineTo(1.4, 1.05)
    ctx.lineTo(2.7, 2.0)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, 3.95, 0.7, 0.8, 0, 0, TAU)
    ctx.fill()
  } else {
    // The far eye a touch narrower, turned away a little.
    for (const [x, rx] of [
      [-1.89, 0.95],
      [1.89, 0.86],
    ] as const) {
      ctx.beginPath()
      ctx.ellipse(x, 1.05, rx, 1.58, 0, 0, TAU)
      ctx.fill()
    }
    ctx.fillStyle = '#ffffff'
    for (const x of [-1.58, 2.15]) {
      ctx.beginPath()
      ctx.arc(x, 0.32, 0.36, 0, TAU)
      ctx.fill()
    }
    ctx.lineWidth = Math.max(0.47, px)
    ctx.beginPath()
    ctx.moveTo(-1.26, 3.57)
    ctx.quadraticCurveTo(0, 4.73, 1.26, 3.57)
    ctx.stroke()
  }
  ctx.fillStyle = `rgba(${L.cheek}, ${p.mood === 'happy' ? 0.85 : 0.7})`
  for (const [x, rx] of [
    [-3.57, 0.95],
    [3.57, 0.82],
  ] as const) {
    ctx.beginPath()
    ctx.ellipse(x, 3.15, rx, 0.53, 0, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** His spark: a white dot in its glow, which breathes. */
function blipSpark(ctx: CanvasRenderingContext2D, p: SkinPose) {
  const [x, y] = blipSparkAt(p.dive, p.ground, p.time)
  const r = 2.7 * (1 + 0.08 * Math.sin(p.time * 5.3))
  const glow = p.dark === false ? BLIP_LOOK.glowDay : BLIP_LOOK.glow
  const fade = ctx.createRadialGradient(x, y, 0, x, y, r)
  fade.addColorStop(0, `rgba(${glow}, 0.9)`)
  fade.addColorStop(1, `rgba(${glow}, 0)`)
  ctx.fillStyle = fade
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.fillStyle = BLIP_LOOK.core
  ctx.beginPath()
  ctx.arc(x, y, 0.85, 0, TAU)
  ctx.fill()
}

/**
 * Blip, the site's mascot, with wings: his round mint body, belly shade and shine, his face turned to look where
 * he's going, two little wings beating (the far one peeking over his back), his feet on the hill or tucked back in
 * the air, and his spark floating over his head, swept back as he flies. Swoop's outline goes round him, a deep
 * teal, so he sits in its drawing. Mint and teal, never the blue bird's blue.
 */
const blip: Painter = (ctx, p) => {
  const L = BLIP_LOOK
  ctx.save()
  ctx.translate(0, BLIP_Y)
  ctx.scale(BLIP_K, BLIP_K)
  const line = lineOf(p) / BLIP_K
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = L.line
  // The far wing, behind him: tucked out of sight in a dive and on the hill.
  if (!p.dive && !p.ground) blipWing(ctx, p, FAR_WING, L.wingFar, line)
  ctx.fillStyle = L.feet
  ctx.lineWidth = line * 0.7
  for (const [x, y, a] of p.ground ? FEET_DOWN : p.dive ? FEET_DIVE : FEET_UP) {
    ctx.beginPath()
    ctx.ellipse(x, y, 1.79, 0.95, a, 0, TAU)
    ctx.fill()
    ctx.stroke()
  }
  const P = BLIP_PATHS()
  ctx.fillStyle = L.body
  ctx.fill(P.body)
  ctx.fillStyle = L.shade
  ctx.fill(P.belly)
  ctx.save()
  ctx.translate(-2.52, -2.94)
  ctx.rotate((-24 * Math.PI) / 180)
  ctx.beginPath()
  ctx.ellipse(0, 0, 2.52, 1.26, 0, 0, TAU)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.fill()
  ctx.restore()
  ctx.lineWidth = line
  ctx.stroke(P.body)
  blipFace(ctx, p)
  ctx.strokeStyle = L.line
  blipWing(ctx, p, NEAR_WING, L.wing, line)
  blipSpark(ctx, p)
  ctx.restore()
}

const PAINTERS: Record<string, Painter> = {
  [SNOW_SWIFT]: snowSwift,
  [PENGUIN]: penguin,
  [AURORA_PHOENIX]: auroraPhoenix,
  [BLIP]: blip,
}

/** How a skin draws the bird, in its unit frame, or null for a skin Swoop doesn't know: the usual red swift. */
export function skinPainter(skin: string | null | undefined): Painter | null {
  return (skin && PAINTERS[skin]) || null
}
