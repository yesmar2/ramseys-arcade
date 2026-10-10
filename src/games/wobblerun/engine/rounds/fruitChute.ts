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
import type { EdgeMove, RoundDef, RoundOut, RoundSlot, Rng, TeleFn, Tier } from '../types.ts'
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
  if ((slot.gen ?? 1) >= 2) return build2(slot, rng, tier)
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

/* ------------------------------------------------------------------ generation 2 --- */

/**
 * Gen 2's hill is 8.7 m wide: a belt 7.6 m wide in four 1.9 m lanes (LANES2, from the belt's middle) between 0.2 m
 * dividers, and outside the divider on one side a gold rail 0.9 m wide (the narrowest a gold line may be). The belt
 * sits BELT2_OFF off the middle, away from the rail.
 */
const LANES2 = [-2.85, -0.95, 0.95, 2.85] as const
const BELT2_HX = 3.8
const DIV2_T = 0.2
const BELT2_OFF = 0.55
const RAIL2_X = 3.9
const RAIL2_HX = 0.45
const HILL2_HX = 4.35
/**
 * The fruit leap off the foot of the upper belt, over the ditch below it, and come down LEAP_DOWN of the way across
 * the landing, rolling on from there: their undersides LEAP over the landing at the middle of the leap, so the far
 * part of the landing is a spot they never reach (they sail over it) and its near part is theirs.
 */
const LEAP = 2.6
const LEAP_DOWN = 0.4
/**
 * Gen 2's fruit throw you high and back down the hill: about 2.5 m in the air (the fruit rolls on under you, so it
 * can't catch you again as you land) and up to 0.7 m more on the belt before you're up again (THROW_BACK in all,
 * with room), so one that catches you just past a ditch throws you into it.
 */
const FRUIT_HIT2 = yeet({ x: 0, y: 10, z: -3.5 })
const THROW_BACK = 3.4
/**
 * The lane spots on a belt are a checkerboard, a row every HALF_ROW m, each row in alternate lanes, and the ways
 * between them all go up or down the belt: a lane aside to the row above or below, or straight on two rows up. There
 * are no sideways steps, since the bots' live hands (bots.ts liveHands) score a way by where it gets them at running
 * speed, and a step aside always looked better than the slow climb up a belt: they stepped from lane to lane for
 * ever. Up is always the better score, so a bot climbs, and dodges up (or back down) a lane. The first row is ROW0_2
 * up the belt, or (above a ditch or the gutter's gap) past a throw's reach of it; a ditch's far spot (passed through)
 * is PAST_DITCH past it.
 */
const HALF_ROW = 2
const ROW0_2 = 2.8
const ROW0_DITCH = THROW_BACK + 0.6
const PAST_DITCH = 1.2

/** A stretch of the hill: a belt (rising), a flat (a landing, the top) or a gap (a ditch), from z0 at y0 to z1 at y1. */
type Sec = { kind: 'belt' | 'flat' | 'gap'; z0: number; z1: number; y0: number; y1: number }

/**
 * The cycle of waves on gen 2's lanes (at x `lanes`), as gen 1's schedule but a little sparser (the climb is
 * steeper and longer, so you're on it longer).
 */
