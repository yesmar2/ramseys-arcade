import { LEVELS } from './glasses'
import { HALF_ROUNDS, ROUNDS, type DayPlan } from './plan'
import {
  dayScore,
  fillPercent,
  formatOff,
  formatScore,
  markFor,
  pourScore,
  sharePercent,
  teamFor,
  tierFor,
  type Mark,
  type Team,
  type Tier,
} from './score'

/*
 * A run of Half Full: four glasses to fill half full, then a jug's worth to share fairly between two.
 *
 * Each round: the glass comes in empty (the split starts part-shared), the player moves the level, and
 * locks it with "That's half". The lock waits until the glass has been in 1.2 s and the level has sat
 * still 0.3 s, so a drag that ends over the button, or a tap that lands as the glass arrives, never
 * locks a pour by accident. At 30 s the pour locks where it stands. Then the Tip: the glass pours into
 * a measuring jug that says how full it really was. The next glass waits for a tap.
 */

export type Phase = 'menu' | 'pour' | 'tip' | 'shown' | 'done'

export type PourResult = {
  kind: 'half' | 'split'
  /** The locked level (the first glass's, for the split). */
  level: number
  /** How full it was, in percent (the first glass's share, for the split). */
  percent: number
  score: number
  /** Locked by the clock, not the player. */
  auto: boolean
}

export type GameState = {
  phase: Phase
  plan: DayPlan
  /** 0..3 the half glasses, 4 the split. */
  round: number
  /** The level, an integer 0..1000 (the split: the first glass's, lo..hi). */
  level: number
  /** The level before rounding, as a drag carries it. */
  levelF: number
  /** Seconds since this round's glass came in. */
  roundT: number
  /** roundT at the level's last change. */
  lastMoveT: number
  /** How fast the level is moving, smoothed, in levels a second (+ filling). */
  flow: number
  /** Level change since the last tick, for `flow`. */
  pending: number
  results: PourResult[]
  /** Seconds into the Tip. */
  tipT: number
  /** A replay of a day already played, or a past day's: never the day's result. */
  practice: boolean
}

/** The lock waits this long after a glass comes in... */
export const ARM_AFTER = 1.2
/** ...and this long after the level last moved. */
export const SETTLE = 0.3
/** A ring shows round the lock from here... */
export const RING_AT = 20
/** ...and the pour locks itself here. */
export const AUTO_LOCK = 30
/** The Tip, pour-out to stamp. */
export const TIP_TIME = 2.6

export function isSplitRound(round: number): boolean {
  return round >= HALF_ROUNDS
}

export function createState(plan: DayPlan, practice = false): GameState {
  return {
    phase: 'menu',
    plan,
    round: 0,
    level: 0,
    levelF: 0,
    roundT: 0,
    lastMoveT: -1,
    flow: 0,
    pending: 0,
    results: [],
    tipT: 0,
    practice,
  }
}

function beginRound(s: GameState) {
  const start = isSplitRound(s.round) ? s.plan.split.start : 0
  s.level = start
  s.levelF = start
  s.roundT = 0
  s.lastMoveT = -1
  s.flow = 0
  s.pending = 0
  s.tipT = 0
  s.phase = 'pour'
}

/** Start a run, or carry one on from the pours already locked. */
export function startRun(plan: DayPlan, practice: boolean, done: readonly PourResult[] = []): GameState {
  const s = createState(plan, practice)
  s.results = done.slice(0, ROUNDS)
  if (s.results.length >= ROUNDS) {
    s.round = ROUNDS - 1
    s.phase = 'done'
    return s
  }
  s.round = s.results.length
  beginRound(s)
  return s
}

/** The level's range this round. */
export function levelRange(s: GameState): [number, number] {
  return isSplitRound(s.round) ? [s.plan.split.lo, s.plan.split.hi] : [0, LEVELS]
}

/** Move the level by `delta` (fractions carry over, for a drag). */
export function moveLevel(s: GameState, delta: number) {
  if (s.phase !== 'pour' || delta === 0) return
  const [lo, hi] = levelRange(s)
  s.levelF = Math.min(hi, Math.max(lo, s.levelF + delta))
  const next = Math.round(s.levelF)
  if (next !== s.level) {
    s.pending += next - s.level
    s.level = next
    s.lastMoveT = s.roundT
  }
}

