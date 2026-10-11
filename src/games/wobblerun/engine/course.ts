/**
 * Laying a gauntlet (design-final §4): the start pad and its slide, the rounds in order with a checkpoint pad
 * after each but the finale, a slide down after any round that ends 3 m or more above the course's base, a
 * bounce-up when the next round must start higher, the centreline shifting up to 2 m across each pad, and the
 * finale ending at the crown. From gen 2 the gauntlet has ups and downs instead (`ups`, below): it climbs toward
 * the finale, round by round, with a big way down in the middle.
 *
 * A day's course is `plannedCourse(n, attempt, k)`: the plan (dailyPlan.ts) keeps which rounds (`k`, a letter and
 * a tier a round, the finale last: "g1l2h2s3C2") and which try it kept. Each round is laid from its own seed,
 * 'wobble:' + day + ':' + attempt + ':' + slot, so changing one round never reshuffles another. The lab and the
 * previews lay a course from a code and any seed (`courseFromCode`).
 *
 * Generations (types.ts Gen): every builder, pad and connector gets the course's generation, and a day's is fixed
 * by its number (genOfDay): gen 1 before GEN2_FROM, gen 2 from it. New rules go in behind `gen >= 2`, so the days
 * already planned (and played) lay exactly as they did; test courses take the latest (LATEST_GEN).
 */
import { gauntletName } from './names.ts'
import { hashString, makeRng } from './rng.ts'
import {
  bouncePiece,
  bounceUpPiece,
  checkPiece,
  CHECK_LEN,
  CHECK_LINE,
  dropPiece,
  liftPiece,
  rampPiece,
  slideDownPiece,
  slidePiece,
  stairsPiece,
  START_SPAWN_Z,
  START_Y,
  startPiece,
} from './rounds/pads.ts'
import { isFinale, roundDef } from './rounds/index.ts'
import { buildGrid, DEATH_DROP, PERIODS } from './sim.ts'
import type { CameraPreset, Course, CoursePiece, CourseRound, Gen, Grid, GraphEdge, Point, Rng, RoundDef, RoundOut, RoundSlot, Spawn, Theme, Tier } from './types.ts'

/** Day 1, as daily.ts FIRST_DAY and the API's WOBBLERUN_FIRST_DAY have it. */
export const WOBBLE_FIRST_DAY = '2026-10-09'

/** The newest generation: what the lab, courseFromCode and the difficulty report lay unless told otherwise. */
export const LATEST_GEN: Gen = 2

/**
 * The first day number laid by gen 2's rules (the harder rounds with ups and downs), or null while no planned day
 * is: every day before it stays gen 1, laid exactly as it was planned. Set it only to a day nobody has played,
 * once Ramsey has said yes, then `node scripts/wobblerun-daily.mjs replan <GEN2_FROM>` lays the days from it again
 * at gen 2 (the plan's HEAT2 and the gen-2 builders) and keeps every day before it as it is.
 */
export const GEN2_FROM: number | null = null

/** Day n's generation: 2 from GEN2_FROM on, 1 before it (and every day while it's null). */
export function genOfDay(n: number): Gen {
  return GEN2_FROM !== null && n >= GEN2_FROM ? 2 : 1
}

const dayUTC = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number)
  return Date.UTC(y!, m! - 1, dd!)
}

/** Day n's date (1 on the first day). */
export function dayOfN(n: number): string {
  return new Date(dayUTC(WOBBLE_FIRST_DAY) + (n - 1) * 864e5).toISOString().slice(0, 10)
}

/** A date's day number (1 on the first day). */
export function nOfDay(day: string): number {
  return Math.round((dayUTC(day) - dayUTC(WOBBLE_FIRST_DAY)) / 864e5) + 1
}

/** A date's weekday, 0 Sunday to 6 Saturday. */
export function weekdayOf(day: string): number {
  return new Date(dayUTC(day)).getUTCDay()
}

/**
 * The weekday themes (design-final §4.5): set dressing only, never physics, and never a hazard's colour at full
 * strength on a floor. Sunday first.
 */
