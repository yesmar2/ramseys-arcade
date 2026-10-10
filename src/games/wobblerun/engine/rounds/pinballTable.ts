/**
 * Pinball Table (k, T: a round of our own, gen 2): a tilted pinball playfield Blip climbs, rising toward +z at
 * 8–11°. Teal pop bumpers stand in clusters up the middle of the table; big steel pinballs roll down the two side
 * lanes from kickers (a kicker's light blinks 0.8 s before each ball) and drop into drain holes cut in the table's
 * edge below each cluster; orange flippers at the foot of the table and partway up (T2+, on a flat landing) fire
 * on a beat (a light blinks 0.8 s before), and standing on one as it fires launches you up the table over the next
 * cluster. JUMP as it fires for a perfect flip: from the bottom that's the skill shot, over every cluster at once.
 *
 * The middle of the table is quiet (no ball ever rolls there), but every cluster blocks it: the way round is
 * through a side lane, timed between the balls, along the table's edge, outside the balls' line. A ball's knock
 * there throws you out over the edge or down the lane into its drain hole, and the soda sea below (T1 has rails
 * and no holes: its balls sink into covered saucers). The drain across the bottom is a trough to step through on
 * T1–T2, a gap to hop on T3. The table never climbs more than RISE_MOST (T3's long table is eased): a solo course at
 * gen 1 (the difficulty report's first rows) lays gen 1's slide down after it, whose splat height is 6 m under its
 * top, and that must stay clear of its foot.
 *
 * Main route: up the middle, round each cluster through a side lane between balls. The gold line: the flippers.
 */
import { bonk, knock, releaseTele, rollDistance } from '../sim.ts'
import type { Hit, RoundDef, RoundOut, RoundSlot, Rng, TeleFn, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/**
 * The table: 9 m wide; the drain across its foot (on T1–T2 a trough shallow enough to walk down into and up out of
 * without a ledge catch); the flat top deck; its rails; the most it climbs.
 */
const HX = 4.5
const GUTTER = 1.5
const TROUGH = 0.25
const TOP = 3
const RAIL_H = 1.0
const RISE_MOST = 5.0
/** The flat landing the mid flippers stand on (T2+). */
const LANDING = 4.6
/**
 * The side lanes: the balls' line, the way past a cluster (outside it: a ball's knock there throws you out over the
 * edge or down the lane), and the strip each runs on (from STRIP_X out to the edge), cut by its drain holes.
 */
const LANE_X = 2.8
const WALK_X = 3.8
const STRIP_X = 2.0
/** The balls: size, and how they roll (from v0, gathering ACC, to the tier's most). */
const BALL_R = 0.85
const BALL_V0 = 4
const BALL_ACC = 3
/** A ball's hit: a hard knock, mostly down the table. */
const BALL_HIT: Hit = knock(6.5, 0.5, 5)
/** Pop bumpers: a cluster is three in a triangle, its point down the table. */
const BUMP_R = 0.65
const BUMP_H = 1.1
const BUMP_HIT: Hit = bonk(7, 2.5)
const CLUSTER_LO = 1.2
const CLUSTER_HI = 0.9
const CLUSTER_SIDE = 1.0
/**
 * The way round a cluster: a wait spot beside it below (SIDE_X out, WAIT_LO below its middle), the side lane past it
 * (LANE_LO below to LANE_HI above), a wait spot beside it above (WAIT_HI).
 */
const SIDE_X = 0.95
const WAIT_LO = 2.8
const WAIT_HI = 2.9
const LANE_LO = 1.0
const LANE_HI = 1.9
/**
 * A cluster's lane system: its kicker this far above the cluster, its drain hole's middle this far below, and the
 * least time between a lane's balls (the way round a cluster takes about 1.4 s, a ball about as long to pass it, and
 * a phone's hands are 0.55 s late).
 */
const LANE_LEAST = 3.4
/** A system's right lane fires this share of its period after its left: both busy at once, so you wait for the gap. */
const LANE_LAG = 0.18
const KICK_ABOVE = 5.2
const DRAIN_BELOW = 3.8
/** Flippers: 2.2 m bars 0.9 m deep, angled 20° down toward the middle, their centres 2.5 m out. */
const FLIP_X = 2.5
const FLIP_HX = 1.1
const FLIP_HZ = 0.45
const FLIP_YAW = 0.35
/** A flipper fires for LIT s (standing on it then launches you), after a WARN s blink, settling for BACK s. */
const LIT = 0.3
const WARN = 0.8
const BACK = 0.35
/** The throws: a plain flip and a perfect one (JUMP as it fires) cross at about these speeds, thrown up at most FLIP_VY_MOST. */
const FLIP_SPEED = 14
const SKILL_SPEED = 19
const FLIP_VY_MOST = 20
/**
 * A flip over a cluster lands this far past its middle, clear of its top bumpers on the way down (it skids on); the
 * skill shot (a perfect flip from the bottom, higher and longer) this far past the last cluster's.
 */
const LAND_PAST = 3.6
const SKILL_PAST = 4.6

const deg = (d: number) => (d * Math.PI) / 180
const frac = (v: number) => v - Math.floor(v)

/** A flipper firing at ph + m·P: lit (it throws) for LIT s. */
function flipLit(P: number, ph: number): (t: number) => boolean {
  return (t) => frac((t - ph) / P) * P < LIT
}

/** A flipper's telegraph: `warn` (its light blinking) WARN s before each fire, `act` while it fires, `back` as it settles. */
function flipTele(P: number, ph: number): TeleFn {
  return (t) => {
    const s = frac((t - ph) / P) * P
    if (s < LIT) return { state: 'act', u: s / LIT }
    if (s < LIT + BACK) return { state: 'back', u: (s - LIT) / BACK }
    const until = P - s
    if (until < WARN) return { state: 'warn', u: 1 - until / WARN }
    return { state: 'rest', u: (s - LIT - BACK) / Math.max(1e-6, P - LIT - BACK - WARN) }
  }
}

/** How long a ball takes to roll `len` m of table. */
function rollTime(len: number, vmost: number): number {
  let lo = 0
  let hi = 30
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2
    if (rollDistance(m, BALL_V0, BALL_ACC, vmost) < len) lo = m
    else hi = m
  }
  return hi
}

