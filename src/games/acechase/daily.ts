/**
 * Ace Chase: Today's Hole. A new hole every day, the same for everyone, built from the date.
 *
 * A hole is one of six kinds (rollers, a leap, a switchback, a tilted lane, a summit, a lane of posts) in
 * one of three places, and the place changes how it plays as well as how it looks:
 * - a garden, on grass;
 * - an ice rink, where the ball slides more than twice as far and the target is a curling house;
 * - the Moon, where gravity is a sixth of the Earth's, so the ball floats off every crest.
 * Which kind and where comes from a weekly shuffle; the hole's measurements come from a generator seeded
 * with the date. Not every hole a generator makes is a good one, so each day's is checked before it goes
 * out (scripts/acechase-daily.mjs plays every power and angle, and keeps a hole only if it has a way in
 * a player can find by following the misses, and doesn't give it away), and the checked choice is kept
 * in dailyPlan.ts.
 *
 * Imports only other files that import nothing, so the checker can run this with plain Node.
 */
import { hashString, mulberry32 } from '../../lib/seededRandom.ts'
import {
  DISH_D,
  DISH_S,
  band,
  gauss,
  smooth,
  type Bumper,
  type HoleDef,
  type Lost,
  type Pt,
  type Spot,
  type Style,
} from './physics.ts'

export type Family = 'rollers' | 'leap' | 'switchback' | 'tilt' | 'summit' | 'posts'
export const FAMILIES: readonly Family[] = ['rollers', 'leap', 'switchback', 'tilt', 'summit', 'posts']
export const STYLES: readonly Style[] = ['garden', 'ice', 'moon']

/**
 * Kinds that don't work in a place. On the Moon a leap either sails past the landing or drops into the
 * crater, with hardly a setting between; on ice a switchback's rubber banks never let the ball settle.
 */
const NOT_HERE: Record<Style, readonly Family[]> = { garden: [], ice: ['switchback'], moon: ['leap'] }

/** The kinds a place has, in the order a day falls back through them. */
export function kindsFor(style: Style): readonly Family[] {
  return FAMILIES.filter((f) => !NOT_HERE[style].includes(f))
}

/** A day's hole: what kind, where, and which of the generator's tries at it. */
export type DailyPick = { family: Family; style: Style; k: number }

/** The first day of Today's Hole: #1. */
export const DAILY_EPOCH = '2026-09-25'

/** How each place feels: its pull (m/s²) and its drag. On the Moon the ground is rough, to make up. */
export const FEEL: Record<Style, { gravity: number; friction: number }> = {
  garden: { gravity: 9.81, friction: 0.07 },
  ice: { gravity: 9.81, friction: 0.03 },
  moon: { gravity: 1.62, friction: 0.22 },
}

/**
 * The ground round a target, scaled for each place. The dish pulls a slow ball in only where its slope
 * beats the drag, so on ice (a third of the drag) it is shallower, or it would pull balls in from
 * metres away; and what keeps a ball in the trough is its depth against gravity, so on the Moon the
 * rise, the trough and the dish are all deeper: a crater.
 */
const SHAPE: Record<Style, { dish: number; setting: number }> = {
  garden: { dish: 1, setting: 1 },
  ice: { dish: 0.45, setting: 1 },
  moon: { dish: 3, setting: 3 },
}

type Rand = () => number
const between = (r: Rand, a: number, b: number) => a + r() * (b - a)
const sign = (r: Rand) => (r() < 0.5 ? -1 : 1)
const pick = <T>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length)]!

type Wall = { ax: number; az: number; bx: number; bz: number; e?: number; rubber?: boolean }

/** What a kind of hole builds: its outline, tee and target, its ground, and what stands on it. */
type Parts = {
  green: Pt[]
  tee: Spot
  target: Spot
  height: (x: number, z: number, t: Spot) => number
  /** Where the far end is: the rails beyond it are a cushion. */
  zEnd: number
  walls?: Wall[]
  bumpers?: Bumper[]
  water?: number
  lost?: Lost
}