export const THEMES: readonly Theme[] = [
  { id: 'mint', name: 'Mint Meadow', floors: ['#d4fbe8', '#cfeaff', '#e2f8d6'], bodies: ['#6fd8a7', '#7cc4ef', '#93d679'], goo: '#3ecf8e', scenery: ['daisies', 'kites', 'clouds'] },
  { id: 'bubblegum', name: 'Bubblegum Bay', floors: ['#ffd1e6', '#cfeaff', '#ffe0ee'], bodies: ['#f08cb8', '#7cc4ef', '#f3a6c9'], goo: '#ff62c8', scenery: ['bubbles', 'lighthouse'] },
  { id: 'lemon', name: 'Lemon Lagoon', floors: ['#fff0c4', '#cfeaff', '#fff6d8'], bodies: ['#f3c24f', '#7cc4ef', '#f0d070'], goo: '#3ec8cf', scenery: ['lemon slices', 'beach balls'] },
  { id: 'grape', name: 'Grape Jelly', floors: ['#dcd2ff', '#f6d0f2', '#e6defc'], bodies: ['#8f7fe8', '#d77ccc', '#a796ec'], goo: '#8a6ad4', scenery: ['gumdrop hills', 'jelly cubes'] },
  { id: 'sherbet', name: 'Sherbet Sunset', floors: ['#ffe4c2', '#ffd6e4', '#ffeccf'], bodies: ['#f2b56b', '#ef94b3', '#f5c389'], goo: '#f2813a', scenery: ['ice-cream cones', 'low sun'] },
  { id: 'neon', name: 'Neon Night', floors: ['#c9c3ff', '#f3c4f0', '#d6d0ff'], bodies: ['#5d55c9', '#b04fa8', '#6e66d6'], goo: '#9b6cff', night: true, scenery: ['stars', 'light strings'] },
  {
    id: 'show',
    name: 'Big Show',
    floors: ['#ffd1e6', '#cfeaff', '#fff0c4', '#d4fbe8', '#dcd2ff', '#ffdcc9'],
    bodies: ['#f08cb8', '#7cc4ef', '#f3c24f', '#6fd8a7', '#8f7fe8', '#f2a77e'],
    goo: '#ff62c8',
    perRound: true,
    scenery: ['spectator stands', 'fireworks'],
  },
]

export function themeFor(day: string): Theme {
  return THEMES[weekdayOf(day)]!
}

/**
 * One round of a code: its letter and tier, and (to try a round before it's in the registry, or in a test) the
 * module to lay it with instead of the registry's.
 */
export type RoundSpec = { letter: string; tier: Tier; def?: RoundDef }

/** A code's rounds, in order ("g1l2C2" → g at T1, l at T2, C at T2). */
export function parseCode(k: string): RoundSpec[] {
  const out: RoundSpec[] = []
  const re = /([A-Za-z])([123])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(k))) out.push({ letter: m[1]!, tier: Number(m[2]) as Tier })
  return out
}

export function codeOf(specs: readonly RoundSpec[]): string {
  return specs.map((s) => s.letter + s.tier).join('')
}

/** The course's base height: rounds start here unless one ended high and needed no slide. */
const BASE = 0
/** A round ending this far above the base gets a slide down; a pad this far below it gets a bounce-up. */
const SLIDE_FROM = 3
const BOUNCE_BELOW = -2

/*
 * Gen 2's ups and downs. Between each round and the next a connector (rounds/pads.ts) takes the course up or down to
 * the next round's height, straight after the round: the checkpoint pad stays where it was, the next round's flat
 * pad before. Most gaps climb CLIMB m from the round's base; one in a day's middle (every third on a longer course,
 * never the last, the finale's) is the big way down, a slide of PLUNGE m or a 3 m drop, from wherever the round
 * ended. So a day goes 0 → up → up → down → up into the finale, or 0 → up → down → up → up. A round that ends high or
 * low (one that climbs inside itself, as Melon Hill's belt does) gets whatever brings it to the height wanted: a
 * slide or a drop after a round that ends 3 m up. A round's base stays within LOW … HIGH (FINALE_HIGH for the
 * finale's), the soda sea 9 m under the lowest point as ever; a connector climbs at most UP_MOST and comes down at
 * most DOWN_MOST, and within FLAT the rounds just meet.
 */
