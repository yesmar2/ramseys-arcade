/**
 * Hit Parade (design-final R4, D): a causeway over the goo in one or two acts, with a landing between them (the
 * mid flag). Wrecking Row: giant red balls swinging across the path from tall gantries, each group in a green wave
 * (a full-speed runner who passes the first gantry as its head swings away passes every one in the group); a
 * floor stripe under each arc lights as the head comes down. Punch Bridge: boxing-glove blocks punching in from
 * pillars at the bridge's edges after a 0.6 s wind-up you see and hear: red to dodge, orange to hop (T2+), violet
 * to dive under (T3). A glove never reaches more than 3.6 m of the bridge's 6 m, so the far side is always free.
 *
 * Rails keep every knock out of the goo on T1–T2. T3 leaves Wrecking Row's gantries open on alternate sides and
 * 8–12 m of Punch Bridge open on both, and doubles the heads on one gantry (two balls swinging past each other).
 *
 * Wrecking Row is 9 m wide, not the spec's 6: a head sweeping on into a rail pins a knocked bean there and pushes it
 * through (sim.ts pushes a bean out of a hazard after its walls), but by 4.5 m out a head has risen almost clear
 * of a bean, so its 1 m thick rails hold.
 *
 * Generation 2 (build2, below; README "Generations"): Ramsey's B · Whack mallets. Mallet Hill takes Wrecking Row's
 * place: up a ramp, over a crest, down the other side, with giant mallets on posts at the walkway's sides smashing
 * down across it (T2–T3's long ones double-tap), and Plunger Bridge takes Punch Bridge's: pinball plungers on the
 * gloves' timing, stepping down to a lower deck partway on T2–T3. Gen 1 above is untouched.
 */
