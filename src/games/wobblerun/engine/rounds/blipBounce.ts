/**
 * Blip Bounce (t, gen 2): trampolines over the soda sea. Run off an island onto the teal trampoline past its edge and
 * it throws you up 4 m, keeping your own speed, so you steer the flight onto the next island, nearer or further, higher
 * or lower (the round goes up and down all the way). A JUMP pressed as you land is a perfect bounce, nearly 6 m: the
 * only way up to the high road.
 *
 * Two roads. The low road (the main way) hops island to island, a trampoline between each: slower, more hops. At T2+
 * some of its trampolines move on the round's rhythm: a shuttle waits by its island's edge, blinks, slides 2.2 m out
 * along the course, waits there and comes back (step off while it's in, or jump for it; run off while it's out and
 * it's the sea); at T3 one slides across too (it throws you sideways as well as up); and some bob. The high road
 * (gold) starts at the fork, the first trampoline: a perfect bounce, steered across, lands on an express belt along the
 * other side of the course, high above the low road (a plain bounce can't reach it, or even catch its edge). It
 * carries you on past the low road's first islands and ends over one of them: drop off its end onto it.
 *
 * A trampoline (`trampoline`, a bounce solid: vy 15, perfect 18, no aim, so you keep your speed and your steering) is
 * laid just below its island and close to it, so a run off the edge lands on it. The next island is set where a plain
 * bounce comes down at 4.3–5.3 m/s across: a full-speed flight overshoots it, so steering in the air matters, and a
 * bad bounce lands in the sea.
 */
