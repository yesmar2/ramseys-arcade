/**
 * Crown Peak (design-final F1, the finale): a broad candy mountain with rails, giant striped boulders rolling
 * down three lanes from chutes at the top of each ramp, a low sweeper on the terrace between the ramps (T2+), a
 * teal summit pad that flings a perfect bounce up to the summit (the gold line), and the golden crown bobbing over
 * the summit. Touching the crown stops the clock, to the moment inside the step.
 *
 * The reference round for scheduled hazards (path specs: release k at ph + k·P, rolling down the slope), ramps
 * with sloping rails, a sweeper bar, a bounce pad with a perfect window, a mid flag and the crown.
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
export const ROUND: RoundDef = {
  letter: 'C',
  name: 'Crown Peak',
  hint: 'grab the crown',
  family: 'finale',
  phase: 1,
  build,
}