const CLIMB = [2, 3.5] as const
const PLUNGE = [3, 5] as const
const LOW = -1.5
const HIGH = 6.5
const FINALE_HIGH = 7.5
const UP_MOST = 4
const DOWN_MOST = 6
const FLAT = 0.6
/** The biggest drop (dropPiece), the plunge's when it's a drop; else a way down from SLIDE_DOWN m is a slide. */
const DROP_MOST = 3
const SLIDE_DOWN = 2.5
/** A way down from DROP_FROM m is a drop; less is stairs down. */
const DROP_FROM = 1.4

/** The gap before round g: a climb from the round before's base, or the big way down (a slide, or a drop). */
type Gap = { plunge: boolean; amount: number; drop: boolean }

/** A course of `count` rounds' gaps (gaps[g] is the one before round g, from 1), drawn from the course's own stream. */
function profileOf(count: number, rng: Rng): Gap[] {
  const first = count >= 5 && rng.chance(0.5) ? 3 : 2
  const gaps: Gap[] = []
  for (let g = 1; g < count; g++) {
    const plunge = g >= first && (g - first) % 3 === 0 && g < count - 1
    gaps[g] = plunge ? { plunge, amount: rng.between(...PLUNGE), drop: rng.chance(0.4) } : { plunge, amount: rng.between(...CLIMB), drop: false }
  }
  return gaps
}

/** The connectors (rounds/pads.ts), by the piece kind the camera and the map know them as. */
type Way = 'ramp' | 'stairs' | 'slide' | 'drop' | 'lift' | 'bounce-up'

/**
 * The connector that takes the course `d` m up (or down: d < 0) between two rounds, from the gap's own stream, or
 * null within FLAT. Down: a slide from SLIDE_DOWN (a belly slide is the expert's way down it), a drop from DROP_FROM
 * (and the plunge's own choice of a 3 m drop), stairs below that. Up: stairs below 1.6 m; else a ramp (to 3.4 m),
 * stairs, a bounce-up (2.5–3.5 m) or twin lifts (2.8–3.5 m, but never into the finale: Tide Tower's sea starts
 * rising at its checkpoint), weighed 3 : 3 : 2 : 1 (lifts are the slow one: you wait for one), and not the way the
 * last climb went when there's another.
 */
function connectorFor(d: number, drop: boolean, rng: Rng, last: Way | null, intoFinale: boolean, gen: Gen): { way: Way; out: RoundOut } | null {
  if (Math.abs(d) < FLAT) return null
  if (d < 0) {
    if (-d >= DROP_FROM && (drop || -d < SLIDE_DOWN)) return { way: 'drop', out: dropPiece(Math.min(-d, DROP_MOST), gen) }
    if (-d >= SLIDE_DOWN) return { way: 'slide', out: slideDownPiece(-d, rng, gen) }
    return { way: 'stairs', out: stairsPiece(d, rng, gen) }
  }
  if (d < 1.6) return { way: 'stairs', out: stairsPiece(d, rng, gen) }
  const ways: [Way, number][] = []
  if (d <= 3.4) ways.push(['ramp', 3])
  ways.push(['stairs', 3])
  if (d >= 2.5 && d <= 3.5) ways.push(['bounce-up', 2])
  if (d >= 2.8 && d <= 3.5 && !intoFinale) ways.push(['lift', 1])
  const fresh = ways.filter(([w]) => w !== last)
  const from = fresh.length ? fresh : ways
  let r = rng() * from.reduce((sum, [, odds]) => sum + odds, 0)
  let way = from[from.length - 1]![0]
  for (const [w, odds] of from) {
    r -= odds
    if (r < 0) {
      way = w
      break
    }
  }
  if (way === 'ramp') return { way, out: rampPiece(d, rng, gen) }
  if (way === 'bounce-up') return { way, out: bouncePiece(d, gen) }
  if (way === 'lift') return { way, out: liftPiece(d, rng, gen) }
  return { way, out: stairsPiece(d, rng, gen) }
}

export type AssembleOpts = {
  key: string
  name: string
  n: number
  attempt: number
  theme: Theme
  /** Round i's seed. */
  seedOf: (i: number) => string
  /** The course's own seed (periods, x shifts, the slides' hoops; gen 2's ups and downs). */
  seed: string
  /** The generation every round, pad and connector is laid by (1 if left out). */
  gen?: Gen
  /**
   * Gen 2's ups and downs between rounds (on from gen 2 unless false). False, the rounds are joined as gen 1 joins
   * them, with gen 1's pieces, whatever the generation (but for the slide's splat height, 6 m under its foot): a solo
   * course (lab.ts), a round measured on its own.
   */
  ups?: boolean
}