/* ------------------------------------------------------------ shapes --- */

/** Round some of a polygon's corners, by index, as physics' `rounded` rounds them all. */
function roundCorners(pts: readonly Pt[], which: readonly number[], r: number, steps = 6): Pt[] {
  const out: Pt[] = []
  const at = new Set(which)
  for (let i = 0; i < pts.length; i++) {
    const c = pts[i]!
    if (!at.has(i)) {
      out.push(c)
      continue
    }
    const p = pts[(i + pts.length - 1) % pts.length]!
    const q = pts[(i + 1) % pts.length]!
    const l1 = Math.hypot(c[0] - p[0], c[1] - p[1])
    const l2 = Math.hypot(q[0] - c[0], q[1] - c[1])
    const k = Math.min(r, l1 / 2, l2 / 2)
    const a = [c[0] + ((p[0] - c[0]) * k) / l1, c[1] + ((p[1] - c[1]) * k) / l1]
    const b = [c[0] + ((q[0] - c[0]) * k) / l2, c[1] + ((q[1] - c[1]) * k) / l2]
    for (let j = 0; j <= steps; j++) {
      const t = j / steps
      const u = 1 - t
      out.push([u * u * a[0]! + 2 * u * t * c[0] + t * t * b[0]!, u * u * a[1]! + 2 * u * t * c[1] + t * t * b[1]!])
    }
  }
  return out
}

/** A lane down the hole: its middle at x = mid(z), `half` either side, from the tee end to the far end. */
function laneOutline(mid: (z: number) => number, half: number, zTop: number, zEnd: number): Pt[] {
  const n = Math.max(8, Math.ceil((zTop - zEnd) / 1.25))
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const z = zTop - ((zTop - zEnd) * i) / n
    left.push([mid(z) - half, z])
    right.push([mid(z) + half, z])
  }
  // Only the four corners at the ends are rounded: every vertex a rail, and few of them, keeps a putt quick to play out.
  return roundCorners([...left, ...right.reverse()], [0, n, n + 1, 2 * n + 1], 1.2)
}

/** The target's dish, in a place. */
function dishIn(style: Style) {
  const depth = DISH_D * SHAPE[style].dish
  return (x: number, z: number, t: Spot) => depth * gauss(x, z, t.x, t.z, DISH_S)
}

/** The ground round a target: a low rise to sit it on, a trough behind to take what runs past, and the dish. */
function setting(style: Style, rise: number, trough: number) {
  const k = SHAPE[style].setting
  const dish = dishIn(style)
  return (x: number, z: number, t: Spot) => k * (rise * band(z, t.z, 1.2) - trough * smooth(t.z - 1, t.z - 2.6, z)) - dish(x, z, t)
}

/** A gentle bank at the tee end, so nothing rolls back past the tee. */
const teeBank = (z: number) => 0.12 * smooth(10, 16, z)

/** A lane's middle line: straight, one bend, or an S. */
function laneMiddle(r: Rand, shapes: readonly ('straight' | 'bend' | 's')[]): (z: number) => number {
  const shape = pick(r, shapes)
  const a1 = sign(r) * between(r, 1.3, 2.7)
  const a2 = -a1 * between(r, 0.6, 1.15)
  if (shape === 'straight') return () => 0
  if (shape === 'bend') return (z) => a1 * smooth(6, -5, z)
  return (z) => a1 * smooth(10, 2, z) + a2 * smooth(0, -8, z)
}

/* ----------------------------------------------------------- the kinds --- */

