import { api } from '../../lib/leaderboard'
import { launchWarp } from '../../lib/ghostWarp'
import { chosenSkin } from '../../lib/skins'
import type { GhostRun } from './runStore'
import { GHOST_RATE, GHOST_STRIDE, GROUNDED, newPose, solidPose } from './engine/sim'
import type { Course } from './engine/types'

/*
 * The #1's ghost (the API's lapGhosts.ts, as Hot Lap's, Marble Run's, Lander's and Swoop's are), for everyone to
 * race: on today's gauntlet, today's #1; on a past one, its All time #1. A run saved on the board sends where the
 * bean went after it, ten times a second, and the API keeps it when it's the tag's run on the board and the
 * gauntlet's fastest yet. The #1 is always told, path or not: a run saved on a card closed too soon has none, and
 * then the ghost runs the blue blip's line at the #1's time (standIn).
 */

/** A gauntlet's #1: whose run, its time in seconds, the run itself when its path is known, and the skin it was run in. */
export type BoardGhost = { name: string; avatarId?: string; time: number; run: GhostRun | null; skin?: string }

/** Of a run's samples (20 a second), every other goes, and the crown's moment: ten a second is plenty to run it again from. */
const SEND_EVERY = 2
const S = GHOST_STRIDE

type GhostReply = { name: string; avatarId?: string; time: number; splits?: number[]; rate?: number; path: number[] | null; skin?: string }

/**
 * One sample between two: x, y and z along the way, in the state it was. Across a respawn (a jump of more than
 * 3 m) it stays where it was until the next sample, so a ghost never streaks from the goo to the checkpoint.
 */
function between(path: number[], k: number, f: number, out: number[]) {
  const a = k * S
  const b = a + S
  const jump = Math.hypot(path[b]! - path[a]!, path[b + 1]! - path[a + 1]!, path[b + 2]! - path[a + 2]!) > 3
  const g = jump ? 0 : f
  out.push(path[a]! + (path[b]! - path[a]!) * g, path[a + 1]! + (path[b + 1]! - path[a + 1]!) * g, path[a + 2]! + (path[b + 2]! - path[a + 2]!) * g, path[a + 3]!)
}

/**
 * A path sent at `rate` samples a second, the crown's moment last, filled back in to the ghost's own rate: a sample
 * every twentieth of a second from GO, and the crown's last, as a run's own path has them.
 */
function fillIn(path: number[], rate: number, time: number): number[] {
  const samples = path.length / S
  // Each sample's moment: `rate` a second, and the last at the crown.
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
  // The skin it was run in: whoever races the ghost sees it in that.
  return { name: reply.name, avatarId: reply.avatarId, time, run, ...(typeof reply.skin === 'string' && reply.skin ? { skin: reply.skin } : {}) }
}

/** A gauntlet's #1, with their run when its path is known; null while nobody has a run on it. `fresh` asks past the browser's copy. */
export async function fetchBoardGhost(gauntlet: number, fresh = false): Promise<BoardGhost | null> {
  try {
    return toGhost(await api<GhostReply>(`/tracks/wobblerun/${gauntlet}/ghost`, fresh ? { cache: 'no-cache' } : undefined))
  } catch {
    return null
  }
}

/** The player one place above you on today's board, and the place their run holds. */
export type NextGhost = BoardGhost & { place: number }

/**
 * Next place up (the API's day ghosts): the player one place above `tag` on today's gauntlet, with their run when
 * its path is known. Null while `tag` has no run on the board, or is its #1.
 */
export async function fetchNextGhost(gauntlet: number, tag: string): Promise<NextGhost | null> {
  try {
    const reply = await api<GhostReply & { place?: number }>(`/tracks/wobblerun/${gauntlet}/ghost?above=${encodeURIComponent(tag)}`, { cache: 'no-cache' })
    const ghost = toGhost(reply)
    return ghost && typeof reply.place === 'number' && reply.place >= 1 ? { ...ghost, place: reply.place } : null
  } catch {
    return null
  }
}