type Span = { z0: number; z1: number; y: number }

/** Lays the rounds into a course (any number of them; the last should be a finale, for the crown). */
export function assemble(specs: readonly RoundSpec[], o: AssembleOpts): Course {
  const gen: Gen = o.gen ?? 1
  const course: Course = {
    key: o.key,
    name: o.name,
    n: o.n,
    attempt: o.attempt,
    gen,
    theme: o.theme,
    solids: [],
    hazards: [],
    volumes: [],
    decos: [],
    rounds: [],
    pieces: [],
    spawns: [],
    deaths: [],
    graph: { nodes: [], edges: [], start: 'S:start', goal: '' },
    crown: -1,
    tiles: [],
    planks: [],
    splitCount: 0,
    length: 0,
    minY: 0,
    maxY: 0,
    gooY: 0,
    grid: null as unknown as Grid,
  }
  const lay = makeRng(o.seed + ':lay')
  const periods = lay.shuffle([...PERIODS])
  const pieceDeaths: { z0: number; z1: number; y: number; own: Span[] }[] = []

  /** Moves a laid piece or round into place, renaming its route nodes `prefix:id`. */
  const place = (out: RoundOut, ox: number, oy: number, oz: number, round: number, prefix: string, finale: boolean) => {
    const s0 = course.solids.length
    const h0 = course.hazards.length
    const v0 = course.volumes.length
    const shift = (p: { x: number; y: number; z: number }) => ({ x: p.x + ox, y: p.y + oy, z: p.z + oz })
    for (const s of out.solids) {
      s.x += ox
      s.y += oy
      s.z += oz
      s.round = round
      if (s.bounce) s.bounce = { ...s.bounce, aim: s.bounce.aim && shift(s.bounce.aim), perfectAim: s.bounce.perfectAim && shift(s.bounce.perfectAim) }
      course.solids.push(s)
    }
    for (const h of out.hazards) {
      h.x += ox
      h.y += oy
      h.z += oz
      h.round = round
      course.hazards.push(h)
    }
    for (const v of out.volumes) {
      v.x += ox
      v.y += oy
      v.z += oz
      v.round = round
      if (v.kind === 'slime') {
        v.z0 += oz
        v.z1 += oz
      }
      if (v.kind === 'crown') course.crown = course.volumes.length
      course.volumes.push(v)
    }
    for (const d of out.decos) {
      d.x += ox
      d.y += oy
      d.z += oz
      d.round = round
      if (d.ref) d.ref = { kind: d.ref.kind, i: d.ref.i + (d.ref.kind === 'solid' ? s0 : d.ref.kind === 'hazard' ? h0 : v0) }
      course.decos.push(d)
    }
    const point = (p: Point): Point => {
      const q: Point = shift(p)
      if (p.on !== undefined) q.on = p.on + s0
      return q
    }
    for (const n of out.graph.nodes) {
      const moved = { ...n, ...point(n), id: `${prefix}:${n.id}` }
      if (n.on === undefined) delete moved.on
      course.graph.nodes.push(moved)
    }
    for (const e of out.graph.edges) {
      const moved: GraphEdge = { ...e, from: `${prefix}:${e.from}`, to: `${prefix}:${e.to}` }
      if (e.takeoff && e.takeoff !== 'edge') moved.takeoff = point(e.takeoff)
      if (e.via) moved.via = e.via.map(point)
      course.graph.edges.push(moved)
    }
    for (const f of out.flags) {
      course.spawns.push({ kind: 'flag', x: f.x + ox, y: f.y + oy, z: f.z + oz, line: f.z + oz, split: false, round, node: `${prefix}:${f.node}`, finale })
    }
    pieceDeaths.push({ z0: oz, z1: oz + out.exit.z, y: oy - DEATH_DROP, own: out.deaths.map((d) => ({ z0: d.z0 + oz, z1: d.z1 + oz, y: d.y + oy })) })
  }
  const edge = (from: string, to: string, e: Partial<GraphEdge> = {}) => course.graph.edges.push({ from, to, move: 'run', tier: 'main', ...e })
  const piece = (kind: CoursePiece['kind'], z0: number, z1: number, x: number, y: number, camera: CameraPreset) => course.pieces.push({ kind, z0, z1, x, y, camera })

  // The start pad and its slide.
  const start = startPiece(makeRng(o.seed + ':start'), gen)
  place(start, 0, 0, 0, 0, 'S', false)
  course.spawns.push({ kind: 'start', x: 0, y: START_Y, z: START_SPAWN_Z, line: START_SPAWN_Z, split: false, round: 0, node: 'S:start', finale: false })
  piece('start', 0, start.exit.z, 0, 0, 'slide')
  let x = 0
  let y = BASE + start.exit.y
  let z = start.exit.z
  let from = 'S:top'
  let slideIn = true
  const count = specs.length
  // Gen 2's ups and downs: the gaps' plan, from the course's own stream (gen 1 draws nothing here).
  const ups = (o.ups ?? gen >= 2) ? profileOf(count, makeRng(o.seed + ':ups')) : null
  let climbed: Way | null = null

  for (let i = 0; i < count; i++) {
    const spec = specs[i]!
    const def = spec.def ?? roundDef(spec.letter)
    const finale = i === count - 1 && (spec.def ? spec.def.family === 'finale' : isFinale(spec.letter))
    const slot: RoundSlot = { i, count, letter: spec.letter, tier: spec.tier, period: periods[i % periods.length]!, finale, seed: o.seedOf(i), gen }
    const out = def.build(slot, makeRng(slot.seed), spec.tier, { x, y, z })
    const prefix = String(i)
    place(out, x, y, z, i, prefix, finale)
    const round: CourseRound = {
      i,
      letter: spec.letter,
      tier: spec.tier,
      name: def.name,
      hint: def.hint,
      family: def.family,
      stub: !!def.stub,
      period: slot.period,
      z0: z,
      z1: z + out.exit.z,
      x,
      y,
      camera: out.camera,
      gold: out.gold.map((g) => ({ ...g, z0: g.z0 + z, z1: g.z1 + z, x: g.x + x })),
    }
    course.rounds.push(round)
    // In from the pad before (down the slide, running or belly sliding).
    edge(from, `${prefix}:in`)
    if (slideIn) edge(from, `${prefix}:in`, { move: 'slide', tier: 'gold' })
    if (finale) {
      course.graph.goal = `${prefix}:crown`
      z += out.exit.z
      break
    }
    let ex = x + out.exit.x
    let ey = y + out.exit.y
    let ez = z + out.exit.z
    from = `${prefix}:out`
    slideIn = false
    if (ups) {
      // Gen 2: up or down to the next round's height, straight after this round (its `out` node stands on the
      // connector's lead). A climb is from this round's base; the big way down from where it ended.
      const gap = ups[i + 1]!
      const next = specs[i + 1]!
      const intoFinale = i + 1 === count - 1 && (next.def ? next.def.family === 'finale' : isFinale(next.letter))
      let want = gap.plunge ? ey - (gap.drop ? Math.min(gap.amount, DROP_MOST) : gap.amount) : y + gap.amount
      // A round that climbed a little past the height wanted keeps it: no stairs down straight after a climb.
      if (!gap.plunge && want < ey && ey - want < DROP_FROM) want = ey
      const target = Math.min(intoFinale ? FINALE_HIGH : HIGH, Math.max(LOW, want))
      const d = Math.min(UP_MOST, Math.max(-DOWN_MOST, target - ey))
      const c = connectorFor(d, gap.drop, makeRng(`${o.seed}:ups:${i + 1}`), climbed, intoFinale, gen)
      if (c) {
        const label = `C${i + 1}`
        place(c.out, ex, ey, ez, i + 1, label, false)
        piece(c.way, ez, ez + c.out.exit.z, ex, ey, c.out.camera)
        // Its route, if it has one: in at its first node, on from the one furthest along. A ramp, stairs or a drop has
        // none: the way on runs straight over it.
        const nodes = c.out.graph.nodes
        if (nodes.length) {
          edge(from, `${label}:${nodes[0]!.id}`)
          from = `${label}:${nodes.reduce((a, b) => (b.z > a.z ? b : a)).id}`
        }
        slideIn = c.way === 'slide'
        if (d > 0) climbed = c.way
        ey += c.out.exit.y
        ez += c.out.exit.z
      }
    } else if (ey - BASE >= SLIDE_FROM) {
      const drop = ey - BASE
      const slide = slidePiece(drop, makeRng(`${o.seed}:slide:${i}`), gen)
      // In a solo course (`ups: false`, at any generation) and from gen 2, the slide splats 6 m under its foot, not 6 m
      // under its top: a round can now end 6 m up or more, and the slide's foot would be under the splat height. A
      // planned gen-1 day (ups left out) lays exactly as it did; no stored route runs a solo course.
      if (gen >= 2 || o.ups === false) slide.deaths.push({ z0: 0, z1: slide.exit.z, y: slide.exit.y - DEATH_DROP })
      place(slide, ex, ey, ez, i + 1, `L${i}`, false)
      piece('slide', ez, ez + slide.exit.z, ex, ey, 'slide')
      edge(from, `L${i}:top`)
      from = `L${i}:top`
      slideIn = true
      ey += slide.exit.y
      ez += slide.exit.z
    }
    // The checkpoint pad: a split at its flag line, the spawn at its middle.
    const cp = checkPiece(i + 1, gen)
    const next = specs[i + 1]!
    const nextFinale = i + 1 === count - 1 && (next.def ? next.def.family === 'finale' : isFinale(next.letter))
    place(cp, ex, ey, ez, i + 1, `P${i + 1}`, false)
    piece('check', ez, ez + CHECK_LEN, ex, ey, 'default')
    course.spawns.push({ kind: 'check', x: ex, y: ey, z: ez + CHECK_LEN / 2, line: ez + CHECK_LINE, split: true, round: i + 1, node: `P${i + 1}:cp`, finale: nextFinale })
    edge(from, `P${i + 1}:cp`)
    if (slideIn) edge(from, `P${i + 1}:cp`, { move: 'slide', tier: 'gold' })
    slideIn = false
    from = `P${i + 1}:cp`
    ez += CHECK_LEN
    if (!ups && ey < BOUNCE_BELOW) {
      const up = bounceUpPiece(gen)
      place(up, ex, ey, ez, i + 1, `U${i + 1}`, false)
      piece('bounce-up', ez, ez + up.exit.z, ex, ey, 'default')
      edge(from, `U${i + 1}:low`)
      from = `U${i + 1}:high`
      ey += up.exit.y
      ez += up.exit.z
    }
    // The next round's centreline shifts up to 2 m across the pad, drifting back toward the middle.
    x = ex + Math.max(-2, Math.min(2, -0.5 * ex + lay.between(-1.5, 1.5)))
    y = ey
    z = ez
  }

  // Splat heights: each piece's own, and 6 m below its base elsewhere along it.
  const spans: Span[] = []
  for (const p of pieceDeaths) {
    const own = p.own.filter((d) => d.z1 > p.z0 && d.z0 < p.z1).sort((a, b) => a.z0 - b.z0)
    let at = p.z0
    for (const d of own) {
      const a = Math.max(at, d.z0)
      if (a > at) spans.push({ z0: at, z1: a, y: p.y })
      const b = Math.min(p.z1, d.z1)
      if (b > a) spans.push({ z0: a, z1: b, y: d.y })
      at = Math.max(at, b)
    }
    if (at < p.z1) spans.push({ z0: at, z1: p.z1, y: p.y })
  }
  if (spans.length) {
    spans[0]!.z0 = -Infinity
    spans[spans.length - 1]!.z1 = Infinity
  }
  course.deaths = spans
  course.spawns.sort((a, b) => a.line - b.line)
  course.length = z
  course.splitCount = course.spawns.filter((s) => s.split).length + 1
  let lo = Infinity
  let hi = -Infinity
  course.solids.forEach((s, i) => {
    if (s.touch?.kind === 'tile') {
      s.ti = course.tiles.length
      course.tiles.push(i)
    } else if (s.touch?.kind === 'plank') {
      s.pi = course.planks.length
      course.planks.push(i)
    }
    if (s.noGround) return
    lo = Math.min(lo, s.y)
    hi = Math.max(hi, s.y)
  })
  course.minY = lo
  course.maxY = hi
  course.gooY = lo - 9
  course.grid = buildGrid(course)
  return course
}