type Cluster = { cx: number; z: number; sys: number }

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('climb')
  const two = tier >= 2
  const holes = tier >= 2
  const drainLen = byTier(tier, [0, 1.8, 1.4])
  const vmost = byTier(tier, [6, 7.5, 7.5])
  const want = deg(byTier(tier, [8, 9.5, 11]) + rng.between(-0.5, 0.5))

  // Along the table: the bottom flippers, cluster 1, (T2+: the landing with the mid flippers, cluster 2, and on T3
  // cluster 3 right after it, the two sharing the wait spots between them and the upper lanes), the top.
  const zt0 = GUTTER
  const zf = zt0 + 1.3
  const c1 = zt0 + rng.between(8.4, 9.0)
  const clusters: Cluster[] = [{ cx: rng.between(-0.25, 0.25), z: c1, sys: 0 }]
  let zl0: number
  let zl1: number
  let zt1: number
  if (two) {
    zl0 = c1 + rng.between(6.6, 6.9)
    zl1 = zl0 + LANDING
    const c2 = zl1 + rng.between(5.6, 6.0)
    clusters.push({ cx: rng.between(-0.25, 0.25), z: c2, sys: 1 })
    if (tier === 3) clusters.push({ cx: rng.between(-0.25, 0.25), z: c2 + rng.between(5.9, 6.2), sys: 1 })
    zt1 = clusters[clusters.length - 1]!.z + rng.between(6.2, 6.6)
  } else {
    zt1 = c1 + rng.between(6.2, 6.6)
    zl0 = zl1 = zt1
  }
  // The lane systems: each from a kicker above its top cluster down past its clusters into a drain hole below its
  // lowest (on T1, a covered saucer at the foot of the lane).
  const systems = [...new Set(clusters.map((c) => c.sys))].map((sys) => {
    const own = clusters.filter((c) => c.sys === sys)
    const hi = own[own.length - 1]!.z
    const kick = sys === clusters[clusters.length - 1]!.sys ? Math.min(zt1 - 1.0, hi + KICK_ABOVE) : hi + KICK_ABOVE
    return { kick, drain: holes ? own[0]!.z - DRAIN_BELOW : zt0 + 3.0 }
  })
  const zm = (zl0 + zl1) / 2
  const tilted = zl0 - zt0 + (zt1 - zl1)
  const a = Math.min(want, Math.atan(RISE_MOST / tilted))
  const TAN = Math.tan(a)
  const COS = Math.cos(a)
  const SIN = Math.sin(a)
  const yl = (zl0 - zt0) * TAN
  const rise = yl + (zt1 - zl1) * TAN
  const surf = (z: number) => (z <= zt0 ? 0 : z <= zl0 ? (z - zt0) * TAN : z <= zl1 ? yl : z <= zt1 ? yl + (z - zl1) * TAN : rise)
  const zEnd = zt1 + TOP

  // The drain across the foot (a trough on T1–T2, a gap on T3), the top deck.
  if (tier < 3) {
    k.floor(0, GUTTER, { hx: HX, top: -TROUGH })
    k.walls(0, GUTTER, { hx: HX, y: -TROUGH, h: RAIL_H + TROUGH })
  }
  k.floor(zt1, zEnd, { hx: HX, top: rise, hy: 0.6 + rise / 2 })
  k.walls(zt1, zEnd, { hx: HX, y: rise })

  // The table, in strips: the middle one all the way up; on T2+ the side ones cut by each cluster's drain holes.
  // Each strip is tilted below and above the landing, flat across it.
  const strip = (z0: number, z1: number, x: number, hx: number) => {
    const parts: [number, number][] = [
      [z0, Math.min(z1, zl0)],
      [Math.max(z0, zl0), Math.min(z1, zl1)],
      [Math.max(z0, zl1), z1],
    ]
    parts.forEach(([p0, p1], i) => {
      if (p1 - p0 < 0.01) return
      if (i === 1) k.floor(p0, p1, { x, hx, top: yl, hy: 0.6 + yl / 2, look: 'table', role: 'floor' })
      else k.ramp(p0, p1, surf(p0), surf(p1) - surf(p0), { x, hx, hy: 0.8, look: 'table', role: 'floor' })
    })
  }
  const drains = holes ? systems.map((y) => [y.drain - drainLen / 2, y.drain + drainLen / 2] as const) : []
  if (!holes) strip(zt0, zt1, 0, HX)
  else {
    strip(zt0, zt1, 0, STRIP_X)
    const hxs = (HX - STRIP_X) / 2
    for (const side of [-1, 1]) {
      let at = zt0
      for (const [d0, d1] of drains) {
        strip(at, d0, side * (STRIP_X + hxs), hxs)
        at = d1
      }
      strip(at, zt1, side * (STRIP_X + hxs), hxs)
    }
  }
  // Rails: T1 all the way up; T2 by the bottom flippers, open past them where the balls run; T3 none.
  if (tier === 1) k.walls(zt0, zt1, { hx: HX, rise, h: RAIL_H })
  else if (tier === 2) k.walls(zt0, zf + 1.6, { hx: HX, rise: surf(zf + 1.6), h: RAIL_H })
  for (let z = 0; z < zEnd; z += 3) k.death(z, Math.min(z + 3, zEnd), surf(z) - 4.5)

  // Bumpers: each cluster's three.
  for (const c of clusters) {
    for (const [dx, dz] of [
      [0, -CLUSTER_LO],
      [-CLUSTER_SIDE, CLUSTER_HI],
      [CLUSTER_SIDE, CLUSTER_HI],
    ] as const) {
      k.hazard({ shape: 'post', x: c.cx + dx, y: surf(c.z + dz), z: c.z + dz, r: BUMP_R, h: BUMP_H, hit: BUMP_HIT, look: 'bumper' })
    }
  }

  // The balls: each lane system's left and right lanes, a ball every P from its kicker down past its clusters into
  // its drain; the right lane's a little after the left's, so both are busy at once and you wait for the gap.
  const P0 = Math.max(LANE_LEAST, slot.period * byTier(tier, [1.35, 1.15, 1.25]))
  systems.forEach(({ kick: z0, drain: z1 }, j) => {
    const roll = rollTime((z0 - z1) / COS, vmost)
    const sink = 0.3
    const P = P0 * (j === 1 ? 1.07 : 1)
    const ph0 = rng.between(0, P)
    for (const side of [-1, 1] as const) {
      const ph = ph0 + (side > 0 ? P * LANE_LAG : 0)
      const ball = k.hazard({
        shape: 'sphere',
        x: side * LANE_X,
        y: surf(z0) + BALL_R / COS,
        z: z0,
        r: BALL_R,
        hit: BALL_HIT,
        look: 'pinball',
        role: 'dodge',
        tele: releaseTele(P, ph, 0.8),
        path: {
          P,
          ph,
          life: roll + sink,
          at: (tau, _k, o) => {
            const s = rollDistance(Math.min(tau, roll), BALL_V0, BALL_ACC, vmost)
            o.z = -s * COS
            o.y = -s * SIN
            // No yaw (a boulder's rolling angle): a path body's yaw turns the point it touches you with (sim.ts
            // hazardVel), so a rolling ball's hit would carry a sideways kick toward −x in both lanes, throwing you
            // off one side of the table and onto the other. A chrome ball's roll hardly shows anyway.
            // Down the hole at the foot of its lane.
            if (tau > roll) o.y -= 14 * (tau - roll) ** 2 + 2 * (tau - roll)
          },
        },
      })
      k.deco({ look: 'chute', x: side * LANE_X, y: surf(z0), z: z0 + 0.4, sx: 2.2, sy: 2.2, sz: 1.2, ref: { kind: 'hazard', i: ball } })
      k.deco({ look: 'drain', x: side * (holes ? (STRIP_X + HX) / 2 : LANE_X), y: surf(z1), z: z1, sx: 0.05, sy: 0.05, sz: 0.05, params: holes ? { w: HX - STRIP_X, l: drainLen } : { w: 2 * BALL_R + 0.2, l: 2 * BALL_R + 0.2, saucer: true } })
    }
  })

  // The flippers: a pair at the foot, and (T2+) a pair on the landing. Each fires every period, the pair's two out
  // of step, lit while it fires; standing on one then throws you up over the next cluster (a perfect flip further).
  const at = (zz: number) => ({ x: 0, y: surf(zz), z: zz })
  // A throw's upward speed: whatever carries it from the flipper to the spot at about `speed` m/s across (high
  // enough to clear every bumper on the way), at most FLIP_VY_MOST.
  const vyFor = (z: number, aim: number, speed: number) => {
    const tf = Math.max(0.85, Math.hypot(FLIP_X, aim - z) / speed)
    return Math.min(FLIP_VY_MOST, 14 * tf + (surf(aim) - surf(z)) / tf)
  }
  const flipPair = (z: number, aim: number, perfect: number | null, phase: number): number[] => {
    const tan = z > zl0 && z < zl1 ? 0 : TAN
    const vy = vyFor(z, aim, FLIP_SPEED)
    const pvy = perfect === null ? 0 : vyFor(z, perfect, SKILL_SPEED)
    return ([-1, 1] as const).map((side) => {
      const yaw = side < 0 ? FLIP_YAW : -FLIP_YAW
      const ph = phase + (side > 0 ? slot.period / 2 : 0)
      const lit = flipLit(slot.period, ph)
      return k.box({
        x: side * FLIP_X,
        z,
        hx: FLIP_HX,
        hz: FLIP_HZ,
        top: surf(z) + 0.06,
        hy: 0.15,
        yaw,
        pitch: Math.atan(Math.cos(yaw) * tan),
        roll: Math.atan(-Math.sin(yaw) * tan),
        look: 'flipper',
        role: 'helps',
        gold: true,
        ledge: false,
        tele: flipTele(slot.period, ph),
        bounce: perfect === null ? { vy, aim: at(aim), lit } : { vy, aim: at(aim), perfectVy: pvy, perfectAim: at(perfect), lit },
      })
    })
  }
  const last = clusters[clusters.length - 1]!
  const ph0 = rng.between(0, slot.period)
  const bottom = flipPair(zf, clusters[0]!.z + LAND_PAST, two ? last.z + SKILL_PAST : zt1 + 0.8, ph0)
  const mid = two ? flipPair(zm, zt1 + 0.8, null, ph0 + rng.between(0.2, 0.8) * slot.period) : []
  k.deco({ look: 'gold-flag', x: -HX + 0.4, y: surf(zf - 1.0), z: zf - 1.0, sy: 1.8 })
  k.gold('Flippers', zf, zt1, 0)

  // The route: up the middle to a wait spot beside the cluster, round it through that side's lane (between balls),
  // to a wait spot beside it above (on T3 the next cluster's wait spot below, across the middle either way);
  // between clusters across the landing; over the top.
  k.node('in', 0, -1.5)
  const c0 = k.node('c0', 0, zt0 + 1.0, { y: surf(zt0 + 1.0) })
  if (tier < 3) k.edge('in', c0)
  else k.edge('in', c0, 'jump', { takeoff: k.at(0, 0, -0.4) })
  let froms = [c0]
  let shared: Record<string, string> | null = null
  clusters.forEach((c, j) => {
    const next = clusters[j + 1]
    const join = !!next && next.z - WAIT_LO - (c.z + WAIT_HI) < 1.0
    const ups: Record<string, string> = {}
    const sides: (1 | -1)[] = rng.chance(0.5) ? [-1, 1] : [1, -1]
    for (const side of sides) {
      const s = side < 0 ? 'L' : 'R'
      let b = shared?.[s]
      if (!b) {
        b = k.node(`${s}${j}b`, side * SIDE_X, c.z - WAIT_LO, { y: surf(c.z - WAIT_LO) })
        for (const f of froms) k.edge(f, b)
      }
      const lo = k.node(`${s}${j}0`, side * WALK_X, c.z - LANE_LO, { y: surf(c.z - LANE_LO), wait: 'no' })
      const hi = k.node(`${s}${j}1`, side * WALK_X, c.z + LANE_HI, { y: surf(c.z + LANE_HI), wait: 'no' })
      const tz = join ? (c.z + WAIT_HI + next!.z - WAIT_LO) / 2 : c.z + WAIT_HI
      const t = k.node(`${s}${j}a`, side * SIDE_X, tz, { y: surf(tz) })
      k.edge(b, lo)
      k.edge(lo, hi)
      k.edge(hi, t)
      ups[s] = t
    }
    if (join) {
      k.edge(ups.L!, ups.R!)
      k.edge(ups.R!, ups.L!)
      shared = ups
      return
    }
    shared = null
    froms = [ups.L!, ups.R!]
    if (j === 0 && two) {
      const m = k.node('m', 0, zm, { y: yl })
      for (const f of froms) k.edge(f, m)
      froms = [m]
    }
  })
  const top = k.node('top', 0, zt1 + 1.5, { y: rise })
  for (const f of froms) k.edge(f, top)
  k.node('out', 0, zEnd + 1.5, { y: rise })
  k.edge(top, 'out')

  // The gold line: from the foot onto a bottom flipper, over cluster 1 (a perfect flip: over them all); from the
  // landing onto a mid flipper, up onto the top deck.
  const flipEdges = (fromId: string, pads: number[], to: string, move: 'bounce' | 'perfectBounce', z: number) => {
    pads.forEach((pad, i) => {
      const side = i === 0 ? -1 : 1
      k.edge(fromId, to, move, { tier: 'gold', via: [k.at(side * FLIP_X, surf(z), z, pad)], maxT: slot.period + 4 })
    })
  }
  flipEdges(c0, bottom, two ? 'm' : top, 'bounce', zf)
  flipEdges(c0, bottom, top, 'perfectBounce', zf)
  if (two) flipEdges('m', mid, top, 'bounce', zm)
  return k.done({ x: 0, y: rise, z: zEnd })
}

export const ROUND: RoundDef = {
  letter: 'k',
  name: 'Pinball Table',
  hint: 'ride the flippers up',
  family: 'T',
  phase: 2,
  build,
}
