/**
 * Crown Peak (design-final F1, the finale): a broad candy mountain with rails, giant striped boulders rolling
 * down three lanes from chutes at the top of each ramp, a low sweeper on the terrace between the ramps (T2+), a
 * teal summit pad that flings a perfect bounce up to the summit (the gold line), and the golden crown bobbing over
 * the summit. Touching the crown stops the clock, to the moment inside the step.
 *
 * The reference round for scheduled hazards (path specs: release k at ph + k·P, rolling down the slope), ramps
 * with sloping rails, a sweeper bar, a bounce pad with a perfect window, a mid flag and the crown.
 *
 * Generation 2 (build2, below): two climbs with a ledge up onto the terrace and a crevasse down off it, and open
 * edges at T2 and up.
 */
import { bonk, knock, releaseTele, rollDistance, spin } from '../sim.ts'
import type { RoundDef, RoundOut, RoundSlot, Rng, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

const HX = 5
const RAIL_H = 1.2
const LANES = [-3.3, 0, 3.3] as const
const BOULDER_R = 1.2
/** Boulders set off at 6 m/s and gather 1 m/s² to 8. */
const B_V0 = 6
const B_ACC = 1
const B_MOST = 8
/** The terrace sweeper: a low bar (axis 0.40 m up) 4.8 m each way, round a hub. */
const SWEEP_LEN = 4.8
const SWEEP_Y = 0.4
const SWEEP_R = 0.25
const HUB_R = 0.8
/** The terrace's length; its corner wait spots, this far in from its rails and ends. */
const TERRACE_LEN = 12
const CORNER_X = 4.5
const CORNER_IN = 0.9
/** The chutes release this far below the top of a ramp; boulders drop away this far before its foot. */
const CHUTE_IN = 1.0
const FOOT_OUT = 1.5

/** How long a boulder takes to roll `len` m of slope. */
function rollTime(len: number): number {
  let a = 0
  let b = 30
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2
    if (rollDistance(m, B_V0, B_ACC, B_MOST) < len) a = m
    else b = m
  }
  return b
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  if (k.gen >= 2) return build2(slot, rng, tier)
  k.camera('climb')
  const lowLen = rng.between(26, 30)
  const lowA = (rng.between(9, 11) * Math.PI) / 180
  const upLen = rng.between(16, 20)
  const upA = (rng.between(13, 15) * Math.PI) / 180
  const P = byTier(tier, [4.0, 3.6, 3.2])
  const lanes = tier === 1 ? [0, 2] : [0, 1, 2]
  const sweeper = tier >= 2
  const w = sweeper ? (tier === 3 ? 1.1 : rng.between(0.9, 1.1)) * rng.sign() : 0

  // The mountain: a 2 m apron, the lower ramp, the terrace, the upper ramp, the summit. The terrace is 12 m (the
  // spec's 8 m left no spot a careful bean could stand clear of a 4.8 m sweeper): its four corners are clear.
  const z0 = 2
  const lowRise = lowLen * Math.tan(lowA)
  const zt0 = z0 + lowLen
  const zt1 = zt0 + TERRACE_LEN
  const upRise = upLen * Math.tan(upA)
  const zs0 = zt1 + upLen
  const zs1 = zs0 + 8
  const yt = lowRise
  const ys = lowRise + upRise
  k.floor(0, z0)
  k.walls(0, z0, { h: RAIL_H })
  k.ramp(z0, zt0, 0, lowRise, { hx: HX, hy: 0.8 })
  k.walls(z0, zt0, { hx: HX, rise: lowRise, h: RAIL_H })
  k.floor(zt0, zt1, { hx: HX, top: yt, look: 'terrace', hy: 0.6 + yt / 2 })
  k.walls(zt0, zt1, { hx: HX, y: yt, h: RAIL_H })
  k.ramp(zt1, zs0, yt, upRise, { hx: HX, hy: 0.8 })
  k.walls(zt1, zs0, { hx: HX, y: yt, rise: upRise, h: RAIL_H })
  k.floor(zs0, zs1, { hx: HX, top: ys, look: 'summit', hy: 0.6 + ys / 2 })
  k.walls(zs0, zs1, { hx: HX, y: ys, h: RAIL_H })
  k.box({ x: 0, z: zs1 + 0.25, hx: HX + 0.5, hz: 0.25, top: ys + RAIL_H, hy: (RAIL_H + 0.6) / 2, look: 'rail', noGround: true })

  // Boulders: each lane releases one every P (out of step with its neighbours) from a chute just below the top of
  // each ramp, and they drop away just before its foot.
  const ph0 = rng.between(0, P)
  const lanePh = LANES.map((_, l) => ph0 + (l * P) / 3 + rng.between(-0.25, 0.25))
  const ramps = [
    { top: zt0, y: lowRise, a: lowA, len: lowLen },
    { top: zs0, y: ys, a: upA, len: upLen },
  ]
  for (const ramp of ramps) {
    const cs = Math.cos(ramp.a)
    const sn = Math.sin(ramp.a)
    const life = rollTime((ramp.len - CHUTE_IN - FOOT_OUT) / cs)
    const lift = BOULDER_R / cs
    for (const l of lanes) {
      const ph = lanePh[l]! + (ramp === ramps[1] ? P / 2 : 0)
      const boulder = k.hazard({
        shape: 'sphere',
        x: LANES[l],
        y: ramp.y - CHUTE_IN * Math.tan(ramp.a) + lift,
        z: ramp.top - CHUTE_IN,
        r: BOULDER_R,
        hit: knock(6, 0.5, 5),
        look: 'boulder',
        tele: releaseTele(P, ph, 0.8),
        path: {
          P,
          ph,
          life,
          at: (tau, _k, o) => {
            const s = rollDistance(tau, B_V0, B_ACC, B_MOST)
            o.z = -s * cs
            o.y = -s * sn
            o.yaw = s / BOULDER_R
          },
        },
      })
      k.deco({ look: 'chute', x: LANES[l], y: ramp.y, z: ramp.top - CHUTE_IN + 0.4, sx: 2.8, sy: 2.6, sz: 1.6, ref: { kind: 'hazard', i: boulder } })
    }
  }

  // The terrace sweeper (T2+): a low bar round a hub, to hop or wait for.
  const tc = (zt0 + zt1) / 2
  if (sweeper) {
    k.hazard({ shape: 'bar', x: 0, y: yt + SWEEP_Y, z: tc, r: SWEEP_R, len: SWEEP_LEN, hit: knock(5, 0.8, 6), look: 'bar-low', move: spin(w, rng.between(0, Math.PI * 2)) })
    k.hazard({ shape: 'post', x: 0, y: yt, z: tc, r: HUB_R, h: 1.5, hit: bonk(6), look: 'hub' })
  }

  // The summit pad (gold): a perfect bounce flings you onto the summit; a plain one only halfway up the ramp.
  const padSide = rng.sign()
  const padX = padSide * 2.6
  const padZ = zt1 - 1.6
  const summitAim = { x: padX * 0.3, y: ys, z: zs0 + 2.2 }
  const rampAim = { x: padX * 0.8, y: yt + upRise / 2, z: zt1 + upLen / 2 }
  const pad = k.cyl({ x: padX, z: padZ, r: 1.0, top: yt + 0.04, hy: 0.3, look: 'bounce', gold: true, bounce: { vy: 15, aim: rampAim, perfectVy: 18, perfectAim: summitAim } })
  k.deco({ look: 'gold-flag', x: padX, y: yt, z: padZ - 1.4, sy: 1.8 })
  k.gold('Summit pad', padZ, zs0, padX)

  // The crown over the summit's middle, bobbing: walk into its low half, or jump for it.
  const crownZ = zs0 + 4.2
  const bobPh = rng.between(0, 2.2)
  k.deco({ look: 'pedestal', x: 0, y: ys, z: crownZ, sx: 1.4, sy: 0.5, sz: 1.4 })
  k.crown({ x: 0, y: ys + 2.2, z: crownZ, bob: (t) => 0.5 * Math.sin((2 * Math.PI * (t + bobPh)) / 2.2) })

  // The route: lane nodes up each ramp (with steps aside, out of a boulder's way), the terrace's corners (clear
  // of the sweeper and the chutes: the near one away from the pad has the mid flag), up to the summit, then a jump
  // into the crown.
  k.node('in', 0, -1.5)
  const rows = (zA: number, zB: number, yA: number, yB: number, name: string) => {
    const n = Math.max(3, Math.round((zB - zA) / 6.5) + 1)
    const ids: string[][] = []
    for (let r = 0; r < n; r++) {
      const z = zA + ((zB - zA) * r) / (n - 1)
      const y = yA + ((yB - yA) * r) / (n - 1)
      ids.push(LANES.map((x, l) => k.node(`${name}${r}_${l}`, x, z, { y })))
    }
    for (let r = 0; r < n - 1; r++) for (let l = 0; l < 3; l++) for (let l2 = 0; l2 < 3; l2++) if (Math.abs(l - l2) <= 1) k.edge(ids[r]![l]!, ids[r + 1]![l2]!)
    for (let r = 0; r < n; r++) {
      for (let l = 0; l < 2; l++) {
        k.edge(ids[r]![l]!, ids[r]![l + 1]!)
        k.edge(ids[r]![l + 1]!, ids[r]![l]!)
      }
    }
    return ids
  }
  const lowTopZ = zt0 - 0.5
  const upFootZ = zt1 + 0.6
  const low = rows(z0 + 0.6, lowTopZ, Math.tan(lowA) * 0.6, Math.tan(lowA) * (lowTopZ - z0), 'a')
  const up = rows(upFootZ, zs0 - 0.6, yt + Math.tan(upA) * (upFootZ - zt1), yt + Math.tan(upA) * (zs0 - 0.6 - zt1), 'b')
  for (let l = 0; l < 3; l++) k.edge('in', low[0]![l]!)
  const lowTop = low[low.length - 1]!
  const near = [k.node('tn0', -CORNER_X, zt0 + CORNER_IN, { y: yt }), k.node('tn1', CORNER_X, zt0 + CORNER_IN, { y: yt })]
  const far = [k.node('tf0', -CORNER_X, zt1 - CORNER_IN, { y: yt }), k.node('tf1', CORNER_X, zt1 - CORNER_IN, { y: yt })]
  k.edge(lowTop[0]!, near[0]!)
  k.edge(lowTop[1]!, near[0]!)
  k.edge(lowTop[1]!, near[1]!)
  k.edge(lowTop[2]!, near[1]!)
  for (const s of [0, 1]) k.edge(near[s]!, far[s]!)
  k.edge(far[0]!, up[0]![0]!)
  k.edge(far[0]!, up[0]![1]!)
  k.edge(far[1]!, up[0]![1]!)
  k.edge(far[1]!, up[0]![2]!)
  const flagSide = padSide > 0 ? 0 : 1
  k.flag(flagSide ? CORNER_X : -CORNER_X, zt0 + CORNER_IN, near[flagSide]!, yt)
  k.node('top', 0, zs0 + 1.4, { y: ys })
  for (let l = 0; l < 3; l++) k.edge(up[up.length - 1]![l]!, 'top')
  k.node('crown', 0, crownZ, { y: ys })
  k.edge('top', 'crown', 'jump', { takeoff: k.at(0, ys, crownZ - 2.0) })
  // The gold line: from the near corner on the pad's side, onto the pad, perfect-bounce onto the summit.
  k.edge(near[padSide > 0 ? 1 : 0]!, 'top', 'perfectBounce', { tier: 'gold', via: [k.at(padX, yt, padZ, pad)] })
  return k.done({ x: 0, y: ys, z: zs1 })
}

