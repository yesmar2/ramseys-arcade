import { getPersonalBest } from '../../lib/personalBest'
import { sfx } from '../../lib/sound'

export type Phase = 'menu' | 'playing' | 'reveal' | 'gameover'

export type Point = { x: number; y: number }

export type ShapeKind = 'triangle' | 'quad' | 'pentagon'

export type Shape = {
  kind: ShapeKind
  /** Clockwise or counter-clockwise vertex ring. */
  points: Point[]
  /** Scale used for scoring thresholds. */
  size: number
  hue: number
  sat: number
}

export type ShotGrade = 'perfect' | 'great' | 'close' | 'far' | 'miss'

export type RoundResult = {
  guess: Point | null
  center: Point
  dist: number
  points: number
  grade: ShotGrade
  timedOut: boolean
}

export type Floater = {
  id: number
  x: number
  y: number
  text: string
  life: number
}

export type Snapshot = {
  score: number
  best: number
  phase: Phase
  round: number
  totalRounds: number
  timeLeft: number
  lastPoints: number
  lastGrade: ShotGrade | null
  lastDist: number | null
  avgAccuracy: number
}

export type GameState = {
  phase: Phase
  score: number
  best: number
  round: number
  timeLeft: number
  shape: Shape | null
  result: RoundResult | null
  floaters: Floater[]
  flash: number
  scale: number
  stageW: number
  stageH: number
  accuracySum: number
  finishedRounds: number
}

export const DESIGN_LONG = 720
export const DESIGN_SHORT = 540
export const DESIGN_W = DESIGN_LONG
export const DESIGN_H = DESIGN_SHORT
export const TOTAL_ROUNDS = 5
export const ROUND_SECS = 5

/** Same 4×3 field, rotated so the long side matches the screen. */
export function deadCenterLayout(portrait: boolean) {
  return portrait
    ? { aspectW: 3, aspectH: 4 }
    : { aspectW: 4, aspectH: 3 }
}

function designScale(w: number, h: number) {
  const portrait = h > w
  const dw = portrait ? DESIGN_SHORT : DESIGN_LONG
  const dh = portrait ? DESIGN_LONG : DESIGN_SHORT
  return Math.min(w / dw, h / dh) || 1
}

const MAX_ROUND_SCORE = 1000

function loadBest() {
  return getPersonalBest('dead-center')
}

function saveBest(_score: number) {}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Area centroid (shoelace) — the “balance point” of any simple polygon. */
export function polygonCentroid(pts: Point[]): Point {
  const n = pts.length
  if (n === 0) return { x: 0, y: 0 }
  if (n === 1) return { ...pts[0] }
  if (n === 2) {
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
  }

  let area2 = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const cross = pts[i].x * pts[j].y - pts[j].x * pts[i].y
    area2 += cross
    cx += (pts[i].x + pts[j].x) * cross
    cy += (pts[i].y + pts[j].y) * cross
  }
  if (Math.abs(area2) < 1e-6) {
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / n,
      y: pts.reduce((s, p) => s + p.y, 0) / n,
    }
  }
  return { x: cx / (3 * area2), y: cy / (3 * area2) }
}

export function shapeCentroid(shape: Shape): Point {
  return polygonCentroid(shape.points)
}

function polygonArea(pts: Point[]) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return Math.abs(a) / 2
}

function sideLengths(pts: Point[]) {
  return [
    dist(pts[0], pts[1]),
    dist(pts[1], pts[2]),
    dist(pts[2], pts[0]),
  ]
}

/** Interior angles in degrees, same order as vertices. */
function triangleAngles(pts: Point[]) {
  const ab = dist(pts[0], pts[1])
  const bc = dist(pts[1], pts[2])
  const ca = dist(pts[2], pts[0])
  const angle = (opp: number, x: number, y: number) => {
    const cos = (x * x + y * y - opp * opp) / (2 * x * y)
    return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI)
  }
  return [angle(bc, ab, ca), angle(ca, ab, bc), angle(ab, ca, bc)]
}