import { DEATH_DROP, gloveMove, gloveTele, knock, pendulumMove, pendulumTele, type GloveSpec, type PendulumSpec } from '../sim.ts'
import type { Hit, MoveFn, RoundDef, RoundOut, RoundSlot, Rng, Tele, TeleFn, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** Wrecking Row's half width (9 m) and rails' thickness, Punch Bridge's (6 m); the rails' height (a knock's pop tops out at 0.64 m). */
const HX_A = 4.5
const RAIL_A = 1.0
const HX_B = 3.0
const RAIL_B = 0.5
const RAIL_H = 1.0
/** The bots' three lanes in each act. */
const LANES_A = [-3, 0, 3] as const
const LANES_B = [-2, 0, 2] as const
/** Wrecking Row: a pivot 7.7 m up, a 6.6 m arm, a 1.1 m head (its centre 1.1 m up at the bottom of the swing). */
const PIVOT_Y = 7.7
const ARM = 6.6
const HEAD_R = 1.1
/** A double gantry's two heads swing this far either side of it, half a period apart (past each other). */
const DOUBLE_DZ = 1.25
/** The first wait row is this far into Wrecking Row, the act ends this far past its last. */
const LEAD_A = 2.5
/** Punch Bridge: wait rows halfway between gloves, from this far in; a 4.4 m glove block resting at the edge. */
const LEAD_B = 2
const GLOVE_HX = 2.2
const PILLAR_X = 3.6
/** The landing between the acts, where the mid flag is. */
const LANDING = 4
/**
 * How far a knock can carry a bean along the track, m (the most measured is 3.1: a pop of 6 is 0.43 s in the air,
 * then a slide): a T2 rail gap stays this far from anything that could throw a bean toward it.
 */
const KNOCK_CARRY = 4.5
/** The bean's radius. */
const BEAN_R = 0.42

type Glove = 'red' | 'low' | 'high'
/** Each glove's block: its centre's height, half height, half depth; RED y 0–1.8, ORANGE 0–0.8, VIOLET 1.3–2.4. */
const GLOVES: Record<Glove, { y: number; hy: number; hz: number; look: string }> = {
  red: { y: 0.9, hy: 0.9, hz: 0.8, look: 'glove' },
  low: { y: 0.4, hy: 0.4, hz: 0.5, look: 'glove-low' },
  high: { y: 1.85, hy: 0.55, hz: 0.8, look: 'glove-high' },
}

/** Something that knocks: where it is along the round, how far either side of that it can hit, and which way it throws (0 either). */
type Knocker = { z: number; reach: number; toward: -1 | 0 | 1 }
/** A stretch of causeway: where, how wide, how thick its rails. */
type Stretch = { z0: number; z1: number; hx: number; thick: number }

/** How far apart two moments are on a clock of period T. */
function apart(a: number, b: number, T: number): number {
  const d = Math.abs(a - b) % T
  return Math.min(d, T - d)
}

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  if ((slot.gen ?? 1) >= 2) return build2(slot, rng, tier)
  const k = kit(slot, tier)
  const acts: readonly ('A' | 'B')[] = tier === 1 ? [rng.chance(0.5) ? 'A' : 'B'] : rng.chance(0.5) ? ['A', 'B'] : ['B', 'A']
  const knockers: Knocker[] = []
  // Rail gaps by side (index 0 the −x side, 1 the +x side), the stretches they run along, and each act's.
  const gaps: [number, number][][] = [[], []]
  const gapsOn = (side: number) => gaps[side > 0 ? 1 : 0]!
  const stretches: Stretch[] = []
  const actSpans: [number, number][] = []

  // The route: three lanes a row, wait rows between the hazards (safe: nothing reaches them), steps across a row.
  // Each spot's ways out go on first, straight on first (the live hands take the first way when nothing is clean),
  // then across: the steps across are added once every way on is.
  const rowsAll: string[][] = []
  const row = (name: string, z: number, lanes: readonly number[]): string[] => {
    const r = lanes.map((x, l) => k.node(`${name}_${l}`, x, z))
    rowsAll.push(r)
    return r
  }
  const ahead = (a: readonly string[], b: readonly string[], wide: boolean) => {
    for (let l = 0; l < a.length; l++) {
      const order = [l, l - 1, l + 1, l - 2, l + 2].filter((m) => m >= 0 && m < b.length && (wide || Math.abs(l - m) <= 1))
      for (const m of order) k.edge(a[l]!, b[m]!)
    }
  }

  /** Wrecking Row from z0: n gantries, each group's in a green wave. Returns its wait rows and where it ends. */
  const wreckingRow = (z0: number, n: number) => {
    const S = tier === 3 ? rng.between(6.5, 7.0) : rng.between(6.5, 8.0)
    const A = rng.between(0.9, 1.0)
    // T3: two groups (no one wave carries through), and one gantry with two heads.
    const dbl = tier === 3 ? rng.int(0, n - 1) : -1
    const split = tier === 3 ? Math.ceil(n / 2) : n
    const T1 = slot.period
    const T2 = T1 * 1.17 <= 4.4 ? T1 * 1.17 : T1 / 1.17
    // The wait rows, halfway between gantries (a double gantry has room either side for its second head).
    const rz = [z0 + LEAD_A]
    for (let r = 0; r < n; r++) rz.push(rz[r]! + S + (r === dbl ? 2 * DOUBLE_DZ : 0))
    const end = rz[n]! + LEAD_A
    k.floor(z0, end, { hx: HX_A })
    stretches.push({ z0, z1: end, hx: HX_A, thick: RAIL_A })
    let ph0 = 0
    let zg0 = 0
    for (let r = 0; r < n; r++) {
      const z = (rz[r]! + rz[r + 1]!) / 2
      const T = r < split ? T1 : T2
      if (r === 0 || r === split) {
        ph0 = rng.between(0, T)
        zg0 = z
      }
      // The green wave: a gantry's phase is its group's, less the time a full-speed runner takes to get to it.
      const ph = ph0 - (z - zg0) / 7.2 + rng.between(-0.15, 0.15)
      const heads = r === dbl ? [-DOUBLE_DZ, DOUBLE_DZ] : [0]
      heads.forEach((dz, j) => {
        const spec: PendulumSpec = { L: ARM, A, T, ph: ph + (j * T) / 2 }
        const h = k.hazard({ shape: 'sphere', x: 0, y: PIVOT_Y, z: z + dz, r: HEAD_R, hit: knock(6, 0.85, 6), look: 'pendulum', move: pendulumMove(spec), tele: pendulumTele(spec) })
        k.deco({ look: 'stripe', x: 0, y: 0.01, z: z + dz, sx: 2 * HX_A, sy: 0.02, sz: 2 * HEAD_R, role: 'dodge', ref: { kind: 'hazard', i: h }, params: { pendulum: true } })
      })
      k.deco({ look: 'gantry', x: 0, y: 0, z, sx: 2 * (HX_A + RAIL_A) + 0.6, sy: PIVOT_Y + 0.5, sz: r === dbl ? 2 * DOUBLE_DZ + 0.6 : 0.6, params: { heads: heads.length } })
      knockers.push({ z, reach: HEAD_R + BEAN_R + (r === dbl ? DOUBLE_DZ : 0), toward: 0 })
      // T3: each gantry's stretch keeps its rail on one side only, the side alternating.
      if (tier === 3) gapsOn(r % 2 === 0 ? 1 : -1).push([rz[r]!, rz[r + 1]!])
    }
    const rows = rz.map((z, r) => row(`a${r}`, z, LANES_A))
    for (let r = 0; r < n; r++) ahead(rows[r]!, rows[r + 1]!, false)
    actSpans.push([z0, end])
    if (split === n) {
      k.gold('Green wave', z0, end, 0)
      k.deco({ look: 'gold-flag', x: -HX_A + 0.4, y: 0, z: z0 + 0.6, sy: 1.8 })
    }
    return { rows, end }
  }

  /** Punch Bridge from z0: n gloves from alternating-ish sides, never three in a row from one. */
  const punchBridge = (z0: number, n: number) => {
    const S = tier === 1 ? rng.between(4.8, 5.6) : rng.between(4.6, 5.4)
    const T = slot.period <= 3.6 ? slot.period : rng.between(2.8, 3.6)
    const kinds: readonly Glove[] = byTier(tier, [['red'], ['red', 'red', 'low'], ['red', 'low', 'high']] as const)
    const end = z0 + 2 * LEAD_B + n * S
    k.floor(z0, end, { hx: HX_B })
    stretches.push({ z0, z1: end, hx: HX_B, thick: RAIL_B })
    const rz = Array.from({ length: n + 1 }, (_, r) => z0 + LEAD_B + r * S)
    const rows = rz.map((z, r) => row(`b${r}`, z, LANES_B))
    let lastSide = 0
    let run = 0
    let lastFire = NaN
    for (let g = 0; g < n; g++) {
      const z = z0 + LEAD_B + (g + 0.5) * S
      let side: 1 | -1 = rng.sign()
      if (run >= 2 && side === lastSide) side = side > 0 ? -1 : 1
      run = side === lastSide ? run + 1 : 1
      lastSide = side
      const kind = rng.pick(kinds)
      const box = GLOVES[kind]
      const reach = rng.between(3.0, 3.6)
      // Two gloves next to each other never punch within 0.8 s of each other (a punch starts 0.6 s into the cycle).
      let fire = rng.between(0, T)
      for (let tries = 0; tries < 24 && lastFire === lastFire && apart(fire, lastFire, T) < 0.8; tries++) fire = rng.between(0, T)
      lastFire = fire
      const spec: GloveSpec = { T, ph: 0.6 - fire, side, reach }
      const h = k.hazard({
        shape: 'box',
        x: side * (HX_B + GLOVE_HX),
        y: box.y,
        z,
        hx: GLOVE_HX,
        hy: box.hy,
        hz: box.hz,
        hit: knock(6, 0.45, 5.5, 11),
        look: box.look,
        move: gloveMove(spec),
        tele: gloveTele(spec),
      })
      k.deco({ look: 'pillar', x: side * PILLAR_X, y: 0, z, sx: 1.2, sy: 2.8, sz: 2.2, ref: { kind: 'hazard', i: h } })
      gapsOn(side).push([z - box.hz - 0.25, z + box.hz + 0.25])
      knockers.push({ z, reach: box.hz + BEAN_R, toward: side > 0 ? -1 : 1 })
      // Every way past it: the lanes it can't reach any time, the rest while it rests; for experts, a hop over an
      // orange glove or a dive under a violet one in the lanes it reaches.
      ahead(rows[g]!, rows[g + 1]!, true)
      if (kind !== 'red') {
        LANES_B.forEach((x, l) => {
          if (side * x + BEAN_R + 0.35 <= HX_B - reach) return
          k.edge(rows[g]![l]!, rows[g + 1]![l]!, kind === 'low' ? 'jump' : 'dive', { tier: 'gold' })
        })
      }
    }
    // T3: 8–12 m of the bridge with no rails at all.
    if (tier === 3) {
      const w = rng.between(8, 12)
      const a = rng.between(z0 + 1, Math.max(z0 + 1, end - 1 - w))
      gapsOn(1).push([a, a + w])
      gapsOn(-1).push([a, a + w])
    }
    actSpans.push([z0, end])
    return { rows, end }
  }

  // The acts in order, the landing between them (as wide as Wrecking Row).
  k.node('in', 0, -1.5)
  let z = 0
  let prev: string[] | null = null
  for (let i = 0; i < acts.length; i++) {
    if (i > 0) {
      k.floor(z, z + LANDING, { hx: HX_A, look: 'pad' })
      stretches.push({ z0: z, z1: z + LANDING, hx: HX_A, thick: RAIL_A })
      const mid = row('m', z + LANDING / 2, LANES_A)
      ahead(prev!, mid, false)
      k.flag(0, z + LANDING / 2, mid[1]!)
      prev = mid
      z += LANDING
    }
    const act = acts[i] === 'A' ? wreckingRow(z, byTier(tier, [4, 3, 4])) : punchBridge(z, byTier(tier, [6, 5, 6]))
    if (prev) ahead(prev, act.rows[0]!, false)
    else for (const id of act.rows[0]!) k.edge('in', id)
    prev = act.rows[act.rows.length - 1]!
    z = act.end
  }
  const len = z
  k.node('out', 0, len + 1.5)
  for (const id of prev!) k.edge(id, 'out')
  for (const r of rowsAll) {
    for (let l = 0; l < r.length - 1; l++) {
      k.edge(r[l]!, r[l + 1]!)
      k.edge(r[l + 1]!, r[l]!)
    }
  }

  // T2: one 3 m rail gap a side in each act, only where no knock could carry a bean through it (none if there's
  // no such place: the rule that a knock never goes in the goo on T1–T2 comes first). Wrecking Row never has room
  // for one; Punch Bridge often does, on a side whose nearby gloves all punch from it.
  if (tier === 2) {
    for (const [a0, a1] of actSpans) {
      for (const side of [-1, 1] as const) {
        const spots: number[] = []
        for (let c = a0 + 1.8; c <= a1 - 1.8; c += 0.5) spots.push(c)
        const ok = rng.shuffle(spots).find((c) => knockers.every((q) => q.toward === -side || q.z + q.reach + KNOCK_CARRY <= c - 1.5 || q.z - q.reach - KNOCK_CARRY >= c + 1.5))
        if (ok !== undefined) gapsOn(side).push([ok - 1.5, ok + 1.5])
      }
    }
  }
  // The rails, stretch by stretch; where a narrow stretch meets a wide one, a short wall closes the wide one's end.
  for (const s of stretches) {
    for (const side of [-1, 1] as const) k.walls(s.z0, s.z1, { hx: s.hx, h: RAIL_H, thick: s.thick, gaps: gapsOn(side), sides: [side] })
    const next = stretches.find((o) => Math.abs(o.z0 - s.z1) < 1e-6)
    if (!next || next.hx === s.hx) continue
    const narrow = Math.min(s.hx, next.hx)
    const wide = Math.max(s.hx + s.thick, next.hx + next.thick)
    for (const side of [-1, 1] as const) {
      k.box({ x: (side * (narrow + wide)) / 2, z: s.z1, hx: (wide - narrow) / 2, hz: 0.25, top: RAIL_H, hy: (RAIL_H + 0.6) / 2, look: 'rail', noGround: true })
    }
  }
  return k.done({ x: 0, y: 0, z: len })
}

/* ------------------------------------------------------------------ gen 2 --- */

/*
 * Generation 2: Bonk Alley as Ramsey picked it (B · Whack mallets), harder, with ups and downs.
 *
 * Mallet Hill: a walkway 8 m wide runs up a ramp, over a crest and down again (T3: the first row of mallets on the way
 * up, the last on the way down). Between each pair of wait rows stands a row of whack mallets on posts just outside
 * the rails: raised (leaning a little back past upright), each creaks back and shakes for 0.6 s, smashes down across
 * the path, lies there a moment and rises. A short mallet whacks the lane by its post; a long one reaches the middle,
 * its handle lying over the lane by its post (three hit spheres along it), so it covers two lanes; a pair row is a
 * long one from each side, a one-two 0.9 s apart. On T2–T3 a long single double-taps: it lifts a little and smashes
 * again before it rises, so a runner its first tap held up meets the second. A head throws you the way it's going
 * (across, away from its post), hard: by a rail you're pinned, by a gap you're in the soda. A group's rows are a green
 * wave for a full-speed runner up the middle (T2–T3: two groups on two clocks); a careful bean always has a lane open
 * at some point in the period (windows 1.5–3.6 s), and a runner who doesn't look gets whacked.
 *
 * Plunger Bridge: Punch Bridge's 6 m bridge and timing, with pinball plungers (red full, orange low to hop, violet
 * high to dive under); on T2–T3 it steps down 1.1–1.4 m to a lower deck partway, and T3's plungers punch on a quicker
 * beat.
 *
 * Rails: T1 everywhere. T2: open on the side each long mallet throws toward (±1.8 m by it) and by half the red
 * plungers (±1.6 m, the far side). T3: open ±3 m by each long mallet (little of the crest's rail is left), by half the
 * red plungers, and 8–12 m of the bridge on both sides.
 *
 * For the scene (looks contract, scratchpad wobble/gen2/new-looks.md): `mallet` is the head's sphere; its anchor is
 * the pivot, HEAD2 (its r) over the walkway floor at a post at x = ±POST2, and the head swings in the x–y plane at
 * the anchor's z; draw the handle from the anchor to the body, the head as a cylinder whose axis lies in that plane
 * square to the handle (its flat face meets the floor when the handle lies level). `mallet-handle` spheres (same
 * anchor) are hit bodies only. `mallet-shadow` decos lie where the head lands. Telegraph: warn (wind-up, and a double
 * tap's lift), act (smashing down), hold (lying on the floor), back (rising), rest (raised).
 */

const frac = (v: number) => v - Math.floor(v)
const deg = (d: number) => (d * Math.PI) / 180

/** Mallet Hill's walkway (8 m) and rails (0.5 m); the mallets' posts stand just outside the rails; three lanes. */
const HX2 = 4.0
const RAIL2 = 0.5
const POST2 = HX2 + RAIL2 + 0.1
const LANES2 = [-2.6, 0, 2.6] as const
/** A mallet's head is a sphere HEAD2 m in radius, its pivot HEAD2 over the floor: the handle lies level when it's down. */
const HEAD2 = 0.8
/** A head lands NUDGE toward its post from its lane's middle, so a bean in the lane is on its far side. */
const NUDGE = 0.3
/** A short mallet whacks the lane by its post; a long one reaches the middle, its handle lying over the near lane. */
const ARM_SHORT = POST2 - LANES2[2] - NUDGE
const ARM_LONG = POST2 - NUDGE
/** A long mallet's handle as hit bodies: spheres at these shares of the arm. */
const HANDLE_AT = [0.3, 0.5, 0.7] as const
const HANDLE_R = 0.25
/** Raised, the handle leans 100° (a little back past upright); the wind-up creaks it back 15° more, shaking ±3°. */
const REST2 = deg(100)
const PULL2 = deg(15)
const WOB2 = deg(3)
/**
 * The mallet's beat: the wind-up (WIND2 ≥ 0.5 s), the smash (quickening, as if falling), lying on the floor HOLD2,
 * rising BACK2; raised for the rest of the period. A double tap smashes, lies TAP_HOLD, lifts to TAP_A over TAP_LIFT
 * (a warn of its own: lift and smash take 0.52 s) and smashes again before it lies there and rises. A double tap's
 * beats take 2.86 s, within the shortest period.
 */
const WIND2 = 0.6
const SMASH_LONG = 0.34
const SMASH_SHORT = 0.26
const HOLD2 = 0.45
const BACK2 = 0.75
const TAP_HOLD = 0.2
const TAP_LIFT = 0.36
const TAP_SMASH = 0.16
const TAP_A = deg(40)
/** A pair row's second mallet comes down this long after its first: a one-two. */
const ONE_TWO = 0.9
/**
 * A head throws you the way it's going: its own speed (capped at 11 m/s) and 3 m/s off it, up 6. It's still going
 * across the path as it comes down to a bean's height (the pivot is as low as the head lands), so a bean beside it
 * flies 5–6 m across; one under its post side is only shoved out (sim.ts: a hazard moving away only shoves).
 */
const MALLET_HIT: Hit = knock(3, 1.0, 6, 11)
const HANDLE_HIT: Hit = knock(5, 0.5, 5, 11)
/** T3: the rail on the side a long mallet throws you toward is open this far either side of it (T2: 1.8 m). */
const THROW_GAP = 3.0
/** A full-speed runner reaches a mallet's row this long after its head last came down: the lane clear, with room. */
const WAVE_AFTER = 0.95
/** Full speed, and the bean's slope rule (sim.ts: RUN × (1 − 0.6·s), s within −0.25 … 0.4). */
const FULL = 7.2
const slopeSpeed = (rise: number, run: number) => {
  const s = Math.max(-0.25, Math.min(0.4, rise / Math.hypot(rise, run)))
  return FULL * (1 - 0.6 * s)
}

/** One beat of a mallet's cycle: its telegraph state, how long, the handle's lean from and to, and how it eases. */
type Beat = { state: Tele['state']; dur: number; a0: number; a1: number; ease: 'wind' | 'in' | 'out' | 'cos' | 'flat' }

/** A mallet on a post on side `side` (+1: the +x side), its arm `L` long: its beats, once a period T from phase ph. */
type MalletSpec = { T: number; ph: number; side: 1 | -1; L: number; beats: Beat[] }

/** A mallet's beats: one smash, or a double tap; then up, and raised for the rest of T. */
function beatsOf(T: number, smash: number, double: boolean): Beat[] {
  const b: Beat[] = [
    { state: 'warn', dur: WIND2, a0: REST2, a1: REST2 + PULL2, ease: 'wind' },
    { state: 'act', dur: smash, a0: REST2 + PULL2, a1: 0, ease: 'in' },
  ]
  if (double) {
    b.push({ state: 'hold', dur: TAP_HOLD, a0: 0, a1: 0, ease: 'flat' })
    b.push({ state: 'warn', dur: TAP_LIFT, a0: 0, a1: TAP_A, ease: 'out' })
    b.push({ state: 'act', dur: TAP_SMASH, a0: TAP_A, a1: 0, ease: 'in' })
  }
  b.push({ state: 'hold', dur: HOLD2, a0: 0, a1: 0, ease: 'flat' })
  b.push({ state: 'back', dur: BACK2, a0: 0, a1: REST2, ease: 'cos' })
  // Everything but the rest fits the shortest period; were it ever to overrun, the rise is squeezed.
  const over = b.reduce((s, x) => s + x.dur, 0) - T
  if (over > 0) b[b.length - 1]!.dur -= over
  b.push({ state: 'rest', dur: Math.max(0, -over), a0: REST2, a1: REST2, ease: 'flat' })
  return b
}

/** When in its cycle a mallet's head last comes down (the end of its last smash). */
function lastImpact(beats: readonly Beat[]): number {
  let at = 0
  let last = 0
  for (const b of beats) {
    at += b.dur
    if (b.state === 'act') last = at
  }
  return last
}

/** Where in its beats a mallet is at t: the beat, how far through it (0–1), and the time into it. */
function beatAt(m: MalletSpec, t: number): { b: Beat; u: number; s: number } {
  let s = frac((t + m.ph) / m.T) * m.T
  for (const b of m.beats) {
    if (s < b.dur || b === m.beats[m.beats.length - 1]) return { b, u: b.dur > 0 ? Math.min(1, s / b.dur) : 1, s }
    s -= b.dur
  }
  return { b: m.beats[m.beats.length - 1]!, u: 1, s }
}

/** The handle's lean over the floor at t: 0 lying level across the path, π/2 upright, more leaning back over its post. */
function malletAngle(m: MalletSpec, t: number): number {
  const { b, u, s } = beatAt(m, t)
  const d = b.a1 - b.a0
  switch (b.ease) {
    case 'wind':
      return b.a0 + d * u * u * (3 - 2 * u) + WOB2 * Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * 7 * s)
    case 'in':
      return b.a0 + d * u * u
    case 'out':
      return b.a0 + d * Math.sin((Math.PI / 2) * u)
    case 'cos':
      return b.a0 + (d * (1 - Math.cos(Math.PI * u))) / 2
    default:
      return b.a0
  }
}

