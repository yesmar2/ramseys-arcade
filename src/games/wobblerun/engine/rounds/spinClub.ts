/**
 * Spin Club (design-final R3, T): one to three round candy stages joined by short walkways. A sweeper stage is a
 * still disc with long bars turning over it: an orange low bar to jump, and from T2 a violet high bar crossed with
 * it to dive under. A turntable stage (T2+) is a spinning disc with teal mushroom bumpers riding it and, when a
 * sweeper follows it, a launch pad that lights green while it points at the way out: step on it then and it throws
 * you right over that sweeper onto the walkway after it (the gold line). Rim fences keep knocks out of the goo on
 * T1–T2; T3 opens gaps in them, and its turntable is fenced only on the half that turns against the way out.
 *
 * A full-diameter bar sweeps any spot every π/ω, two crossed bars every π/2ω, so no spot on a sweeper is safe for
 * long. The blue waits on a walkway (outside the bars' reach) and crosses when a clean crossing exists: running round
 * the rim the way the bars turn keeps it inside one gap between them (a bean 6 m out runs round at about the bars'
 * own speed). The hub line is quicker and needs a hop or a dive on time. On a turntable the ring round the hub
 * bumper is never swept, so the blue can stop there between the gap it comes in by and the one it leaves by.
 */
import { bonk, knock, orbit, spin } from '../sim.ts'
import type { RoundDef, RoundOut, RoundSlot, Rng, TeleFn, Tier } from '../types.ts'
import { byTier, kit, type Kit } from './kit.ts'

/** Walkways: 3.5 m wide, 4 m between stages. */
const WALK_HW = 1.75
const WALK_LEN = 4
/** The stages' radii. */
const SWEEP_R = 7.0
const TURN_R = 7.5
/** Sweeper bars: capsules 0.25 thick, 6.9 m each way; the low one's axis 0.40 up (top 0.65), the high one's 1.55 (underside 1.30). */
const BAR_LEN = 6.9
const BAR_R = 0.25
const LOW_Y = 0.4
const HIGH_Y = 1.55
/** The sweeper's hub (a bonk). */
const HUB_R = 0.9
const HUB_H = 1.5
/** Rim fences: 0.6 m tall, 0.5 thick, in pieces up to FENCE_PIECE long, with OPENING m left open at each walkway. */
const FENCE_H = 0.6
const FENCE_T = 0.5
const FENCE_PIECE = 1.2
const OPENING = 2.6
/** T3's two gaps in each sweeper's fence. */
const GAP = Math.PI / 3
/** Turntable bumpers: 1.2 m tall, r 0.6–0.9, their inner edge at least BUMP_IN out (a clear ring round the hub bumper). */
const BUMP_H = 1.2
const TT_HUB_R = 1.1
const BUMP_IN = 3.6
/** The launch pad: r 0.9 at ρ 5, lit while its arrow (radial, its local +x) points within LIT of the way out. */
const PAD_R = 0.9
const PAD_RHO = 5.0
const LIT = (25 * Math.PI) / 180
/**
 * The bots' guess at a run to the pad (PAD_LAG s to get going, then PAD_V), the lit time it allows either side of
 * getting there (PAD_EARLY before, PAD_RIDE riding it after), and how long it gives the whole throw.
 */
const PAD_LAG = 0.2
const PAD_V = 6.4
const PAD_EARLY = 0.4
const PAD_RIDE = 1.5
const PAD_MAXT = 5
/** The throw lands this far short of the far walkway's spot (it skids on). */
const PAD_SHORT = 2.0
/** The rim turns no faster than this (the phone limit on floor carry). */
const RIM_MOST = 3.4
/**
 * Route spots: just inside an opening (IN_RHO), the sweeper's rim path (RIM_STEPS legs at RIM_RHO), the hub line's
 * spots either side of a hub, the turntable's spots in the clear ring round its hub bumper (as far from it as from
 * the bumpers' ring, with the blue's margin), and its wide spots.
 */
const IN_RHO = 6.0
const TT_IN_RHO = 6.4
const RIM_RHO = 5.9
const RIM_STEPS = 6
const HUB_SIDE = 2.4
const TT_HUB_SIDE = 2.45
const TT_SIDE = 5.2
/** A bar's telegraph: `act` while an arm is within BAR_ACT of pointing at the stage's entry, `warn` for the 90° before. */
const BAR_ACT = 0.2

