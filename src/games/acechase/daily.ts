/**
 * Ace Chase: Today's Hole. A new hole every day, the same for everyone, built from the date.
 *
 * Every day's hole is a big open green walled all round, in the spirit of Bumps and Banks (./bumpsBanks),
 * with humps that bend a putt and things in the way; and every day it's a different kind of thing:
 * - bumps: a hill and humps, a log across the far end, rocks, and a rubber bank (Bumps and Banks itself);
 * - pond: water in the way, to play round or along the edge of;
 * - gates: a wall right across the green with two or three gaps in it;
 * - terrace: a lower and an upper level with a steep step between them;
 * - dogleg: the green turns a corner, with a rubber bank on the outside of it;
 * - mesa: the target on top of a raised plateau;
 * - pinball: springy rubber posts and slingshots to bounce off;
 * - bunkers: sand round the target, which slows a ball four times as fast as the green does;
 * - neck: the green squeezes to a narrow gap between rubber banks.
 * Where it all is, how big and which way the ground leans come from a generator seeded with the date,
 * and so does the place, which changes how it plays as well as how it looks:
 * - a garden, a quick green;
 * - an ice rink, where the ball slides further still and the target is a curling house;
 * - the Moon, where a slope pulls a sixth as hard, so its ground is built steeper, and the ball floats off
 *   every crest.
 * Not every green the generator makes is a good one, so each day's is checked before it goes out
 * (scripts/acechase-daily.mjs plays every power and angle, and keeps a green only if its target has a way
 * in a player can find, about as hard as every other day's, and doesn't give it away), and the checked
 * choice is kept in dailyPlan.ts.
 *
 * Imports only other files that import nothing, so the checker can run this with plain Node.
 */
import { hashString, mulberry32 } from '../../lib/seededRandom.ts'
import {
  gauss,
  rounded,
  smooth,
  type Bumper,
  type HoleDef,
  type Lost,
  type Pt,
  type Spot,
  type Style,
  type WallDef,
} from './physics.ts'

export type Kind = 'bumps' | 'pond' | 'gates' | 'terrace' | 'dogleg' | 'mesa' | 'pinball' | 'bunkers' | 'neck'
export const KINDS: readonly Kind[] = ['bumps', 'pond', 'gates', 'terrace', 'dogleg', 'mesa', 'pinball', 'bunkers', 'neck']
export const STYLES: readonly Style[] = ['garden', 'ice', 'moon']

/** Kinds that don't belong in a place: sand is a garden's. */
const NOT_HERE: Record<Style, readonly Kind[]> = { garden: [], ice: ['bunkers'], moon: ['bunkers'] }

/** A day's hole: what kind, where, and which of the generator's tries at it. */
export type DailyPick = { kind: Kind; style: Style; k: number }

/** The first day of Today's Hole: #1. */
export const DAILY_EPOCH = '2026-09-25'

/**
 * How each place feels: its pull (m/s²) and its drag. The garden is a quick green; on ice the ball slides
 * further still; on the Moon the ground is rough, to make up for the little pull.
 */
export const FEEL: Record<Style, { gravity: number; friction: number }> = {
  garden: { gravity: 9.81, friction: 0.055 },
  ice: { gravity: 9.81, friction: 0.035 },
  moon: { gravity: 1.62, friction: 0.22 },
}

/**
 * How the ground is shaped in each place: how tall its humps are against the garden's, how steeply its
 * far end leans, and how plainly the green's colour shows it all (HoleDef.relief). A slope on the Moon
 * pulls a sixth as hard, so there it's all built steeper; on ice a ball can't come to rest on more than
 * 1.4 × its drag (5 in a hundred), so the lean there is gentler.
 */
const GROUND: Record<Style, { humps: number; lean: readonly [number, number]; relief: number }> = {
  garden: { humps: 1, lean: [0.025, 0.045], relief: 4 },
  ice: { humps: 1, lean: [0.012, 0.022], relief: 4 },
  moon: { humps: 2.4, lean: [0.07, 0.12], relief: 1.8 },
}

type Rand = () => number
const between = (r: Rand, a: number, b: number) => a + r() * (b - a)
const sign = (r: Rand): -1 | 1 => (r() < 0.5 ? -1 : 1)
const pick = <T>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length)]!

/** How far (x, z) is from the segment a–b. */
function toSegment(x: number, z: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(x - a[0] - k * dx, z - a[1] - k * dz)
}

/** A day's green before it's a HoleDef. */
type Green = {
  green: Pt[]
  tee: Spot
  target: Spot
  height: (x: number, z: number) => number
  walls: WallDef[]
  bumpers: Bumper[]
  /** Which rails round the edge are rubber, by where their middle is. */
  rubber?: (x: number, z: number) => number | undefined
  /** Which rails round the edge are cushions: the far end, so a putt too hard stays there. */
  soft: (x: number, z: number) => boolean
  sand?: (x: number, z: number) => boolean
  water?: number
  lost?: Lost
  note: string
}