/** Humps down a winding lane. */
function rollers(r: Rand, style: Style): Parts {
  const half = between(r, 2.0, 2.45)
  const mid = laneMiddle(r, ['s', 's', 'bend', 'straight'])
  const zEnd = -between(r, 15, 16.8)
  const tz = zEnd + between(r, 3, 4.2)
  const tx = mid(tz) + between(r, -0.8, 0.8)
  const scale = style === 'moon' ? 1.4 : style === 'ice' ? 0.8 : 1
  const count = 2 + Math.floor(r() * 3)
  const humps = Array.from({ length: count }, (_, i) => ({
    z: 9 - (16 * (i + between(r, 0.25, 0.75))) / count,
    h: between(r, 0.14, 0.34) * scale,
    s: between(r, 0.8, 1.3),
  }))
  const around = setting(style, 0.15, 0.1)
  return {
    green: laneOutline(mid, half, 15, zEnd),
    tee: { x: mid(13.5), z: 13.5 },
    target: { x: tx, z: tz },
    zEnd,
    height: (x, z, t) => {
      let h = teeBank(z)
      for (const k of humps) h += k.h * band(z, k.z, k.s)
      return h + around(x, z, t)
    },
  }
}

/** Up a ramp and over a gap (water, open water in the ice, or a crater), onto a landing, and up to the target. */
function leap(r: Rand, style: Style): Parts {
  const half = between(r, 1.9, 2.3)
  const bend = r() < 0.4 ? sign(r) * between(r, 0.8, 1.8) : 0
  const mid = (z: number) => bend * smooth(12, 5, z)
  const lip = between(r, 0.6, 2.4)
  const ramp = between(r, 0.45, 0.8)
  const gap = style === 'moon' ? between(r, 2.8, 4) : style === 'ice' ? between(r, 2, 2.8) : between(r, 2.4, 3.4)
  const far = lip - gap
  // Every jump comes down on the level: a landing longer than a jump that makes it across goes.
  const landing = style === 'moon' ? 7 : 5
  const climbFrom = far - landing
  const climbTo = climbFrom - between(r, 3.5, 4.5)
  const climb = style === 'moon' ? between(r, 0.4, 1.4) : style === 'ice' ? between(r, 1, 2) : between(r, 0.6, 2.1)
  const tz = climbTo - between(r, 0.8, 2.2)
  const zEnd = Math.min(tz - 3.4, -15.5)
  const floor = style === 'moon' ? -3 : -1.35
  const around = setting(style, 0, 0.3)
  return {
    green: laneOutline(mid, half, 15, zEnd),
    tee: { x: mid(13.5), z: 13.5 },
    target: { x: mid(tz) + between(r, -0.9, 0.9), z: tz },
    zEnd,
    water: style === 'moon' ? -2.4 : -0.95,
    lost: style === 'moon' ? 'crater' : style === 'ice' ? 'ice' : 'water',
    height: (x, z, t) => {
      if (z > lip) return ramp * smooth(lip + 2.8, lip, z) ** 1.6 + teeBank(z)
      if (z > far) return floor
      return -0.3 + climb * smooth(climbFrom, climbTo, z) + around(x, z, t)
    },
  }
}

