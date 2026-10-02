import { api } from '../../lib/leaderboard'
import type { GhostRun } from './runStore'
import { GHOST_RATE, GHOST_STRIDE, WRECKED, wrap } from './sim'

/*
 * The #1's ghost (the API's lapGhosts.ts, as Hot Lap's and Marble Run's are), for everyone to race: in today's
 * cave, today's #1; in a past one, its All time #1. A run saved on the board sends where the ship
 * went after it, ten times a second, and the API keeps it when it's the tag's run on the board and the cave's
 * fastest yet. The #1 is always told, path or not: a run saved from an old copy of the site, or on a card
 * closed too soon, has none, and then the ghost flies the blue ship's line at the #1's time (standIn).
 */

/** A cave's #1: whose run, its time in seconds, and the run itself when its path is known. */
export type BoardGhost = { name: string; avatarId?: string; time: number; run: GhostRun | null }

/** Of a run's samples (20 a second), every other goes, and the landing's moment: ten a second is plenty to fly it again from. */
const SEND_EVERY = 2
const S = GHOST_STRIDE

type GhostReply = { name: string; avatarId?: string; time: number; splits?: number[]; rate?: number; path: number[] | null }

/** One sample between two: x and y along the way, the angle the short way round, the engine as it was. */
function between(path: number[], k: number, f: number, out: number[]) {
  const a = k * S
  const b = a + S
  // A wreck put back at its gate jumps; it never glides there.
  const jump = Math.hypot(path[b]! - path[a]!, path[b + 1]! - path[a + 1]!) > 8 || path[a + 3] === WRECKED
  const u = jump ? 0 : f
  out.push(path[a]! + (path[b]! - path[a]!) * u, path[a + 1]! + (path[b + 1]! - path[a + 1]!) * u, path[a + 2]! + wrap(path[b + 2]! - path[a + 2]!) * u, path[a + 3]!)
}

/**
 * A path sent at `rate` samples a second, the landing's moment last, filled back in to the ghost's own rate:
 * a sample every twentieth of a second from the go, and the landing's last, as a run's own path has them.
 */
function fillIn(path: number[], rate: number, time: number): number[] {
  const samples = path.length / S
  // Each sample's moment: `rate` a second, and the last at the landing.
  const at = (k: number) => (k === samples - 1 ? time : k / rate)
  const out: number[] = []
  let k = 0
  for (let j = 0; j / GHOST_RATE < time; j++) {
    const t = j / GHOST_RATE
    while (k < samples - 2 && at(k + 1) <= t) k++
    const span = at(k + 1) - at(k)
    between(path, k, span > 0 ? Math.min(1, Math.max(0, (t - at(k)) / span)) : 0, out)
  }
  out.push(...path.slice(-S))
  return out
}

function knownPath(path: unknown, splits: unknown, rate: unknown): path is number[] {
  return (
    Array.isArray(path) &&
    path.length >= S * 2 &&
    path.length % S === 0 &&
    path.every((v) => typeof v === 'number' && Number.isFinite(v)) &&
    Array.isArray(splits) &&
    splits.length >= 1 &&
    typeof rate === 'number' &&
    rate > 0
  )
}

/** A cave's #1, with their run when its path is known; null while nobody has a run in it. `fresh` asks past the browser's copy. */
export async function fetchBoardGhost(cave: number, fresh = false): Promise<BoardGhost | null> {
  try {
    const reply = await api<GhostReply>(`/tracks/lander/${cave}/ghost`, fresh ? { cache: 'no-cache' } : undefined)
    if (typeof reply.name !== 'string' || !(reply.time > 0)) return null
    const time = reply.time / 1000
    const { path, splits, rate } = reply
    const run = knownPath(path, splits, rate) ? { time, splits: splits!, ghost: fillIn(path, rate!, time) } : null
    return { name: reply.name, avatarId: reply.avatarId, time, run }
  } catch {
    return null
  }
}

/**
 * A run of `time` seconds along another run's line: the blue ship's, flown faster or slower all the way down
 * in step, so it passes each gate and lands at the same share of `time` as its own run. For a #1 whose path
 * isn't known: their time, on the blue ship's line.
 */
export function standIn(line: GhostRun, time: number): GhostRun {
  const scale = time / line.time
  const g = line.ghost
  const samples = g.length / S
  const out: number[] = []
  // Samples as often as the ghost's own rate, each where the line was at the same share of its run.
  const count = Math.max(2, Math.round((samples - 1) * scale) + 1)
  for (let k = 0; k < count; k++) {
    const at = Math.min(samples - 1, k / scale)
    const i = Math.min(samples - 2, Math.floor(at))
    between(g, i, at - i, out)
  }
  return { time, splits: line.splits.map((s) => s * scale), ghost: out }
}

/** Send a saved run's path, under the tag it was saved as. Answers whether it's the cave's ghost now. */
export async function sendBoardGhost(cave: number, name: string, run: { score: number; splits: number[]; path: number[] }): Promise<boolean> {
  const samples = run.path.length / S
  if (samples < 2) return false
  const path: number[] = []
  const put = (k: number) => {
    for (let c = 0; c < S; c++) path.push(Math.round(run.path[k * S + c]! * 100) / 100)
  }
  // Every other one of the run's samples, then the landing's moment, which the run's path ends with.
  for (let k = 0; k < samples - 1; k += SEND_EVERY) put(k)
  put(samples - 1)
  try {
    const reply = await api<{ kept?: boolean }>(`/tracks/lander/${cave}/ghost`, {
      method: 'POST',
      body: JSON.stringify({ name, score: run.score, splits: run.splits, path }),
    })
    return reply.kept === true
  } catch {
    return false
  }
}
