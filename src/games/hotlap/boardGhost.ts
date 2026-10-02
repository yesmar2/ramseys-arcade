import { chosenSkin } from '../../lib/skins'
import { api } from '../../lib/leaderboard'
import type { GhostLap } from './lap'
import { GHOST_RATE, type GhostPath } from './sim'

/*
 * The #1's ghost (the API's lapGhosts.ts), for everyone to race: on today's track, today's #1; on a past
 * track, its record holder. A lap saved on a board sends its path after it, ten times a second, and the API
 * keeps it when it's the tag's lap on the board and the track's fastest yet. The #1 is always told, path or
 * not: a lap saved before laps sent their paths, or from an old copy of the site, has none, and then the
 * ghost drives the blue car's line at the #1's time (standIn).
 */

/** A board's #1: whose lap, its time in seconds, and the lap itself when its path is known. */
export type BoardGhost = { name: string; avatarId?: string; time: number; lap: GhostLap | null; skin?: string }

/** Of a lap's samples (30 a second), every third goes: ten a second is plenty to drive it again from. */
const SEND_EVERY = 3

type GhostReply = { name: string; avatarId?: string; time: number; splits?: number[]; rate?: number; path: number[] | null; skin?: string }

/** A path sent at `rate` samples a second, filled back in to the ghost's own rate. */
function fillIn(path: number[], rate: number): GhostPath {
  const every = Math.round(GHOST_RATE / rate)
  const samples = path.length / 3
  if (every <= 1 || samples < 2) return path
  const out: number[] = []
  for (let k = 0; k < samples - 1; k++) {
    const [x0, y0, h0] = [path[k * 3]!, path[k * 3 + 1]!, path[k * 3 + 2]!]
    const [x1, y1, h1] = [path[k * 3 + 3]!, path[k * 3 + 4]!, path[k * 3 + 5]!]
    const turn = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))
    for (let j = 0; j < every; j++) {
      const f = j / every
      out.push(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, h0 + turn * f)
    }
  }
  out.push(...path.slice(-3))
  return out
}

/** A track's #1, with their lap when its path is known; null while nobody has a lap on it. `fresh` asks past the browser's copy. */
export async function fetchBoardGhost(track: number, fresh = false): Promise<BoardGhost | null> {
  try {
    const reply = await api<GhostReply>(`/tracks/hotlap/${track}/ghost`, fresh ? { cache: 'no-cache' } : undefined)
    if (typeof reply.name !== 'string' || !(reply.time > 0)) return null
    const time = reply.time / 1000
    const { path, splits, rate } = reply
    const known =
      Array.isArray(path) && path.length >= 30 && path.length % 3 === 0 && Array.isArray(splits) && splits.length === 3 && rate != null && rate > 0
    return {
      name: reply.name,
      avatarId: reply.avatarId,
      time,
      lap: known ? { time, splits: splits!, ghost: fillIn(path!, rate!) } : null,
      ...(reply.skin ? { skin: reply.skin } : {}),
    }
  } catch {
    return null
  }
}

/**
 * A lap of `time` seconds along another lap's line: the blue car's, driven faster or slower all the way
 * round in step, so it crosses each sector's end and the line at the same share of `time` as its own lap.
 * For a #1 whose path isn't known: their time, on the blue car's line.
 */
export function standIn(line: GhostLap, time: number): GhostLap {
  const scale = time / line.time
  const g = line.ghost
  const samples = g.length / 3
  const out: number[] = []
  // Samples as often as the ghost's own rate, each where the line was at the same share of its lap.
  const count = Math.max(2, Math.round((samples - 1) * scale) + 1)
  for (let k = 0; k < count; k++) {
    const at = Math.min(samples - 1, k / scale)
    const i = Math.min(samples - 2, Math.floor(at))
    const f = at - i
    const turn = Math.atan2(Math.sin(g[i * 3 + 5]! - g[i * 3 + 2]!), Math.cos(g[i * 3 + 5]! - g[i * 3 + 2]!))
    out.push(g[i * 3]! + (g[i * 3 + 3]! - g[i * 3]!) * f, g[i * 3 + 1]! + (g[i * 3 + 4]! - g[i * 3 + 1]!) * f, g[i * 3 + 2]! + turn * f)
  }
  return { time, splits: line.splits.map((s) => s * scale), ghost: out }
}

/** Send a saved lap's path, under the tag it was saved as. Answers whether it's the track's ghost now. */
export async function sendBoardGhost(track: number, name: string, lap: { score: number; splits: number[]; path: GhostPath }): Promise<boolean> {
  const path: number[] = []
  const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places
  for (let k = 0; k < lap.path.length / 3; k += SEND_EVERY) {
    path.push(round(lap.path[k * 3]!, 1), round(lap.path[k * 3 + 1]!, 1), round(lap.path[k * 3 + 2]!, 3))
  }
  try {
    const reply = await api<{ kept?: boolean }>(`/tracks/hotlap/${track}/ghost`, {
      method: 'POST',
      // The skin it was played in, so whoever races the ghost sees it in that (lib/skins.ts).
      body: JSON.stringify({ name, score: lap.score, splits: lap.splits, path, ...(chosenSkin('hotlap') ? { skin: chosenSkin('hotlap') } : {}) }),
    })
    return reply.kept === true
  } catch {
    return false
  }
}