/** Prefer skinny or obtuse — equilateral-ish shapes are too easy to eye. */
function isTrickyEnough(pts: Point[]) {
  const angles = triangleAngles(pts)
  const minA = Math.min(...angles)
  const maxA = Math.max(...angles)
  const sorted = sideLengths(pts).sort((x, y) => x - y)
  const a = sorted[0]
  const b = sorted[1]
  const skinny = minA <= 28 || b / a >= 1.85
  const obtuse = maxA >= 105
  return skinny || obtuse
}

function shapeSize(pts: Point[], center: Point) {
  const avg = pts.reduce((s, p) => s + dist(p, center), 0) / Math.max(1, pts.length)
  return avg || 40
}

const SHAPE_HUES = [198, 172, 38, 348, 272, 18, 128]

function finishShape(kind: ShapeKind, pts: Point[], round: number): Shape {
  const center = polygonCentroid(pts)
  const kindShift = kind === 'triangle' ? 0 : kind === 'quad' ? 2 : 4
  const hue =
    SHAPE_HUES[(kindShift + round) % SHAPE_HUES.length] + (Math.random() - 0.5) * 18
  const sat = 48 + Math.random() * 22
  return {
    kind,
    points: pts,
    size: shapeSize(pts, center),
    hue,
    sat,
  }
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
  return arr
}

type Edge = 0 | 1 | 2 | 3

/** t=0..1 along an inset screen edge (0 top, 1 right, 2 bottom, 3 left). */
function edgePoint(edge: Edge, t: number, w: number, h: number, pad: number): Point {
  const x0 = pad
  const y0 = pad
  const x1 = w - pad
  const y1 = h - pad
  const u = 0.12 + Math.max(0, Math.min(1, t)) * 0.76
  if (edge === 0) return { x: x0 + (x1 - x0) * u, y: y0 }
  if (edge === 1) return { x: x1, y: y0 + (y1 - y0) * u }
  if (edge === 2) return { x: x0 + (x1 - x0) * u, y: y1 }
  return { x: x0, y: y0 + (y1 - y0) * u }
}

type TriangleFamily = 'right' | 'obtuse' | 'isosceles' | 'skinny' | 'scalene'

function pickTriangleFamily(): TriangleFamily {
  const families: TriangleFamily[] = ['right', 'obtuse', 'isosceles', 'skinny', 'scalene']
  return families[Math.floor(Math.random() * families.length)]
}

function pickShapeKind(): ShapeKind {
  const kinds: ShapeKind[] = ['triangle', 'quad', 'pentagon']
  return kinds[Math.floor(Math.random() * kinds.length)]
}

/** Map s∈[0,1) around the inset rectangle perimeter (clockwise from top-left). */
function pointOnPerimeter(s: number, w: number, h: number, pad: number): Point {
  const x0 = pad
  const y0 = pad
  const x1 = w - pad
  const y1 = h - pad
  const bw = x1 - x0
  const bh = y1 - y0
  const peri = 2 * (bw + bh)
  let d = ((s % 1) + 1) % 1 * peri
  if (d <= bw) return { x: x0 + d, y: y0 }
  d -= bw
  if (d <= bh) return { x: x1, y: y0 + d }
  d -= bh
  if (d <= bw) return { x: x1 - d, y: y1 }
  d -= bw
  return { x: x0, y: y1 - d }
}

/** n distinct points in boundary order → simple convex-ish polygon spanning the field. */
function perimeterPolygon(n: number, w: number, h: number, pad: number): Point[] {
  const gaps = Array.from({ length: n }, () => 0.12 + Math.random())
  const sum = gaps.reduce((a, b) => a + b, 0)
  const norm = gaps.map((g) => g / sum)
  let s = Math.random()
  const pts: Point[] = []
  for (const g of norm) {
    pts.push(pointOnPerimeter(s, w, h, pad))
    s += g
  }
  return pts
}

