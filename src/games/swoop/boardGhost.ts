import { api } from '../../lib/leaderboard'
import { launchWarp } from '../../lib/ghostWarp'
import { chosenSkin } from '../../lib/skins'
import type { GhostRun } from './runStore'
import { GHOST_RATE, GHOST_STRIDE, heightAt, type Hills } from './sim'

/*
 * The #1's ghost (the API's lapGhosts.ts, as Hot Lap's, Marble Run's and Lander's are), for everyone to race:
 * on today's course, today's #1; on a past one, its All time #1. A run saved on the board sends where the
 * bird went after it, ten times a second, and the API keeps it when it's the tag's run on the board and the
 * course's fastest yet. The #1 is always told, path or not: a run saved on a card closed too soon has none,
 * and then the ghost flies the blue bird's line at the #1's time (standIn).
 */

/** A course's #1: whose run, its time in seconds, the run itself when its path is known, and the skin it was flown in. */
export type BoardGhost = { name: string; avatarId?: string; time: number; run: GhostRun | null; skin?: string }

/** Of a run's samples (20 a second), every other goes, and the line's moment: ten a second is plenty to fly it again from. */
const SEND_EVERY = 2
const S = GHOST_STRIDE

type GhostReply = { name: string; avatarId?: string; time: number; splits?: number[]; rate?: number; path: number[] | null; skin?: string }

/** One sample between two: x and y along the way, holding as it was. */
function between(path: number[], k: number, f: number, out: number[]) {
  const a = k * S
  const b = a + S
  out.push(path[a]! + (path[b]! - path[a]!) * f, path[a + 1]! + (path[b + 1]! - path[a + 1]!) * f, path[a + 2]!)
}

/**
 * A path sent at `rate` samples a second, the line's moment last, filled back in to the ghost's own rate: a
 * sample every twentieth of a second from the go, and the line's last, as a run's own path has them.
 */
function fillIn(path: number[], rate: number, time: number): number[] {
  const samples = path.length / S
  // Each sample's moment: `rate` a second, and the last at the line.
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

/** A ghost as the API tells it: whose run, its time, and the run itself when its path is known. */
function toGhost(reply: GhostReply): BoardGhost | null {
  if (typeof reply.name !== 'string' || !(reply.time > 0)) return null
  const time = reply.time / 1000
  const { path, splits, rate } = reply
  const run = knownPath(path, splits, rate) ? { time, splits: splits!, ghost: fillIn(path, rate!, time) } : null
  // The skin it was flown in: whoever races the ghost sees it in that.
  return { name: reply.name, avatarId: reply.avatarId, time, run, ...(typeof reply.skin === 'string' && reply.skin ? { skin: reply.skin } : {}) }
}

/** A course's #1, with their run when its path is known; null while nobody has a run on it. `fresh` asks past the browser's copy. */
export async function fetchBoardGhost(course: number, fresh = false): Promise<BoardGhost | null> {
  try {
    return toGhost(await api<GhostReply>(`/tracks/swoop/${course}/ghost`, fresh ? { cache: 'no-cache' } : undefined))
  } catch {
    return null
  }
}

/** The player one place above you on today's board, and the place their run holds. */
export type NextGhost = BoardGhost & { place: number }

/**
 * Next place up (the API's day ghosts): the player one place above `tag` on today's course, with their run
 * when its path is known. Null while `tag` has no run on the board, or is its #1.
 */
export async function fetchNextGhost(course: number, tag: string): Promise<NextGhost | null> {
  try {
    const reply = await api<GhostReply & { place?: number }>(`/tracks/swoop/${course}/ghost?above=${encodeURIComponent(tag)}`, { cache: 'no-cache' })
    const ghost = toGhost(reply)
    return ghost && typeof reply.place === 'number' && reply.place >= 1 ? { ...ghost, place: reply.place } : null
  } catch {
    return null
  }
}

/** Of a path's samples, more than this share under the ground and it isn't a run over these hills. */
const MOST_UNDER = 0.02

/**
 * Whether a ghost's path was flown over these hills: next to none of it under the ground. Hills laid again
 * after a run was flown on them leave a path that cuts through them, and the ghost flies the blue bird's
 * line at the #1's time instead (standIn).
 */
export function fitsHills(hills: Hills, run: GhostRun): boolean {
  const g = run.ghost
  const samples = g.length / S
  let under = 0
  for (let k = 0; k < samples; k++) if (g[k * S + 1]! < heightAt(hills, g[k * S]!) - 0.5) under++
  return under <= samples * MOST_UNDER
}

/**
 * A run of `time` seconds along another run's line: the blue bird's, off the start as it went and then flown
 * faster or slower to make the difference up by the line (lib/ghostWarp.ts), passing each flag when that
 * clock does. For a player whose path isn't known: their time, on the blue bird's line.
 */
export function standIn(line: GhostRun, time: number): GhostRun {
  const warp = launchWarp(line.time, time)
  const g = line.ghost
  const samples = g.length / S
  const out: number[] = []
  // Samples as often as the ghost's own rate, each where the line was at that moment of the stand-in's clock.
  const every = line.time / (samples - 1)
  const count = Math.max(2, Math.round(((samples - 1) * time) / line.time) + 1)
  for (let k = 0; k < count; k++) {
    const at = Math.min(samples - 1, warp.lineAt(k * every) / every)
    const i = Math.min(samples - 2, Math.floor(at))
    between(g, i, at - i, out)
  }
  return { time, splits: line.splits.map((s) => warp.ghostAt(s)), ghost: out }
}

/**
 * Send a saved run's path, under the tag it was saved as, with the skin it was flown in (the one chosen now, for
 * a run kept before runs kept theirs). Answers whether it's the course's ghost now.
 */
export async function sendBoardGhost(course: number, name: string, run: { score: number; splits: number[]; path: number[]; skin?: string }): Promise<boolean> {
  const samples = run.path.length / S
  if (samples < 2) return false
  const path: number[] = []
  const put = (k: number) => {
    for (let c = 0; c < S; c++) path.push(Math.round(run.path[k * S + c]! * 100) / 100)
  }
  // Every other one of the run's samples, then the line's moment, which the run's path ends with.
  for (let k = 0; k < samples - 1; k += SEND_EVERY) put(k)
  put(samples - 1)
  const skin = run.skin ?? chosenSkin('swoop')
  try {
    const reply = await api<{ kept?: boolean }>(`/tracks/swoop/${course}/ghost`, {
      method: 'POST',
      // The skin it was flown in, so whoever races the ghost sees it in that (lib/skins.ts).
      body: JSON.stringify({ name, score: run.score, splits: run.splits, path, ...(skin ? { skin } : {}) }),
    })
    return reply.kept === true
  } catch {
    return false
  }
}