const TEE_END = 15
const TEE_Z = 13.5

type Hump = { x: number; z: number; h: number; s: number }
const humpsAt = (humps: readonly Hump[], x: number, z: number) => humps.reduce((h, k) => h + k.h * gauss(x, z, k.x, k.z, k.s), 0)

/** The far end's lean: across the green, a little along it at most, from about z −2 on up. */
function leaning(r: Rand, style: Style) {
  const lean = between(r, GROUND[style].lean[0], GROUND[style].lean[1])
  const phi = (sign(r) * between(r, 70, 110) * Math.PI) / 180
  const up = { x: Math.sin(phi), z: -Math.cos(phi) }
  const from = between(r, -3, -1)
  return {
    at: (x: number, z: number) => lean * (up.x * x + up.z * (z - from)) * smooth(from, from - 4, z),
    /** Which way it falls, in words. */
    words: () => {
      const across = Math.abs(up.x) >= Math.abs(up.z)
      const way = across ? (up.x > 0 ? 'to the left' : 'to the right') : up.z < 0 ? 'towards you' : 'away from you'
      const also = across && Math.abs(up.z) > 0.3 ? (up.z < 0 ? ' and a little towards you' : ' and a little away') : ''
      return `The far end falls ${way}${also}.`
    },
  }
}

/** Where a side of the green steps in: from `from` along to `to`, by `inset`. */
type Step = { from: number; to: number; inset: number } | null

/** A green `half` either side, from the tee end to `zEnd`, its sides stepping in where they do. */
function outline(half: number, zEnd: number, right: Step, left: Step) {
  const inAt = (s: Step, z: number) => (s ? s.inset * smooth(s.from, s.to, z) : 0)
  const rightAt = (z: number) => half - inAt(right, z)
  const leftAt = (z: number) => -half + inAt(left, z)
  const pts: Pt[] = [
    [-half, TEE_END],
    [half, TEE_END],
  ]
  if (right) pts.push([half, right.from], [half - right.inset, right.to])
  pts.push([rightAt(zEnd), zEnd], [leftAt(zEnd), zEnd])
  if (left) pts.push([-half + left.inset, left.to], [-half, left.from])
  return { green: rounded(pts, 1), rightAt, leftAt }
}

/** A green with one side stepping in as a rubber bank, and sometimes the other as plain wall. */
function bankedBox(r: Rand, half: number, zEnd: number, other = 0.45) {
  const side = sign(r)
  const step = (on: boolean): Step => {
    if (!on) return null
    const from = between(r, -2, 2.5)
    return { from, to: from - between(r, 4.5, 7), inset: between(r, 1.5, 2.5) }
  }
  const right = step(side === 1 || r() < other)
  const left = step(side === -1 || r() < other)
  const squeeze = Math.min(1, (2 * half - 8.5) / ((right?.inset ?? 0) + (left?.inset ?? 0) || 1))
  if (right) right.inset *= squeeze
  if (left) left.inset *= squeeze
  const o = outline(half, zEnd, right, left)
  const s = side === 1 ? right! : left!
  const a: Pt = [side * half, s.from]
  const b: Pt = [side * (half - s.inset), s.to]
  return { ...o, side, rubber: (x: number, z: number) => (toSegment(x, z, a, b) < 0.25 ? 0.9 : undefined) }
}

/** Rocks: a pair either side of the way up from the tee, or `n` about the middle where `clear` allows. */
function rocks(
  r: Rand,
  tee: Spot,
  leftAt: (z: number) => number,
  rightAt: (z: number) => number,
  clear: (x: number, z: number) => boolean,
  n = 2 + Math.floor(r() * 2),
) {
  const out: Bumper[] = []
  if (r() < 0.5) {
    const z = between(r, 6, 8.5)
    const w = between(r, 2.4, 3.6)
    for (const side of [-1, 1]) {
      const rz = z + between(r, -0.8, 0.8)
      const rx = Math.max(leftAt(rz) + 1.2, Math.min(rightAt(rz) - 1.2, tee.x + side * w + between(r, -0.4, 0.4)))
      out.push({ x: rx, z: rz, r: between(r, 0.4, 0.55), rock: true })
    }
    return { rocks: out, gate: true }
  }
  for (let tries = 0; out.length < n && tries < 60; tries++) {
    const z = between(r, -2.5, 8.5)
    const x = between(r, leftAt(z) + 1.4, rightAt(z) - 1.4)
    if (Math.hypot(x - tee.x, z - tee.z) < 4) continue
    if (out.some((b) => Math.hypot(b.x - x, b.z - z) < 2.6)) continue
    if (!clear(x, z)) continue
    out.push({ x, z, r: between(r, 0.4, 0.55), rock: true })
  }
  return { rocks: out, gate: false }
}