/** A course's name, as the plan script names a day's try. */
export function courseName(n: number, attempt: number): string {
  return gauntletName(makeRng(`wobble:name:${dayOfN(n)}:${attempt}`))
}

/**
 * Day n's gauntlet, try `attempt`, with rounds `k` (the plan's row): laid the same on every device, by the day's
 * own generation (genOfDay). `name` is the plan's name for it (its own, worked out, if left out). `gen` is for the
 * plan script's trials only (a day laid by rules it isn't planned with): the game never passes it.
 */
export function plannedCourse(n: number, attempt: number, k: string, name?: string, gen: Gen = genOfDay(n)): Course {
  const day = dayOfN(n)
  return assemble(parseCode(k), {
    key: k,
    name: name ?? courseName(n, attempt),
    n,
    attempt,
    theme: themeFor(day),
    seedOf: (i) => `wobble:${day}:${attempt}:${i}`,
    seed: `wobble:${day}:${attempt}`,
    gen,
  })
}

/**
 * A course from any code and seed, for the lab and previews: Crown Peak (T2) is added if the code doesn't end
 * with a finale. Each round's seed is its letter, tier and how many of it came before, so adding a round to a
 * code never changes the others. It's laid by the newest rules (LATEST_GEN) unless `gen` says otherwise.
 */
