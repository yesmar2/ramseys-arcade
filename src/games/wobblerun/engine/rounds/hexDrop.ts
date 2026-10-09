/**
 * Hex Drop (design-final R7, F): a honeycomb of pastel hex tiles over a basement. A tile you touch shakes, turns red
 * and drops (a touch thing: sim.ts, `touch.kind` 'tile'); white star tiles never drop. Some tiles are missing from
 * the start, never on the way the route takes. Fall through and you land in the basement, whose belt carries you
 * back toward the start, and a teal bounce strip at its far end throws you up onto the exit pad: a soft fail of a few
 * seconds, never a splat and never quicker. On harder days orange low sweepers turn over the field from star hubs.
 *
 * The route: star tiles (safe: a bot may wait there) every four rows, chains of tiles between them (never waited
 * on: they drop), a jump off the last row onto the exit pad, and the basement's own way out for a bean that fell
 * (nothing leads into it, so the blue never plans through it; the live hands find it after a fall). With sweepers,
 * the hubs sit a column off the middle and the blue's lane runs down the far outer column, where only the bars'
 * tips reach: it waits at the lane's star before each hub for a tip to go by. The ways through the middle thread
 * the bars (gold: an expert's). Star rows are six apart across a hub (three either side of it, the nearest a
 * careful bean can stand clear of a 5 m bar) rather than the spec's four; the hub's own star is between them.
 */
import { bonk, knock, spin } from '../sim.ts'
import type { RoundDef, RoundOut, RoundSlot, Rng, Tier } from '../types.ts'
import { byTier, kit } from './kit.ts'

/** The honeycomb: 6 columns of r 0.95 tiles, √3 apart across, 1.5 m apart down, alternate rows shifted ±√3/4. */
const COLS = 6
const TILE_R = 0.95
const COL_W = Math.sqrt(3)
const ROW_D = 1.5
const SHIFT = COL_W / 4
/** The first row's centre (its near edge just off the pad), the tiles' half thickness, how much higher stars sit. */
const ROW0 = 1.0
const TILE_HY = 0.3
/** Star tiles stand 2 cm proud, so a bean on one with a foot over a neighbour stands on the star (it never drops). */
const STAR_UP = 0.02
/** A star row every this many rows. */
const STAR_EVERY = 4
/**
 * The basement: 3.5 m down, its belt toward the start, 14 m wide inside walls that stand 1 m over the tiles: wider
 * than the bars reach (so they never pass through them), and a bean knocked or walking off the field's side hits
 * them and drops into the basement (design-final §1.4: no knock into the goo on the main route).
 */
const CELLAR_Y = -3.5
const CELLAR_HX = 7.0
const CELLAR_WALL = 4.5
const BELT = 2.5
/** The gap from the last row to the exit pad (a jump on the main route), and the bounce strip under it. */
const EXIT_GAP = 2.6
const STRIP_IN = 0.6
const STRIP_UP = 0.45
/** The sweepers: a low bar (axis 0.40 m over the tiles) 5 m each way round a hub post on a star tile. */
const SWEEP_LEN = 5.0
const SWEEP_Y = 0.4
const SWEEP_R = 0.25
const HUB_R = 0.8
/** A chain this near a hub (the bar, the bean and the blue's 0.35 m margin) threads its bar: an expert's way. */
const SWEEP_REACH = SWEEP_LEN + SWEEP_R + 0.42 + 0.35
/**
 * The blue's lane with sweepers: a straight line down the outer column (on its tiles whichever way the row is
 * shifted), 5.4 m from the hubs, which sit at x ∓1.3.
 */
const LANE_X = 4.1
/** The basement's route nodes, this far apart down its middle. */
const CELLAR_STEP = 3

type Tile = { r: number; c: number; x: number; z: number; star: boolean; hub: boolean; hole: boolean; keep: boolean }
/** A chain of tiles between two route nodes; `start` is the tile it sets off from (a star, or none from the pad). */
type Chain = { from: string; to: string; tiles: Tile[]; start: Tile | null }

