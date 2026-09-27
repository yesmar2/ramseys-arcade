import { useEffect, useState } from 'react'
import { detectDeviceType } from './device'
import { api, getClaimToken, normalizePlayerName } from './leaderboard'

/*
 * Track records (the API's trackLaps.ts). Every Hot Lap track keeps a board of its own for good. On its
 * day a track is the Daily, and its laps are the day's board, which closes at midnight with the day's
 * places, points and tickets. After that a lap on it goes on the track's own board: its day's laps and
 * every lap since, each driver's best. The archive shows each track's record; a past track's cards show
 * its board and where you stand.
 */

export type TrackLapFigure = { name: string; score: number; avatarId?: string }

/** A track that has had its day: its record, how many have driven it, and your best and place on it. */
export type TrackRecordRow = {
  track: number
  day: string
  drivers: number
  record: TrackLapFigure | null
  you: { score: number; place: number } | null
}

export type TrackBoard = {
  track: number
  day: string
  /** Past: a lap on it counts here. Today: it's the Daily. Ahead: only a test drive. */
  state: 'past' | 'today' | 'ahead'
  drivers: number
  entries: TrackLapFigure[]
  you: { score: number; place: number } | null
}

/** What came of saving a lap on a past track. */
export type TrackLapResult = {
  track: number
  name: string
  score: number
  /** Your best on the track now, which may be an earlier lap. */
  best: number
  place: number
  drivers: number
  record: { name: string; score: number }
  tookRecord: boolean
}

const cleanName = (name: string) => normalizePlayerName(name)

/** The API lets a browser keep these a few seconds; asked again after a lap is saved, they have to be fresh. */
const FRESH: RequestInit = { cache: 'no-cache' }

/** A track's board, with `name`'s place on it. */
export function fetchTrackBoard(track: number, name: string): Promise<TrackBoard> {
  const who = cleanName(name)
  return api<TrackBoard>(`/tracks/hotlap/${track}/board${who ? `?name=${encodeURIComponent(who)}` : ''}`, FRESH)
}

/** A track's board, fetched again when `version` changes (after a lap is saved). Null while it's asked, or for no track. */
export function useTrackBoard(track: number | null, name: string, version = 0): TrackBoard | null {
  const [board, setBoard] = useState<{ key: string; board: TrackBoard | null } | null>(null)
  const key = `${track}|${cleanName(name)}|${version}`
  useEffect(() => {
    if (track == null) return
    let live = true
    fetchTrackBoard(track, name)
      .then((b) => {
        if (live) setBoard({ key, board: b })
      })
      .catch(() => {
        if (live) setBoard({ key, board: null })
      })
    return () => {
      live = false
    }
  }, [key, track, name])
  if (track == null) return null
  // Keep showing the last board while the next is asked, rather than blinking.
  return board?.board ?? null
}

const HOLD_MS = 60_000
const held = new Map<string, { at: number; rows: TrackRecordRow[] }>()

/** Every track that has had its day, the latest first, with `name`'s results: kept a minute. Null while it's asked. */
export function useTrackRecords(name: string): TrackRecordRow[] | null {
  const who = cleanName(name)
  const [answer, setAnswer] = useState<{ who: string; rows: TrackRecordRow[] } | null>(() => {
    const hit = held.get(who)
    return hit ? { who, rows: hit.rows } : null
  })
  useEffect(() => {
    const hit = held.get(who)
    if (hit && Date.now() - hit.at < HOLD_MS) return
    let live = true
    api<{ tracks: TrackRecordRow[] }>(`/tracks/hotlap/records${who ? `?name=${encodeURIComponent(who)}` : ''}`, FRESH)
      .then((reply) => {
        held.set(who, { at: Date.now(), rows: reply.tracks })
        if (live) setAnswer({ who, rows: reply.tracks })
      })
      .catch(() => {
        if (live) setAnswer({ who, rows: [] })
      })
    return () => {
      live = false
    }
  }, [who])
  if (answer?.who === who) return answer.rows
  return held.get(who)?.rows ?? null
}

/**
 * Save a lap on a past track, under the tag this device plays as. `run` is the run the lap was driven in,
 * asked for as it ended (runSession runIdFor): a lap on a track's board has to be one the server timed.
 */
export async function saveTrackLap(track: number, name: string, score: number, run: Promise<string | undefined>): Promise<TrackLapResult> {
  const cleaned = cleanName(name) || 'PLAYER'
  const runId = await run
  if (!runId) throw Object.assign(new Error('That lap’s run never reached the server, so it can’t be saved.'), { code: 'RUN_REQUIRED' })
  const token = getClaimToken(cleaned)
  const result = await api<TrackLapResult>(`/tracks/hotlap/${track}/laps`, {
    method: 'POST',
    body: JSON.stringify({ name: cleaned, score, device: detectDeviceType(), runId, ...(token ? { token } : {}) }),
  })
  // The archive's records are stale now.
  held.clear()
  return result
}