export function courseFromCode(k: string, seed: string | number = 'lab', name = 'Test Course', gen: Gen = LATEST_GEN): Course {
  const specs = parseCode(k)
  if (!specs.length || !isFinale(specs[specs.length - 1]!.letter)) specs.push({ letter: 'C', tier: 2 })
  const seen = new Map<string, number>()
  const seeds = specs.map((s) => {
    const key = s.letter + s.tier
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    return `lab:${seed}:${key}:${n}`
  })
  return assemble(specs, {
    key: codeOf(specs),
    name,
    n: 0,
    attempt: 0,
    theme: THEMES[hashString(String(seed)) % THEMES.length]!,
    seedOf: (i) => seeds[i]!,
    seed: `lab:${seed}`,
    gen,
  })
}

/** A course's heights (courseHeights). */
export type CourseHeights = { lowest: number; highest: number; sea: number; climb: number; drop: number; star: number }

/**
 * A course's heights along the way (gen 2's ups and downs, for the plan script's trials and the lab's card): its
 * lowest and highest solid, the soda sea's height and the star's, and how far the way climbs and comes down from
 * stretch to stretch (the start pad, then each round's and piece's start height, then the star: what a round climbs
 * inside itself counts, as do the start slide and the finale's climb; ups and downs inside one round don't).
 */