/** Of a path's samples on the ground, at least this share must stand on something of the gauntlet's. */
const MOST_STANDING = 0.85
/** How far off a floor's top a grounded sample may be, m: a tipped plank (drawn level here) takes the most. */
const NEAR_TOP = 0.6
const NEAR_PLANK = 1.1

/**
 * Whether a ghost's path was run over this gauntlet: nearly every moment it was on the ground, there was a floor
 * under it then (moving ones where they were at that moment). A gauntlet laid again after a run was made on it
 * (before launch, re-plans are free) leaves a path running on air, and the ghost runs the blue blip's line at the
 * #1's time instead (standIn).
 */
export function fitsCourse(course: Course, run: GhostRun): boolean {
  const g = run.ghost
  const samples = g.length / S
  const grid = course.grid
  const pose = newPose()
  let grounded = 0
  let standing = 0
  for (let k = 0; k < samples - 1; k++) {
    if (g[k * S + 3] !== GROUNDED) continue
    grounded++
    const x = g[k * S]!
    const y = g[k * S + 1]!
    const z = g[k * S + 2]!
    const t = k / GHOST_RATE
    const cell = Math.min(grid.solids.length - 1, Math.max(0, Math.floor((z - grid.z0) / grid.cell)))
    const list = grid.solids[cell]
    if (!list) continue
    for (let n = 0; n < list.length; n++) {
      const i = list[n]!
      const s = course.solids[i]!
      if (s.noGround || s.door) continue
      solidPose(course, null, i, t, pose)
      if (!pose.on) continue
      const dx = x - pose.x
      const dz = z - pose.z
      const c = Math.cos(pose.yaw)
      const sn = Math.sin(pose.yaw)
      const lx = dx * c - dz * sn
      const lz = dx * sn + dz * c
      const inside = s.shape === 'box' ? Math.abs(lx) <= s.hx + 0.3 && Math.abs(lz) <= s.hz + 0.3 : Math.hypot(lx, lz) <= s.r + 0.3
      if (!inside) continue
      const top = pose.y + lz * Math.tan(pose.pitch) + lx * Math.tan(pose.roll)
      if (Math.abs(top - y) <= (s.touch?.kind === 'plank' ? NEAR_PLANK : NEAR_TOP)) {
        standing++
        break
      }
    }
  }
  return grounded === 0 || standing >= grounded * MOST_STANDING
}

/**
 * A run of `time` seconds along another run's line: the blue blip's, off the start as it went and then run faster
 * or slower to make the difference up by the crown (lib/ghostWarp.ts), crossing each checkpoint when that clock
 * does. For a player whose path isn't known: their time, on the blue blip's line. The blue blip itself is its own
 * hands' line at the plan's time (runs.ts paceOf).
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
 * Send a saved run's path, under the tag it was saved as, with the skin it was run in (the one chosen now, for a
 * run kept before runs kept theirs). Answers whether it's the gauntlet's ghost now.
 */
export async function sendBoardGhost(gauntlet: number, name: string, run: { score: number; splits: number[]; path: number[]; skin?: string }): Promise<boolean> {
  const samples = run.path.length / S
  if (samples < 2) return false
  const path: number[] = []
  const put = (k: number) => {
    for (let c = 0; c < S; c++) path.push(Math.round(run.path[k * S + c]! * 100) / 100)
  }
  // Every other one of the run's samples, then the crown's moment, which the run's path ends with.
  for (let k = 0; k < samples - 1; k += SEND_EVERY) put(k)
  put(samples - 1)
  const skin = run.skin ?? chosenSkin('wobblerun')
  try {
    const reply = await api<{ kept?: boolean }>(`/tracks/wobblerun/${gauntlet}/ghost`, {
      method: 'POST',
      // The skin it was run in, so whoever races the ghost sees it in that (lib/skins.ts).
      body: JSON.stringify({ name, score: run.score, splits: run.splits, path, ...(skin ? { skin } : {}) }),
    })
    return reply.kept === true
  } catch {
    return false
  }
}
