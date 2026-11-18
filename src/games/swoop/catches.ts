/*
 * What waits on the day's three golden hills to be caught, in Swoop's look on test (golden.ts, vista.ts). It was a
 * golden bird, sitting on its hill, and Ramsey, 2026-11-18: "maybe golden bird is the wrong thing to catch. it's
 * weird that it's just sitting there, what else could we use for that". So here are three other things, each with
 * a reason to be where it is, painted to choose between (golden.ts CATCH picks):
 * - a kite, pegged to the slope and flying over it, where it's seen from two hills off; caught, it flies behind you
 *   on its string, so how many you have is plain at a glance, on a phone too;
 * - a golden feather, standing in the turf and bending in the wind; caught, it streams from your tail;
 * - a fledgling in its nest, cheeping; caught, it tumbles out and flaps along at the front of the flock.
 *
 * Each is painted in a frame of its own, in the bird's units or in metres, y down as a canvas has it; the scene
 * and the flock's sheet place, turn and size the frame.
 */

const TAU = Math.PI * 2

/** The golden things' colours: a deep amber line round them, in place of the site's dark one, as the birds have. */
const GOLD = '#ffc93a'
const GOLD_LIT = '#ffe28c'
const GOLD_DEEP = '#eda522'
const AMBER = '#8a5514'
const CREAM = '#fff3c4'

/* ------------------------------------------------------------------- a kite --- */

/** The kite's bows, down its tail: the flock's colours. */
const BOWS = ['#e85d9a', '#3ecf8e', '#8a6ad4'] as const

/**
 * A kite, in metres, its middle at the origin, standing upright (the caller leans it into the wind): a diamond in
 * two golds, and a tail of three bows that ripples with `time`, streaming off to the left.
 */
export function paintKite(g: CanvasRenderingContext2D, time: number, seed: number, line: number) {
  // The tail first, under the kite: a ribbon from its foot, and the bows tied along it.
  const at = (j: number): [number, number] => [-0.42 * j + Math.sin(time * 5 + j * 1.3 + seed) * 0.16 * j * 0.5, 1.3 + 0.46 * j + Math.cos(time * 4 + j + seed) * 0.08 * j]
  g.strokeStyle = AMBER
  g.lineWidth = Math.max(line, 0.07)
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(0, 1.3)
  for (let j = 1; j <= 6; j++) g.lineTo(...at(j))
  g.stroke()
  for (let b = 0; b < BOWS.length; b++) {
    const [x, y] = at(1.6 + b * 1.7)
    g.fillStyle = BOWS[b]!
    g.beginPath()
    g.moveTo(x - 0.3, y - 0.17)
    g.lineTo(x, y)
    g.lineTo(x - 0.3, y + 0.17)
    g.closePath()
    g.moveTo(x + 0.3, y - 0.17)
    g.lineTo(x, y)
    g.lineTo(x + 0.3, y + 0.17)
    g.closePath()
    g.fill()
  }
  // The diamond: its windward half lighter.
  g.fillStyle = GOLD_LIT
  g.beginPath()
  g.moveTo(0, -1.5)
  g.lineTo(-1, -0.35)
  g.lineTo(0, 1.3)
  g.closePath()
  g.fill()
  g.fillStyle = GOLD_DEEP
  g.beginPath()
  g.moveTo(0, -1.5)
  g.lineTo(1, -0.35)
  g.lineTo(0, 1.3)
  g.closePath()
  g.fill()
  // Its spars, and its edge.
  g.strokeStyle = AMBER
  g.lineWidth = Math.max(line * 0.8, 0.05)
  g.beginPath()
  g.moveTo(0, -1.5)
  g.lineTo(0, 1.3)
  g.moveTo(-1, -0.35)
  g.lineTo(1, -0.35)
  g.stroke()
  g.lineWidth = Math.max(line, 0.07)
  g.beginPath()
  g.moveTo(0, -1.5)
  g.lineTo(1, -0.35)
  g.lineTo(0, 1.3)
  g.lineTo(-1, -0.35)
  g.closePath()
  g.stroke()
}

/* ---------------------------------------------------------------- a feather --- */

/** The shapes drawn every frame something waits in view, made the first time (Path2D needs a browser). */
let featherVane: Path2D | null = null
let nestBowl: Path2D | null = null

/**
 * A golden feather, in the bird's units, lying along the frame: its quill at the right (where it's held, or stuck in
 * the turf once the caller stands it up) and its tip at the left.
 */
export function paintFeather(g: CanvasRenderingContext2D, line: number) {
  g.lineJoin = 'round'
  const vane = (featherVane ??= new Path2D('M1.15 0.02 C0.7 -0.62 -0.55 -0.78 -1.75 -0.12 C-0.75 0.62 0.5 0.6 1.15 0.02 Z'))
  g.fillStyle = GOLD
  g.fill(vane)
  // The half the light's on.
  g.fillStyle = GOLD_LIT
  g.beginPath()
  g.moveTo(1.15, 0.02)
  g.bezierCurveTo(0.7, -0.62, -0.55, -0.78, -1.75, -0.12)
  g.closePath()
  g.fill()
  // Two splits in its lower edge, as a feather has.
  g.fillStyle = GOLD_DEEP
  g.beginPath()
  g.moveTo(-0.42, 0.47)
  g.lineTo(-0.1, 0.1)
  g.lineTo(-0.62, 0.4)
  g.closePath()
  g.moveTo(0.36, 0.44)
  g.lineTo(0.56, 0.12)
  g.lineTo(0.16, 0.46)
  g.closePath()
  g.fill()
  g.strokeStyle = AMBER
  g.lineWidth = Math.max(line, 0.09)
  g.stroke(vane)
  // The shaft, from the quill to the tip.
  g.fillStyle = CREAM
  g.beginPath()
  g.moveTo(1.72, -0.02)
  g.lineTo(-1.66, -0.15)
  g.lineTo(-1.66, -0.08)
  g.lineTo(1.72, 0.08)
  g.closePath()
  g.fill()
}