type Kind = 'sweep' | 'turn'
type Stage = { kind: Kind; r: number; cx: number; cz: number; psiIn: number; psiOut: number; w: number }

const TAU = Math.PI * 2
const mod = (a: number, m: number) => ((a % m) + m) % m

/**
 * Polar spots round a stage centre: ψ from the side facing the start (ψ 0 is toward −z, ψ π/2 toward +x, π toward
 * the way out), so a spot is (cx + ρ sin ψ, cz − ρ cos ψ).
 */
const px = (s: Stage, rho: number, psi: number) => s.cx + rho * Math.sin(psi)
const pz = (s: Stage, rho: number, psi: number) => s.cz - rho * Math.cos(psi)

/**
 * A sweeper bar's telegraph: `warn` through the quarter turn before an arm points at the stage's entry (the
 * "whum"), `act` while it's over the entry, `rest` otherwise. `entry` is the yaw an arm has when it points there.
 */
function barTele(w: number, ph: number, entry: number): TeleFn {
  const dir = Math.sign(w) || 1
  return (t) => {
    const ahead = mod((entry - (w * t + ph)) * dir, Math.PI)
    if (ahead < BAR_ACT) return { state: 'act', u: 0.5 - ahead / (2 * BAR_ACT) }
    if (ahead > Math.PI - BAR_ACT) return { state: 'act', u: 0.5 + (Math.PI - ahead) / (2 * BAR_ACT) }
    if (ahead < Math.PI / 2) return { state: 'warn', u: 1 - (ahead - BAR_ACT) / (Math.PI / 2 - BAR_ACT) }
    return { state: 'rest', u: (Math.PI - BAR_ACT - ahead) / (Math.PI / 2 - BAR_ACT) }
  }
}

/**
 * A stage's rim fence: pieces round it, leaving the walkways' openings and any other arcs `open` gives (as
 * [from, to] in ψ) unfenced.
 */
