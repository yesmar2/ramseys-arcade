import { runPreview, type Sim } from '../previewKit'
import type { Hole, Vec } from './course'
import {
  camFor,
  COURSE,
  createInitialState,
  currentHole,
  FIELD_W,
  fieldFrame,
  jumpToHole,
  mapLayout,
  MAX_DRAG,
  onGround,
  powerForDistance,
  powerForSpeed,
  resizeState,
  setDragAim,
  shoot,
  startGame,
  tick,
  toScreen,
  wallsOf,
  type GameState,
  type MapSide,
} from './game'
import { renderGame } from './render'
import { inAny, inside } from './terrain'

/*
 * Putt playing itself, for its cabinet on the home page: the game's own
 * course, engine and renderer, and a pilot that plays the round the way a
 * person does. It knows how far each spot on a hole is from the cup, the way
 * a ball can go, and it lines a shot up by trying it: while it studies the
 * lie it plays a few dozen shots out, from the moment it means to let go,
 * and picks the one that leaves it nearest the cup, and that still does
 * with a touch either way on it, as a person steers clear of a shot that
 * only works dead on. Then it pulls back and lets go with a person's wobble
 * in the pull, and the ball does whatever the game says. A shot that put it
 * in the water it doesn't play the same way again from the same spot. After
 * the last hole, a new round starts.
 */

/** Field units across the screen's short side: the ball big enough to follow, and room to see where it's going. */
const ACROSS = 68

/** The distance map's squares, this many field units a side. */
const CELL = 2
/** Rows of the map drawn up each step, from the moment a hole comes up; its fly-over is time enough for all of them. */
const ROWS_PER_STEP = 12
/** A try is played out this many steps at most; a ball still rolling by then is judged where it is. */
const TRY_STEPS = 240
/** Steps of tries played out in one step of the game, at most: a few milliseconds' work however long the shots roll. */
const STUDY_PER_STEP = 240
/** What a ball in the water costs, in field units of the way still to go: the stroke, and no ground gained. */
const STROKE_COST = 60
/** A hole the pilot is making a mess of is left after this many strokes, as a person would pick up. */
const PICK_UP = 14

type View = {
  /** Where the screen is centred, in field units: along the hole, and across it. */
  along: number
  across: number
}

type Run = { game: GameState; view: View }

/**
 * How many times the screen's size the game is drawn at: enough that the
 * hole, 100 units wide, fills ACROSS units' worth of the screen's short
 * side, with the bands of lettering above and below it off the edge of what
 * shows. The bands are 40 and 44px, or 8.5% and 9% of a tall drawing, and
 * the side margins 8px, or 2% of a wide one.
 */
function zoomFor(w: number, h: number) {
  const short = Math.min(w, h)
  const want = (100 * short) / ACROSS
  if (w >= h) {
    let H = want + 84
    if (H > 40 / 0.085) H = want / 0.825 >= 44 / 0.09 ? want / 0.825 : (want + 44) / 0.915
    return H / h
  }
  const W = want + 16 <= 400 ? want + 16 : want / 0.96
  return W / w
}

/** The size of the drawing for a screen of this size, which is also the size the game is set up for. */
function stageFor(w: number, h: number): [number, number] {
  const z = zoomFor(w, h)
  return [w * z, h * z]
}

/** What shows of the drawing: its middle, in the drawing's own pixels, and its size. */
function framing(run: Run, zw: number, zh: number) {
  const hole = currentHole(run.game)
  const f = fieldFrame(zw, zh, hole.h)
  const short = ACROSS * f.s
  const cw = zw >= zh ? (short * zw) / zh : short
  const ch = zw >= zh ? short : (short * zh) / zw
  const at = toScreen(f, run.game.cam, { x: run.view.across, y: run.view.along })
  // Kept within the hole's window, so none of the lettering above and below it shows.
  const x = f.w > cw ? Math.min(Math.max(at.x, f.x + cw / 2), f.x + f.w - cw / 2) : f.x + f.w / 2
  const y = f.h > ch ? Math.min(Math.max(at.y, f.y + ch / 2), f.y + f.h - ch / 2) : f.y + f.h / 2
  return { hole, f, x, y, cw, ch }
}

