import { chosenSkin } from '../../lib/skins'
import { api } from '../../lib/leaderboard'
import type { GhostRun } from './runStore'
import { GHOST_RATE } from './sim'

/*
 * The #1's ghost (the API's lapGhosts.ts, as Hot Lap's is), for everyone to race: on today's course, today's
 * #1; on a past one, its All time #1. A run saved on the board sends where the marble went after
 * it, ten times a second, and the API keeps it when it's the tag's run on the board and the course's fastest
 * yet. The #1 is always told, path or not: a run saved before runs sent their paths, or from an old copy of
 * the site, has none, and then the ghost rolls the blue ball's line at the #1's time (standIn).
 */

/** A course's #1: whose run, its time in seconds, and the run itself when its path is known. */
export type BoardGhost = { name: string; avatarId?: string; time: number; run: GhostRun | null }

/** Of a run's samples (30 a second), every third goes, and the goal's moment: ten a second is plenty to roll it again from. */
const SEND_EVERY = 3

type GhostReply = { name: string; avatarId?: string; time: number; splits?: number[]; rate?: number; path: number[] | null }

/**
 * A path sent at `rate` samples a second, the goal's moment last, filled back in to the ghost's own rate: a
 * sample every thirtieth of a second from the go, and the goal's last, as a run's own path has them.
 */
function fillIn(path: number[], rate: number, time: number): number[] {
  const samples = path.length / 3
  // Each sample's moment: `rate` a second, and the last at the goal.
  const at = (k: number) => (k === samples - 1 ? time : k / rate)
  const out: number[] = []
  let k = 0
  for (let j = 0; j / GHOST_RATE < time; j++) {
    const t = j / GHOST_RATE
    while (k < samples - 2 && at(k + 1) <= t) k++
    const span = at(k + 1) - at(k)
    const f = span > 0 ? Math.min(1, Math.max(0, (t - at(k)) / span)) : 0
    for (let c = 0; c < 3; c++) out.push(path[k * 3 + c]! + (path[k * 3 + 3 + c]! - path[k * 3 + c]!) * f)
  }
  out.push(...path.slice(-3))
  return out
}

/** A ghost as the API tells it: whose run, its time, and the run itself when its path is known. */
function toGhost(reply: GhostReply): BoardGhost | null {
  if (typeof reply.name !== 'string' || !(reply.time > 0)) return null
  const time = reply.time / 1000
  const { path, splits, rate } = reply
  const known = Array.isArray(path) && path.length >= 6 && path.length % 3 === 0 && Array.isArray(splits) && splits.length >= 1 && rate != null && rate > 0
  return { name: reply.name, avatarId: reply.avatarId, time, run: known ? { time, splits: splits!, ghost: fillIn(path!, rate!, time) } : null }
}

/** A course's #1, with their run when its path is known; null while nobody has a run on it. `fresh` asks past the browser's copy. */
export async function fetchBoardGhost(course: number, fresh = false): Promise<BoardGhost | null> {
  try {
    return toGhost(await api<GhostReply>(`/tracks/marblerun/${course}/ghost`, fresh ? { cache: 'no-cache' } : undefined))
  } catch {
    return null
  }
}

/** The player one place above you on today's board, and the place their run holds. */
export type NextGhost = BoardGhost & { place: number }

/**
 * Next place up (the API's day ghosts): the player one place above `tag` on today's course, with their run when
 * its path is known. Null while `tag` has no run on the board, or is its #1.
 */
export async function fetchNextGhost(course: number, tag: string): Promise<NextGhost | null> {
  try {
    const reply = await api<GhostReply & { place?: number }>(`/tracks/marblerun/${course}/ghost?above=${encodeURIComponent(tag)}`, { cache: 'no-cache' })
    const ghost = toGhost(reply)
    return ghost && typeof reply.place === 'number' && reply.place >= 1 ? { ...ghost, place: reply.place } : null
  } catch {
    return null
  }
}

/**
 * A run of `time` seconds along another run's line: the blue ball's, rolled faster or slower all the way
 * down in step, so it crosses each checkpoint and the goal at the same share of `time` as its own run.
 * For a #1 whose path isn't known: their time, on the blue ball's line.
 */
export function standIn(line: GhostRun, time: number): GhostRun {
  const scale = time / line.time
  const g = line.ghost
  const samples = g.length / 3
  const out: number[] = []
  // Samples as often as the ghost's own rate, each where the line was at the same share of its run.
  const count = Math.max(2, Math.round((samples - 1) * scale) + 1)
  for (let k = 0; k < count; k++) {
    const at = Math.min(samples - 1, k / scale)
    const i = Math.min(samples - 2, Math.floor(at))
    const f = at - i
    for (let c = 0; c < 3; c++) out.push(g[i * 3 + c]! + (g[i * 3 + 3 + c]! - g[i * 3 + c]!) * f)
  }
  return { time, splits: line.splits.map((s) => s * scale), ghost: out }
}

/** Send a saved run's path, under the tag it was saved as. Answers whether it's the course's ghost now. */
export async function sendBoardGhost(course: number, name: string, run: { score: number; splits: number[]; path: number[] }): Promise<boolean> {
  const samples = run.path.length / 3
  if (samples < 2) return false
  const path: number[] = []
  const put = (k: number) => {
    for (let c = 0; c < 3; c++) path.push(Math.round(run.path[k * 3 + c]! * 100) / 100)
  }
  // Every third of the run's samples, then the goal's moment, which the run's path ends with.
  for (let k = 0; k < samples - 1; k += SEND_EVERY) put(k)
  put(samples - 1)
  try {
    const reply = await api<{ kept?: boolean }>(`/tracks/marblerun/${course}/ghost`, {
      method: 'POST',
      // The skin it was played in, so whoever races the ghost sees it in that (lib/skins.ts).
      body: JSON.stringify({ name, score: run.score, splits: run.splits, path, ...(chosenSkin('marblerun') ? { skin: chosenSkin('marblerun') } : {}) }),
    })
    return reply.kept === true
  } catch {
    return false
  }
}
