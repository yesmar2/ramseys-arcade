/**
 * Ace Chase: Today's Hole. A new hole every day, the same for everyone, built from the date.
 *
 * Every day's hole is a big open green walled all round, in the spirit of Bumps and Banks (./bumpsBanks):
 * a hill that bends a putt off whichever side it passes and smaller humps about it, a far end that leans
 * so a putt breaks as it dies, rocks and a log in the way, and a stretch of wall that steps in at an angle
 * as a rubber bank to play off. Where it all is, how big, and which way the far end leans come from a
 * generator seeded with the date, and so does the place, which changes how it plays as well as how it
 * looks:
 * - a garden, a quick green;
 * - an ice rink, where the ball slides further still and the target is a curling house;
 * - the Moon, where a slope pulls a sixth as hard, so its ground is built steeper, and the ball floats off
 *   every crest.
 * Not every green the generator makes is a good one, so each day's is checked before it goes out
 * (scripts/acechase-daily.mjs plays every power and angle, and keeps a green only if its target has a way
 * in a player can find, and doesn't give it away), and the checked choice is kept in dailyPlan.ts.
 *
 * Imports only other files that import nothing, so the checker can run this with plain Node.
 */
import { hashString, mulberry32 } from '../../lib/seededRandom.ts'
import { gauss, rounded, smooth, type Bumper, type HoleDef, type Pt, type Spot, type Style, type WallDef } from './physics.ts'

export const STYLES: readonly Style[] = ['garden', 'ice', 'moon']

/** A day's hole: where, and which of the generator's tries at it. */
export type DailyPick = { style: Style; k: number }

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

/** A day's green before it's a HoleDef: its outline, tee and target, its ground, and what stands on it. */
type Green = {
  green: Pt[]
  tee: Spot
  target: Spot
  zEnd: number
  height: (x: number, z: number) => number
  walls: WallDef[]
  bumpers: Bumper[]
  /** The rubber bank: the stretch of wall that steps in. */
  bank: { a: Pt; b: Pt; side: -1 | 1 }
  /** Which way the far end falls, for the note: the way down, x across and z along. */
  falls: { x: number; z: number }
  gate: boolean
}

const TEE_END = 15
const TEE_Z = 13.5

/** Where a side of the green steps in: from `from` along to `to`, by `inset`. */
type Step = { from: number; to: number; inset: number } | null