/** A hill somewhere in the middle and up to `most` smaller humps clear of it and of the tee. */
function hillAndHumps(
  r: Rand,
  style: Style,
  half: number,
  tee: Spot,
  leftAt: (z: number) => number,
  rightAt: (z: number) => number,
  most = 3,
  zRange: readonly [number, number] = [-4, 9],
) {
  const g = GROUND[style].humps
  const hill: Hump = { x: between(r, -half * 0.3, half * 0.3), z: between(r, 0, 5), h: between(r, 0.45, 0.7) * g, s: between(r, 1.9, 2.6) }
  const humps: Hump[] = [hill]
  const count = 1 + Math.floor(r() * most)
  for (let tries = 0; humps.length < count + 1 && tries < 60; tries++) {
    const z = between(r, zRange[0], zRange[1])
    const x = between(r, leftAt(z) + 1.5, rightAt(z) - 1.5)
    const s = between(r, 1, 1.6)
    if (humps.some((h) => Math.hypot(x - h.x, z - h.z) < h.s + s + 0.8)) continue
    if (Math.hypot(x - tee.x, z - tee.z) < 4.5) continue
    humps.push({ x, z, h: between(r, 0.18, 0.34) * g, s })
  }
  return humps
}

/** The target: the first of `candidate`'s tries that's somewhere a ball can come to rest. */
function targetAt(style: Style, height: (x: number, z: number) => number, candidate: () => Spot | null, fallback: Spot): Spot {
  const rest = 1.4 * FEEL[style].friction
  const e = 0.01
  for (let tries = 0; tries < 100; tries++) {
    const t = candidate()
    if (!t) continue
    const sl = Math.hypot(height(t.x + e, t.z) - height(t.x - e, t.z), height(t.x, t.z + e) - height(t.x, t.z - e)) / (2 * e)
    if (sl <= 0.6 * rest) return t
  }
  return fallback
}

const farEnd = (zEnd: number) => (_x: number, z: number) => z < zEnd + 0.6
const PLACE_NOTES: Record<Style, string> = {
  garden: '',
  ice: ' On the ice it slides further still.',
  moon: ' On the Moon the ball floats off every crest.',
}

/* ----------------------------------------------------------- the kinds --- */

/** A hill and humps, a log across the far end, rocks, and a rubber bank: Bumps and Banks. */
function bumps(r: Rand, style: Style): Green {
  const half = between(r, 6, 8)
  const zEnd = -between(r, 12.5, 16.5)
  const box = bankedBox(r, half, zEnd)
  const tee = { x: between(r, -1.5, 1.5), z: TEE_Z }
  const humps = hillAndHumps(r, style, half, tee, box.leftAt, box.rightAt)
  const lean = leaning(r, style)
  const height = (x: number, z: number) => humpsAt(humps, x, z) + lean.at(x, z)
  const logZ = between(r, -6.5, -3.5)
  const len = between(r, 3.5, 5.2)
  const lo = box.leftAt(logZ) + 1.6 + len / 2
  const hi = box.rightAt(logZ) - 1.6 - len / 2
  const logX = lo < hi ? between(r, lo, hi) : (lo + hi) / 2
  const turn = between(r, -0.3, 0.3)
  const logA: Pt = [logX - (Math.cos(turn) * len) / 2, logZ - (Math.sin(turn) * len) / 2]
  const logB: Pt = [logX + (Math.cos(turn) * len) / 2, logZ + (Math.sin(turn) * len) / 2]
  const rk = rocks(r, tee, box.leftAt, box.rightAt, (x, z) => toSegment(x, z, logA, logB) > 1.6)
  const target = targetAt(
    style,
    height,
    () => {
      const z = between(r, zEnd + 2.2, Math.min(logZ - 2, -7))
      const x = between(r, box.leftAt(z) + 1.3, box.rightAt(z) - 1.3)
      if (toSegment(x, z, logA, logB) < 1.4 || rk.rocks.some((b) => Math.hypot(b.x - x, b.z - z) < 1.8)) return null
      return { x, z }
    },
    { x: (box.leftAt(zEnd + 3) + box.rightAt(zEnd + 3)) / 2, z: zEnd + 3 },
  )
  const rockWords = rk.gate ? 'between the rocks or round them' : 'round the rocks'
  return {
    green: box.green,
    tee,
    target,
    height,
    walls: [{ ax: logA[0], az: logA[1], bx: logB[0], bz: logB[1], name: 'the log' }],
    bumpers: rk.rocks,
    rubber: box.rubber,
    soft: farEnd(zEnd),
    note: `Curve it off the humps, ${rockWords}, and past the log: the rubber on the ${box.side === 1 ? 'right' : 'left'} can bank it in. ${lean.words()}`,
  }
}