/* -------------------------------------------------------------- a fledgling --- */

const CHICK = '#ffd34d'
const CHICK_WING = '#f2a51f'

/**
 * A fledgling flying, in the bird's units, facing right: a round body, a stub of a wing beating hard (`flap` is its
 * beat's phase; `tucked` holds it in for a dive), a tuft, and an eye too big for it.
 */
export function paintChick(g: CanvasRenderingContext2D, flap: number, tucked: boolean, line: number) {
  g.lineJoin = 'round'
  g.strokeStyle = AMBER
  g.lineWidth = Math.max(line, 0.1)
  // Tail and tuft, behind the body.
  g.fillStyle = CHICK_WING
  g.beginPath()
  g.moveTo(-0.78, -0.22)
  g.lineTo(-1.3, -0.5)
  g.lineTo(-0.9, 0.14)
  g.closePath()
  g.fill()
  g.stroke()
  g.fillStyle = CHICK
  g.beginPath()
  g.moveTo(0.02, -0.84)
  g.lineTo(0.16, -1.26)
  g.lineTo(0.36, -0.8)
  g.closePath()
  g.fill()
  g.stroke()
  g.beginPath()
  g.arc(0, 0, 0.92, 0, TAU)
  g.fill()
  g.fillStyle = CREAM
  g.beginPath()
  g.ellipse(0.14, 0.34, 0.6, 0.44, 0, 0, TAU)
  g.fill()
  g.beginPath()
  g.arc(0, 0, 0.92, 0, TAU)
  g.stroke()
  // The wing: up and down about its shoulder.
  g.save()
  g.translate(0.12, -0.1)
  g.rotate(tucked ? 0.35 : -1.0 + 1.5 * (0.5 - 0.5 * Math.sin(flap)))
  g.fillStyle = CHICK_WING
  g.beginPath()
  g.ellipse(-0.5, 0, 0.56, 0.27, 0, 0, TAU)
  g.fill()
  g.stroke()
  g.restore()
  chickFace(g, 0.44, -0.24, false, line)
}

/** A chick's eye and beak, the eye at (x, y): the beak open on a cheep. */
function chickFace(g: CanvasRenderingContext2D, x: number, y: number, cheep: boolean, line: number) {
  g.fillStyle = '#f2813a'
  g.strokeStyle = AMBER
  g.lineWidth = Math.max(line * 0.7, 0.07)
  g.beginPath()
  if (cheep) {
    g.moveTo(x + 0.4, y + 0.02)
    g.lineTo(x + 0.84, y - 0.12)
    g.lineTo(x + 0.52, y + 0.16)
    g.lineTo(x + 0.8, y + 0.42)
    g.lineTo(x + 0.38, y + 0.34)
  } else {
    g.moveTo(x + 0.4, y + 0.08)
    g.lineTo(x + 0.82, y + 0.22)
    g.lineTo(x + 0.4, y + 0.38)
  }
  g.closePath()
  g.fill()
  g.stroke()
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.arc(x, y, 0.21, 0, TAU)
  g.fill()
  g.fillStyle = '#1a2b3c'
  g.beginPath()
  g.arc(x + 0.05, y, 0.125, 0, TAU)
  g.fill()
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.arc(x + 0.1, y - 0.06, 0.045, 0, TAU)
  g.fill()
}

/**
 * A fledgling in its nest, in the bird's units, the nest's foot at the origin: the chick showing over the rim,
 * bobbing up by `peek` (0 to 1), its beak open when it cheeps.
 */
export function paintNest(g: CanvasRenderingContext2D, peek: number, cheep: boolean, line: number) {
  g.lineJoin = 'round'
  g.strokeStyle = AMBER
  g.lineWidth = Math.max(line, 0.1)
  // The far rim, the chick, then the bowl in front of it.
  g.fillStyle = '#6f4720'
  g.beginPath()
  g.ellipse(0, -0.62, 1.12, 0.26, 0, 0, TAU)
  g.fill()
  g.save()
  g.translate(0, -0.95 - peek * 0.34)
  g.fillStyle = CHICK
  g.beginPath()
  g.moveTo(-0.14, -0.6)
  g.lineTo(0.0, -0.98)
  g.lineTo(0.18, -0.58)
  g.closePath()
  g.fill()
  g.stroke()
  g.beginPath()
  g.arc(0, 0, 0.66, 0, TAU)
  g.fill()
  g.stroke()
  chickFace(g, 0.2, -0.14, cheep, line)
  g.restore()
  g.fillStyle = '#93602c'
  const bowl = (nestBowl ??= new Path2D('M-1.14 -0.62 C-1.0 0.08 1.0 0.08 1.14 -0.62 C0.6 -0.42 -0.6 -0.42 -1.14 -0.62 Z'))
  g.fill(bowl)
  g.stroke(bowl)
  // A few twigs across it.
  g.strokeStyle = '#c08a48'
  g.lineWidth = Math.max(line * 0.7, 0.06)
  g.beginPath()
  g.moveTo(-0.8, -0.34)
  g.lineTo(-0.2, -0.16)
  g.moveTo(0.1, -0.3)
  g.lineTo(0.7, -0.2)
  g.moveTo(-0.4, -0.1)
  g.lineTo(0.3, -0.06)
  g.stroke()
}