/**
 * Build a large on-screen shape by pinning vertices to the playfield.
 * Triangles, quads, and pentagons — picked at random each round.
 */
function makeShape(w: number, h: number, round: number): Shape {
  const pad = Math.min(w, h) * 0.1
  const minArea = w * h * 0.14
  const kind = pickShapeKind()

  for (let i = 0; i < 40; i++) {
    let pts: Point[]
    if (kind === 'triangle') {
      // Mix handcrafted families with random perimeter triangles
      pts =
        Math.random() < 0.45
          ? perimeterPolygon(3, w, h, pad)
          : triangleForFamily(pickTriangleFamily(), w, h, pad)
    } else if (kind === 'quad') {
      pts = perimeterPolygon(4, w, h, pad)
    } else {
      pts = perimeterPolygon(5, w, h, pad)
    }
    const okArea = polygonArea(pts) >= minArea
    const okTrick = kind === 'triangle' ? isTrickyEnough(pts) : true
    if (okArea && okTrick) return finishShape(kind, pts, round)
  }

  if (kind === 'quad') return finishShape('quad', perimeterPolygon(4, w, h, pad), round)
  if (kind === 'pentagon') return finishShape('pentagon', perimeterPolygon(5, w, h, pad), round)

  return finishShape(
    'triangle',
    [
      { x: pad, y: pad },
      { x: w - pad, y: pad },
      { x: pad, y: pad + (h - 2 * pad) * 0.42 },
    ],
    round,
  )
}

function triangleForFamily(family: TriangleFamily, w: number, h: number, pad: number): Point[] {
  const t = () => Math.random()

  if (family === 'right') {
    // Uneven legs — one short, one long — so the centroid sits off the visual middle.
    const corner = Math.floor(Math.random() * 4) as Edge
    const x0 = pad
    const y0 = pad
    const x1 = w - pad
    const y1 = h - pad
    const long = 0.72 + t() * 0.2
    const short = 0.28 + t() * 0.22
    const swap = Math.random() < 0.5
    const a = swap ? long : short
    const b = swap ? short : long
    const corners: Point[][] = [
      [
        { x: x0, y: y0 },
        { x: x0 + (x1 - x0) * a, y: y0 },
        { x: x0, y: y0 + (y1 - y0) * b },
      ],
      [
        { x: x1, y: y0 },
        { x: x1, y: y0 + (y1 - y0) * a },
        { x: x1 - (x1 - x0) * b, y: y0 },
      ],
      [
        { x: x1, y: y1 },
        { x: x1 - (x1 - x0) * a, y: y1 },
        { x: x1, y: y1 - (y1 - y0) * b },
      ],
      [
        { x: x0, y: y1 },
        { x: x0, y: y1 - (y1 - y0) * a },
        { x: x0 + (x1 - x0) * b, y: y1 },
      ],
    ]
    return corners[corner]
  }

  if (family === 'isosceles') {
    const vertical = Math.random() < 0.5
    if (vertical) {
      const apex = edgePoint(0, 0.35 + t() * 0.3, w, h, pad)
      const side = Math.random() < 0.5
      const left = edgePoint(2, side ? 0.02 + t() * 0.12 : 0.55 + t() * 0.18, w, h, pad)
      const right = edgePoint(2, side ? 0.22 + t() * 0.14 : 0.78 + t() * 0.16, w, h, pad)
      return Math.random() < 0.5
        ? [apex, left, right]
        : [
            edgePoint(2, 0.35 + t() * 0.3, w, h, pad),
            edgePoint(0, side ? 0.02 + t() * 0.12 : 0.55 + t() * 0.18, w, h, pad),
            edgePoint(0, side ? 0.22 + t() * 0.14 : 0.78 + t() * 0.16, w, h, pad),
          ]
    }
    const apex = edgePoint(3, 0.35 + t() * 0.3, w, h, pad)
    const side = Math.random() < 0.5
    return Math.random() < 0.5
      ? [
          apex,
          edgePoint(1, side ? 0.02 + t() * 0.12 : 0.55 + t() * 0.18, w, h, pad),
          edgePoint(1, side ? 0.22 + t() * 0.14 : 0.78 + t() * 0.16, w, h, pad),
        ]
      : [
          edgePoint(1, 0.35 + t() * 0.3, w, h, pad),
          edgePoint(3, side ? 0.02 + t() * 0.12 : 0.55 + t() * 0.18, w, h, pad),
          edgePoint(3, side ? 0.22 + t() * 0.14 : 0.78 + t() * 0.16, w, h, pad),
        ]
  }

  if (family === 'obtuse' || family === 'skinny') {
    const corner = Math.floor(Math.random() * 4) as Edge
    const near = 0.04 + t() * 0.14
    const far = 0.62 + t() * 0.3
    if (corner === 0) {
      return [
        edgePoint(0, near, w, h, pad),
        edgePoint(3, near + t() * 0.1, w, h, pad),
        Math.random() < 0.5 ? edgePoint(2, far, w, h, pad) : edgePoint(1, far, w, h, pad),
      ]
    }
    if (corner === 1) {
      return [
        edgePoint(0, 1 - near, w, h, pad),
        edgePoint(1, near + t() * 0.1, w, h, pad),
        Math.random() < 0.5 ? edgePoint(2, 1 - far, w, h, pad) : edgePoint(3, far, w, h, pad),
      ]
    }
    if (corner === 2) {
      return [
        edgePoint(2, 1 - near, w, h, pad),
        edgePoint(1, 1 - near - t() * 0.1, w, h, pad),
        Math.random() < 0.5 ? edgePoint(0, 1 - far, w, h, pad) : edgePoint(3, 1 - far, w, h, pad),
      ]
    }
    return [
      edgePoint(2, near, w, h, pad),
      edgePoint(3, 1 - near - t() * 0.1, w, h, pad),
      Math.random() < 0.5 ? edgePoint(0, far, w, h, pad) : edgePoint(1, 1 - far, w, h, pad),
    ]
  }

  const edges = shuffle<Edge>([0, 1, 2, 3]).slice(0, 3)
  return edges.map((edge) => edgePoint(edge, t(), w, h, pad))
}