/** A day's green, from the generator's numbers. */
function buildGreen(r: Rand, style: Style): Green {
  const ground = GROUND[style]
  const half = between(r, 6, 8)
  const zEnd = -between(r, 12.5, 16.5)
  // One side steps in at an angle as the rubber bank; the other sometimes steps in too, as plain wall.
  const bankSide = sign(r)
  const step = (on: boolean): Step => {
    if (!on) return null
    const from = between(r, -2, 2.5)
    return { from, to: from - between(r, 4.5, 7), inset: between(r, 1.5, 2.5) }
  }
  const right = step(bankSide === 1 || r() < 0.45)
  const left = step(bankSide === -1 || r() < 0.45)
  // Never narrower than 8.5 m at the top.
  const squeeze = Math.min(1, (2 * half - 8.5) / ((right?.inset ?? 0) + (left?.inset ?? 0) || 1))
  if (right) right.inset *= squeeze
  if (left) left.inset *= squeeze
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
  const s = bankSide === 1 ? right! : left!
  const bank: Green['bank'] = {
    a: [bankSide * half, s.from],
    b: [bankSide * (half - s.inset), s.to],
    side: bankSide,
  }

  const tee = { x: between(r, -1.5, 1.5), z: TEE_Z }

  // The hill, somewhere in the middle, and one to three smaller humps clear of it and of the tee.
  const hill = { x: between(r, -half * 0.3, half * 0.3), z: between(r, 0, 5), h: between(r, 0.45, 0.7) * ground.humps, s: between(r, 1.9, 2.6) }
  const humps: { x: number; z: number; h: number; s: number }[] = []
  const count = 1 + Math.floor(r() * 3)
  for (let tries = 0; humps.length < count && tries < 60; tries++) {
    const z = between(r, -4, 9)
    const x = between(r, leftAt(z) + 1.5, rightAt(z) - 1.5)
    const sd = between(r, 1, 1.6)
    if (Math.hypot(x - hill.x, z - hill.z) < hill.s + sd + 0.8) continue
    if (humps.some((h) => Math.hypot(x - h.x, z - h.z) < h.s + sd + 0.8)) continue
    if (Math.hypot(x - tee.x, z - tee.z) < 4.5) continue
    humps.push({ x, z, h: between(r, 0.18, 0.34) * ground.humps, s: sd })
  }
  // The far end leans, across the green and a little along it at most, so what reaches the far end doesn't
  // roll all the way back down to the target: `up` is the way it rises.
  const lean = between(r, ground.lean[0], ground.lean[1])
  const phi = (sign(r) * between(r, 70, 110) * Math.PI) / 180
  const up = { x: Math.sin(phi), z: -Math.cos(phi) }
  const leanFrom = between(r, -3, -1)
  const height = (x: number, z: number) => {
    let h = hill.h * gauss(x, z, hill.x, hill.z, hill.s)
    for (const k of humps) h += k.h * gauss(x, z, k.x, k.z, k.s)
    return h + lean * (up.x * x + up.z * (z - leanFrom)) * smooth(leanFrom, leanFrom - 4, z)
  }

  // The log, across the far end, left, middle or right of it, and turned a little.
  const logZ = between(r, -6.5, -3.5)
  const len = between(r, 3.5, 5.2)
  const lo = leftAt(logZ) + 1.6 + len / 2
  const hi = rightAt(logZ) - 1.6 - len / 2
  const logX = lo < hi ? between(r, lo, hi) : (lo + hi) / 2
  const turn = between(r, -0.3, 0.3)
  const logA: Pt = [logX - (Math.cos(turn) * len) / 2, logZ - (Math.sin(turn) * len) / 2]
  const logB: Pt = [logX + (Math.cos(turn) * len) / 2, logZ + (Math.sin(turn) * len) / 2]
  const walls: WallDef[] = [{ ax: logA[0], az: logA[1], bx: logB[0], bz: logB[1], name: 'the log' }]

  // Rocks: a pair either side of the way up from the tee, or two or three about the middle.
  const bumpers: Bumper[] = []
  const gate = r() < 0.5
  if (gate) {
    const z = between(r, 6, 8.5)
    const w = between(r, 2.4, 3.6)
    for (const side of [-1, 1]) {
      const rz = z + between(r, -0.8, 0.8)
      const rx = Math.max(leftAt(rz) + 1.2, Math.min(rightAt(rz) - 1.2, tee.x + side * w + between(r, -0.4, 0.4)))
      bumpers.push({ x: rx, z: rz, r: between(r, 0.4, 0.55), rock: true })
    }
  } else {
    const n = 2 + Math.floor(r() * 2)
    for (let tries = 0; bumpers.length < n && tries < 60; tries++) {
      const z = between(r, -2.5, 8.5)
      const x = between(r, leftAt(z) + 1.4, rightAt(z) - 1.4)
      const rad = between(r, 0.4, 0.55)
      if (Math.hypot(x - tee.x, z - tee.z) < 4) continue
      if (bumpers.some((b) => Math.hypot(b.x - x, b.z - z) < 2.6)) continue
      if (toSegment(x, z, logA, logB) < 1.6) continue
      bumpers.push({ x, z, r: rad, rock: true })
    }
  }

  // The target: beyond the log, clear of it and of the rocks, where a ball can come to rest.
  const rest = 1.4 * FEEL[style].friction
  const slopeAt = (x: number, z: number) => {
    const e = 0.01
    return Math.hypot(height(x + e, z) - height(x - e, z), height(x, z + e) - height(x, z - e)) / (2 * e)
  }
  let target: Spot = { x: (leftAt(zEnd + 3) + rightAt(zEnd + 3)) / 2, z: zEnd + 3 }
  for (let tries = 0; tries < 80; tries++) {
    const z = between(r, zEnd + 2.2, Math.min(logZ - 2, -7))
    const x = between(r, leftAt(z) + 1.3, rightAt(z) - 1.3)
    if (toSegment(x, z, logA, logB) < 1.4) continue
    if (bumpers.some((b) => Math.hypot(b.x - x, b.z - z) < 1.8)) continue
    if (slopeAt(x, z) > 0.6 * rest) continue
    target = { x, z }
    break
  }

  return {
    green: rounded(pts, 1),
    tee,
    target,
    zEnd,
    height,
    walls,
    bumpers,
    bank,
    falls: { x: -up.x, z: -up.z },
    gate,
  }
}