/** A Z: up the first lane, across the middle, up the last; rubber banks at the corners. */
function switchback(r: Rand, style: Style): Parts {
  const w1 = between(r, 2.3, 2.9)
  const xa = -between(r, 3.9, 4.4)
  const xb = xa + w1
  const zc = -between(r, 1.6, 3)
  const wm = between(r, 2.3, 2.9)
  const w3 = between(r, 2.3, 2.9)
  const xd = between(r, 3.8, 4.5)
  const xc = xd - w3
  const zEnd = -between(r, 15.5, 17)
  const cut1 = 1.4
  const cut2 = 1.6
  const climb1 = between(r, 0.1, 0.35) * (style === 'moon' ? 1.5 : 1)
  const hump2 = between(r, 0.12, 0.26)
  const xh = between(r, xb + 0.6, xc - 0.6)
  const saddle = between(r, 0.14, 0.3)
  const zs = between(r, zEnd + 6, zc - wm - 3)
  const tz = zEnd + between(r, 2.8, 4.2)
  const tx = between(r, xc + 0.9, xd - 0.9)
  const inLane1 = (x: number) => smooth(xb + 0.3, xb - 0.3, x)
  const inMid = (z: number) => smooth(zc + 0.3, zc - 0.3, z) * smooth(zc - wm - 0.3, zc - wm + 0.3, z)
  const inLane3 = (x: number) => smooth(xc - 0.3, xc + 0.3, x)
  const around = setting(style, 0.14, 0.1)
  const height = (x: number, z: number, t: Spot) =>
    climb1 * smooth(13, zc, z) * inLane1(x) +
    hump2 * band(x, xh, 0.55) * inMid(z) +
    saddle * band(z, zs, 0.9) * inLane3(x) +
    around(x, z, t)
  const green: Pt[] = [
    [xa, 14.4],
    [xb, 14.4],
    [xb, zc],
    [xd, zc],
    [xd, zEnd],
    [xc, zEnd],
    [xc, zc - wm],
    [xa + cut1, zc - wm],
    [xa, zc - wm + cut1],
  ]
  const walls: Wall[] = [
    { ax: xa, az: zc - wm + cut1, bx: xa + cut1, bz: zc - wm, e: 0.9, rubber: true },
    { ax: xd - cut2, az: zc, bx: xd, bz: zc - cut2, e: 0.9, rubber: true },
  ]
  const parts: Parts = { green, tee: { x: (xa + xb) / 2, z: 13 }, target: { x: tx, z: tz }, zEnd, height, walls }
  // Half the time it turns the other way.
  return r() < 0.5 ? mirror(parts) : parts
}

/** A lane that leans: aim up the slope and let it curve down to the target. */
function tilt(r: Rand, style: Style): Parts {
  const half = between(r, 2.3, 2.8)
  const bend = r() < 0.5 ? sign(r) * between(r, 0.8, 2) : 0
  const mid = (z: number) => bend * smooth(8, -4, z)
  const lean = style === 'moon' ? 1.6 : style === 'ice' ? 0.6 : 1
  const k1 = sign(r) * between(r, 0.03, 0.06) * lean
  const k2 = r() < 0.6 ? -k1 * between(r, 0.6, 1.2) : 0
  const hump = r() < 0.5 ? { z: between(r, -2, 6), h: between(r, 0.12, 0.25), s: between(r, 0.8, 1.2) } : null
  const zEnd = -between(r, 15, 16.8)
  const tz = zEnd + between(r, 3, 4.2)
  // On the high side of the last lean, so the ball has to be sent up and brought down.
  const last = k2 !== 0 ? k2 : k1
  const tx = mid(tz) + (last > 0 ? 1 : -1) * between(r, 0.5, 1.2)
  const win = (z: number, a: number, b: number) => smooth(a + 1, a - 1, z) * smooth(b - 1, b + 1, z)
  const around = setting(style, 0.12, 0.1)
  return {
    green: laneOutline(mid, half, 15, zEnd),
    tee: { x: mid(13.5), z: 13.5 },
    target: { x: tx, z: tz },
    zEnd,
    height: (x, z, t) =>
      teeBank(z) +
      (x - mid(z)) * (k1 * win(z, 11, 0) + k2 * win(z, 0, tz - 1)) +
      (hump ? hump.h * band(z, hump.z, hump.s) : 0) +
      around(x, z, t),
  }
}