/** The corner for the hole's map: whichever of the two stays out of what shows. The screen is never over both. */
function mapCorner(fr: ReturnType<typeof framing>): MapSide {
  const covered = (side: MapSide) => {
    const m = mapLayout(fr.f, fr.hole.h, side)
    const x = Math.min(m.x + m.w + 4, fr.x + fr.cw / 2) - Math.max(m.x - 4, fr.x - fr.cw / 2)
    const y = Math.min(m.y + m.h + 4, fr.y + fr.ch / 2) - Math.max(m.y - 4, fr.y - fr.ch / 2)
    return Math.max(0, x) * Math.max(0, y)
  }
  return covered('near') <= covered('far') ? 'near' : 'far'
}

/* ---------- the way to the cup ---------- */

/** How far each square of a hole is from its cup, the way a ball can go: round walls, over bridges, through pipes. */
type Ways = { cols: number; rows: number; far: Float64Array; jumps: Map<number, number> }

/** A hole's map being drawn up: what each square costs to cross (0 is no way at all), a few rows a step. */
type Survey = { hole: Hole; cols: number; rows: number; cost: Float32Array; row: number; ways: Ways | null }

function survey(hole: Hole): Survey {
  const cols = Math.ceil(FIELD_W / CELL)
  const rows = Math.ceil(hole.h / CELL)
  return { hole, cols, rows, cost: new Float32Array(cols * rows), row: 0, ways: null }
}

/** What it costs to cross the square around `p`: water and a drop cost a stroke if the ball stops there, sand slows it. */
function costAt(hole: Hole, p: Vec) {
  const bridged = inAny(hole.bridges, p) || hole.drawbridges.some((d) => inside(d.shape, p))
  const wet = !bridged && (inAny(hole.water, p) || inAny(hole.pits, p))
  if (wet) return 9
  if (!bridged && !onGround(hole, p)) return 0
  return inAny(hole.sand, p) ? 1.6 : 1
}

function surveyRows(sv: Survey, n: number) {
  const end = Math.min(sv.rows, sv.row + n)
  for (; sv.row < end; sv.row++) {
    for (let c = 0; c < sv.cols; c++) {
      sv.cost[sv.row * sv.cols + c] = costAt(sv.hole, { x: (c + 0.5) * CELL, y: (sv.row + 0.5) * CELL })
    }
  }
  if (sv.row < sv.rows) return
  block(sv)
  const jumps = jumpsOf(sv)
  sv.ways = { cols: sv.cols, rows: sv.rows, far: flood(sv, jumps), jumps }
}

/** Mark what stands on the ground as no way through: bars, towers, rocks and bumpers. Flaps and gates are left open. */
function block(sv: Survey) {
  const { hole, cols, rows, cost } = sv
  const shut = (x0: number, y0: number, x1: number, y1: number, hit: (p: Vec) => boolean) => {
    for (let r = Math.max(0, Math.floor(y0 / CELL)); r <= Math.min(rows - 1, Math.floor(y1 / CELL)); r++) {
      for (let c = Math.max(0, Math.floor(x0 / CELL)); c <= Math.min(cols - 1, Math.floor(x1 / CELL)); c++) {
        if (hit({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL })) cost[r * cols + c] = 0
      }
    }
  }
  for (const w of wallsOf(hole)) {
    if (w.edge || w.pass !== undefined) continue
    const reach = w.t + 1
    shut(Math.min(w.a.x, w.b.x) - reach, Math.min(w.a.y, w.b.y) - reach, Math.max(w.a.x, w.b.x) + reach, Math.max(w.a.y, w.b.y) + reach, (p) => {
      const abx = w.b.x - w.a.x
      const aby = w.b.y - w.a.y
      const u = Math.max(0, Math.min(1, ((p.x - w.a.x) * abx + (p.y - w.a.y) * aby) / (abx * abx + aby * aby || 1)))
      return Math.hypot(p.x - (w.a.x + abx * u), p.y - (w.a.y + aby * u)) < reach
    })
  }
  for (const b of [...hole.rocks, ...hole.bumpers]) {
    const reach = b.r + 1
    shut(b.x - reach, b.y - reach, b.x + reach, b.y + reach, (p) => Math.hypot(p.x - b.x, p.y - b.y) < reach)
  }
}

/** The eight ways out of a square, and how far each goes. */
const STEPS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
]