function schedule2(rng: Rng, tier: Tier, lanes: readonly number[], zc: number, z0: number, z1: number): { waves: Shot[][]; V: number } {
  const style: Style = rng.pick(['sweep', 'pincer', 'alternate'] as const)
  if (tier === 1) {
    const order = style === 'sweep' ? [0, 1, 2, 3] : style === 'pincer' ? [0, 3, 1, 2] : [0, 2, 1, 3]
    if (rng.chance(0.5)) order.reverse()
    return { waves: order.map((l) => [{ lanes: [l], kind: 'melon', x: lanes[l]! }]), V: rng.between(1.8, 2.2) }
  }
  const pairs = style === 'sweep' ? [[0, 1], [2, 3]] : style === 'pincer' ? [[0, 3], [1, 2]] : [[0, 2], [1, 3]]
  if (rng.chance(0.5)) pairs.reverse()
  const V = tier === 2 ? rng.between(2.2, 2.8) : rng.between(2.3, 2.7)
  const shot = (l: number, kind: Kind): Shot => ({ lanes: [l], kind, x: lanes[l]! })
  for (let tries = 0; tries < 60; tries++) {
    const waves: Shot[][] = []
    for (let w = 0; w < 4; w++) {
      const [a, b] = pairs[w % 2]! as [number, number]
      const side = b - a === 1
      const roll = rng()
      const banana = tier === 2 ? 0.2 : 0.3
      if (side && roll < banana) waves.push([{ lanes: [a, b], kind: 'banana', x: (lanes[a]! + lanes[b]!) / 2 }])
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

/**
 * Generation 2 (README "Generations"): Melon Hill is a steep, terraced hill. Belt 1 (8–10°), a flat landing, the
 * upper belt (9–11°), the top; the fruit come down the whole hill from the cannons at the top, leaping off the foot of
 * the upper belt over the landing's far part (a spot they never reach, where you can wait) and rolling on across its
 * near part and down belt 1. On T2 a ditch cuts across the hill either side of the landing; on T3 the upper belt is
 * two belts with a third ditch between, and the gutter is a gap again. You jump each ditch, and a fruit that catches
 * you just past one throws you high and back into it (the throw is high so the fruit rolls on under you). A careful
 * bean waits under the leap, or at a lane spot a throw's reach up a belt, for a gap in the fruit before each ditch.
 * One gold rail (0.9 m), with longer gaps, runs up one side.
 */
function build2(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('climb')
  const vb = byTier(tier, [1.8, 2.2, 2.6])
  const rad = (d: number) => (d * Math.PI) / 180
  const [a1, b1] = byTier(tier, [
    [8, 9],
    [8.5, 9.5],
    [9, 10],
  ] as const)
  const [a2, b2] = byTier(tier, [
    [9, 10],
    [9.5, 10.5],
    [10, 11],
  ] as const)
  const pitch1 = rad(rng.between(a1, b1))
  const pitch2 = rad(rng.between(a2, b2))
  const L1 = rng.between(13, 16)
  const L2 = tier === 3 ? rng.between(18, 21) : rng.between(15, 18)
  // The ditches, 2.4–2.8 m (T3's ditch A, its third, 2.0–2.4). A fruit's throw puts you in one when it catches you
  // within the ditch's width of a throw past it, so the ditch's width is the danger, whatever the throw.
  const ditchA = tier >= 2 ? (tier === 3 ? rng.between(2.0, 2.4) : rng.between(2.4, 2.8)) : 0
  const ditchB = tier >= 2 ? rng.between(2.4, 2.8) : 0
  const ditchC = tier === 3 ? rng.between(2.4, 2.8) : 0
  const land = rng.between(4.8, 5.8)
  const gap = tier === 3
  // The gold rail's side; the belt sits off the middle, away from it.
  const railSide = rng.sign()
  const bx = -railSide * BELT2_OFF
  const lanes = LANES2.map((x) => bx + x)

  // The hill, bottom to top: the gutter (a step down on T1–T2, a gap on T3), belt 1, (T2+) ditch A, the landing,
  // (T2+) ditch B, the upper belt (on T3 two belts with ditch C between), the top.
  const secs: Sec[] = []
  const gutter = GUTTER
  let z = gutter
  let y = 0
  const add = (kind: Sec['kind'], len: number, rise = 0) => {
    secs.push({ kind, z0: z, z1: z + len, y0: y, y1: y + rise })
    z += len
    y += rise
    return secs[secs.length - 1]!
  }
  const belt1 = add('belt', L1, L1 * Math.tan(pitch1))
  const dA = ditchA > 0 ? add('gap', ditchA) : null
  const mid = add('flat', land)
  const dB = ditchB > 0 ? add('gap', ditchB) : null
  const upper: Sec[] = []
  const ditches: (Sec | null)[] = [dB]
  if (ditchC > 0) {
    const La = L2 * 0.45
    upper.push(add('belt', La, La * Math.tan(pitch2)))
    ditches.push(add('gap', ditchC))
    upper.push(add('belt', L2 - La, (L2 - La) * Math.tan(pitch2)))
  } else upper.push(add('belt', L2, L2 * Math.tan(pitch2)))
  const top = add('flat', TOP)
  const H = top.y0
  const zEnd = top.z1
  const belts = [belt1, ...upper]
  const last = upper[upper.length - 1]!
  const slopeOf = (s: Sec) => Math.atan2(s.y1 - s.y0, s.z1 - s.z0)
  /** The ground at z (NaN over a ditch); before the hill, the gutter's. */
  const ground = (zz: number) => {
    for (const s of secs) {
      if (zz > s.z1) continue
      if (s.kind === 'gap') return NaN
      return s.y0 + ((s.y1 - s.y0) * Math.max(0, zz - s.z0)) / (s.z1 - s.z0)
    }
    return H
  }
  /** The fruit's leap: from the foot of the upper belt over ditch B to LEAP_DOWN of the way across the landing. */
  const leap0 = mid.z0 + LEAP_DOWN * (mid.z1 - mid.z0)
  const leap1 = upper[0]!.z0
  const leapU = (zz: number) => (zz - leap0) / (leap1 - leap0)
  /** Where a fruit's underside is at z: the ground; in the leap an arc LEAP high in the middle; a hop over ditch C. */
  const fruitGround = (zz: number) => {
    if (zz > leap0 && zz < leap1) {
      const u = leapU(zz)
      return mid.y0 + 4 * u * (1 - u) * LEAP
    }
    for (const s of secs) {
      if (zz > s.z1) continue
      if (s.kind !== 'gap') return s.y0 + ((s.y1 - s.y0) * Math.max(0, zz - s.z0)) / (s.z1 - s.z0)
      const u = (zz - s.z0) / (s.z1 - s.z0)
      return s.y0 + 4 * u * (1 - u) * (0.6 + 0.15 * (s.z1 - s.z0))
    }
    return H
  }
  const zc = top.z0 + CANNON_DZ
  const yc = H + CANNON_UP

  // The gutter, the belts and their dividers, the landing, the top. The landing has low walls on T1.
  if (!gap) {
    k.floor(0, GUTTER, { x: bx, hx: BELT2_HX, top: -TROUGH })
    k.walls(0, GUTTER, { x: bx, hx: BELT2_HX, y: -TROUGH, h: DIVIDER_H + TROUGH, thick: DIV2_T, look: 'divider' })
  }
  for (const b of belts) {
    k.ramp(b.z0, b.z1, b.y0, b.y1 - b.y0, { x: bx, hx: BELT2_HX, look: 'belt', belt: { x: 0, z: -vb } })
    k.walls(b.z0, b.z1, { x: bx, hx: BELT2_HX, y: b.y0, rise: b.y1 - b.y0, h: DIVIDER_H, thick: DIV2_T, look: 'divider' })
  }
  k.floor(mid.z0, mid.z1, { hx: HILL2_HX, top: mid.y0, look: 'terrace' })
  if (tier === 1) k.walls(mid.z0, mid.z1, { hx: HILL2_HX, y: mid.y0 })
  k.floor(top.z0, top.z1, { hx: HILL2_HX, top: H })
  k.walls(top.z0, top.z1, { hx: HILL2_HX, y: H })

  // The gold rail up each belt, each with its gaps (at least 2 m of rail either side of each), flush with the belt.
  const nGaps = byTier(tier, [1, 2, 2])
  const gapLen = byTier(tier, [2.8, 3.2, 3.4])
  const railX = railSide * RAIL2_X
  const rails = belts.map((b) => {
    const L = b.z1 - b.z0
    const n = L - nGaps * gapLen >= (nGaps + 1) * 2 ? nGaps : 1
    const share = Array.from({ length: n + 1 }, () => 0.5 + rng())
    const sum = share.reduce((s, v) => s + v, 0)
    const spare = L - n * gapLen - (n + 1) * 2
    const pieces: [number, number][] = []
    let at = b.z0
    share.forEach((w) => {
      const len = 2 + (spare * w) / sum
      pieces.push([at, at + len])
      at += len + gapLen
    })
    pieces[pieces.length - 1]![1] = b.z1
    for (const [p0, p1] of pieces) k.box({ x: railX, z: (p0 + p1) / 2, hx: RAIL2_HX, hz: (p1 - p0) / 2, top: ground((p0 + p1) / 2), pitch: slopeOf(b), look: 'floor', gold: true })
    return pieces
  })
  k.deco({ look: 'gold-flag', x: railX, y: 0, z: belt1.z0 - 0.3, sy: 1.8 })
  k.gold('Side rail', belt1.z0, last.z1, railX)

  // The fruit, from the cannons at the top, down the whole hill (hopping the ditches) to the gutter.
  const { waves, V } = schedule2(rng, tier, lanes, zc, gutter, last.z1)
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
        hit: FRUIT_HIT2,
        look: f.look,
        tele: first ? cannonTele(P, fires[l]!) : undefined,
        path: {
          P,
          ph: ph0 + wi * V,
          life: (zc - gutter) / f.v,
          at: (tau, _k, o) => {
            const fz = zc - f.v * tau
            let fy = fruitGround(fz) + f.r
            if (tau < LOB) fy += lift * (1 - tau / LOB) ** 2
            else if (s.kind === 'orange' && !(fz > leap0 && fz < leap1)) fy += BOUNCE_H * Math.abs(Math.sin((Math.PI * (tau - LOB)) / BOUNCE_T))
            o.z = fz - zc
            o.y = fy - yc
            if (ball) o.yaw = (f.v * tau) / f.r
          },
        },
      })
      if (first) lead[l] = h
    }
  })
  lanes.forEach((x, l) => k.deco({ look: 'cannon', x, y: yc, z: zc, sx: 1.5, sy: 1.5, sz: 2.2, ref: { kind: 'hazard', i: lead[l]! } }))
  // A lip at the foot of belt 2 the fruit leap from.
  k.deco({ look: 'lip', x: bx, y: upper[0]!.y0, z: upper[0]!.z0 + 0.25, sx: 2 * BELT2_HX, sy: 0.25, sz: 0.5 })
  k.deco({ look: 'gantry', x: 0, y: H, z: zc, sx: 2 * HILL2_HX, sy: CANNON_UP + 1.2, sz: 0.6 })

  // Splat heights under the hill, 4.5 m below it, following it (a ditch's at its edges' height).
  const level = (zz: number) => {
    for (const s of secs) if (zz <= s.z1) return s.kind === 'gap' ? s.y0 : s.y0 + ((s.y1 - s.y0) * Math.max(0, zz - s.z0)) / (s.z1 - s.z0)
    return H
  }
  for (let zz = 0; zz < zEnd; zz += 1.5) k.death(zz, Math.min(zz + 1.5, zEnd), Math.min(level(zz), level(zz + 1.5)) - 4.5)

  // The route: a checkerboard of lane spots up each belt (a bot waits there running on the spot, between fruit), a
  // row of spots on the landing under the leap, in over the gutter, the ditches jumped from their edges onto a spot
  // just past them, out over the top. The gold line: onto the rail from the pad, hops over its gaps, across the
  // landing's corner (clear of the fruit), onto the next belt's rail, over ditch C.
  k.node('in', 0, -1.5)
  const near = (l: number) => [l, l - 1, l + 1].filter((m) => m >= 0 && m < lanes.length)
  /** A belt's checkerboard: spots[r][l] (null where row r has no spot in lane l). */
  type Board = { spots: (string | null)[][] }
  const below = [gap, ...ditches.map((d) => !!d)]
  const boards: Board[] = belts.map((b, bi) => {
    const spots: (string | null)[][] = []
    for (let r = 0, zz = b.z0 + (below[bi] ? ROW0_DITCH : ROW0_2); zz <= b.z1 - 1; r++, zz += HALF_ROW) {
      spots.push(lanes.map((x, l) => ((l + r) % 2 === 0 ? k.node(`b${bi}_${r}_${l}`, x, zz, { y: ground(zz) }) : null)))
    }
    // Within it: a lane aside to the row above, or straight on two rows up; and a lane aside to the row below, the
    // dodge for when nothing up the belt is clear (it scores worse than any way up, so it's only taken then).
    spots.forEach((row, r) =>
      row.forEach((id, l) => {
        if (!id) return
        for (const m of [l - 1, l + 1]) {
          const to = spots[r + 1]?.[m]
          if (to) k.edge(id, to)
        }
        const up = spots[r + 2]?.[l]
        if (up) k.edge(id, up)
        for (const m of [l - 1, l + 1]) {
          const to = spots[r - 1]?.[m]
          if (to) k.edge(id, to)
        }
      }),
    )
    return { spots }
  })
  /** The spot in lane l nearest the bottom of a board. */
  const entry = (bd: Board, l: number) => bd.spots[0]![l] ?? bd.spots[1]![l]!
  /** The spots at the top of a board (its last two rows), by lane. */
  const exits = (bd: Board) => {
    const n = bd.spots.length
    return lanes.map((_, l) => bd.spots[n - 1]![l] ?? bd.spots[n - 2]![l]!)
  }
  // The landing's spots, under the fruit's leap (they sail over them), short of its far edge.
  const midZ = Math.min(mid.z1 - 1.3, (leap0 + leap1) / 2)
  const midSpots = lanes.map((x, l) => k.node(`m_${l}`, x, midZ, { y: mid.y0 }))
  k.node('out', 0, zEnd + 1.5, { y: H })
  const board1 = boards[0]!
  /**
   * A way out of a spot a bean can stand at as long as it likes (the pad before, the landing under the leap), laid
   * three times, each allowed in its own third of the fruit's cycle: the blue's planner keeps each way's first clean
   * departure, and this way it tries setting off at three moments of the cycle, not only the first (which can lead
   * up the belt into a dead end). Together they allow every moment, so no departure that works is lost.
   */
  type EdgeOpts = Parameters<typeof k.edge>[3]
  const thirds = (from: string, to: string, move: EdgeMove = 'run', o: EdgeOpts = {}) => {
    for (let j = 0; j < 3; j++) k.edge(from, to, move, { ...o, window: (t) => Math.min(2, Math.floor(3 * frac((t - ph0) / P))) === j })
  }
  if (!gap) lanes.forEach((_, l) => thirds('in', entry(board1, l)))
  else {
    // Over the gutter's gap onto a spot just up the belt, then on up to the first spots.
    const zf = belt1.z0 + PAST_DITCH
    lanes.forEach((x, m) => {
      const far = k.node(`g_${m}`, x, zf, { y: ground(zf), wait: 'no' })
      thirds('in', far, 'jump', { takeoff: k.at((x * 1.1) / (zf + 1.5), 0, -0.4) })
      k.edge(far, entry(board1, m))
    })
  }
  /** From spots `from` (by lane) over a ditch (or none) to spots `to(m)`: straight on and a lane aside. */
  const across = (from: readonly string[], fromY: number, edgeZ: number, d: Sec | null, to: (m: number) => string, tag: string, staging: boolean) => {
    const way = staging ? thirds : (a: string, b: string, move: EdgeMove = 'run', o: EdgeOpts = {}) => void k.edge(a, b, move, o)
    if (!d) {
      from.forEach((id, l) => near(l).forEach((m) => way(id, to(m))))
      return
    }
    const farY = ground(d.z1 + PAST_DITCH)
    const far = lanes.map((x, m) => k.node(`${tag}_${m}`, x, d.z1 + PAST_DITCH, { y: farY, wait: 'no' }))
    from.forEach((id, l) => near(l).forEach((m) => way(id, far[m]!, 'jump', { takeoff: k.at(lanes[l]! + (lanes[m]! - lanes[l]!) * 0.15, fromY, edgeZ - 0.45) })))
    far.forEach((id, m) => k.edge(id, to(m)))
  }
  across(exits(board1), belt1.y1, belt1.z1, dA, (m) => midSpots[m]!, 'dA', false)
  across(midSpots, mid.y0, mid.z1, dB, (m) => entry(boards[1]!, m), 'dB', true)
  for (let u = 1; u < upper.length; u++) {
    const b = upper[u - 1]!
    across(exits(boards[u]!), b.y1, b.z1, ditches[u]!, (m) => entry(boards[u + 1]!, m), `d${u}`, false)
  }
  exits(boards[boards.length - 1]!).forEach((id) => k.edge(id, 'out'))

  // The gold line: up belt 1's rail, across the landing's corner (clear of the fruit), up the upper belt's (over
  // ditch C on T3).
  const corner = k.node('rm', railX, midZ, { y: mid.y0 })
  const railEnds: string[] = []
  rails.forEach((pieces, bi) => {
    const ids = pieces.map(([p0, p1], j) => {
      const za = j === 0 ? p0 + 0.9 : p0 + 0.6
      const zb = p1 - 0.6
      return [k.node(`r${bi}_${j}a`, railX, za, { y: ground(za) }), k.node(`r${bi}_${j}b`, railX, zb, { y: ground(zb), wait: 'no' })] as const
    })
    // Onto it: from the pad (over the gutter), from the landing's corner (over ditch B), or from the rail before (over
    // ditch C).
    const enter = bi === 0 ? 'in' : bi === 1 ? corner : railEnds[bi - 1]!
    const into = bi === 0 || bi > 1 || dB ? 'jump' : 'run'
    k.edge(enter, ids[0]![0], into, into === 'jump' ? { tier: 'gold', takeoff: 'edge', inset: 0.3 } : { tier: 'gold' })
    ids.forEach(([a, b], j) => {
      k.edge(a, b, 'run', { tier: 'gold' })
      if (j < ids.length - 1) k.edge(b, ids[j + 1]![0], 'jump', { tier: 'gold', takeoff: 'edge', inset: 0.35 })
    })
    const lastB = ids[ids.length - 1]![1]
    railEnds.push(lastB)
    if (bi === 0) k.edge(lastB, corner, dA ? 'jump' : 'run', dA ? { tier: 'gold', takeoff: 'edge', inset: 0.35 } : { tier: 'gold' })
    else if (bi === rails.length - 1) k.edge(lastB, 'out', 'run', { tier: 'gold' })
  })
  return k.done({ x: 0, y: H, z: zEnd })
}

export const ROUND: RoundDef = {
  letter: 'f',
  name: 'Melon Hill',
  hint: 'climb the belt',
  family: 'D',
  phase: 1,
  build,
}