/** Move the level by whole steps (a nudge or a key), dropping any fraction a drag left. */
export function stepLevel(s: GameState, steps: number) {
  if (s.phase !== 'pour') return
  s.levelF = s.level
  moveLevel(s, steps)
}

/** Whether "That's half" would lock now. */
export function canLock(s: GameState): boolean {
  if (s.phase !== 'pour') return false
  if (s.roundT < ARM_AFTER || s.roundT - s.lastMoveT < SETTLE) return false
  return isSplitRound(s.round) || s.level > 0
}

/** What a level scores on this round. */
export function judge(s: Pick<GameState, 'plan' | 'round'>, level: number, auto = false): PourResult {
  if (isSplitRound(s.round)) {
    const percent = sharePercent(s.plan.split, level)
    return { kind: 'split', level, percent, score: pourScore(percent), auto }
  }
  const percent = fillPercent(s.plan.pours[s.round]!, level)
  return { kind: 'half', level, percent, score: pourScore(percent), auto }
}

/** Lock the pour and start the Tip. Returns whether it locked. */
export function lock(s: GameState, auto = false): boolean {
  if (!auto && !canLock(s)) return false
  if (s.phase !== 'pour') return false
  s.results.push(judge(s, s.level, auto))
  s.phase = 'tip'
  s.tipT = 0
  s.flow = 0
  s.pending = 0
  return true
}

export function skipTip(s: GameState) {
  if (s.phase === 'tip') {
    s.tipT = TIP_TIME
    s.phase = 'shown'
  }
}

/** On to the next glass, or the end of the day. */
export function nextRound(s: GameState) {
  if (s.phase !== 'shown') return
  if (s.round >= ROUNDS - 1) {
    s.phase = 'done'
    return
  }
  s.round += 1
  beginRound(s)
}

export function tick(s: GameState, dt: number) {
  if (s.phase === 'pour') {
    s.roundT += dt
    const rate = dt > 0 ? s.pending / dt : 0
    s.pending = 0
    // A quick rise and a slower fall, so the stream doesn't flicker between drag events.
    const k = Math.abs(rate) > Math.abs(s.flow) ? 0.5 : 0.12
    s.flow += (rate - s.flow) * k
    if (Math.abs(s.flow) < 1) s.flow = 0
    if (s.roundT >= AUTO_LOCK) lock(s, true)
  } else if (s.phase === 'tip') {
    s.tipT += dt
    if (s.tipT >= TIP_TIME) {
      s.tipT = TIP_TIME
      s.phase = 'shown'
    }
  }
}

/* ---------- the day's result ---------- */

export type RunSummary = {
  score: number
  scoreText: string
  tier: Tier
  marks: Mark[]
  team: Team
  /** The line under the squares: the worst pour, or the closest. */
  story: string
}

function ratioWords(percent: number): string {
  const big = Math.max(percent, 100 - percent)
  const small = Math.max(0.01, Math.min(percent, 100 - percent))
  const ratio = big / small
  if (ratio >= 1.5) return `${(Math.round(10 * ratio) / 10).toString()}× as much as`
  return `${Math.round(100 * (ratio - 1))}% more than`
}

export function summarize(results: readonly PourResult[]): RunSummary {
  const scores = results.map((r) => r.score)
  const score = dayScore(scores)
  const half = results.filter((r) => r.kind === 'half')
  let worst = results[0]!
  let closest = results[0]!
  for (const r of results) {
    if (r.score < worst.score) worst = r
    if (r.score > closest.score) closest = r
  }
  let story: string
  if (worst.score >= 90) {
    const off = formatOff(closest.percent)
    story = off === '0.0' ? 'Closest pour: dead on half.' : `Closest pour: ${off} ${off === '1.0' ? 'point' : 'points'} off half.`
  }
  else if (worst.kind === 'half') story = `My worst “half” was ${Math.round(worst.percent)}% full.`
  else story = `I gave one friend ${ratioWords(worst.percent)} the other.`
  return {
    score,
    scoreText: formatScore(score),
    tier: tierFor(score),
    marks: results.map((r) => markFor(r.score)),
    team: teamFor(half.map((r) => r.percent)),
    story,
  }
}