/** Water in the way, off to one side of the middle, with dry ground round it and a hump on the dry side. */
function pond(r: Rand, style: Style): Green {
  const half = between(r, 6.5, 8)
  const zEnd = -between(r, 13, 16.5)
  const o = outline(half, zEnd, null, null)
  const tee = { x: between(r, -1.2, 1.2), z: TEE_Z }
  const side = sign(r)
  const cx = side * between(r, 0.5, 2.6)
  const cz = between(r, -3, 2.5)
  const rx = between(r, 2.4, 3.6)
  const rz = between(r, 2.3, 3.4)
  const turn = between(r, -0.5, 0.5)
  const g = GROUND[style].humps
  const into = (x: number, z: number) => {
    const u = ((x - cx) * Math.cos(turn) + (z - cz) * Math.sin(turn)) / rx
    const v = (-(x - cx) * Math.sin(turn) + (z - cz) * Math.cos(turn)) / rz
    return Math.hypot(u, v)
  }
  const dry: Hump = { x: -side * between(r, 1.8, 3.8), z: between(r, -1, 5), h: between(r, 0.28, 0.42) * g, s: between(r, 1.2, 1.8) }
  const lean = leaning(r, style)
  // The water sits below the lowest the far end leans to, so the pond is the only water there is.
  const low = Math.min(0, lean.at(-half, zEnd), lean.at(half, zEnd))
  const water = low - 0.12 * g
  const floor = water - 0.35 * g
  const height = (x: number, z: number) => floor * smooth(1.25, 0.8, into(x, z)) + humpsAt([dry], x, z) + lean.at(x, z)
  // The wall beside the pond is rubber: a putt along the edge can bank off it.
  const rubberFrom = cz + rz + 1
  const rubberTo = cz - rz - 1
  const rk = rocks(r, tee, o.leftAt, o.rightAt, (x, z) => into(x, z) > 1.5 && Math.hypot(x - dry.x, z - dry.z) > dry.s, 1 + Math.floor(r() * 2))
  const target = targetAt(
    style,
    height,
    () => {
      const z = between(r, zEnd + 2, Math.min(cz - rz - 1.8, -6.5))
      const x = between(r, o.leftAt(z) + 1.3, o.rightAt(z) - 1.3)
      if (into(x, z) < 1.6 || rk.rocks.some((b) => Math.hypot(b.x - x, b.z - z) < 1.8)) return null
      return { x, z }
    },
    { x: 0, z: zEnd + 3 },
  )
  const lost: Lost = style === 'moon' ? 'crater' : style === 'ice' ? 'ice' : 'water'
  const what = style === 'moon' ? 'crater' : style === 'ice' ? 'open water' : 'pond'
  return {
    green: o.green,
    tee,
    target,
    height,
    walls: [],
    bumpers: rk.rocks,
    rubber: (x, z) => (Math.sign(x) === side && Math.abs(x) > half - 0.2 && z < rubberFrom && z > rubberTo ? 0.9 : undefined),
    soft: farEnd(zEnd),
    water,
    lost,
    note: `The ${what} is in the way: round it over the hump, or along its edge off the rubber, and too wide it's in. ${lean.words()}`,
  }
}

/** A wall right across the green with two or three gaps in it; humps on either side. */
function gates(r: Rand, style: Style): Green {
  const half = between(r, 6, 7.5)
  const zEnd = -between(r, 13, 16.5)
  const o = outline(half, zEnd, null, null)
  const tee = { x: between(r, -1.5, 1.5), z: TEE_Z }
  const wz = between(r, -4, -1.5)
  const n = r() < 0.5 ? 2 : 3
  // The gaps spread across it, each in its own share of the width, clear of the sides.
  const gaps: { x0: number; x1: number }[] = []
  const share = (2 * half - 2) / n
  for (let i = 0; i < n; i++) {
    const w = between(r, 1.3, 2)
    const lo = -half + 1 + share * i
    const x0 = between(r, lo + 0.3, lo + share - w - 0.3)
    gaps.push({ x0, x1: x0 + w })
  }
  const walls: WallDef[] = []
  let from = -half
  for (const gp of gaps) {
    if (gp.x0 - from > 0.2) walls.push({ ax: from, az: wz, bx: gp.x0, bz: wz, name: 'the wall' })
    from = gp.x1
  }
  if (half - from > 0.2) walls.push({ ax: from, az: wz, bx: half, bz: wz, name: 'the wall' })
  const g = GROUND[style].humps
  const humps: Hump[] = [
    { x: between(r, -half * 0.4, half * 0.4), z: between(r, 2, 7), h: between(r, 0.4, 0.6) * g, s: between(r, 1.7, 2.3) },
    { x: between(r, -half + 2, half - 2), z: wz - between(r, 2.5, 4), h: between(r, 0.18, 0.3) * g, s: between(r, 1.1, 1.5) },
  ]
  const lean = leaning(r, style)
  const height = (x: number, z: number) => humpsAt(humps, x, z) + lean.at(x, z)
  const target = targetAt(
    style,
    height,
    () => {
      const z = between(r, zEnd + 2, wz - 2.5)
      return { x: between(r, -half + 1.3, half - 1.3), z }
    },
    { x: 0, z: zEnd + 3 },
  )
  return {
    green: o.green,
    tee,
    target,
    height,
    walls,
    bumpers: [],
    soft: farEnd(zEnd),
    note: `A wall right across, with ${n} gaps: pick your gap, and let the ground bring it round to the target. ${lean.words()}`,
  }
}