/** The target on top of a hill: too soft and it rolls back down, too hard and it goes over the top. */
function summit(r: Rand, style: Style): Parts {
  const half = between(r, 2.1, 2.6)
  const mid = laneMiddle(r, ['straight', 'straight', 'bend'])
  const tz = -between(r, 10.5, 13)
  const high = style === 'moon' ? between(r, 0.8, 1.6) : style === 'ice' ? between(r, 0.3, 0.6) : between(r, 0.5, 0.9)
  const spread = between(r, 1.6, 2.4)
  const zEnd = tz - between(r, 4.6, 5.6)
  const pre = r() < 0.5 ? { z: between(r, 2, 7), h: between(r, 0.1, 0.22), s: between(r, 0.8, 1.2) } : null
  const dish = dishIn(style)
  return {
    green: laneOutline(mid, half, 15, zEnd),
    tee: { x: mid(13.5), z: 13.5 },
    target: { x: mid(tz) + between(r, -0.8, 0.8), z: tz },
    zEnd,
    height: (x, z, t) => teeBank(z) + (pre ? pre.h * band(z, pre.z, pre.s) : 0) + high * band(z, t.z, spread) - dish(x, z, t),
  }
}

/** A wide lane with posts in the way: find the gap, or bank it off one. */
function posts(r: Rand, style: Style): Parts {
  const half = between(r, 2.6, 3.1)
  const mid = laneMiddle(r, ['straight', 'bend'])
  const zEnd = -between(r, 15, 16.8)
  const tz = zEnd + between(r, 3, 4.2)
  const count = 2 + Math.floor(r() * 3)
  const bumpers: Bumper[] = []
  for (let tries = 0; bumpers.length < count && tries < 80; tries++) {
    const z = between(r, -8, 6)
    const radius = between(r, 0.28, 0.45)
    const x = mid(z) + between(r, -1.3, 1.3)
    if (Math.abs(x - mid(z)) > half - radius - 0.6) continue
    if (bumpers.some((b) => Math.hypot(b.x - x, b.z - z) < 1.6)) continue
    bumpers.push({ x, z, r: radius, e: 0.8 })
  }
  const hump = r() < 0.4 ? { z: between(r, -4, 8), h: between(r, 0.1, 0.22) * (style === 'moon' ? 1.4 : 1), s: 1 } : null
  const around = setting(style, 0.14, 0.1)
  return {
    green: laneOutline(mid, half, 15, zEnd),
    tee: { x: mid(13.5), z: 13.5 },
    target: { x: mid(tz) + between(r, -0.8, 0.8), z: tz },
    zEnd,
    bumpers,
    height: (x, z, t) => teeBank(z) + (hump ? hump.h * band(z, hump.z, hump.s) : 0) + around(x, z, t),
  }
}

/** The same hole turned the other way: right for left. */
function mirror(p: Parts): Parts {
  return {
    ...p,
    green: p.green.map(([x, z]) => [-x, z] as Pt).reverse(),
    tee: { x: -p.tee.x, z: p.tee.z },
    target: { x: -p.target.x, z: p.target.z },
    height: (x, z, t) => p.height(-x, z, { ...t, x: -t.x }),
    walls: p.walls?.map((w) => ({ ...w, ax: -w.ax, bx: -w.bx })),
    bumpers: p.bumpers?.map((b) => ({ ...b, x: -b.x })),
  }
}

const BUILD: Record<Family, (r: Rand, style: Style) => Parts> = { rollers, leap, switchback, tilt, summit, posts }

/* ------------------------------------------------------ names and words --- */

const PLACE_WORDS: Record<Style, readonly string[]> = {
  garden: ['Meadow', 'Willow', 'Clover', 'Bramble', 'Orchard', 'Foxglove', 'Primrose', 'Hollyhock'],
  ice: ['Frost', 'Glacier', 'Icicle', 'Polar', 'Snowdrift', 'Blizzard', 'Tundra', 'Hailstone'],
  moon: ['Crater', 'Lunar', 'Moonbeam', 'Tranquility', 'Orbit', 'Selene', 'Stardust', 'Apollo'],
}

