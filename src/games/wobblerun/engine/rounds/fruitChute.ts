/**
 * Fruit Chute (design-final R5, D): an uphill belt (6°) running down at you in four painted lanes, and a gantry of
 * fruit cannons at the top lobbing giant melons, bouncing oranges (T2+) and bananas lying across two lanes (T2+,
 * hop them) down the lanes in waves. A cannon swells and glows 0.8 s before it fires. Low dividers keep a hit bean
 * on the belt; outside them two narrow gold rails run up over the goo, static (so quicker than the belt) but with
 * gaps to hop: the gold line. A gutter across the bottom swallows the fruit: a step down on T1–T2, a gap to hop
 * on T3. The round ends high, so the course lays a slide down after it.
 *
 * The fruit run on a schedule (sim.ts path specs): a wave every V seconds (1.6–2.6 s by tier) in a cycle of four,
 * each wave one lane (T1) or two (T2+, a pair of lanes or one banana across a pair), so no lane fires more often
 * than every 3.6 s and the bean meets a wave about every 1–1.6 s, with a lane to step into. The schedule is checked as it's
 * made: at any point of the belt, never more than two lanes have fruit passing in any 0.8 s.
 */
import { yeet } from '../sim.ts'
import type { RoundDef, RoundOut, RoundSlot, Rng, TeleFn, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

const PITCH = (6 * Math.PI) / 180
const TAN = Math.tan(PITCH)
/** The belt: 8 m wide, its lanes' centres; the dividers outside it, 0.7 m tall (jumpable, never stepped over). */
const BELT_HX = 4.0
const LANES = [-3, -1, 1, 3] as const
const DIVIDER_H = 0.7
const DIVIDER_T = 0.4
/** The dividers stop this short of the top, so the rails run straight on toward the exit. */
const DIVIDER_END = 1.5
/** The gold rails: 0.9 m wide strips outside the dividers, flush with the belt. */
const RAIL_X = 4.85
const RAIL_HX = 0.45
/** The gutter across the bottom (a 0.4 m step down on T1–T2), the landing at the top, the bots' lane rows. */
const GUTTER = 1.5
const TROUGH = 0.4
const TOP = 2
const TOP_HX = RAIL_X + RAIL_HX
const ROW = 4
/** The first lane row, this far up the belt: a fruit's throw there lands you on the belt, not in the gutter. */
const ROW0 = 2.5
/** The cannons: 0.5 m past the top of the belt, their mouths 1.5 m up; a fruit lobs down onto the belt in 0.3 s. */
const CANNON_DZ = 0.5
const CANNON_UP = 1.5
const LOB = 0.3
/** An orange bounces up to 1.0 m, every 0.55 s. */
const BOUNCE_H = 1.0
const BOUNCE_T = 0.55
/** A cannon swells this long before it fires. */
const WARN = 0.8

type Kind = 'melon' | 'orange' | 'banana'
/** Each fruit: its radius (a banana's, round its 2.4 m length), how fast it rolls down, how it's drawn. */
const FRUIT: Record<Kind, { r: number; v: number; look: string }> = {
  melon: { r: 0.85, v: 7.0, look: 'fruit-melon' },
  orange: { r: 0.55, v: 6.0, look: 'fruit-orange' },
  banana: { r: 0.4, v: 6.0, look: 'banana' },
}
/** A banana's capsule runs this far either side of its middle (2.4 m long with its rounded ends). */
const BANANA_LEN = 0.8
/**
 * A fruit throws you up and a little back down the belt (about 1.2 m and 1 s lost, with the belt), as a yeet
 * rather than the spec's knock: a yeeted bean isn't touched by fruit again until it's down, so the fruit rolls on
 * under it. A knocked bean lands just ahead of the fruit that knocked it, and sim.ts lets that fruit push it on
 * down the lane and knock it again every 0.8 s, all the way to the bottom (engine-requests.md).
 */
const FRUIT_HIT = yeet({ x: 0, y: 7.5, z: -1 })

/** One fruit of a wave: the lanes it fills (indices into LANES), its kind, and the x it rolls down. */
type Shot = { lanes: number[]; kind: Kind; x: number }
type Style = 'sweep' | 'pincer' | 'alternate'

const frac = (v: number) => v - Math.floor(v)

/**
 * A cannon's telegraph for releases at each of `phs` + m·P: `warn` for WARN s before each (the swell and the
 * thoomp), `act` for 0.25 s after, `rest` between (as sim.ts releaseTele, for a cannon that fires more than once a
 * cycle).
 */
function cannonTele(P: number, phs: readonly number[]): TeleFn {
  return (t) => {
    let since = Infinity
    let until = Infinity
    for (const ph of phs) {
      const s = frac((t - ph) / P) * P
      since = Math.min(since, s)
      until = Math.min(until, P - s)
    }
    if (until < WARN) return { state: 'warn', u: 1 - until / WARN }
    if (since < 0.25) return { state: 'act', u: since / 0.25 }
    return { state: 'rest', u: since / P }
  }
}

/**
 * Whether a cycle of waves (wave w fires at w·V, the cycle repeating every waves.length·V) keeps to the phone's
 * rules: every lane fires something its cannon can show (not only bananas), and at every point of the belt from z0
 * to z1, no 0.8 s has fruit passing in more than two lanes. zc is where the fruit set off from.
 */
function fair(waves: readonly Shot[][], V: number, zc: number, z0: number, z1: number): boolean {
  const P = waves.length * V
  const shown = [false, false, false, false]
  for (const w of waves) for (const s of w) if (s.kind !== 'banana') for (const l of s.lanes) shown[l] = true
  if (shown.includes(false)) return false
  for (let z = z0; z <= z1; z += 0.5) {
    // When each shot's fruit is passing z: [a, b] after its release.
    const pass: { a: number; b: number; lanes: number[] }[] = []
    waves.forEach((w, wi) => {
      for (const s of w) {
        const f = FRUIT[s.kind]
        const a0 = wi * V + (zc - z - f.r) / f.v
        const b0 = wi * V + (zc - z + f.r) / f.v
        for (let m = -6; m <= 6; m++) if (b0 + m * P >= 0 && a0 + m * P <= P + 0.8) pass.push({ a: a0 + m * P, b: b0 + m * P, lanes: s.lanes })
      }
    })
    for (let t = 0; t < P; t += 0.05) {
      let busy = 0
      for (const p of pass) if (p.b >= t && p.a <= t + 0.8) for (const l of p.lanes) busy |= 1 << l
      let n = 0
      for (let l = 0; l < 4; l++) if (busy & (1 << l)) n++
      if (n > 2) return false
    }
  }
  return true
}

/**
 * The round's cycle of waves and its wave interval. T1: one melon a wave across the lanes in the style's order.
 * T2+: complementary pairs of lanes in turn, each wave a pair of melons or oranges, one of the pair, or (when the
 * pair is side by side) a banana across them; tried until the cycle is fair, melon pairs if nothing is.
 */
function schedule(rng: Rng, tier: Tier, zc: number, z0: number, z1: number): { waves: Shot[][]; V: number } {
  const style: Style = rng.pick(['sweep', 'pincer', 'alternate'] as const)
  if (tier === 1) {
    const order = style === 'sweep' ? [0, 1, 2, 3] : style === 'pincer' ? [0, 3, 1, 2] : [0, 2, 1, 3]
    if (rng.chance(0.5)) order.reverse()
    return { waves: order.map((l) => [{ lanes: [l], kind: 'melon', x: LANES[l]! }]), V: rng.between(1.6, 2.0) }
  }
  const pairs = style === 'sweep' ? [[0, 1], [2, 3]] : style === 'pincer' ? [[0, 3], [1, 2]] : [[0, 2], [1, 3]]
  if (rng.chance(0.5)) pairs.reverse()
  const V = tier === 2 ? rng.between(2.0, 2.6) : rng.between(1.8, 2.2)
  const shot = (l: number, kind: Kind): Shot => ({ lanes: [l], kind, x: LANES[l]! })
  for (let tries = 0; tries < 60; tries++) {
    const waves: Shot[][] = []
    for (let w = 0; w < 4; w++) {
      const [a, b] = pairs[w % 2]! as [number, number]
      const side = b - a === 1
      const roll = rng()
      const banana = tier === 2 ? 0.2 : 0.3
      if (side && roll < banana) waves.push([{ lanes: [a, b], kind: 'banana', x: (LANES[a]! + LANES[b]!) / 2 }])
      else if (roll < banana + 0.2) waves.push([shot(rng.chance(0.5) ? a : b, rng.chance(0.5) ? 'melon' : 'orange')])
      else {
        const kind: Kind = rng.chance(tier === 2 ? 0.5 : 0.6) ? 'orange' : 'melon'
        waves.push([shot(a, kind), shot(b, kind)])
      }
    }
    if (fair(waves, V, zc, z0, z1)) return { waves, V }
  }
  return { waves: [0, 1, 0, 1].map((p) => pairs[p]!.map((l) => shot(l, 'melon'))), V }
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('climb')
  const L = rng.between(38, 48)
  const vb = byTier(tier, [1.8, 2.2, 2.6])
  const gap = tier === 3
  const z0 = GUTTER
  const z1 = z0 + L
  const rise = L * TAN
  const surf = (z: number) => Math.min(rise, Math.max(0, (z - z0) * TAN))
  const zc = z1 + CANNON_DZ
  const yc = rise + CANNON_UP

  // The gutter (a step down, walled by the dividers, or on T3 a gap), the belt, its dividers, the top landing.
  if (!gap) {
    k.floor(0, z0, { hx: BELT_HX, top: -TROUGH })
    k.walls(0, z0, { hx: BELT_HX, y: -TROUGH, h: DIVIDER_H + TROUGH, thick: DIVIDER_T, look: 'divider' })
  }
  k.ramp(z0, z1, 0, rise, { hx: BELT_HX, look: 'belt', belt: { x: 0, z: -vb } })
  k.walls(z0, z1 - DIVIDER_END, { hx: BELT_HX, rise: rise - DIVIDER_END * TAN, h: DIVIDER_H, thick: DIVIDER_T, look: 'divider' })
  k.floor(z1, z1 + TOP, { hx: TOP_HX, top: rise })
  k.walls(z1, z1 + TOP, { hx: TOP_HX, y: rise })

  // The gold rails, each with its gaps (spread along it, at least 4 m of rail between), flush with the belt.
  const nGaps = byTier(tier, [2, 3, 3])
  const gapLen = byTier(tier, [2.6, 2.8, 3.2])
  const rails: { side: 1 | -1; pieces: [number, number][] }[] = []
  for (const side of [-1, 1] as const) {
    const span = (L - 6) / nGaps
    const pieces: [number, number][] = []
    let at = z0
    for (let g = 0; g < nGaps; g++) {
      const lo = z0 + 3 + g * span
      const a = rng.between(Math.max(lo, g > 0 ? at + 4 : lo), lo + span - gapLen - (g === nGaps - 1 ? 0 : 1))
      pieces.push([at, a])
      at = a + gapLen
    }
    pieces.push([at, z1])
    for (const [a, b] of pieces) k.box({ x: side * RAIL_X, z: (a + b) / 2, hx: RAIL_HX, hz: (b - a) / 2, top: surf((a + b) / 2), pitch: PITCH, look: 'floor', gold: true })
    k.deco({ look: 'gold-flag', x: side * RAIL_X, y: 0, z: z0 - 0.3, sy: 1.8 })
    rails.push({ side, pieces })
  }
  k.gold('Side rails', z0, z1, RAIL_X)

  // The fruit: each shot of each wave is a path (once a cycle), set off from its cannon, lobbing onto the belt and
  // rolling down its lane until the gutter swallows it. Each lane's cannon swells before every shot in its lane.
  const { waves, V } = schedule(rng, tier, zc, z0, z1)
  const P = waves.length * V
  const ph0 = rng.between(0, P)
  const fires: number[][] = [[], [], [], []]
  waves.forEach((w, wi) => {
    for (const s of w) for (const l of s.lanes) fires[l]!.push(ph0 + wi * V)
  })
  const lead = [-1, -1, -1, -1]
  waves.forEach((w, wi) => {
    for (const s of w) {
      const f = FRUIT[s.kind]
      const ball = s.kind !== 'banana'
      const l = s.lanes[0]!
      const first = ball && lead[l]! < 0
      const lift = CANNON_UP - f.r
      const h = k.hazard({
        shape: ball ? 'sphere' : 'bar',
        x: s.x,
        y: yc,
        z: zc,
        r: f.r,
        len: BANANA_LEN,
        hit: FRUIT_HIT,
        look: f.look,
        tele: first ? cannonTele(P, fires[l]!) : undefined,
        path: {
          P,
          ph: ph0 + wi * V,
          life: (zc - z0) / f.v,
          at: (tau, _k, o) => {
            const z = zc - f.v * tau
            let y = surf(z) + f.r
            if (tau < LOB) y += lift * (1 - tau / LOB) ** 2
            else if (s.kind === 'orange') y += BOUNCE_H * Math.abs(Math.sin((Math.PI * (tau - LOB)) / BOUNCE_T))
            o.z = z - zc
            o.y = y - yc
            if (ball) o.yaw = (f.v * tau) / f.r
          },
        },
      })
      if (first) lead[l] = h
    }
  })
  LANES.forEach((x, l) => k.deco({ look: 'cannon', x, y: yc, z: zc, sx: 1.6, sy: 1.6, sz: 2.2, ref: { kind: 'hazard', i: lead[l]! } }))
  k.deco({ look: 'gantry', x: 0, y: rise, z: zc, sx: 2 * TOP_HX, sy: CANNON_UP + 1.2, sz: 0.6 })

  // Splat heights following the slope (a fall off a rail splats well before the goo far below).
  for (let z = 0; z < z1 + TOP; z += 3) k.death(z, Math.min(z + 3, z1 + TOP), surf(z) - 4.5)

  // The route: lane rows every 4 m up the belt (a bot waits there running on the spot, between fruit, and steps
  // aside), in over the gutter, out over the top. Each spot's ways out go up the belt first, straight on first (the
  // live hands take the first way when nothing is clean), then aside. The gold line: onto a rail from the pad, hops
  // over its gaps.
  k.node('in', 0, -1.5)
  const rows: string[][] = []
  const zr0 = z0 + ROW0
  for (let r = 0, z = zr0; z <= z1 - 1; r++, z += ROW) rows.push(LANES.map((x, l) => k.node(`b${r}_${l}`, x, z, { y: surf(z) })))
  k.node('out', 0, z1 + TOP + 1.5, { y: rise })
  rows[0]!.forEach((id, l) => {
    if (!gap) k.edge('in', id)
    else k.edge('in', id, 'jump', { takeoff: k.at((LANES[l]! * 1.1) / (zr0 + 1.5), 0, -0.4) })
  })
  rows.forEach((row, r) => {
    row.forEach((id, l) => {
      if (r === rows.length - 1) k.edge(id, 'out')
      else for (const m of [l, l - 1, l + 1]) if (m >= 0 && m < LANES.length) k.edge(id, rows[r + 1]![m]!)
    })
    for (let l = 0; l < row.length - 1; l++) {
      k.edge(row[l]!, row[l + 1]!)
      k.edge(row[l + 1]!, row[l]!)
    }
  })
  for (const { side, pieces } of rails) {
    const s = side > 0 ? 'R' : 'L'
    const ids = pieces.map(([a, b], j) => {
      const za = j === 0 ? a + 0.9 : a + 0.6
      const zb = b - 0.6
      return [k.node(`${s}${j}a`, side * RAIL_X, za, { y: surf(za) }), k.node(`${s}${j}b`, side * RAIL_X, zb, { y: surf(zb), wait: 'no' })] as const
    })
    k.edge('in', ids[0]![0], 'jump', { tier: 'gold', takeoff: 'edge', inset: 0.3 })
    ids.forEach(([a, b], j) => {
      k.edge(a, b, 'run', { tier: 'gold' })
      if (j < ids.length - 1) k.edge(b, ids[j + 1]![0], 'jump', { tier: 'gold', takeoff: 'edge', inset: 0.35 })
    })
    k.edge(ids[ids.length - 1]![1], 'out', 'run', { tier: 'gold' })
  }
  return k.done({ x: 0, y: rise, z: z1 + TOP })
}

export const ROUND: RoundDef = {
  letter: 'f',
  name: 'Melon Hill',
  hint: 'climb the belt',
  family: 'D',
  phase: 1,
  build,
}