/** A lower level and an upper one, with a steep step between them; the target on the upper. */
function terrace(r: Rand, style: Style): Green {
  const half = between(r, 6, 7.5)
  const zEnd = -between(r, 13, 16.5)
  const box = bankedBox(r, half, zEnd, 0.3)
  const tee = { x: between(r, -1.5, 1.5), z: TEE_Z }
  const zs = between(r, -4, -1)
  const slant = between(r, -0.18, 0.18)
  const g = GROUND[style].humps
  const rise = between(r, 0.35, 0.55) * g
  const w = between(r, 2, 2.8) * (style === 'moon' ? 1.6 : 1)
  const edge = (x: number) => zs + slant * x
  const humps = hillAndHumps(r, style, half, tee, box.leftAt, box.rightAt, 1, [edge(0) + 3, 9])
  const lean = leaning(r, style)
  const height = (x: number, z: number) => rise * smooth(edge(x) + w / 2, edge(x) - w / 2, z) + humpsAt(humps, x, z) + lean.at(x, z)
  const rk = rocks(r, tee, box.leftAt, box.rightAt, (x, z) => z > edge(x) + w / 2 + 1)
  const target = targetAt(
    style,
    height,
    () => {
      const z = between(r, zEnd + 2, edge(0) - w / 2 - 2)
      const x = between(r, box.leftAt(z) + 1.3, box.rightAt(z) - 1.3)
      if (z > edge(x) - w / 2 - 1.2) return null
      return { x, z }
    },
    { x: 0, z: zEnd + 3 },
  )
  return {
    green: box.green,
    tee,
    target,
    height,
    walls: [],
    bumpers: rk.rocks,
    rubber: box.rubber,
    soft: farEnd(zEnd),
    note: `Up the step to the top level: too soft and it rolls back down, too hard and it runs on to the back. ${lean.words()}`,
  }
}

/** The green turns a corner: up the first arm, round a rubber bank on the outside, and along the second. */
function dogleg(r: Rand, style: Style): Green {
  const side = sign(r)
  const a = between(r, 4, 5)
  const b = between(r, 3.8, 4.8)
  const zTop = -between(r, 9, 12)
  const zc = zTop + 2 * b
  const reach = between(r, 8, 11)
  const far = a + reach
  // Drawn turning right, then turned whichever way the day turns.
  const right: Pt[] = [
    [-a, TEE_END],
    [a, TEE_END],
    [a, zc],
    [far, zc],
    [far, zTop],
    [-a, zTop],
  ]
  const pts = side === 1 ? right : right.map(([x, z]) => [-x, z] as Pt).reverse()
  const c = between(r, 2.2, 3.2)
  const bankA: Pt = [-a * side, zTop + c]
  const bankB: Pt = [(-a + c) * side, zTop]
  const g = GROUND[style].humps
  const humps: Hump[] = [
    { x: side * between(r, -a + 1.5, a - 1.5), z: between(r, 2, 8), h: between(r, 0.4, 0.6) * g, s: between(r, 1.5, 2.1) },
    { x: side * between(r, a + 1.5, far - 2), z: zTop + b + between(r, -1, 1), h: between(r, 0.2, 0.32) * g, s: between(r, 1.1, 1.5) },
  ]
  // The far arm leans across itself, towards the tee end or away from it.
  const lean = between(r, GROUND[style].lean[0], GROUND[style].lean[1]) * sign(r)
  const height = (x: number, z: number) => humpsAt(humps, x, z) + lean * (z - (zTop + b)) * smooth(a - 0.5, a + 2.5, x * side)
  const tee = { x: side * between(r, -1, 1), z: TEE_Z }
  const target = targetAt(
    style,
    height,
    () => {
      const x = side * between(r, a + 1.8, far - 1.3)
      const z = between(r, zTop + 1.2, zc - 1.2)
      if (Math.hypot(x - humps[1]!.x, z - humps[1]!.z) < 1) return null
      return { x, z }
    },
    { x: side * (far - 2), z: zTop + b },
  )
  const rock: Bumper = { x: side * between(r, a + 0.8, a + 2.2), z: zc - between(r, 0.8, 1.6), r: between(r, 0.4, 0.5), rock: true }
  return {
    green: rounded(pts, 1),
    tee,
    target,
    height,
    walls: [{ ax: bankA[0], az: bankA[1], bx: bankB[0], bz: bankB[1], e: 0.9, rubber: true }],
    bumpers: Math.hypot(rock.x - target.x, rock.z - target.z) > 1.8 ? [rock] : [],
    soft: (x) => x * side > far - 0.3,
    note: `Round the corner to the ${side === 1 ? 'right' : 'left'}: bank it off the rubber or curve it round the inside, and stop it in the far arm.`,
  }
}