function fence(k: Kit, s: Stage, open: readonly (readonly [number, number])[]): void {
  const rf = s.r + FENCE_T / 2
  const half = Math.asin(OPENING / 2 / rf)
  const gaps: (readonly [number, number])[] = [[s.psiIn - half, s.psiIn + half], [s.psiOut - half, s.psiOut + half], ...open]
  // Mark the circle in half-degree bins, then fence each run of kept bins.
  const BINS = 720
  const kept = new Array<boolean>(BINS).fill(true)
  for (const [a, b] of gaps) {
    for (let i = 0; i < BINS; i++) {
      const psi = ((i + 0.5) / BINS) * TAU
      if (mod(psi - a, TAU) <= mod(b - a, TAU)) kept[i] = false
    }
  }
  const first = kept.indexOf(false)
  if (first < 0) return
  let i = 0
  while (i < BINS) {
    const at = (first + i) % BINS
    if (!kept[at]) {
      i++
      continue
    }
    let n = 0
    while (n < BINS && kept[(first + i + n) % BINS]) n++
    const a = (at / BINS) * TAU
    const span = (n / BINS) * TAU
    const pieces = Math.max(1, Math.ceil((span * rf) / FENCE_PIECE))
    const d = span / pieces
    for (let p = 0; p < pieces; p++) {
      const psi = a + d * (p + 0.5)
      const rc = rf * Math.cos(d / 2)
      k.box({ x: px(s, rc, psi), z: pz(s, rc, psi), hx: rf * Math.sin(d / 2) + 0.04, hz: FENCE_T / 2, top: FENCE_H, hy: (FENCE_H + 0.6) / 2, yaw: -psi, look: 'fence', noGround: true })
    }
    i += n
  }
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('wide')
  const kinds: Kind[] = tier === 1 ? ['sweep'] : tier === 2 ? rng.shuffle<Kind>(['sweep', 'turn']) : rng.shuffle<Kind>(['sweep', 'sweep', 'turn'])
  // The sweepers' speed: the tier's, a little quicker or slower by the round's period (so its rhythm is its own).
  const w0 = byTier(tier, [0.9, 1.0, 1.15]) * (0.94 + (0.12 * (4.4 - slot.period)) / 1.5)

  // Walkway centres across: each 1.5–3 m over from the last (back toward the middle once out past 1 m), within 2.5.
  const xs = [rng.between(-1, 1)]
  for (let i = 0; i < kinds.length; i++) {
    const prev = xs[i]!
    let sign = Math.abs(prev) > 1 ? -Math.sign(prev) : rng.sign()
    let next = prev + sign * rng.between(1.5, 3)
    if (Math.abs(next) > 2.5) {
      sign = -sign
      next = prev + sign * rng.between(1.5, 3)
    }
    xs.push(Math.max(-2.5, Math.min(2.5, next)))
  }

  // Lay the stages along: walkway, stage, walkway, … (each walkway runs into the discs either side far enough to
  // cover the rim's curve under its corners).
  const stages: Stage[] = []
  const walkZ: number[] = [0]
  let lastDir = 0
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i]!
    const r = kind === 'sweep' ? SWEEP_R : TURN_R
    const cx = (xs[i]! + xs[i + 1]!) / 2 + rng.between(-0.4, 0.4)
    const e = xs[i]! - cx
    const f = xs[i + 1]! - cx
    const cz = walkZ[i]! + WALK_LEN + Math.sqrt(r * r - e * e)
    const dir = lastDir ? -lastDir : rng.sign()
    lastDir = dir
    const w = kind === 'sweep' ? dir * w0 : dir * Math.min(rng.between(0.35, 0.45), RIM_MOST / r)
    // The walkways meet the rim at ψ near 0 (in) and near π (out).
    stages.push({ kind, r, cx, cz, psiIn: Math.asin(e / r), psiOut: Math.PI - Math.asin(f / r), w })
    walkZ.push(cz + Math.sqrt(r * r - f * f))
  }
  const cover = (r: number, off: number) => Math.sqrt(r * r - off * off) - Math.sqrt(r * r - (Math.abs(off) + WALK_HW) ** 2) + 0.15
  for (let i = 0; i <= kinds.length; i++) {
    const before = stages[i - 1]
    const after = stages[i]
    const z0 = walkZ[i]! - (before ? cover(before.r, xs[i]! - before.cx) : 0)
    const z1 = walkZ[i]! + WALK_LEN + (after ? cover(after.r, xs[i]! - after.cx) : 0)
    k.box({ x: xs[i]!, z: (z0 + z1) / 2, hx: WALK_HW, hz: (z1 - z0) / 2, top: 0 })
    // T1–T2: a walkway at a sweeper is fenced both sides, from rim fence to rim fence (or its own end). A bar's tip
    // reaches 7.57 m out with the bean's radius (6.9 + 0.25 + 0.42), past the rim onto the walkway, and a knock there
    // carries 3 m on along it: the fences keep it out of the goo (T3 lets knocks in).
    if (tier < 3 && (before?.kind === 'sweep' || after?.kind === 'sweep')) {
      const ring = (s: Stage, x: number) => Math.sqrt(Math.max(0, (s.r + FENCE_T / 2) ** 2 - (x - s.cx) ** 2))
      for (const side of [-1, 1]) {
        const x = xs[i]! + side * (WALK_HW + FENCE_T / 2)
        const za = before ? before.cz + ring(before, x) : z0
        const zb = after ? after.cz - ring(after, x) : z1
        k.box({ x, z: (za + zb) / 2, hx: FENCE_T / 2, hz: (zb - za) / 2, top: FENCE_H, hy: (FENCE_H + 0.6) / 2, look: 'fence', noGround: true })
      }
    }
  }
  const exitZ = walkZ[kinds.length]! + WALK_LEN

  // The route's walkway spots (safe: past the bars' and bumpers' reach), then each stage's way across.
  k.node('in', 0, -1.5)
  const walkSpot = walkZ.map((z, i) => z + (i === 0 ? 2.2 : WALK_LEN / 2))
  const walk = xs.map((x, i) => k.node(`w${i}`, x, walkSpot[i]!))
  k.node('out', xs[kinds.length]!, exitZ + 1.5)
  k.edge('in', walk[0]!)
  k.edge(walk[kinds.length]!, 'out')

  stages.forEach((s, i) => {
    const from = walk[i]!
    const to = walk[i + 1]!
    if (s.kind === 'sweep') {
      // The disc, its hub, and its bars: one low bar on T1; from T2 a high bar crossed with it, so the arms go low,
      // high, low, high round the disc.
      k.cyl({ x: s.cx, z: s.cz, r: s.r, top: 0, hy: 0.6, look: 'disc' })
      k.hazard({ shape: 'post', x: s.cx, y: 0, z: s.cz, r: HUB_R, h: HUB_H, hit: bonk(6), look: 'hub' })
      const ph = rng.between(0, TAU)
      const entry = Math.PI / 2 - s.psiIn
      k.hazard({ shape: 'bar', x: s.cx, y: LOW_Y, z: s.cz, r: BAR_R, len: BAR_LEN, hit: knock(5.5, 0.6, 5.5), look: 'bar-low', move: spin(s.w, ph), tele: barTele(s.w, ph, entry) })
      if (tier >= 2) k.hazard({ shape: 'bar', x: s.cx, y: HIGH_Y, z: s.cz, r: BAR_R, len: BAR_LEN, hit: knock(5.5, 0.6, 5.5), look: 'bar-high', move: spin(s.w, ph + Math.PI / 2), tele: barTele(s.w, ph + Math.PI / 2, entry) })
      // T3: two 60° gaps in the fence, clear of the openings and of each other.
      const open: [number, number][] = []
      if (tier === 3) {
        const a = rng.between(Math.PI / 6, (5 * Math.PI) / 6)
        const b = rng.between(Math.PI / 6, (5 * Math.PI) / 6)
        open.push([a - GAP / 2, a + GAP / 2], [-b - GAP / 2, -b + GAP / 2])
      }
      fence(k, s, open)

      // The way across: in through the opening, then round the rim the way the bars turn (the blue's: a bean 6 m out
      // runs round at about the bars' own speed, so it stays in one gap between them), or past the hub on that side
      // (quicker, and on time a hop over a low arm or, from T2, a dive under a high one). The arms go round in ψ the
      // other way from their yaw, so with w > 0 that's the −x side. The other side never works: it isn't laid.
      const side = s.w > 0 ? -1 : 1
      const nin = k.node(`s${i}in`, px(s, IN_RHO, s.psiIn), pz(s, IN_RHO, s.psiIn), { wait: 'no' })
      const nout = k.node(`s${i}out`, px(s, IN_RHO, s.psiOut), pz(s, IN_RHO, s.psiOut), { wait: 'no' })
      k.edge(from, nin)
      k.edge(nout, to)
      const end = side > 0 ? s.psiOut : s.psiOut - TAU
      let prev = nin
      for (let q = 1; q < RIM_STEPS; q++) {
        const psi = s.psiIn + ((end - s.psiIn) * q) / RIM_STEPS
        const id = k.node(`s${i}r${q}`, px(s, RIM_RHO, psi), pz(s, RIM_RHO, psi), { wait: 'no' })
        k.edge(prev, id)
        prev = id
      }
      k.edge(prev, nout)
      const hub = k.node(`s${i}h`, s.cx + side * HUB_SIDE, s.cz, { wait: 'no' })
      k.edge(nin, hub)
      k.edge(hub, nout)
      for (const move of tier === 1 ? (['jump'] as const) : (['jump', 'dive'] as const)) {
        k.edge(nin, hub, move, { tier: 'gold' })
        k.edge(hub, nout, move, { tier: 'gold' })
      }
    } else {
      // The turntable: a spinning disc, a hub bumper, bumpers riding it in a ring clear of the hub's, the launch pad
      // in the widest gap between them.
      k.cyl({ x: s.cx, z: s.cz, r: s.r, top: 0, hy: 0.6, look: 'turntable', move: spin(s.w), ledge: false })
      k.hazard({ shape: 'post', x: s.cx, y: 0, z: s.cz, r: TT_HUB_R, h: BUMP_H, hit: bonk(7), look: 'bumper', move: spin(s.w) })
      const nb = tier === 2 ? rng.int(4, 5) : rng.int(5, 6)
      const a0 = rng.between(0, TAU)
      const angles: number[] = []
      for (let b = 0; b < nb; b++) {
        const a = a0 + (b * TAU) / nb + rng.between(-0.25, 0.25)
        const r = rng.between(0.6, 0.9)
        const rho = rng.between(BUMP_IN + r, 6.0)
        angles.push(a)
        k.hazard({ shape: 'post', x: s.cx, y: 0, z: s.cz, r, h: BUMP_H, hit: bonk(7), look: 'bumper', move: orbit(rho, a, s.w) })
      }
      // T3: the half turning with the way out has no fence (the quick side, and the risky one).
      const open: [number, number][] = []
      if (tier === 3) open.push(s.w > 0 ? [Math.PI + 0.01, TAU - 0.01] : [0.01, Math.PI - 0.01])
      fence(k, s, open)

      const nin = k.node(`t${i}in`, px(s, TT_IN_RHO, s.psiIn), pz(s, TT_IN_RHO, s.psiIn), { wait: 'no' })
      const nout = k.node(`t${i}out`, px(s, TT_IN_RHO, s.psiOut), pz(s, TT_IN_RHO, s.psiOut), { wait: 'no' })
      k.edge(from, nin)
      k.edge(nout, to)
      // The way across: in through a gap between the bumpers to a spot either side of the hub bumper (the ring there
      // is never swept: safe to wait, slow under foot), then out through a gap when one comes round to the exit; or
      // straight across out wide either side, through both gaps in one go.
      const hubs: { id: string; x: number; z: number }[] = [{ id: from, x: xs[i]!, z: walkSpot[i]! }]
      for (const side of [1, -1]) {
        const hub = k.node(`t${i}h${side > 0 ? 'l' : 'r'}`, s.cx + side * TT_HUB_SIDE, s.cz)
        hubs.push({ id: hub, x: s.cx + side * TT_HUB_SIDE, z: s.cz })
        k.edge(nin, hub)
        k.edge(hub, nout)
        const wide = k.node(`t${i}s${side > 0 ? 'l' : 'r'}`, s.cx + side * TT_SIDE, s.cz, { wait: 'no' })
        k.edge(nin, wide)
        k.edge(wide, nout)
      }

      // The launch pad (gold), when a sweeper follows: it rides the disc, and while its arrow points within 25° of the
      // way out a bean on it is thrown right over that sweeper onto the walkway after it (a throw only as far as the
      // next walkway is no quicker than running there: 1.07 s of flight covers 7 m either way).
      if (i === stages.length - 1) return
      const sorted = angles.map((a) => mod(a, TAU)).sort((p, q) => p - q)
      let padA = 0
      let widest = -1
      sorted.forEach((a, b) => {
        const next = b + 1 < sorted.length ? sorted[b + 1]! : sorted[0]! + TAU
        if (next - a > widest) {
          widest = next - a
          padA = (a + next) / 2
        }
      })
      // Aimed short of the far walkway's spot: landing at 20 m/s it skids on that far.
      const aim = { x: xs[i + 2]!, y: 0, z: walkSpot[i + 2]! - PAD_SHORT }
      const cosLit = Math.cos(LIT)
      const w = s.w
      const lit = (t: number) => -Math.sin(padA + w * t) >= cosLit
      const pad = k.cyl({
        x: s.cx,
        z: s.cz,
        r: PAD_R,
        top: 0.04,
        hy: 0.3,
        yaw: padA,
        look: 'launch-pad',
        gold: true,
        ledge: false,
        move: orbit(PAD_RHO, padA, w),
        bounce: { vy: 15, aim, lit },
      })
      // From the walkway or either hub spot, onto the pad and away. Setting off can only work if the pad is lit, or
      // lights up soon after, about when the bean gets to it (a guess at its run there, leniently either side).
      const target = walk[i + 2]!
      for (const at of hubs) {
        const window = (t: number) => {
          let ta = t + PAD_LAG
          for (let it = 0; it < 3; it++) {
            const a = padA + w * ta
            ta = t + PAD_LAG + Math.hypot(s.cx + PAD_RHO * Math.cos(a) - at.x, s.cz - PAD_RHO * Math.sin(a) - at.z) / PAD_V
          }
          for (let u = ta - PAD_EARLY; u <= ta + PAD_RIDE; u += 0.05) if (lit(u)) return true
          return false
        }
        k.edge(at.id, target, 'bounce', { tier: 'gold', via: [k.at(s.cx, 0.04, s.cz, pad)], window, maxT: PAD_MAXT })
      }
      k.deco({ look: 'gold-flag', x: xs[i]! + 1.4, y: 0, z: walkZ[i]! + WALK_LEN - 0.6, sy: 1.8 })
      k.gold('Launch pad', walkZ[i]! + WALK_LEN, walkSpot[i + 2]!, s.cx)
    }
  })
  return k.done({ x: xs[kinds.length]!, y: 0, z: exitZ })
}

export const ROUND: RoundDef = {
  letter: 's',
  name: 'Spin Club',
  hint: 'hop the bars',
  family: 'T',
  phase: 1,
  build,
}