import { G, wave } from '../sim.ts'
import type { MoveFn, RoundDef, RoundOut, RoundSlot, Rng, Tele, TeleFn, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** A trampoline's radius and its frame's half depth; its throw, plain and perfect. */
const TRAMP_R = 1.5
const TRAMP_HY = 0.3
const PLAIN_VY = 15
const PERFECT_VY = 18
/** A trampoline stands this far below its island's top, and this far past its edge (a shuttle, while it's in). */
const TRAMP_DOWN = [0.25, 0.45] as const
const TRAMP_GAP = 0.2
/** Islands: radius. */
const ISLAND_R = [2.0, 2.4] as const
/** The speed across that brings a plain bounce down on the next island's middle (a full 7.2 m/s overshoots it). */
const LAND_V = [4.3, 5.3] as const
/** The sea between a trampoline (at its furthest) and the island after it, at least. */
const SEA_GAP = 1.3
/**
 * A shuttle: how far out it goes (a run off the edge lands about 1.5 m out at most: out there, it's the sea; a jump
 * still makes it), how long each move takes, how long its blink before it goes, and the share of its cycle it's out of
 * a run's reach, by tier and by which of the round's shuttles it is (T3's second is shorter out).
 */
const SHUTTLE_OUT = 2.2
const SHUTTLE_MOVE = 0.45
const SHUTTLE_WARN = 0.6
const SHUTTLE_SHARE = [0, 0.36, 0.3] as const
/**
 * The high road: its top this far over the fork trampoline's (a plain bounce peaks at 4 m and catches an edge 0.6 m
 * higher; a perfect one peaks at 5.8), its middle this far to its side, half its width; it starts this far past the
 * fork.
 */
const HIGH_UP = 5.0
const HIGH_X = 3.0
const HIGH_HX = 1.4
const HIGH_FROM = 2.4
/** The high road is an express belt: it carries you on this fast (a gold line's floor carry, at most 4.5). */
const HIGH_BELT = 3.5
/** Beside it the low road keeps this far off its wall (WALL_IN: the nearest across it comes, on the high road's side). */
const HIGH_CLEAR = 0.4
const WALL_IN = HIGH_X - HIGH_HX - HIGH_CLEAR
/** The splat height, this far below the lowest trampoline or island. */
const DEATH_UNDER = 3.5

/** Seconds a throw of vy takes to come back down to `rise` m above where it left. */
function flight(vy: number, rise: number): number {
  return (vy + Math.sqrt(Math.max(0, vy * vy - 2 * G * rise))) / G
}

/**
 * A shuttle's cycle, from phase `ph`: in for `inT` s, out over `move` (eased both ends), out for `outT`, back over
 * `move`. Arithmetic only, so it's the same in every browser.
 */
type Shuttle = { inT: number; outT: number; move: number; ph: number }

/** Seconds into its cycle at t (from the start of its wait in). */
function shuttleClock(s: Shuttle, t: number): number {
  const span = s.inT + s.outT + 2 * s.move
  const u = (t + s.ph) % span
  return u < 0 ? u + span : u
}

const ease = (x: number) => x * x * (3 - 2 * x)

/** How far out the shuttle is at t: 0 in, 1 out. */
function shuttleOut(s: Shuttle, t: number): number {
  let u = shuttleClock(s, t)
  if (u < s.inT) return 0
  u -= s.inT
  if (u < s.move) return ease(u / s.move)
  u -= s.move
  if (u < s.outT) return 1
  return 1 - ease((u - s.outT) / s.move)
}

/** Laid half way out, it moves `dist` m from in to out. */
function shuttleMove(s: Shuttle, dist: number): MoveFn {
  return (t, o) => void (o.z = dist * (shuttleOut(s, t) - 0.5))
}

/** `rest` while it's in (`warn` for the last SHUTTLE_WARN s of that), `act` going out, `hold` out, `back` coming in. */
function shuttleTele(s: Shuttle): TeleFn {
  return (t): Tele => {
    let u = shuttleClock(s, t)
    if (u < s.inT) {
      const left = s.inT - u
      return left <= SHUTTLE_WARN ? { state: 'warn', u: 1 - left / SHUTTLE_WARN } : { state: 'rest', u: u / s.inT }
    }
    u -= s.inT
    if (u < s.move) return { state: 'act', u: u / s.move }
    u -= s.move
    if (u < s.outT) return { state: 'hold', u: u / s.outT }
    return { state: 'back', u: (u - s.outT) / s.move }
  }
}

type Island = { x: number; z: number; y: number; r: number; i: number }
/**
 * A trampoline as laid: its middle (where it shuttles, slides or bobs about), how far it reaches out along the course
 * past that and how far it bobs down, its motion and telegraph.
 */
type Tramp = { x: number; z: number; y: number; i: number; out: number; bob: number; move?: MoveFn; tele?: TeleFn }

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('wide')
  const side = rng.sign()
  const T = slot.period
  const N = byTier(tier, [5, 6, 7])
  // Which trampolines past the fork move: shuttles (out and in along the course), a slider (across), bobbers.
  const movers = rng.shuffle(Array.from({ length: N - 1 }, (_, n) => n + 1))
  const nShuttle = byTier(tier, [0, 1, 2])
  const nSlide = byTier(tier, [0, 0, 1])
  const nBob = byTier(tier, [0, 1, 1])
  const shuttles = movers.slice(0, nShuttle)
  const slide = new Set(movers.slice(nShuttle, nShuttle + nSlide))
  const bob = new Set(movers.slice(nShuttle + nSlide, nShuttle + nSlide + nBob))
  // The island the high road comes down over.
  const merge = Math.min(N - 1, byTier(tier, [3, 3, 4]))

  // A trampoline past an island's edge (or the pad before's), its centre `reach` from (x, z) leaning `lean` across, a
  // little below `top`. Beside the high road (before the merge) it leans no nearer its wall than HIGH_CLEAR, sliding
  // or not. A shuttle is laid half way out; a bobber at the middle of its bob, which rises to TRAMP_DOWN under the top.
  const tramp = (n: number, x: number, z: number, top: number, reach: number, lean: number): Tramp => {
    const amp = slide.has(n) ? rng.between(0.55, 0.75) : 0
    if (n > 0 && n < merge) lean = side * Math.min(side * lean, WALL_IN - TRAMP_R - amp - side * x)
    const t: Tramp = { x: x + lean, z: z + Math.sqrt(reach * reach - lean * lean), y: top - rng.between(...TRAMP_DOWN), i: -1, out: 0, bob: 0 }
    const m = shuttles.indexOf(n)
    if (m >= 0) {
      // Its cycle: the round's period (a second shuttle's 1.3 times it, out of step), out of a run's reach for the
      // tier's share of it (all of the wait out and about half of each move).
      const span = T * (m === 0 ? 1 : 1.3)
      const outT = Math.max(0.3, SHUTTLE_SHARE[tier - 1]! * span - SHUTTLE_MOVE * 0.9)
      const s: Shuttle = { inT: span - outT - 2 * SHUTTLE_MOVE, outT, move: SHUTTLE_MOVE, ph: rng.between(0, span) }
      t.z += SHUTTLE_OUT / 2
      t.out = SHUTTLE_OUT / 2
      t.move = shuttleMove(s, SHUTTLE_OUT)
      t.tele = shuttleTele(s)
    } else if (amp > 0) {
      t.move = wave('x', amp, rng.between(0.9, 1.1) * T, rng.between(0, T))
    } else if (bob.has(n)) {
      t.bob = rng.between(0.45, 0.65)
      t.y -= t.bob
      t.move = wave('y', t.bob, rng.between(0.9, 1.1) * T, rng.between(0, T))
    }
    return t
  }

  // The fork: a trampoline just past the pad before, in the middle.
  const tramps: Tramp[] = [tramp(0, 0, 0, 0, TRAMP_GAP + TRAMP_R, 0)]
  const islands: Island[] = []

  // The low road: an island where the last trampoline's plain bounce comes down (from its middle), up or down from it,
  // with the sea between them even from its furthest; then its own trampoline past its edge, leaning toward the
  // island after. Before the merge the islands keep to the side away from the high road; from it they use the middle.
  let up = false
  const xFor = (n: number) => (n < merge ? -side * rng.between(0.9, 2.0) : n === merge ? side * rng.between(-0.2, 0.6) : rng.between(-1.4, 1.4))
  let nextX = xFor(1)
  for (let n = 1; n < N; n++) {
    const from = tramps[n - 1]!
    const r = rng.between(...ISLAND_R)
    const step = up ? rng.between(1.0, 2.0) : -rng.between(0.7, 1.4)
    up = !up
    const y = Math.max(-2.0, Math.min(2.6, from.y + step))
    const D = Math.max(r + TRAMP_R + SEA_GAP + from.out, rng.between(...LAND_V) * flight(PLAIN_VY, y - from.y))
    // (Beside the high road, its far side no nearer the wall than HIGH_CLEAR.)
    const x = n < merge ? side * Math.min(side * nextX, WALL_IN - r) : nextX
    const z = from.z + Math.sqrt(Math.max(1, D * D - (x - from.x) ** 2))
    islands.push({ x, z, y, r, i: -1 })
    nextX = n + 1 < N ? xFor(n + 1) : rng.between(-0.8, 0.8)
    tramps.push(tramp(n, x, z, y, r + TRAMP_GAP + TRAMP_R, Math.max(-0.8, Math.min(0.8, (nextX - x) * 0.35))))
  }

  // The pad after: where the last trampoline's bounce comes down, a little up.
  const lastT = tramps[N - 1]!
  const exitY = lastT.y + rng.between(0.6, 1.4)
  const exitD = Math.max(TRAMP_R + SEA_GAP + 1.5 + lastT.out, rng.between(...LAND_V) * flight(PLAIN_VY, exitY - lastT.y))
  const exitZ = lastT.z + exitD - 1.5

  // The trampolines (a moving one has no ledge to catch) and the islands.
  for (const t of tramps) {
    t.i = k.cyl({ x: t.x, z: t.z, r: TRAMP_R, top: t.y, hy: TRAMP_HY, look: 'trampoline', role: 'bouncy', tint: -1, bounce: { vy: PLAIN_VY, perfectVy: PERFECT_VY }, ledge: !t.move, move: t.move, tele: t.tele })
  }
  for (const isl of islands) isl.i = k.cyl({ x: isl.x, z: isl.z, r: isl.r, top: isl.y, hy: 0.6 + Math.max(0, isl.y + 2) / 2, look: 'island' })

  // The high road: from just past the fork to just short of the island it comes down over, along the far side, a tall
  // block (a plain bounce steered at it meets its face and drops into the sea), its top an express belt.
  const fork = tramps[0]!
  const yH = fork.y + HIGH_UP
  const land = islands[merge - 1]!
  const zH0 = fork.z + HIGH_FROM
  const zH1 = land.z - land.r - 1.2
  const lowest = Math.min(...tramps.map((t) => t.y - t.bob), ...islands.map((i) => i.y))
  k.box({ x: side * HIGH_X, z: (zH0 + zH1) / 2, hx: HIGH_HX, hz: (zH1 - zH0) / 2, top: yH, hy: (yH - lowest + 1) / 2, look: 'belt', gold: true, belt: { x: 0, z: HIGH_BELT } })
  k.deco({ look: 'gold-flag', x: fork.x + side * 1.2, y: 0, z: -0.6, sy: 1.8 })
  k.gold('High road', 0, zH1, side * HIGH_X)
  k.death(0, exitZ, lowest - DEATH_UNDER)

  // The route: the low road island to island (bounce via each trampoline), the high road from the fork (a perfect
  // bounce onto it, along it, off its end onto the island below).
  k.node('in', 0, -1.5)
  islands.forEach((isl, n) => k.node(`i${n + 1}`, isl.x, isl.z, { y: isl.y }))
  k.node('out', 0, exitZ + 1.5, { y: exitY })
  const via = (t: Tramp) => [k.at(t.x, t.y, t.z, t.i)]
  const chain = ['in', ...islands.map((_, n) => `i${n + 1}`), 'out']
  for (let n = 0; n + 1 < chain.length; n++) k.edge(chain[n]!, chain[n + 1]!, 'bounce', { via: via(tramps[n]!) })
  k.node('h0', side * HIGH_X, zH0 + 2.0, { y: yH, wait: 'no' })
  k.node('h1', side * HIGH_X, zH1 - 0.8, { y: yH, wait: 'no' })
  k.edge('in', 'h0', 'perfectBounce', { tier: 'gold', via: via(fork) })
  k.edge('h0', 'h1', 'run', { tier: 'gold' })
  k.edge('h1', `i${merge}`, 'run', { tier: 'gold' })
  const flagAt = Math.ceil((N - 1) / 2)
  const fi = islands[flagAt - 1]!
  k.flag(fi.x, fi.z, `i${flagAt}`, fi.y)
  return k.done({ x: 0, y: exitY, z: exitZ })
}

export const ROUND: RoundDef = {
  letter: 't',
  name: 'Blip Bounce',
  hint: 'bounce to the high road',
  family: 'A',
  phase: 2,
  build,
}