/** The target on top of a raised plateau: climb it and stop on top. */
function mesa(r: Rand, style: Style): Green {
  const half = between(r, 6.5, 8)
  const zEnd = -between(r, 13, 16.5)
  const box = bankedBox(r, half, zEnd, 0.3)
  const tee = { x: between(r, -1.5, 1.5), z: TEE_Z }
  const g = GROUND[style].humps
  const R = between(r, 2.2, 3)
  const H = between(r, 0.32, 0.45) * g
  const flank = 1.5 * (style === 'moon' ? 2.2 : 1)
  const cz = between(r, zEnd + R + flank + 1, -4.5)
  const cx = between(r, box.leftAt(cz) + R + flank + 0.6, box.rightAt(cz) - R - flank - 0.6)
  const humps = hillAndHumps(r, style, half, tee, box.leftAt, box.rightAt, 1, [cz + R + flank + 2.5, 9])
  const height = (x: number, z: number) => H * smooth(R + flank, R, Math.hypot(x - cx, z - cz)) + humpsAt(humps, x, z)
  const rk = rocks(r, tee, box.leftAt, box.rightAt, (x, z) => Math.hypot(x - cx, z - cz) > R + flank + 1)
  const target = targetAt(
    style,
    height,
    () => {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * (R - 0.8)
      return { x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d }
    },
    { x: cx, z: cz },
  )
  return {
    green: box.green,
    tee,
    target,
    height,
    walls: [],
    bumpers: rk.rocks,
    rubber: box.rubber,
    soft: farEnd(zEnd),
    note: `The target's up on the mesa: too soft and it rolls back down its side, too hard and it runs off the far edge.`,
  }
}

/** Springy rubber posts in the middle and a slingshot either side, to bounce off. */
function pinball(r: Rand, style: Style): Green {
  const half = between(r, 6, 7.5)
  const zEnd = -between(r, 13, 16.5)
  const o = outline(half, zEnd, null, null)
  const tee = { x: between(r, -1.5, 1.5), z: TEE_Z }
  const posts: Bumper[] = []
  const n = 4 + Math.floor(r() * 3)
  for (let tries = 0; posts.length < n && tries < 80; tries++) {
    const z = between(r, -5, 8)
    const x = between(r, -half + 1.4, half - 1.4)
    if (Math.hypot(x - tee.x, z - tee.z) < 4) continue
    if (posts.some((p) => Math.hypot(p.x - x, p.z - z) < 2.3)) continue
    posts.push({ x, z, r: between(r, 0.3, 0.5), e: 0.9 })
  }
  const walls: WallDef[] = []
  for (const s of [-1, 1]) {
    const z1 = between(r, -1, 4)
    walls.push({ ax: s * (half - 0.6), az: z1, bx: s * (half - between(r, 2, 2.8)), bz: z1 - between(r, 1.6, 2.4), e: 0.92, rubber: true })
  }
  const g = GROUND[style].humps
  const hill: Hump = { x: between(r, -half * 0.3, half * 0.3), z: between(r, -8, -6), h: between(r, 0.2, 0.32) * g, s: between(r, 1.3, 1.8) }
  const lean = leaning(r, style)
  const height = (x: number, z: number) => humpsAt([hill], x, z) + lean.at(x, z)
  const target = targetAt(
    style,
    height,
    () => {
      const z = between(r, zEnd + 2, -6.5)
      const x = between(r, -half + 1.3, half - 1.3)
      if (posts.some((p) => Math.hypot(p.x - x, p.z - z) < 1.8)) return null
      return { x, z }
    },
    { x: 0, z: zEnd + 3 },
  )
  return {
    green: o.green,
    tee,
    target,
    height,
    walls,
    bumpers: posts,
    soft: farEnd(zEnd),
    note: `Springy posts and a slingshot either side: thread the gaps or bounce it through. ${lean.words()}`,
  }
}