/** A point `f` of the way along the arm (1: the head's centre), as an offset from the pivot: it swings in x–y. */
function malletMove(m: MalletSpec, f = 1): MoveFn {
  return (t, o) => {
    const a = malletAngle(m, t)
    o.x = -m.side * f * m.L * Math.cos(a)
    o.y = f * m.L * Math.sin(a)
  }
}

function malletTele(m: MalletSpec): TeleFn {
  return (t) => {
    const { b, u } = beatAt(m, t)
    return { state: b.state, u }
  }
}

/** A Mallet Hill row: a short mallet, a long one, or a pair (a long one from each side, a one-two). */
type Kind2 = 'short' | 'long' | 'pair'
/** The plungers' looks and colour code (kit.ts ROLE_OF doesn't know them): red dodge, orange jump, violet dive. */
const PLUNGERS: Record<Glove, { look: string; role: 'dodge' | 'jump' | 'dive' }> = {
  red: { look: 'plunger', role: 'dodge' },
  low: { look: 'plunger-low', role: 'jump' },
  high: { look: 'plunger-high', role: 'dive' },
}

function build2(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  const acts: readonly ('A' | 'B')[] = tier === 1 ? [rng.chance(0.5) ? 'A' : 'B'] : rng.chance(0.5) ? ['A', 'B'] : ['B', 'A']
  // The floor's profile (heights along it), the rail gaps by side, the stretches the rails run along.
  const profile: { z0: number; z1: number; y0: number; y1: number }[] = []
  const yAt = (z: number): number => {
    for (const p of profile) if (z >= p.z0 - 1e-9 && z <= p.z1 + 1e-9) return p.y0 + ((p.y1 - p.y0) * (z - p.z0)) / Math.max(1e-9, p.z1 - p.z0)
    return profile.length ? (z < profile[0]!.z0 ? profile[0]!.y0 : profile[profile.length - 1]!.y1) : 0
  }
  const gaps: [number, number][][] = [[], []]
  const gapsOn = (side: number) => gaps[side > 0 ? 1 : 0]!
  type Stretch2 = { z0: number; z1: number; y0: number; y1: number; hx: number; thick: number }
  const stretches: Stretch2[] = []
  /**
   * Floor from z0 to z1, from height y0 to y1 (a ramp when they differ), hx half wide, its body reaching 1.2 m below
   * `foot` (the act's lowest level: a hump stands on it, a step's face comes down past the deck below); rails `thick`;
   * splat 6 m below it.
   */
  const lay = (z0: number, z1: number, y0: number, y1: number, hx: number, thick: number, foot: number, look?: string) => {
    if (z1 - z0 < 0.01) return
    const lo = Math.min(y0, y1)
    const deep = lo - (Math.min(foot, lo) - 1.2)
    if (Math.abs(y1 - y0) < 1e-6) k.floor(z0, z1, { hx, top: y0, hy: deep / 2, ...(look ? { look } : {}) })
    else k.ramp(z0, z1, y0, y1 - y0, { hx, hy: (deep + Math.abs(y1 - y0)) / 2 })
    profile.push({ z0, z1, y0, y1 })
    stretches.push({ z0, z1, y0, y1, hx, thick })
    k.death(z0, z1, lo - DEATH_DROP)
  }

  // The route: three lanes a row, wait rows between the hazards, steps across a row (added last, as gen 1's).
  const rowsAll: string[][] = []
  const row = (name: string, z: number, lanes: readonly number[]): string[] => {
    const y = yAt(z)
    const r = lanes.map((x, l) => k.node(`${name}_${l}`, x, z, { y }))
    rowsAll.push(r)
    return r
  }
  const ahead = (a: readonly string[], b: readonly string[], wide: boolean) => {
    for (let l = 0; l < a.length; l++) {
      const order = [l, l - 1, l + 1, l - 2, l + 2].filter((m) => m >= 0 && m < b.length && (wide || Math.abs(l - m) <= 1))
      for (const m of order) k.edge(a[l]!, b[m]!)
    }
  }

  /** Mallet Hill from z0 at height y0: up a ramp, over a crest, down the other side, a row of mallets between each pair of wait rows. */
  const malletHill = (z0: number, y0: number) => {
    const n = byTier(tier, [4, 3, 5])
    const S = rng.between(5.2, 5.8)
    const rise = byTier(tier, [rng.between(1.0, 1.4), rng.between(1.3, 1.8), rng.between(1.6, 2.1)])
    const upLen = rise / Math.tan(deg(rng.between(13, 16)))
    let downLen = rise / Math.tan(deg(rng.between(13, 16)))
    const slopes = tier === 3
    // The wait rows, and the hill's shape round them: on T3 the first row of mallets stands on the way up and the
    // last on the way down (their wait rows on the slopes).
    const zu0 = z0 + (slopes ? 2.6 : 1.0)
    const zu1 = zu0 + upLen
    const w0 = slopes ? z0 + 2.0 : zu1 + 1.6
    const w: number[] = []
    for (let j = 0; j <= n; j++) w.push(w0 + j * S)
    const zd0 = slopes ? w[n - 1]! + 1.4 : w[n]! + 1.6
    if (slopes) downLen = Math.max(downLen, w[n]! - zd0 + 2.0)
    const zd1 = zd0 + downLen
    const end = zd1 + 1.0
    const top = y0 + rise
    lay(z0, zu0, y0, y0, HX2, RAIL2, y0)
    lay(zu0, zu1, y0, top, HX2, RAIL2, y0)
    lay(zu1, zd0, top, top, HX2, RAIL2, y0)
    lay(zd0, zd1, top, y0, HX2, RAIL2, y0)
    lay(zd1, end, y0, y0, HX2, RAIL2, y0)

    // The rows' kinds; singles alternate sides. T3's first row (on the way up, meeting a runner at any moment) is
    // never a pair.
    const kinds: Kind2[] = byTier(tier, [
      rng.shuffle<Kind2>(['short', 'long', 'short', 'long']),
      rng.shuffle<Kind2>(['long', 'pair', 'long']),
      rng.shuffle<Kind2>(['pair', 'long', 'pair', 'short', 'short']),
    ])
    if (tier === 3 && kinds[0] === 'pair') {
      const j = kinds.findIndex((x) => x !== 'pair')
      kinds[0] = kinds[j]!
      kinds[j] = 'pair'
    }
    const tap2 = tier >= 2
    let side: 1 | -1 = rng.sign()
    // The green wave: a group's rows come down so a full-speed runner up the middle passes each just after it's up
    // again (slower up the slope, quicker down it). T2–T3: two groups on two clocks.
    const T1 = slot.period
    const T2 = T1 * 1.17 <= 4.4 ? T1 * 1.17 : T1 / 1.17
    const split = tier === 1 ? n : Math.ceil(n / 2)
    let tg = 0
    let zPrev = 0
    let tRun = 0
    for (let r = 0; r < n; r++) {
      const z = (w[r]! + w[r + 1]!) / 2
      const yf = yAt(z)
      const T = r < split ? T1 : T2
      if (r === 0 || r === split) {
        tg = rng.between(0, T)
        zPrev = z
        tRun = 0
      } else {
        // The runner's time from the last row to this one, piece by piece.
        for (let zz = zPrev; zz < z - 1e-9; ) {
          const p = profile.find((q) => zz >= q.z0 - 1e-9 && zz < q.z1 - 1e-9)!
          const to = Math.min(z, p.z1)
          tRun += (to - zz) / slopeSpeed(p.y1 - p.y0, p.z1 - p.z0)
          zz = to
        }
        zPrev = z
      }
      // When the row's last head comes down (a pair's second, ONE_TWO after its first).
      const at = tg + tRun - WAVE_AFTER + rng.between(-0.12, 0.12)
      const kind = kinds[r]!
      const sides: (1 | -1)[] = kind === 'pair' ? [side, side > 0 ? -1 : 1] : [side]
      sides.forEach((s, j) => {
        const long = kind !== 'short'
        const beats = beatsOf(T, long ? SMASH_LONG : SMASH_SHORT, kind === 'long' && tap2)
        const down = at - (kind === 'pair' && j === 0 ? ONE_TWO : 0)
        const spec: MalletSpec = { T, side: s, L: long ? ARM_LONG : ARM_SHORT, beats, ph: frac((lastImpact(beats) - down) / T) * T }
        const px = s * POST2
        const py = yf + HEAD2
        const head = k.hazard({ shape: 'sphere', x: px, y: py, z, r: HEAD2, hit: MALLET_HIT, look: 'mallet', role: 'dodge', move: malletMove(spec), tele: malletTele(spec) })
        if (long) for (const f of HANDLE_AT) k.hazard({ shape: 'sphere', x: px, y: py, z, r: HANDLE_R, hit: HANDLE_HIT, look: 'mallet-handle', role: 'dodge', move: malletMove(spec, f) })
        k.deco({ look: 'mallet-shadow', x: px - s * spec.L, y: yf + 0.01, z, sx: 2 * HEAD2, sy: 0.02, sz: 2 * HEAD2, role: 'dodge', ref: { kind: 'hazard', i: head } })
        // T2–T3: the rail on the side a long mallet throws you toward is open by it.
        if (long && tier >= 2) {
          const g = tier === 3 ? THROW_GAP : 1.8
          gapsOn(-s).push([z - g, z + g])
        }
      })
      side = side > 0 ? -1 : 1
    }
    const rows = w.map((z, r) => row(`a${r}`, z, LANES2))
    for (let r = 0; r < n; r++) ahead(rows[r]!, rows[r + 1]!, false)
    k.gold('Green wave', w[0]!, w[split]!, 0)
    k.deco({ look: 'gold-flag', x: -HX2 + 0.4, y: yAt(w[0]! - 0.6), z: w[0]! - 0.6, sy: 1.8 })
    return { rows, end, y: y0 }
  }

  /** Plunger Bridge from z0 at height y0: n plungers from alternating-ish sides (never three in a row from one); T2–T3 step down partway. */
  const plungerBridge = (z0: number, y0: number, n: number) => {
    const S = tier === 1 ? rng.between(4.8, 5.6) : rng.between(4.6, 5.4)
    // T3's plungers punch on a quicker beat (at most 3.4 s, not 3.6).
    const T = tier === 3 ? (slot.period <= 3.4 ? slot.period : rng.between(3.0, 3.4)) : slot.period <= 3.6 ? slot.period : rng.between(2.8, 3.6)
    const kinds: readonly Glove[] = byTier(tier, [['red'], ['red', 'red', 'low'], ['red', 'red', 'low', 'high']] as const)
    const end = z0 + 2 * LEAD_B + n * S
    const rz = Array.from({ length: n + 1 }, (_, r) => z0 + LEAD_B + r * S)
    // The step down (T2–T3): 1 m past wait row d, to a deck 1.1–1.4 m lower.
    const d = tier >= 2 ? rng.int(1, n - 1) : -1
    const drop = d >= 0 ? rng.between(1.1, 1.4) : 0
    const zStep = d >= 0 ? rz[d]! + 1.0 : end
    lay(z0, zStep, y0, y0, HX_B, RAIL_B, y0 - drop)
    if (d >= 0) {
      lay(zStep, end, y0 - drop, y0 - drop, HX_B, RAIL_B, y0 - drop)
      k.deco({ look: 'stripe', x: 0, y: y0 + 0.01, z: zStep - 0.25, sx: 2 * HX_B, sy: 0.02, sz: 0.3 })
    }
    const rows = rz.map((z, r) => row(`b${r}`, z, LANES_B))
    let lastSide = 0
    let run = 0
    let lastFire = NaN
    const reds: { z: number; side: number }[] = []
    for (let g = 0; g < n; g++) {
      const z = z0 + LEAD_B + (g + 0.5) * S
      const yf = yAt(z)
      let side: 1 | -1 = rng.sign()
      if (run >= 2 && side === lastSide) side = side > 0 ? -1 : 1
      run = side === lastSide ? run + 1 : 1
      lastSide = side
      const kind = rng.pick(kinds)
      const box = GLOVES[kind]
      const reach = rng.between(3.0, 3.6)
      // Two plungers next to each other never punch within 0.8 s of each other (a punch starts 0.6 s into the cycle).
      let fire = rng.between(0, T)
      for (let tries = 0; tries < 24 && lastFire === lastFire && apart(fire, lastFire, T) < 0.8; tries++) fire = rng.between(0, T)
      lastFire = fire
      const spec: GloveSpec = { T, ph: 0.6 - fire, side, reach }
      const h = k.hazard({
        shape: 'box',
        x: side * (HX_B + GLOVE_HX),
        y: yf + box.y,
        z,
        hx: GLOVE_HX,
        hy: box.hy,
        hz: box.hz,
        hit: knock(6, 0.45, 5.5, 11),
        look: PLUNGERS[kind].look,
        role: PLUNGERS[kind].role,
        move: gloveMove(spec),
        tele: gloveTele(spec),
      })
      k.deco({ look: 'pillar', x: side * PILLAR_X, y: yf, z, sx: 1.2, sy: 2.8, sz: 2.2, ref: { kind: 'hazard', i: h } })
      // The near rail has a gap where the plunger comes through; the far one, by half the red plungers (below).
      gapsOn(side).push([z - box.hz - 0.25, z + box.hz + 0.25])
      if (kind === 'red') reds.push({ z, side })
      // Every way past it, and for experts a hop over an orange plunger or a dive under a violet one where it reaches.
      ahead(rows[g]!, rows[g + 1]!, true)
      if (kind !== 'red') {
        LANES_B.forEach((x, l) => {
          if (side * x + BEAN_R + 0.35 <= HX_B - reach) return
          k.edge(rows[g]![l]!, rows[g + 1]![l]!, kind === 'low' ? 'jump' : 'dive', { tier: 'gold' })
        })
      }
    }
    // T2–T3: by half the red plungers the far rail is open (a red one throws you there); T3 also leaves 8–12 m of the
    // bridge with no rails at all.
    if (tier >= 2) for (const q of rng.shuffle(reds).slice(0, Math.ceil(reds.length / 2))) gapsOn(-q.side).push([q.z - 1.6, q.z + 1.6])
    if (tier === 3) {
      const wide = rng.between(8, 12)
      const a = rng.between(z0 + 1, Math.max(z0 + 1, end - 1 - wide))
      gapsOn(1).push([a, a + wide])
      gapsOn(-1).push([a, a + wide])
    }
    return { rows, end, y: y0 - drop }
  }

  // The acts in order, the landing between them (as wide as the hill, the mid flag on it).
  k.node('in', 0, -1.5)
  let z = 0
  let y = 0
  let prev: string[] | null = null
  for (let i = 0; i < acts.length; i++) {
    if (i > 0) {
      lay(z, z + LANDING, y, y, HX2, RAIL2, y, 'pad')
      const mid = row('m', z + LANDING / 2, LANES2)
      ahead(prev!, mid, false)
      k.flag(0, z + LANDING / 2, mid[1]!, y)
      prev = mid
      z += LANDING
    }
    const act = acts[i] === 'A' ? malletHill(z, y) : plungerBridge(z, y, byTier(tier, [6, 5, 6]))
    if (prev) ahead(prev, act.rows[0]!, false)
    else for (const id of act.rows[0]!) k.edge('in', id)
    prev = act.rows[act.rows.length - 1]!
    z = act.end
    y = act.y
  }
  const len = z
  k.node('out', 0, len + 1.5, { y })
  for (const id of prev!) k.edge(id, 'out')
  for (const r of rowsAll) {
    for (let l = 0; l < r.length - 1; l++) {
      k.edge(r[l]!, r[l + 1]!)
      k.edge(r[l + 1]!, r[l]!)
    }
  }

  // The rails, stretch by stretch (sloping up and down the hill); where a narrow stretch meets a wide one, a short wall
  // closes the wide one's end, as one closes the 9 m pad before a narrow first stretch.
  const first = stretches[0]!
  if (first.hx + first.thick < 4.5) {
    for (const s of [-1, 1] as const) k.box({ x: (s * (first.hx + first.thick + 5)) / 2, z: 0.25, hx: (5 - first.hx - first.thick) / 2, hz: 0.25, top: first.y0 + RAIL_H, hy: (RAIL_H + 0.6) / 2, look: 'rail', noGround: true })
  }
  for (const s of stretches) {
    for (const side of [-1, 1] as const) k.walls(s.z0, s.z1, { hx: s.hx, y: s.y0, rise: s.y1 - s.y0, h: RAIL_H, thick: s.thick, gaps: gapsOn(side), sides: [side] })
    const next = stretches.find((o) => Math.abs(o.z0 - s.z1) < 1e-6)
    if (!next || next.hx === s.hx) continue
    const narrow = Math.min(s.hx, next.hx)
    const wide = Math.max(s.hx + s.thick, next.hx + next.thick)
    const yTop = Math.max(s.y1, next.y0)
    for (const side of [-1, 1] as const) {
      k.box({ x: (side * (narrow + wide)) / 2, z: s.z1, hx: (wide - narrow) / 2, hz: 0.25, top: yTop + RAIL_H, hy: (RAIL_H + 0.6) / 2, look: 'rail', noGround: true })
    }
  }
  return k.done({ x: 0, y, z: len })
}

export const ROUND: RoundDef = {
  letter: 'h',
  name: 'Bonk Alley',
  hint: 'dodge the swings',
  family: 'D',
  phase: 1,
  build,
}