function cellOf(cols: number, rows: number, p: Vec) {
  const c = Math.min(cols - 1, Math.max(0, Math.floor(p.x / CELL)))
  const r = Math.min(rows - 1, Math.max(0, Math.floor(p.y / CELL)))
  return r * cols + c
}

/** Where the ball goes without rolling there: into a pipe's mouth and out of its end, off a ramp and down where it lands. */
function jumpsOf(sv: Survey): Map<number, number> {
  const { hole, cols, rows } = sv
  const jumps = new Map<number, number>()
  for (const pipe of hole.portals) jumps.set(cellOf(cols, rows, pipe.a), cellOf(cols, rows, pipe.b))
  for (const ramp of hole.ramps) {
    const mid = { x: ramp.x + ramp.w / 2, y: ramp.y + ramp.h / 2 }
    const land = { x: mid.x + Math.cos(ramp.dir) * ramp.len, y: mid.y + Math.sin(ramp.dir) * ramp.len }
    jumps.set(cellOf(cols, rows, mid), cellOf(cols, rows, land))
  }
  return jumps
}

/** Out from the cup, nearest first. A pipe's mouth is as far as where it comes out; so is a ramp, from where it lands. */
function flood(sv: Survey, jumps: Map<number, number>): Float64Array {
  const { hole, cols, rows, cost } = sv
  const far = new Float64Array(cols * rows).fill(Infinity)
  const links = new Map<number, number[]>()
  for (const [from, to] of jumps) links.set(to, [...(links.get(to) ?? []), from])
  const heap = new Heap()
  const cup = cellOf(cols, rows, hole.cup)
  far[cup] = 0
  heap.push(0, cup)
  while (heap.size) {
    const [d, i] = heap.pop()
    if (d > far[i]!) continue
    const c = i % cols
    const r = (i - c) / cols
    for (const [dc, dr, len] of STEPS) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      const j = nr * cols + nc
      const cj = cost[j]!
      if (!cj) continue
      // No cutting a corner between two squares that are no way through.
      if (dc && dr && (!cost[r * cols + nc] || !cost[nr * cols + c])) continue
      const nd = d + len * CELL * ((cj + (cost[i]! || cj)) / 2)
      if (nd < far[j]!) {
        far[j] = nd
        heap.push(nd, j)
      }
    }
    for (const j of links.get(i) ?? []) {
      const nd = d + CELL * 2
      if (nd < far[j]!) {
        far[j] = nd
        heap.push(nd, j)
      }
    }
  }
  return far
}

/** Squares still to settle, nearest first. */
class Heap {
  private d: number[] = []
  private i: number[] = []
  get size() {
    return this.d.length
  }
  push(d: number, i: number) {
    let k = this.d.length
    this.d.push(d)
    this.i.push(i)
    while (k > 0) {
      const p = (k - 1) >> 1
      if (this.d[p]! <= d) break
      this.d[k] = this.d[p]!
      this.i[k] = this.i[p]!
      k = p
    }
    this.d[k] = d
    this.i[k] = i
  }
  pop(): [number, number] {
    const top: [number, number] = [this.d[0]!, this.i[0]!]
    const d = this.d.pop()!
    const i = this.i.pop()!
    const n = this.d.length
    if (n) {
      let k = 0
      for (;;) {
        let m = 2 * k + 1
        if (m >= n) break
        if (m + 1 < n && this.d[m + 1]! < this.d[m]!) m += 1
        if (this.d[m]! >= d) break
        this.d[k] = this.d[m]!
        this.i[k] = this.i[m]!
        k = m
      }
      this.d[k] = d
      this.i[k] = i
    }
    return top
  }
}

/** How far a point is from the cup, the way round: its own square, or the nearest of its neighbours plus a step. */
function farAt(ways: Ways, p: Vec) {
  const i = cellOf(ways.cols, ways.rows, p)
  const own = ways.far[i]!
  if (own < Infinity) return own
  const c = i % ways.cols
  const r = (i - c) / ways.cols
  let best = Infinity
  for (const [dc, dr, len] of STEPS) {
    const nc = c + dc
    const nr = r + dr
    if (nc < 0 || nr < 0 || nc >= ways.cols || nr >= ways.rows) continue
    best = Math.min(best, ways.far[nr * ways.cols + nc]! + len * CELL)
  }
  return best < Infinity ? best : 9999
}