/** Bunkers round the target and on the way to it, where a ball slows four times as fast. */
function bunkers(r: Rand, style: Style): Green {
  const half = between(r, 6.5, 8)
  const zEnd = -between(r, 13, 16.5)
  const box = bankedBox(r, half, zEnd, 0.3)
  const tee = { x: between(r, -1.5, 1.5), z: TEE_Z }
  const humps = hillAndHumps(r, style, half, tee, box.leftAt, box.rightAt, 2)
  const lean = leaning(r, style)
  const ground = (x: number, z: number) => humpsAt(humps, x, z) + lean.at(x, z)
  // The target first, then the sand round it and on the way to it.
  const target = targetAt(
    style,
    ground,
    () => {
      const z = between(r, zEnd + 2.5, -7)
      return { x: between(r, box.leftAt(z) + 1.8, box.rightAt(z) - 1.8), z }
    },
    { x: 0, z: zEnd + 3 },
  )
  type Blob = { x: number; z: number; rx: number; rz: number; turn: number; wob: number }
  const blobs: Blob[] = []
  const inBlob = (k: Blob, x: number, z: number) => {
    const u = ((x - k.x) * Math.cos(k.turn) + (z - k.z) * Math.sin(k.turn)) / k.rx
    const v = (-(x - k.x) * Math.sin(k.turn) + (z - k.z) * Math.cos(k.turn)) / k.rz
    return Math.hypot(u, v) / (1 + 0.12 * Math.sin(3 * Math.atan2(v, u) + k.wob))
  }
  const near = 1 + Math.floor(r() * 2)
  for (let tries = 0; blobs.length < near + 2 && tries < 80; tries++) {
    const close = blobs.length < near
    const a = r() * Math.PI * 2
    const d = close ? between(r, 2, 3.2) : 0
    const x = close ? target.x + Math.cos(a) * d : between(r, -half + 2, half - 2)
    const z = close ? target.z + Math.sin(a) * d * 0.8 : between(r, -5, 6)
    const k = { x, z, rx: between(r, 1.1, 2), rz: between(r, 0.9, 1.6), turn: r() * Math.PI, wob: r() * 6 }
    if (inBlob(k, target.x, target.z) < 1.4) continue
    if (Math.hypot(x - tee.x, z - tee.z) < 4.5) continue
    if (x < box.leftAt(z) + 1 || x > box.rightAt(z) - 1) continue
    blobs.push(k)
  }
  const sand = (x: number, z: number) => blobs.some((k) => inBlob(k, x, z) < 1)
  // The sand sits a little low, as a bunker does.
  const height = (x: number, z: number) => ground(x, z) - 0.05 * blobs.reduce((m, k) => Math.max(m, smooth(1.15, 0.9, inBlob(k, x, z))), 0)
  return {
    green: box.green,
    tee,
    target,
    height,
    walls: [],
    bumpers: [],
    rubber: box.rubber,
    soft: farEnd(zEnd),
    sand,
    note: `Bunkers guard the target, and the sand takes the pace off a ball: short or wide, and it stops in the sand. ${lean.words()}`,
  }
}

/** The green squeezes to a narrow neck between rubber banks, and opens out again beyond. */
function neck(r: Rand, style: Style): Green {
  const half = between(r, 6.5, 8)
  const zEnd = -between(r, 13, 16.5)
  const tee = { x: between(r, -1.5, 1.5), z: TEE_Z }
  const zn = between(r, -2, 2)
  const nw = between(r, 1.2, 1.7)
  const nx = between(r, -1.5, 1.5)
  const long = between(r, 1.5, 2.5)
  const inLen = between(r, 3, 4.5)
  const outLen = between(r, 3, 4.5)
  const top = zn + long / 2
  const bottom = zn - long / 2
  const pts: Pt[] = [
    [-half, TEE_END],
    [half, TEE_END],
    [half, top + inLen],
    [nx + nw, top],
    [nx + nw, bottom],
    [half, bottom - outLen],
    [half, zEnd],
    [-half, zEnd],
    [-half, bottom - outLen],
    [nx - nw, bottom],
    [nx - nw, top],
    [-half, top + inLen],
  ]
  const inR: [Pt, Pt] = [
    [half, top + inLen],
    [nx + nw, top],
  ]
  const inL: [Pt, Pt] = [
    [-half, top + inLen],
    [nx - nw, top],
  ]
  const g = GROUND[style].humps
  const humps: Hump[] = [
    { x: nx + sign(r) * between(r, 1.5, 3), z: top + inLen + between(r, 1.5, 3.5), h: between(r, 0.3, 0.5) * g, s: between(r, 1.3, 1.9) },
    { x: between(r, -half + 2, half - 2), z: bottom - outLen - between(r, 0.5, 2.5), h: between(r, 0.18, 0.3) * g, s: between(r, 1.1, 1.5) },
  ]
  const lean = leaning(r, style)
  const height = (x: number, z: number) => humpsAt(humps, x, z) + lean.at(x, z)
  const target = targetAt(
    style,
    height,
    () => {
      const z = between(r, zEnd + 2, bottom - outLen - 1.5)
      return { x: between(r, -half + 1.3, half - 1.3), z }
    },
    { x: 0, z: zEnd + 3 },
  )
  return {
    green: rounded(pts, 0.8),
    tee,
    target,
    height,
    walls: [],
    bumpers: [],
    // The walls running in to the neck are rubber: bank it in.
    rubber: (x, z) => (toSegment(x, z, inR[0], inR[1]) < 0.25 || toSegment(x, z, inL[0], inL[1]) < 0.25 ? 0.88 : undefined),
    soft: farEnd(zEnd),
    note: `Thread the neck: bank it in off the rubber or curve it through, and let it break to the target. ${lean.words()}`,
  }
}