/* ------------------------------------------------------------------ generation 2 --- */

/*
 * Generation 2: Star Peak climbs in two goes, with level changes between. The first climb (20–24 m, shorter than gen
 * 1's) ends at a ledge you hop up (LEDGE_H) onto the terrace; its chutes stand 3 m below the ledge, so a strip under it
 * is clear to wait in. The terrace (the mid flag; the sweeper at T2 and up) ends at a crevasse; across it, a short drop
 * down, is a shelf at the second climb's foot, clear of its boulders (they drop away just before it). A boulder that
 * catches you low on the second climb knocks you back across the shelf into the crevasse, and at T2 and up the rails
 * are open along the second climb's foot (T2 0.45 of it, T3 0.6; T3 also the first climb's top 0.4): the mountain's
 * edge, where a knock is a fall back to the last flag. The shelf is deeper the gentler the tier (T1 3.8 m, T2 4.6,
 * T3 3.0, with T3's wider crevasse and open edges). Boulders roll every 4.0 / 3.6 / 3.6 s a lane (gen 1's T3 3.2 s
 * was two to five knocks for a careful phone player), the two climbs' chutes nearly together. The summit pad stays the
 * gold line: a perfect bounce flings you over the crevasse and halfway up the second climb, a plain one onto its foot.
 */