/** Points along the way to the cup from `p`, this far along it, as far as the map runs downhill. */
function ahead(ways: Ways, p: Vec, marks: readonly number[]): Vec[] {
  const out: Vec[] = []
  let i = cellOf(ways.cols, ways.rows, p)
  let gone = 0
  let next = 0
  for (let n = 0; n < 400 && next < marks.length; n++) {
    const c = i % ways.cols
    const r = (i - c) / ways.cols
    let to = -1
    let low = ways.far[i]!
    let stepLen = 0
    for (const [dc, dr, len] of STEPS) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nr < 0 || nc >= ways.cols || nr >= ways.rows) continue
      const j = nr * ways.cols + nc
      if (ways.far[j]! < low) {
        low = ways.far[j]!
        to = j
        stepLen = len * CELL
      }
    }
    if (to < 0) {
      // A pipe's mouth or a ramp: the way carries on from where it comes out.
      const jump = ways.jumps.get(i)
      if (jump === undefined || jump === i) break
      const a = i % ways.cols
      const b = jump % ways.cols
      stepLen = Math.hypot(a - b, (i - a) / ways.cols - (jump - b) / ways.cols) * CELL
      to = jump
    }
    i = to
    gone += stepLen
    while (next < marks.length && gone >= marks[next]!) {
      const cc = i % ways.cols
      out.push({ x: (cc + 0.5) * CELL, y: ((i - cc) / ways.cols + 0.5) * CELL })
      next += 1
    }
  }
  // Where the way runs out (the cup, or a pipe's mouth), that is the last point.
  const cc = i % ways.cols
  const end = { x: (cc + 0.5) * CELL, y: ((i - cc) / ways.cols + 0.5) * CELL }
  if (!out.length || Math.hypot(end.x - out[out.length - 1]!.x, end.y - out[out.length - 1]!.y) > CELL) out.push(end)
  return out
}

/* ---------- the pilot ---------- */

type Shot = { angle: number; power: number }

type Plan = {
  hole: number
  stroke: number
  /** Steps until it lets go, and how many of the last of them it spends pulling back. */
  left: number
  pull: number
  /** The game as it will stand when it lets go: every try is played out from there. */
  from: GameState
  tries: Shot[]
  tried: { shot: Shot; score: number }[]
  /** The two best first tries, once it has looked round them: each is followed in `tried` by its four neighbours. */
  pair: Shot[]
  /** The try being played out, carried over from step to step. */
  trying: { shot: Shot; game: GameState; steps: number } | null
  refined: boolean
  /** The shot as it will be taken, wobble and all, once it has chosen. */
  shot: (Shot & { shank: number }) | null
  /** Where it is looking: the way ahead, for its eye and for the screen. */
  look: Vec
  /** What a try costs on top of where it ends: a shot that went in the water from here before is off the table. */
  penalty: (shot: Shot) => number
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a)
}

/** A person's scatter: most often a little either way, now and then more. */
function wobble() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
}

const MARKS = [12, 30, 60, 100, 150]

function clampPower(p: number) {
  return Math.min(1, Math.max(0.1, p))
}

/**
 * The shots worth trying from `from`: at points along the way to the cup,
 * near and far; a fan either side of it, for a way that bends round a corner
 * or a line the map can't see; up a ramp the ball is on or just short of, fast
 * enough to take off; and straight at the cup, when it's near.
 */