/* ------------------------------------------------------ names and words --- */

const PLACE_WORDS: Record<Style, readonly string[]> = {
  garden: ['Meadow', 'Willow', 'Clover', 'Bramble', 'Orchard', 'Foxglove', 'Primrose', 'Hollyhock'],
  ice: ['Frost', 'Glacier', 'Icicle', 'Polar', 'Snowdrift', 'Blizzard', 'Tundra', 'Hailstone'],
  moon: ['Crater', 'Lunar', 'Moonbeam', 'Tranquility', 'Orbit', 'Selene', 'Stardust', 'Apollo'],
}

const GREEN_WORDS: Record<Style, readonly string[]> = {
  garden: ['Green', 'Commons', 'Lawn', 'Park', 'Glade', 'Knolls'],
  ice: ['Rink', 'Pond', 'Sheet', 'Floe', 'Flats'],
  moon: ['Basin', 'Mare', 'Plain', 'Highlands', 'Uplands'],
}

const PLACE_NOTES: Record<Style, string> = {
  garden: '',
  ice: ' On the ice it slides further still.',
  moon: ' On the Moon the ball floats off every crest.',
}

/** What the note says: what's in the way, where the bank is, and which way the far end falls. */
function noteFor(p: Green, style: Style): string {
  const across = Math.abs(p.falls.x) >= Math.abs(p.falls.z)
  const way = across ? (p.falls.x < 0 ? 'to the left' : 'to the right') : p.falls.z > 0 ? 'towards you' : 'away from you'
  const also = across && Math.abs(p.falls.z) > 0.3 ? (p.falls.z > 0 ? ' and a little towards you' : ' and a little away') : ''
  const rocks = p.gate ? 'between the rocks or round them' : 'round the rocks'
  const bank = p.bank.side === 1 ? 'right' : 'left'
  return `Curve it off the humps, ${rocks}, and past the log: the rubber on the ${bank} can bank it in. The far end falls ${way}${also}.${PLACE_NOTES[style]}`
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

/** Where a day is, before checking: a week has five gardens, a rink and a Moon day, in a shuffled order. */
export function plannedStyle(n: number): Style {
  const week = Math.floor((n - 1) / 7)
  return shuffled(['garden', 'garden', 'garden', 'garden', 'garden', 'ice', 'moon'] as const, `acechase:places:${week}`)[(n - 1) % 7]!
}

/** A day's hole, built: the same numbers make the same hole on any device. */
export function dailyHoleDef(choice: DailyPick, day: string): HoleDef {
  const r = mulberry32(hashString(`acechase:green:${day}:${choice.style}:${choice.k}`))
  const p = buildGreen(r, choice.style)
  const words = mulberry32(hashString(`acechase:name:${day}`))
  const name = `${pick(words, PLACE_WORDS[choice.style])} ${pick(words, GREEN_WORDS[choice.style])}`
  const { zEnd, bank } = p
  return {
    name,
    note: noteFor(p, choice.style),
    green: p.green,
    tee: p.tee,
    height: (x, z) => p.height(x, z),
    spots: [p.target],
    walls: p.walls,
    bumpers: p.bumpers,
    // The far end is a cushion, so a putt too hard stays up there rather than coming back at the target.
    soft: (_x, z) => z < zEnd + 0.6,
    rubber: (x, z) => (toSegment(x, z, bank.a, bank.b) < 0.25 ? 0.9 : undefined),
    style: choice.style,
    gravity: FEEL[choice.style].gravity,
    friction: FEEL[choice.style].friction,
    laid: true,
    relief: GROUND[choice.style].relief,
  }
}
