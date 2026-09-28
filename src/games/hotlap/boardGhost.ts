import { api } from '../../lib/leaderboard'
import type { GhostLap } from './lap'
import { GHOST_RATE, type GhostPath } from './sim'

/*
 * The #1's ghost: the fastest lap on a track's board that came with its path (the API's lapGhosts.ts), for
 * everyone to race. On today's track it's today's #1; on a past track, its record holder. A lap saved on a
 * board sends its path after it, ten times a second, and the API keeps it if it's the track's fastest yet.
 */

/** A board's fastest lap, to race: whose it is, and the lap. */
export type BoardGhost = { name: string; avatarId?: string; lap: GhostLap }

/** Of a lap's samples (30 a second), every third goes: ten a second is plenty to drive it again from. */
const SEND_EVERY = 3

type GhostReply = { name: string; avatarId?: string; time: number; splits: number[]; rate: number; path: number[] }

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

/** A track's fastest lap with its path, or null if nobody's has come with one yet. `fresh` asks past the browser's copy. */
export async function fetchBoardGhost(track: number, fresh = false): Promise<BoardGhost | null> {
  try {
    const reply = await api<GhostReply>(`/tracks/hotlap/${track}/ghost`, fresh ? { cache: 'no-cache' } : undefined)
    const { path, splits } = reply
    if (!Array.isArray(path) || path.length < 30 || path.length % 3 !== 0 || !Array.isArray(splits) || splits.length !== 3) return null
    if (!(reply.time > 0) || !(reply.rate > 0)) return null
    return { name: reply.name, avatarId: reply.avatarId, lap: { time: reply.time / 1000, splits, ghost: fillIn(path, reply.rate) } }
  } catch {
    return null
  }
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
      body: JSON.stringify({ name, score: lap.score, splits: lap.splits, path }),
    })
    return reply.kept === true
  } catch {
    return false
  }
}