function firstTries(ways: Ways, from: GameState): { tries: Shot[]; look: Vec } {
  const b = from.ball
  const hole = currentHole(from)
  const points = ahead(ways, b, MARKS)
  const tries: Shot[] = []
  for (const p of points) {
    const d = Math.hypot(p.x - b.x, p.y - b.y)
    if (d < 3) continue
    const angle = Math.atan2(p.y - b.y, p.x - b.x)
    // As hard as the flat would need, and a good deal harder, for a way that climbs.
    for (const turn of [0, -0.08, 0.08]) {
      for (const k of [1, 1.45]) tries.push({ angle: angle + turn, power: clampPower(powerForDistance(d * k)) })
    }
  }
  const way = points.find((p) => Math.hypot(p.x - b.x, p.y - b.y) >= 3)
  const heading = way ? Math.atan2(way.y - b.y, way.x - b.x) : -Math.PI / 2
  for (const turn of [-1.2, -0.7, -0.35, 0.35, 0.7, 1.2]) {
    for (const power of [0.25, 0.55, 0.85]) tries.push({ angle: heading + turn, power })
  }
  for (const rp of hole.ramps) {
    const near = b.x > rp.x - 8 && b.x < rp.x + rp.w + 8 && b.y > rp.y - 8 && b.y < rp.y + rp.h + 8
    if (!near) continue
    // Straight up it, and, from a ball off to one side of it, angled in at its middle, if that is still near enough straight to take off.
    const into = Math.atan2(rp.y + rp.h / 2 - b.y, rp.x + rp.w / 2 - b.x)
    const angles = Math.cos(into - rp.dir) > 0.86 ? [rp.dir, into] : [rp.dir]
    for (const angle of angles) {
      for (const k of [1.12, 1.3, 1.55]) tries.push({ angle, power: clampPower(powerForSpeed((rp.min ?? 60) * k)) })
    }
  }
  const cup = hole.cup
  const toCup = Math.hypot(cup.x - b.x, cup.y - b.y)
  if (toCup < 80 && farAt(ways, b) < 100) {
    const angle = Math.atan2(cup.y - b.y, cup.x - b.x)
    for (const turn of [0, -0.03, 0.03]) {
      for (const k of [1, 1.2, 1.45]) tries.push({ angle: angle + turn, power: clampPower(powerForDistance(toCup * k)) })
    }
  }
  return { tries, look: points[Math.min(1, points.length - 1)] ?? b }
}

const REFINES = 8

const NEIGHBOURS = [
  [-0.035, 1],
  [0.035, 1],
  [0, 0.94],
  [0, 1.06],
] as const

/** Around the two best so far, a touch either way and a touch harder and softer. */
function refineTries(tried: Plan['tried']): { pair: Shot[]; tries: Shot[] } {
  const pair = [...tried]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((t) => t.shot)
  const tries: Shot[] = []
  for (const shot of pair) {
    for (const [turn, k] of NEIGHBOURS) tries.push({ angle: shot.angle + turn, power: clampPower(shot.power * k) })
  }
  return { pair, tries: tries.slice(0, REFINES) }
}

/** How a played-out try left things: how far from the cup, the way round, and far below zero for in. */
function judge(ways: Ways, from: GameState, g: GameState) {
  if (g.phase === 'sunk') return -1000
  if (g.phase === 'splash') return farAt(ways, from.ball) + STROKE_COST
  return farAt(ways, g.ball) + (g.inSand ? 8 : 0)
}

/** Play tries out from where the pilot will let go, up to `budget` steps of them, carrying one over if it runs past. */
function study(p: Plan, ways: Ways, dt: number, budget: number) {
  while (budget > 0) {
    if (!p.trying) {
      const next = p.tries[p.tried.length]
      if (!next) {
        if (p.refined) return
        p.refined = true
        const round = refineTries(p.tried)
        p.pair = round.pair
        p.tries.push(...round.tries)
        continue
      }
      p.trying = { shot: next, game: shoot({ ...p.from, aim: next.angle, power: next.power, aiming: 'drag' }), steps: 0 }
    }
    const t = p.trying
    for (; budget > 0 && t.steps < TRY_STEPS && t.game.phase === 'roll'; t.steps++, budget--) t.game = tick(t.game, dt)
    if (t.game.phase === 'roll' && t.steps < TRY_STEPS) return
    p.tried.push({ shot: t.shot, score: judge(ways, p.from, t.game) + p.penalty(t.shot) })
    p.trying = null
    // However quickly a try ends, it counts for a step, so a run of them can't spin.
    budget -= 1
  }
}

/** The quickest way round from angle `a` to `b`. */
function turnToward(a: number, b: number, most: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + Math.max(-most, Math.min(most, d))
}

/** A shot as it was played, from where. */
type Played = { hole: number; x: number; y: number; angle: number; power: number }