const BUILD: Record<Kind, (r: Rand, style: Style) => Green> = { bumps, pond, gates, terrace, dogleg, mesa, pinball, bunkers, neck }

/* ------------------------------------------------------ names and words --- */

const PLACE_WORDS: Record<Style, readonly string[]> = {
  garden: ['Meadow', 'Willow', 'Clover', 'Bramble', 'Orchard', 'Foxglove', 'Primrose', 'Hollyhock'],
  ice: ['Frost', 'Glacier', 'Icicle', 'Polar', 'Snowdrift', 'Blizzard', 'Tundra', 'Hailstone'],
  moon: ['Crater', 'Lunar', 'Moonbeam', 'Tranquility', 'Orbit', 'Selene', 'Stardust', 'Apollo'],
}

const KIND_WORDS: Record<Kind, readonly string[]> = {
  bumps: ['Knolls', 'Bumps', 'Hillocks', 'Humps'],
  pond: ['Pond', 'Pool', 'Lagoon', 'Waters'],
  gates: ['Gates', 'Wall', 'Gaps', 'Portcullis'],
  terrace: ['Terrace', 'Steps', 'Tiers', 'Ledge'],
  dogleg: ['Dogleg', 'Elbow', 'Corner', 'Bend'],
  mesa: ['Mesa', 'Tabletop', 'Plateau', 'Butte'],
  pinball: ['Pinball', 'Bumpers', 'Arcade', 'Flipper'],
  bunkers: ['Bunkers', 'Sands', 'Traps', 'Dunes'],
  neck: ['Narrows', 'Neck', 'Hourglass', 'Squeeze'],
}

/* --------------------------------------------------------------- the day --- */

/** Days since Today's Hole began: #1 on its first day. */
export function dailyNumber(day: string): number {
  const at = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number)
    return Date.UTC(y!, m! - 1, dd!)
  }
  return Math.round((at(day) - at(DAILY_EPOCH)) / 86_400_000) + 1
}

function shuffled<T>(list: readonly T[], key: string): T[] {
  const rand = mulberry32(hashString(key))
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** The kinds a place has, in the order a day falls back through them. */
export function kindsFor(style: Style): readonly Kind[] {
  return KINDS.filter((k) => !NOT_HERE[style].includes(k))
}

/**
 * The kind and place a day starts from, before checking: a week has five gardens, a rink and a Moon day in
 * a shuffled order, and the nine kinds come round in a shuffle of their own, skipping a kind the place
 * doesn't have and the kind the day before had.
 */
export function plannedPick(n: number): Omit<DailyPick, 'k'> {
  let before: Kind | null = null
  let choice: Omit<DailyPick, 'k'> = { kind: 'bumps', style: 'garden' }
  for (let d = 1; d <= n; d++) {
    choice = startingPick(d, before)
    before = choice.kind
  }
  return choice
}

function startingPick(n: number, avoid: Kind | null): Omit<DailyPick, 'k'> {
  const week = Math.floor((n - 1) / 7)
  const style = shuffled(['garden', 'garden', 'garden', 'garden', 'garden', 'ice', 'moon'] as const, `acechase:places:${week}`)[(n - 1) % 7]!
  const round = Math.floor((n - 1) / KINDS.length)
  const order = shuffled(KINDS, `acechase:kinds:${round}`)
  const start = (n - 1) % KINDS.length
  for (let i = 0; i < order.length; i++) {
    const kind = order[(start + i) % order.length]!
    if (kind !== avoid && !NOT_HERE[style].includes(kind)) return { kind, style }
  }
  return { kind: 'bumps', style }
}

/** A day's hole, built: the same numbers make the same hole on any device. */
export function dailyHoleDef(choice: DailyPick, day: string): HoleDef {
  const r = mulberry32(hashString(`acechase:${choice.kind}:${day}:${choice.style}:${choice.k}`))
  const p = BUILD[choice.kind](r, choice.style)
  const words = mulberry32(hashString(`acechase:name:${day}`))
  return {
    name: `${pick(words, PLACE_WORDS[choice.style])} ${pick(words, KIND_WORDS[choice.kind])}`,
    note: p.note + PLACE_NOTES[choice.style],
    green: p.green,
    tee: p.tee,
    height: (x, z) => p.height(x, z),
    spots: [p.target],
    walls: p.walls,
    bumpers: p.bumpers,
    soft: p.soft,
    rubber: p.rubber,
    sand: p.sand,
    water: p.water,
    lost: p.lost,
    style: choice.style,
    gravity: FEEL[choice.style].gravity,
    friction: FEEL[choice.style].friction,
    laid: true,
    relief: GROUND[choice.style].relief,
  }
}