export function courseHeights(course: Course): CourseHeights {
  const starts = [...course.rounds.map((r) => ({ z: r.z0, y: r.y })), ...course.pieces.filter((p) => p.kind !== 'start').map((p) => ({ z: p.z0, y: p.y }))].sort((a, b) => a.z - b.z)
  const crown = course.volumes[course.crown]
  const star = crown ? crown.y : (starts[starts.length - 1]?.y ?? 0)
  const ys = [START_Y, ...starts.map((s) => s.y), star]
  let climb = 0
  let drop = 0
  for (let i = 1; i < ys.length; i++) {
    const d = ys[i]! - ys[i - 1]!
    if (d > 0) climb += d
    else drop -= d
  }
  return { lowest: course.minY, highest: course.maxY, sea: course.gooY, climb, drop, star }
}

/** The round the bean is in at z (−1 on the start, a pad or a slide), for the HUD's "Round 2 · Pad Hop". */
export function roundAt(course: Course, z: number): number {
  for (const r of course.rounds) if (z >= r.z0 && z < r.z1) return r.i
  return -1
}

/** How the camera sits at z: the round's preset, or the piece's (the slides). */
export function cameraAt(course: Course, z: number): CameraPreset {
  for (const r of course.rounds) if (z >= r.z0 && z < r.z1) return r.camera
  for (const p of course.pieces) if (z >= p.z0 && z < p.z1) return p.camera
  return 'default'
}

/** The splits' spawns (the checkpoints), in order: split k is crossing spawns[splitSpawns[k]].line. */
export function splitSpawns(course: Course): Spawn[] {
  return course.spawns.filter((s) => s.split)
}