export function makeSim(): Sim<Run> {
  let sv: Survey | null = null
  let plan: Plan | null = null
  /** The last shot, and the shots this round that put the ball in the water or off the ground. */
  let last: Played | null = null
  let burnt: Played[] = []

  /** Whether a shot from `from` is one that went wrong from there before. */
  const wentWrong = (hole: number, from: Vec, shot: Shot) =>
    burnt.some(
      (b) =>
        b.hole === hole &&
        Math.hypot(b.x - from.x, b.y - from.y) < 2 &&
        Math.abs(Math.atan2(Math.sin(b.angle - shot.angle), Math.cos(b.angle - shot.angle))) < 0.09 &&
        Math.abs(b.power - shot.power) < b.power * 0.15,
    )

  const newPlan = (g: GameState, ways: Ways, dt: number): Plan => {
    // It lets go after a look at the lie and a pull, so it works out how the game will stand by then.
    const pull = Math.round(rand(0.45, 0.7) / dt)
    const left = pull + Math.round(rand(1.3, 1.9) / dt)
    let from = g
    for (let n = 0; n < left; n++) from = tick(from, dt)
    const { tries, look } = firstTries(ways, from)
    // It looked good in its head the last time too.
    const penalty = (shot: Shot) => (wentWrong(g.holeIndex, from.ball, shot) ? 10_000 : 0)
    return { hole: g.holeIndex, stroke: g.strokes, left, pull, from, tries, tried: [], pair: [], trying: null, refined: false, shot: null, look, penalty }
  }

  const choose = (p: Plan, ways: Ways) => {
    const tried = p.tried
    let best = tried.reduce((a, b) => (b.score < a.score ? b : a), tried[0] ?? { shot: p.tries[0]!, score: 0 })
    // Close in, a person takes more care.
    const careful = best.score < 20 || farAt(ways, p.from.ball) < 30
    // Further out, of the two best, the one whose worst with a touch either way on it is least bad: a
    // carry over water that only works dead on loses to a shot that lands well whatever the hand does.
    const firsts = tried.length - p.pair.length * NEIGHBOURS.length
    if (!careful && p.pair.length === 2 && firsts >= 0 && tried.length === p.tries.length) {
      const worst = p.pair.map((shot, i) => {
        const own = tried.find((t) => t.shot === shot)?.score ?? Infinity
        const round = tried.slice(firsts + i * NEIGHBOURS.length, firsts + (i + 1) * NEIGHBOURS.length)
        return { shot, score: own, worst: Math.max(own, ...round.map((t) => t.score)) }
      })
      const safer = worst[0]!.worst <= worst[1]!.worst ? worst[0]! : worst[1]!
      best = { shot: safer.shot, score: safer.score }
    }
    const power = clampPower(best.shot.power * (1 + wobble() * (careful ? 0.02 : 0.035)))
    p.shot = { angle: best.shot.angle, power, shank: wobble() * (careful ? 0.012 : 0.02) }
  }

  const pilot = (g: GameState, dt: number): GameState => {
    const ways = sv?.hole === currentHole(g) ? sv.ways : null
    // Still looking the hole over.
    if (!ways) return g
    if (g.strokes >= PICK_UP) {
      plan = null
      return g.holeIndex + 1 < COURSE.length ? jumpToHole(g, g.holeIndex + 1) : { ...g, phase: 'gameover', t: 0 }
    }
    if (!plan || plan.hole !== g.holeIndex || plan.stroke !== g.strokes) {
      // Back where the last shot was played from: it went in the water, or off the ground.
      if (last && last.hole === g.holeIndex && Math.hypot(g.ball.x - last.x, g.ball.y - last.y) < 1.5) burnt.push(last)
      last = null
      plan = newPlan(g, ways, dt)
    }
    const p = plan
    if (p.left === 0) {
      if (!p.shot) choose(p, ways)
      const s = p.shot!
      plan = null
      last = { hole: g.holeIndex, x: g.ball.x, y: g.ball.y, angle: s.angle, power: s.power }
      const lined = setDragAim(g, -Math.cos(s.angle) * s.power * MAX_DRAG, -Math.sin(s.angle) * s.power * MAX_DRAG)
      return shoot(lined, s.shank)
    }
    p.left -= 1
    if (p.left >= p.pull) {
      // Studying the lie: shots played out in its head, and its eye along the way ahead.
      study(p, ways, dt, STUDY_PER_STEP)
      const eye = Math.atan2(p.look.y - g.ball.y, p.look.x - g.ball.x)
      return { ...g, aim: turnToward(g.aim, eye, 3 * dt) }
    }
    // Pulling back, easing out toward the pull it wants.
    if (!p.shot) choose(p, ways)
    const s = p.shot!
    const u = 1 - p.left / p.pull
    const pw = s.power * (1 - (1 - u) * (1 - u))
    return setDragAim({ ...g, aim: turnToward(g.aim, s.angle, 6 * dt) }, -Math.cos(s.angle) * pw * MAX_DRAG, -Math.sin(s.angle) * pw * MAX_DRAG)
  }

  /** The screen follows the ball, a little ahead of it, and the fly-over at a hole's start. */
  const follow = (view: View, g: GameState, dt: number, w: number, h: number): View => {
    const f = fieldFrame(g.stageW, g.stageH, currentHole(g).h)
    const k = Math.min(1, dt * 3)
    if (g.phase === 'intro') return { along: g.cam + f.vis / 2, across: view.across + (50 - view.across) * k }
    const b = g.ball
    let lead: Vec = { x: 0, y: 0 }
    if (g.phase === 'roll') lead = { x: b.vx * 0.25, y: b.vy * 0.25 }
    else if (g.phase === 'aim' && plan) lead = { x: (plan.look.x - b.x) * 0.5, y: (plan.look.y - b.y) * 0.5 }
    const reach = Math.hypot(lead.x, lead.y)
    if (reach > 22) lead = { x: (lead.x / reach) * 22, y: (lead.y / reach) * 22 }
    const half = (ACROSS * Math.max(w, h)) / Math.min(w, h) / 2
    const along = view.along + (b.y + lead.y - view.along) * k
    const across = view.across + (b.x + lead.x - view.across) * k
    // Never so far behind that the ball nears the edge of the screen.
    return {
      along: Math.min(Math.max(along, b.y - half * 0.55), b.y + half * 0.55),
      across: Math.min(Math.max(across, b.x - ACROSS * 0.3), b.x + ACROSS * 0.3),
    }
  }

  return {
    start: (w, h) => {
      sv = null
      plan = null
      last = null
      burnt = []
      const [zw, zh] = stageFor(w, h)
      const game = startGame(createInitialState(zw, zh))
      const f = fieldFrame(zw, zh, currentHole(game).h)
      return { game, view: { along: game.cam + f.vis / 2, across: 50 } }
    },
    step: (run, dt, w, h) => {
      const hole = currentHole(run.game)
      if (sv?.hole !== hole) sv = survey(hole)
      if (!sv.ways) surveyRows(sv, ROWS_PER_STEP)
      const game = tick(run.game.phase === 'aim' ? pilot(run.game, dt) : run.game, dt)
      if (game.phase !== 'aim') plan = null
      return { game, view: follow(run.view, game, dt, w, h) }
    },
    over: (run) => run.game.phase === 'gameover',
    // The course as the game draws it, minus what is written over it for a player: the card
    // at each hole's start, the word for a splash and the result of the hole.
    render: (ctx, run, w, h) => {
      const g = run.game
      const mapSide = mapCorner(framing(run, w, h))
      renderGame(ctx, { ...g, t: g.phase === 'intro' ? 0 : g.t, popup: null, floaters: [], mapSide }, w, h)
    },
    // A new screen size keeps the window where it was, centred on the same stretch of the hole.
    resize: (run, w, h) => {
      const [zw, zh] = stageFor(w, h)
      const hole = currentHole(run.game)
      const was = fieldFrame(run.game.stageW, run.game.stageH, hole.h)
      const now = fieldFrame(zw, zh, hole.h)
      const keep = (cam: number) => camFor(now, cam + was.vis / 2)
      return { ...run, game: { ...resizeState(run.game, zw, zh), cam: keep(run.game.cam), look: keep(run.game.look) } }
    },
    // Drawn big enough that the hole fills the screen ACROSS units wide, and only the part round the ball shows.
    zoom: zoomFor,
    focus: (run, zw, zh) => {
      const fr = framing(run, zw, zh)
      return { x: fr.x, y: fr.y }
    },
    // The still: the ball in the air off the ramp on Lily Pond, over the water (it goes on into the cup).
    poster: { seed: 1, at: 4.92 },
    hold: 2,
  }
}

export function createPreview() {
  return runPreview(makeSim())
}