function build(slot: RoundSlot, rng: Rng, tier: Tier): RoundOut {
  const k = kit(slot, tier)
  k.camera('wide')
  const N = byTier(tier, [12, 14, 16])
  const holeShare = byTier(tier, [0.08, 0.12, 0.16])
  const [cLo, cHi] = byTier(tier, [
    [0.56, 0.6],
    [0.48, 0.52],
    [0.45, 0.47],
  ] as const)
  const crumble = rng.between(cLo, cHi)
  const sweepers = byTier(tier, [0, 1, 2])

  // The hubs (T2 one, T3 two, eight rows apart so their bars never cross), each with a star row three rows either
  // side of it, clear of its bar; more star rows wherever the gap would be over four (never across a hub), the
  // first within three rows of the pad and the last within three of the end. With sweepers the hubs sit a column
  // off the middle on one side, and the blue's lane runs down the other side's outer column, 5.4 m from them: the
  // tips of the bars cross it, so the blue waits at the lane's star for one to go by, then has 0.8 s or more to
  // set off in (1.5 s or more for a real bean); the rows are shifted to put the hubs there.
  const hubRows = sweepers === 1 ? [rng.int(5, N - 5)] : sweepers === 2 ? [4, 4 + 2 * STAR_EVERY] : []
  const starRows = hubRows.flatMap((h) => [h - 3, h + 3])
  if (!starRows.length) for (let r = rng.int(2, 3); r < N; r += STAR_EVERY) starRows.push(r)
  while (starRows[0]! > 3) starRows.unshift(Math.max(1, starRows[0]! - STAR_EVERY))
  for (let i = 0; i + 1 < starRows.length; i++) {
    const a = starRows[i]!
    if (starRows[i + 1]! - a > STAR_EVERY && !hubRows.some((h) => h > a && h < starRows[i + 1]!)) starRows.splice(i + 1, 0, a + STAR_EVERY)
  }
  while (starRows[starRows.length - 1]! < N - 4) starRows.push(starRows[starRows.length - 1]! + STAR_EVERY)
  const lane = sweepers ? rng.sign() : 0
  const laneCol = lane < 0 ? 0 : COLS - 1
  const hubCol = lane < 0 ? 3 : 2
  const par = lane ? -lane * (hubRows[0]! % 2 ? 1 : -1) : rng.sign()
  const tx = (r: number, c: number) => (c - (COLS - 1) / 2) * COL_W + par * (r % 2 ? SHIFT : -SHIFT)
  const tz = (r: number) => ROW0 + r * ROW_D
  const grid: Tile[][] = []
  for (let r = 0; r < N; r++) {
    grid.push([])
    for (let c = 0; c < COLS; c++) grid[r]!.push({ r, c, x: tx(r, c), z: tz(r), star: false, hub: false, hole: false, keep: false })
  }
  const at = (r: number, c: number) => grid[r]![c]!

  // Stars: two a star row. With sweepers, one on the lane and one in the middle (within the bars' reach: a spot to
  // thread them from); without, one each side, at least two columns apart.
  const stars: Tile[][] = starRows.map((r) => {
    let cols: number[]
    if (lane) cols = [laneCol, rng.pick([2, 3])]
    else {
      const a = rng.int(0, 2)
      cols = [a, rng.int(Math.max(3, a + 2), COLS - 1)]
    }
    return cols.map((c) => {
      const t = at(r, c)
      t.star = true
      return t
    })
  })

  const hubs = hubRows.map((r) => {
    const t = at(r, hubCol)
    t.star = true
    t.hub = true
    return t
  })

  // A chain of tiles from one row to a star further down (or, with no star, to row toR as near x toX as it gets): a
  // row at a time, onto whichever of the two tiles ahead is nearer the straight line, then along the star's row if
  // it's still off to one side (two tiles at most).
  const walk = (fromR: number, fromC: number, fromX: number, toR: number, toC: number, toX = tx(toR, toC)): Tile[] | null => {
    const out: Tile[] = []
    let c = fromC
    for (let r = fromR + 1; r <= toR; r++) {
      const want = fromX + ((toX - fromX) * (r - fromR)) / (toR - fromR)
      let best = -1
      let bestD = Infinity
      for (let cc = 0; cc < COLS; cc++) {
        if (c >= 0 && Math.abs(tx(r, cc) - tx(r - 1, c)) > COL_W * 0.6) continue
        if (at(r, cc).hub) continue
        const d = Math.abs(tx(r, cc) - want)
        if (d < bestD) {
          bestD = d
          best = cc
        }
      }
      if (best < 0) return null
      c = best
      out.push(at(r, c))
    }
    for (let side = 0; toC >= 0 && c !== toC; side++) {
      c += Math.sign(toC - c)
      if (side >= 2 || at(toR, c).hub) return null
      out.push(at(toR, c))
    }
    return out
  }

  // The chains: from the pad to each first star, from each star to each star in the next star row it can reach,
  // and from each last star down to the last row (toward the middle), where the jump for the exit pad is.
  const starId = (j: number, a: number) => `s${j}_${a}`
  const chains: Chain[] = []
  stars[0]!.forEach((t, a) => {
    const tiles = walk(-1, -1, 0, t.r, t.c)
    if (tiles) chains.push({ from: 'in', to: starId(0, a), tiles: tiles.slice(0, -1), start: null })
  })
  for (let j = 0; j + 1 < stars.length; j++) {
    stars[j]!.forEach((s, a) => {
      stars[j + 1]!.forEach((t, b) => {
        const tiles = walk(s.r, s.c, s.x, t.r, t.c)
        if (tiles) chains.push({ from: starId(j, a), to: starId(j + 1, b), tiles: tiles.slice(0, -1), start: s })
      })
    })
  }
  const last = stars.length - 1
  stars[last]!.forEach((s, a) => {
    const tiles = s.r < N - 1 ? (walk(s.r, s.c, s.x, N - 1, -1, Math.max(-2.6, Math.min(2.6, s.x))) ?? []) : []
    chains.push({ from: starId(last, a), to: 'out', tiles, start: s })
  })
  for (const ch of chains) for (const t of ch.tiles) t.keep = true
  // A chain through a bar's sweep (but the lane, timed for the blue) is a thread for experts, its windows too short
  // for the main route's 1 s (design-final §1.4): gold.
  const threads = (ch: Chain) => {
    const spots = [...ch.tiles, ...(ch.start ? [ch.start] : [])]
    if (lane && spots.every((t) => t.c === laneCol)) return false
    return spots.some((t) => hubs.some((h) => Math.hypot(t.x - h.x, t.z - h.z) < SWEEP_REACH))
  }

  // Holes: the tier's share of the field, never on a chain, a star or a hub, and never two side by side.
  const near = (a: Tile, b: Tile) => Math.hypot(a.x - b.x, a.z - b.z) < COL_W + 0.1
  const free = rng.shuffle(grid.flat().filter((t) => !t.keep && !t.star))
  const want = Math.round(holeShare * N * COLS)
  const holes: Tile[] = []
  for (const t of free) {
    if (holes.length >= want) break
    if (holes.some((h) => near(h, t))) continue
    t.hole = true
    holes.push(t)
  }

  // The field.
  for (const t of grid.flat()) {
    if (t.hole) continue
    k.cyl({ x: t.x, z: t.z, r: TILE_R, sides: 6, top: t.star ? STAR_UP : 0, hy: TILE_HY, look: t.star ? 'tile-star' : 'tile', touch: { kind: 'tile', crumble, star: t.star } })
  }

  // The basement: the belt back toward the start, walls round it (1 m over the tiles at the sides and either side
  // of the pads, under the pads' ends), and past the last row the bounce strip, which throws anything that steps on
  // it onto the exit pad (vy 15: it clears the pad's edge).
  const lastZ = tz(N - 1)
  const exitZ = lastZ + TILE_R + EXIT_GAP
  const stripZ0 = lastZ + TILE_R + STRIP_IN
  const wallTop = CELLAR_Y + CELLAR_WALL
  k.box({ x: 0, z: exitZ / 2, hx: CELLAR_HX, hz: exitZ / 2, top: CELLAR_Y, hy: 0.6, look: 'belt', belt: { x: 0, z: -BELT } })
  k.walls(0, exitZ, { hx: CELLAR_HX, y: CELLAR_Y, h: CELLAR_WALL })
  // (The pad before can sit up to 2 m to either side in this frame, the pad after is centred: the tall corners
  // keep clear of both.)
  for (const [z, padHx] of [
    [-0.25, 6.5],
    [exitZ + 0.25, 4.5],
  ] as const) {
    k.box({ x: 0, z, hx: CELLAR_HX + 0.5, hz: 0.25, top: -1.0, hy: (-1.0 - CELLAR_Y + 0.6) / 2, look: 'rail', noGround: true })
    for (const side of [-1, 1]) {
      k.box({ x: (side * (CELLAR_HX + 0.5 + padHx)) / 2, z, hx: (CELLAR_HX + 0.5 - padHx) / 2, hz: 0.25, top: wallTop, hy: (wallTop + 1.0) / 2, look: 'rail', noGround: true })
    }
  }
  const strip = k.box({
    x: 0,
    z: (stripZ0 + exitZ) / 2,
    hx: CELLAR_HX,
    hz: (exitZ - stripZ0) / 2,
    top: CELLAR_Y + STRIP_UP,
    hy: 0.3 + STRIP_UP / 2,
    look: 'bounce',
    bounce: { vy: 15, aim: { x: 0, y: 0, z: exitZ + 2.2 } },
  })

  // The sweepers: a low bar round each hub (jump it, or wait for it), turning 0.9–1.1 rad/s either way.
  for (const h of hubs) {
    const w = rng.between(0.9, 1.1) * rng.sign()
    k.hazard({ shape: 'bar', x: h.x, y: SWEEP_Y, z: h.z, r: SWEEP_R, len: SWEEP_LEN, hit: knock(5, 0.6, 5.5), look: 'bar-low', move: spin(w, rng.between(0, Math.PI * 2)) })
    k.hazard({ shape: 'post', x: h.x, y: STAR_UP, z: h.z, r: HUB_R, h: 1.5, hit: bonk(6), look: 'hub' })
  }

  // The route: the pads, the stars, each chain's tiles (never waited on; the lane's in a straight line), and the
  // jump for the exit pad from the last row; then the basement's way out (safe spots down its middle, the bounce
  // strip onto the exit pad).
  const spotX = (t: Tile) => (lane && t.c === laneCol ? lane * LANE_X : t.x)
  k.node('in', 0, -1.5)
  k.node('out', 0, exitZ + 1.5)
  stars.forEach((row, j) => row.forEach((t, a) => k.node(starId(j, a), spotX(t), t.z, { y: STAR_UP })))
  chains.forEach((ch, n) => {
    const tier = threads(ch) ? 'gold' : 'main'
    let prev = ch.from
    ch.tiles.forEach((t, i) => {
      const id = `c${n}_${i}`
      k.node(id, spotX(t), t.z, { wait: 'no', y: t.star ? STAR_UP : 0 })
      k.edge(prev, id, 'run', { tier })
      prev = id
    })
    if (ch.to !== 'out') k.edge(prev, ch.to, 'run', { tier })
    else {
      const t = ch.tiles[ch.tiles.length - 1] ?? ch.start!
      k.edge(prev, 'out', 'jump', { tier, takeoff: k.at(spotX(t), t.star ? STAR_UP : 0, t.z + 0.45) })
    }
  })
  const cellar: string[] = []
  for (let z = 1.5; z < stripZ0 - 0.8; z += CELLAR_STEP) cellar.push(k.node(`b${cellar.length}`, 0, z, { y: CELLAR_Y }))
  for (let i = 0; i + 1 < cellar.length; i++) k.edge(cellar[i]!, cellar[i + 1]!)
  k.edge(cellar[cellar.length - 1]!, 'out', 'bounce', { via: [k.at(0, CELLAR_Y + STRIP_UP, (stripZ0 + exitZ) / 2, strip)] })
  return k.done({ x: 0, y: 0, z: exitZ })
}

export const ROUND: RoundDef = {
  letter: 'x',
  name: 'Hex Drop',
  hint: 'keep moving',
  family: 'F',
  phase: 1,
  build,
}