const LEDGE_H = 0.75
/** The first climb's chutes stand this far below its top, leaving a strip under the ledge no boulder reaches. */
const CHUTE_IN_1 = 3.0
/** Where the first climb's rows of route spots end, short of the ledge (in that strip). */
const ROWS_SHORT = 0.6
/** How far up the second climb a perfect bounce off the summit pad lands you (the row of spots nearest it). */
const GOLD_UP = 0.55

function build2(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('climb')
  const lowLen = rng.between(20, 24)
  const lowA = (rng.between(9, 11) * Math.PI) / 180
  const upLen = rng.between(16, 20)
  const upA = (rng.between(13, 15) * Math.PI) / 180
  const P = byTier(tier, [4.0, 3.6, 3.6])
  const lanes = tier === 1 ? [0, 2] : [0, 1, 2]
  const sweeper = tier >= 2
  const w = sweeper ? (tier === 3 ? 1.1 : rng.between(0.9, 1.1)) * rng.sign() : 0
  const gap = byTier(tier, [rng.between(1.6, 1.8), rng.between(2.0, 2.2), rng.between(2.2, 2.5)])
  const drop = rng.between(0.4, 0.6)
  const shelf = byTier(tier, [3.8, 4.6, 3.0])
  /** How much of the second climb (from its foot) and of the first (to its top) runs without rails. */
  const open2 = byTier(tier, [0, 0.45, 0.6])
  const open1 = byTier(tier, [0, 0, 0.4])

  // The mountain: a 2 m apron, the first climb, the ledge up onto the terrace, the crevasse, the shelf (a short drop
  // below the terrace), the second climb, the summit.
  const z0 = 2
  const lowRise = lowLen * Math.tan(lowA)
  const zl = z0 + lowLen
  const yt = lowRise + LEDGE_H
  const zt1 = zl + TERRACE_LEN
  const zc = zt1 + gap
  const yb = yt - drop
  const zf = zc + shelf
  const upRise = upLen * Math.tan(upA)
  const zs0 = zf + upLen
  const zs1 = zs0 + 8
  const ys = yb + upRise
  k.floor(0, z0)
  k.walls(0, z0, { h: RAIL_H })
  k.ramp(z0, zl, 0, lowRise, { hx: HX, hy: 0.8 })
  const open1At = zl - open1 * lowLen
  k.walls(z0, zl, { hx: HX, rise: lowRise, h: RAIL_H, gaps: open1 > 0 ? [[open1At, zl]] : [] })
  k.floor(zl, zt1, { hx: HX, top: yt, look: 'terrace', hy: 0.6 + yt / 2 })
  k.walls(zl, zt1, { hx: HX, y: yt, h: RAIL_H })
  k.floor(zc, zf, { hx: HX, top: yb, look: 'terrace', hy: 0.6 + yb / 2 })
  if (open2 <= 0) k.walls(zc, zf, { hx: HX, y: yb, h: RAIL_H })
  k.ramp(zf, zs0, yb, upRise, { hx: HX, hy: 0.8 })
  const open2To = zf + open2 * upLen
  k.walls(zf, zs0, { hx: HX, y: yb, rise: upRise, h: RAIL_H, gaps: open2 > 0 ? [[zf, open2To]] : [] })
  k.floor(zs0, zs1, { hx: HX, top: ys, look: 'summit', hy: 0.6 + ys / 2 })
  k.walls(zs0, zs1, { hx: HX, y: ys, h: RAIL_H })
  k.box({ x: 0, z: zs1 + 0.25, hx: HX + 0.5, hz: 0.25, top: ys + RAIL_H, hy: (RAIL_H + 0.6) / 2, look: 'rail', noGround: true })
  // Splat heights: off the first climb's open top, and in the crevasse and off the open foot of the second, a few
  // metres down (not 6 m below the apron, a long way below up here).
  if (open1 > 0) k.death(open1At, zl, (lowRise * (open1At - z0)) / lowLen - 3)
  k.death(zt1, Math.max(zf, open2To), yb - 2.5)

  // Boulders: each lane releases one every P (out of step with its neighbours) from a chute below the top of each
  // climb, and they drop away just before its foot. The second climb's chutes go a tenth of P after the first's, lane
  // by lane (gen 1's second ramp ran half a period behind): a player knocked on the first climb crosses the terrace in
  // about the same time every try, so this decides how often the second climb's boulders meet a player who never waits
  // at its foot. Nearly in step, about a third of the time at T2; half a period behind, four times in five.
  const ph0 = rng.between(0, P)
  const lanePh = LANES.map((_, l) => ph0 + (l * P) / 3 + rng.between(-0.25, 0.25))
  const climbs = [
    { top: zl, y: lowRise, a: lowA, len: lowLen, chute: CHUTE_IN_1, after: 0 },
    { top: zs0, y: ys, a: upA, len: upLen, chute: CHUTE_IN, after: 0.1 * P },
  ]
  for (const c of climbs) {
    const cs = Math.cos(c.a)
    const sn = Math.sin(c.a)
    const life = rollTime((c.len - c.chute - FOOT_OUT) / cs)
    const lift = BOULDER_R / cs
    for (const l of lanes) {
      const ph = lanePh[l]! + c.after
      const boulder = k.hazard({
        shape: 'sphere',
        x: LANES[l],
        y: c.y - c.chute * Math.tan(c.a) + lift,
        z: c.top - c.chute,
        r: BOULDER_R,
        hit: knock(6, 0.5, 5),
        look: 'boulder',
        tele: releaseTele(P, ph, 0.8),
        path: {
          P,
          ph,
          life,
          at: (tau, _k, o) => {
            const s = rollDistance(tau, B_V0, B_ACC, B_MOST)
            o.z = -s * cs
            o.y = -s * sn
            o.yaw = s / BOULDER_R
          },
        },
      })
      k.deco({ look: 'chute', x: LANES[l], y: c.y - (c.chute - 1) * Math.tan(c.a), z: c.top - c.chute + 0.4, sx: 2.8, sy: 2.6, sz: 1.6, ref: { kind: 'hazard', i: boulder } })
    }
  }

  // The terrace sweeper (T2+): a low bar round a hub, to hop or wait for.
  const tc = (zl + zt1) / 2
  if (sweeper) {
    k.hazard({ shape: 'bar', x: 0, y: yt + SWEEP_Y, z: tc, r: SWEEP_R, len: SWEEP_LEN, hit: knock(5, 0.8, 6), look: 'bar-low', move: spin(w, rng.between(0, Math.PI * 2)) })
    k.hazard({ shape: 'post', x: 0, y: yt, z: tc, r: HUB_R, h: 1.5, hit: bonk(6), look: 'hub' })
  }
  const padSide = rng.sign()

  // The star over the summit's middle, bobbing: walk into its low half, or jump for it.
  const crownZ = zs0 + 4.2
  const bobPh = rng.between(0, 2.2)
  k.deco({ look: 'pedestal', x: 0, y: ys, z: crownZ, sx: 1.4, sy: 0.5, sz: 1.4 })
  k.crown({ x: 0, y: ys + 2.2, z: crownZ, bob: (t) => 0.5 * Math.sin((2 * Math.PI * (t + bobPh)) / 2.2) })

  // The route: lane rows up each climb (steps aside within a row), a hop up the ledge onto the terrace's near corners,
  // the far corners (clear of the sweeper), a hop over the crevasse onto the shelf (a spot in each lane, steps across
  // it), up the second climb to the summit, and a jump into the star.
  k.node('in', 0, -1.5)
  const rows = (zA: number, zB: number, yA: number, yB: number, name: string) => {
    const n = Math.max(3, Math.round((zB - zA) / 6.5) + 1)
    const ids: string[][] = []
    for (let r = 0; r < n; r++) {
      const z = zA + ((zB - zA) * r) / (n - 1)
      const y = yA + ((yB - yA) * r) / (n - 1)
      ids.push(LANES.map((x, l) => k.node(`${name}${r}_${l}`, x, z, { y })))
    }
    for (let r = 0; r < n - 1; r++) for (let l = 0; l < 3; l++) for (let l2 = 0; l2 < 3; l2++) if (Math.abs(l - l2) <= 1) k.edge(ids[r]![l]!, ids[r + 1]![l2]!)
    for (let r = 0; r < n; r++) {
      for (let l = 0; l < 2; l++) {
        k.edge(ids[r]![l]!, ids[r]![l + 1]!)
        k.edge(ids[r]![l + 1]!, ids[r]![l]!)
      }
    }
    return ids
  }
  const lowTopZ = zl - ROWS_SHORT
  const upFootZ = zf + 0.6
  const upAt = (z: number) => yb + Math.tan(upA) * (z - zf)
  const low = rows(z0 + 0.6, lowTopZ, Math.tan(lowA) * 0.6, Math.tan(lowA) * (lowTopZ - z0), 'a')
  const up = rows(upFootZ, zs0 - 0.6, upAt(upFootZ), upAt(zs0 - 0.6), 'b')
  const sh = LANES.map((x, l) => k.node(`s${l}`, x, (zc + zf) / 2 + 0.2, { y: yb }))
  for (let l = 0; l < 2; l++) {
    k.edge(sh[l]!, sh[l + 1]!)
    k.edge(sh[l + 1]!, sh[l]!)
  }
  for (let l = 0; l < 3; l++) for (let l2 = 0; l2 < 3; l2++) if (Math.abs(l - l2) <= 1) k.edge(sh[l]!, up[0]![l2]!)
  for (let l = 0; l < 3; l++) k.edge('in', low[0]![l]!)
  const lowTop = low[low.length - 1]!
  const near = [k.node('tn0', -CORNER_X, zl + CORNER_IN, { y: yt }), k.node('tn1', CORNER_X, zl + CORNER_IN, { y: yt })]
  const far = [k.node('tf0', -CORNER_X, zt1 - CORNER_IN, { y: yt }), k.node('tf1', CORNER_X, zt1 - CORNER_IN, { y: yt })]
  const hop = { takeoff: 'edge' as const, inset: 0.45 }
  k.edge(lowTop[0]!, near[0]!, 'jump', hop)
  k.edge(lowTop[1]!, near[0]!, 'jump', hop)
  k.edge(lowTop[1]!, near[1]!, 'jump', hop)
  k.edge(lowTop[2]!, near[1]!, 'jump', hop)
  for (const s of [0, 1]) k.edge(near[s]!, far[s]!)
  k.edge(far[0]!, sh[0]!, 'jump', hop)
  k.edge(far[0]!, sh[1]!, 'jump', hop)
  k.edge(far[1]!, sh[1]!, 'jump', hop)
  k.edge(far[1]!, sh[2]!, 'jump', hop)
  const flagSide = padSide > 0 ? 0 : 1
  k.flag(flagSide ? CORNER_X : -CORNER_X, zl + CORNER_IN, near[flagSide]!, yt)
  k.node('top', 0, zs0 + 1.4, { y: ys })
  for (let l = 0; l < 3; l++) k.edge(up[up.length - 1]![l]!, 'top')
  k.node('crown', 0, crownZ, { y: ys })
  k.edge('top', 'crown', 'jump', { takeoff: k.at(0, ys, crownZ - 2.0) })

  // The summit pad (gold), at the terrace's far end: a perfect bounce flings you over the crevasse and up the second
  // climb to the row of spots nearest GOLD_UP of the way up it (on the pad's side), a plain one over the crevasse onto
  // the climb's foot: either way into the boulders' lanes, so it's a bounce to time.
  const padX = padSide * 2.6
  const padZ = zt1 - 1.6
  const padLane = padSide > 0 ? 2 : 0
  const upZ = (r: number) => upFootZ + ((zs0 - 0.6 - upFootZ) * r) / (up.length - 1)
  const want = zf + GOLD_UP * upLen
  let goldRow = 0
  for (let r = 1; r < up.length - 1; r++) if (Math.abs(upZ(r) - want) < Math.abs(upZ(goldRow) - want)) goldRow = r
  const climbAim = { x: LANES[padLane]!, y: upAt(upZ(goldRow)), z: upZ(goldRow) }
  const footAim = { x: LANES[padLane]! * 0.8, y: upAt(upFootZ), z: upFootZ }
  const pad = k.cyl({ x: padX, z: padZ, r: 1.0, top: yt + 0.04, hy: 0.3, look: 'bounce', gold: true, bounce: { vy: 15, aim: footAim, perfectVy: 18, perfectAim: climbAim } })
  k.deco({ look: 'gold-flag', x: padX, y: yt, z: padZ - 1.4, sy: 1.8 })
  k.gold('Summit pad', padZ, upZ(goldRow), padX)
  k.edge(near[padSide > 0 ? 1 : 0]!, up[goldRow]![padLane]!, 'perfectBounce', { tier: 'gold', via: [k.at(padX, yt, padZ, pad)] })
  return k.done({ x: 0, y: ys, z: zs1 })
}

export const ROUND: RoundDef = {
  letter: 'C',
  name: 'Star Peak',
  hint: 'grab the star',
  family: 'finale',
  phase: 1,
  build,
}