function gradeFor(distPx: number, ratio: number, timedOut: boolean): ShotGrade {
  if (timedOut) return 'miss'
  // Perfect is absolute — within ~2.5px of the true center
  if (distPx <= 2.5) return 'perfect'
  if (ratio >= 0.7) return 'great'
  if (ratio >= 0.4) return 'close'
  return 'far'
}

function scoreGuess(shape: Shape, guess: Point | null, timeLeft: number): RoundResult {
  const center = shapeCentroid(shape)
  const timedOut = guess == null
  const d = timedOut ? shape.size * 2 : dist(guess, center)
  // Tighter threshold = harder to rack up points
  const threshold = Math.max(12, shape.size * 0.55)
  const ratio = Math.max(0, Math.min(1, 1 - d / threshold))
  let points = Math.round(MAX_ROUND_SCORE * ratio * ratio)
  // Perfect bonus only when essentially dead-on
  if (!timedOut && d <= 2) points = Math.min(MAX_ROUND_SCORE + 100, points + 100)
  else if (!timedOut && ratio > 0.4) {
    points += Math.round(70 * (timeLeft / ROUND_SECS) * ratio)
  }
  return {
    guess,
    center,
    dist: d,
    points,
    grade: gradeFor(d, ratio, timedOut),
    timedOut,
  }
}

export function createInitialState(w = DESIGN_W, h = DESIGN_H): GameState {
  return {
    phase: 'menu',
    score: 0,
    best: loadBest(),
    round: 1,
    timeLeft: ROUND_SECS,
    shape: null,
    result: null,
    floaters: [],
    flash: 0,
    scale: designScale(w, h),
    stageW: w,
    stageH: h,
    accuracySum: 0,
    finishedRounds: 0,
  }
}