const KIND_WORDS: Record<Family, readonly string[]> = {
  rollers: ['Rollers', 'Ripple', 'Tumble', 'Humps'],
  leap: ['Leap', 'Jump', 'Gap', 'Vault'],
  switchback: ['Switchback', 'Zigzag', 'Dogleg'],
  tilt: ['Tilt', 'Camber', 'Lean', 'Slant'],
  summit: ['Summit', 'Peak', 'Hilltop', 'Knoll'],
  posts: ['Posts', 'Pinball', 'Slalom', 'Pins'],
}

const KIND_NOTES: Record<Family, string> = {
  rollers: 'Humps down a winding lane. Carry the ball over them all, and not so hard it runs through the target.',
  leap: 'Up the ramp and over the gap, then up to the target. Too soft and it drops in; too hard and it runs on past.',
  switchback: 'Two corners with rubber banks. Find the angle that bounces it round both, then the power to stop it.',
  tilt: 'The lane leans. Aim up the slope and let it curve down to the target.',
  summit: 'The target is on top of the hill. Too soft and it rolls back down; too hard and it goes over the top.',
  posts: 'Posts stand in the way. Find the gap between them, or bank it off one.',
}

const PLACE_NOTES: Record<Style, string> = {
  garden: '',
  ice: ' On the ice it slides more than twice as far.',
  moon: ' On the Moon it floats off every crest.',
}

/** What the gap is called in the note, where there is one. */
const GAP_WORDS: Record<Style, string> = { garden: 'the pond', ice: 'the open water', moon: 'the crater' }

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

/**
 * The kind and place a day starts from, before checking: a week has three gardens, two rinks and two
 * Moon days in a shuffled order, and the six kinds come round in a shuffle of their own, skipping a kind
 * the place doesn't have and the kind the day before had.
 */
export function plannedPick(n: number): Omit<DailyPick, 'k'> {
  let before: Family | null = null
  let choice: Omit<DailyPick, 'k'> = { family: 'rollers', style: 'garden' }
  for (let d = 1; d <= n; d++) {
    choice = startingPick(d, before)
    before = choice.family
  }
  return choice
}

function startingPick(n: number, avoid: Family | null): Omit<DailyPick, 'k'> {
  const week = Math.floor((n - 1) / 7)
  const style = shuffled(['garden', 'garden', 'garden', 'ice', 'ice', 'moon', 'moon'] as const, `acechase:places:${week}`)[(n - 1) % 7]!
  const round = Math.floor((n - 1) / FAMILIES.length)
  const order = shuffled(FAMILIES, `acechase:kinds:${round}`)
  const start = (n - 1) % FAMILIES.length
  for (let i = 0; i < order.length; i++) {
    const family = order[(start + i) % order.length]!
    if (family !== avoid && !NOT_HERE[style].includes(family)) return { family, style }
  }
  return { family: 'rollers', style }
}

/** A day's hole, built: the same numbers make the same hole on any device. */
export function dailyHoleDef(choice: DailyPick, day: string): HoleDef {
  const r = mulberry32(hashString(`acechase:${day}:${choice.family}:${choice.style}:${choice.k}`))
  const p = BUILD[choice.family](r, choice.style)
  const words = mulberry32(hashString(`acechase:name:${day}`))
  const name = `${pick(words, PLACE_WORDS[choice.style])} ${pick(words, KIND_WORDS[choice.family])}`
  const note = (KIND_NOTES[choice.family] + PLACE_NOTES[choice.style]).replace('the gap', GAP_WORDS[choice.style])
  const zEnd = p.zEnd
  return {
    name,
    note,
    green: p.green,
    tee: p.tee,
    height: p.height,
    spots: [p.target],
    water: p.water,
    lost: p.lost,
    walls: p.walls,
    bumpers: p.bumpers,
    // The far end is a cushion, so a shot hit too hard stays in the trough rather than coming back.
    soft: (_x, z) => z < zEnd + 0.6,
    style: choice.style,
    gravity: FEEL[choice.style].gravity,
    friction: FEEL[choice.style].friction,
  }
}