export function resizeState(state: GameState, w: number, h: number): GameState {
  const scale = designScale(w, h)
  if (state.phase === 'playing' && state.shape) {
    return {
      ...state,
      scale,
      stageW: w,
      stageH: h,
      shape: makeShape(w, h, state.round),
      result: null,
    }
  }
  return { ...state, scale, stageW: w, stageH: h }
}

function beginRound(state: GameState, round: number): GameState {
  return {
    ...state,
    phase: 'playing',
    round,
    timeLeft: ROUND_SECS,
    shape: makeShape(state.stageW, state.stageH, round),
    result: null,
    floaters: [],
  }
}

export function startGame(prev: GameState): GameState {
  const base = createInitialState(prev.stageW, prev.stageH)
  return beginRound(
    {
      ...base,
      best: Math.max(prev.best, loadBest()),
    },
    1,
  )
}

function finishRound(state: GameState, result: RoundResult): GameState {
  if (result.timedOut || result.grade === 'miss') sfx('miss')
  else if (result.grade === 'perfect') sfx('perfect')
  else if (result.grade === 'great') sfx('good')
  else sfx('tap')

  const threshold = Math.max(12, (state.shape?.size ?? 40) * 0.55)
  const accuracy = result.timedOut
    ? 0
    : Math.max(0, Math.min(1, 1 - result.dist / threshold))

  return {
    ...state,
    phase: 'reveal',
    result,
    score: state.score + result.points,
    floaters: [],
    flash: result.grade === 'perfect' ? 0.4 : result.timedOut ? 0.15 : 0.22,
    accuracySum: state.accuracySum + accuracy,
    finishedRounds: state.finishedRounds + 1,
  }
}

export function aim(state: GameState, x: number, y: number): GameState {
  if (state.phase !== 'playing' || !state.shape) return state
  const pad = 8 * state.scale
  const guess = {
    x: Math.max(pad, Math.min(state.stageW - pad, x)),
    y: Math.max(pad, Math.min(state.stageH - pad, y)),
  }
  return finishRound(state, scoreGuess(state.shape, guess, state.timeLeft))
}

export function tick(state: GameState, dt: number): GameState {
  let s = { ...state }
  s.flash = Math.max(0, s.flash - dt * 1.8)
  s.floaters = s.floaters
    .map((f) => ({
      ...f,
      y: f.y - 26 * s.scale * dt,
      life: f.life - dt * 1.1,
    }))
    .filter((f) => f.life > 0)

  if (s.phase === 'playing') {
    s.timeLeft = Math.max(0, s.timeLeft - dt)
    if (s.timeLeft <= 0 && s.shape) {
      return finishRound(s, scoreGuess(s.shape, null, 0))
    }
    return s
  }

  return s
}

export function nextRound(state: GameState): GameState {
  if (state.phase !== 'reveal') return state
  if (state.round >= TOTAL_ROUNDS) {
    const best = Math.max(state.best, state.score)
    if (best !== state.best) saveBest(best)
    return {
      ...state,
      phase: 'gameover',
      best,
      shape: null,
      result: null,
    }
  }
  return beginRound(state, state.round + 1)
}

export function toSnapshot(s: GameState): Snapshot {
  const avg =
    s.finishedRounds > 0 ? Math.round((s.accuracySum / s.finishedRounds) * 100) : 0
  return {
    score: s.score,
    best: s.best,
    phase: s.phase,
    round: s.round,
    totalRounds: TOTAL_ROUNDS,
    timeLeft: Math.ceil(Math.max(0, s.timeLeft)),
    lastPoints: s.result?.points ?? 0,
    lastGrade: s.result?.grade ?? null,
    lastDist: s.result && !s.result.timedOut ? s.result.dist : null,
    avgAccuracy: avg,
  }
}
