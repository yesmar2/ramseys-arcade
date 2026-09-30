import { useCallback, useEffect, useState } from 'react'
import { detectDeviceType } from './device'
import { api, getClaimToken, normalizePlayerName } from './leaderboard'
import { noteTicketsPaid } from './tickets'

/*
 * Track records (the API's trackLaps.ts). Every Hot Lap track keeps a board of its own for good. On its
 * day a track is the Daily, and its laps are the day's board, which closes at midnight with the day's
 * places, points and tickets. After that a lap on it goes on the track's own board: its day's laps and
 * every lap since, each driver's best. Hot Lap's past tracks tab and Records tab show each track's record;
 * a past track's cards show its board and where you stand.
 */

export type TrackLapFigure = { name: string; score: number; avatarId?: string }

/** A track that has had its day: its record, how many have driven it, and your best and place on it. */
export type TrackRecordRow = {
  track: number
  day: string
  drivers: number
  /** `at`: when the record was driven (ms), on the track's day or since. */
  record: (TrackLapFigure & { at?: number }) | null
  you: { score: number; place: number } | null
}

/** Every track's row, or null while they're asked; `failed` when asking didn't work, and `retry` asks again. */
export type TrackRecords = { rows: TrackRecordRow[] | null; failed: boolean; retry: () => void }

/** A driver's best on a track's board: `at` is when it was driven, `place` where it stands on the whole board. */
export type TrackBoardRow = TrackLapFigure & { at?: number; place?: number }

export type TrackBoard = {
  track: number
  day: string
  /** Past: a lap on it counts here. Today: it's the Daily. Ahead: only a test drive. */
  state: 'past' | 'today' | 'ahead'
  drivers: number
  /** The page asked for: the top ten unless asked otherwise. */
  entries: TrackBoardRow[]
  /**
   * The first ten whatever the page, where the page starts, and how many are on it (always `drivers`).
   * An API from before boards were paged leaves them out, since the site and the API go live separately.
   */
  top?: TrackBoardRow[]
  offset?: number
  total?: number
  you: { score: number; place: number } | null
}

/** A page of a board: from `offset`, `limit` long (the API's default is 10, its most 500). */
export type BoardPage = { offset?: number; limit?: number }

/** A board's page as the API's query asks for it: nothing for the first ten. */
export function pageParams(params: URLSearchParams, page?: BoardPage): URLSearchParams {
  if (page?.offset) params.set('offset', String(Math.max(0, Math.floor(page.offset))))
  if (page?.limit) params.set('limit', String(Math.max(1, Math.floor(page.limit))))
  return params
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
  /** What taking the record paid, the first time this track's was taken: the API's RECORD_TICKETS. */
  tickets?: { earned: number; balance: number }
}

const cleanName = (name: string) => normalizePlayerName(name)

/** The API lets a browser keep these a few seconds; asked again after a lap is saved, they have to be fresh. */
const FRESH: RequestInit = { cache: 'no-cache' }

/** A track's board, with `name`'s place on it: its top ten, or the page asked for. */
export function fetchTrackBoard(track: number, name: string, page?: BoardPage): Promise<TrackBoard> {
  const who = cleanName(name)
  const params = pageParams(new URLSearchParams(who ? { name: who } : {}), page)
  const query = params.toString()
  return api<TrackBoard>(`/tracks/hotlap/${track}/board${query ? `?${query}` : ''}`, FRESH)
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

/**
 * Every track that has had its day, the latest first, with `name`'s results: kept a minute. `rows` is null
 * while it's asked; `failed` when the ask failed and nothing is kept, so a page can say so rather than "no tracks".
 */
export function useTrackRecordsAsked(name: string): TrackRecords {
  const who = cleanName(name)
  const [asks, setAsks] = useState(0)
  const [answer, setAnswer] = useState<{ who: string; rows: TrackRecordRow[] | null; failed: boolean } | null>(() => {
    const hit = held.get(who)
    return hit ? { who, rows: hit.rows, failed: false } : null
  })
  useEffect(() => {
    const hit = held.get(who)
    if (hit && Date.now() - hit.at < HOLD_MS) return
    let live = true
    api<{ tracks: TrackRecordRow[] }>(`/tracks/hotlap/records${who ? `?name=${encodeURIComponent(who)}` : ''}`, FRESH)
      .then((reply) => {
        held.set(who, { at: Date.now(), rows: reply.tracks })
        if (live) setAnswer({ who, rows: reply.tracks, failed: false })
      })
      .catch(() => {
        // Records asked a while ago still stand; none at all is a failure to say, never an empty list.
        const kept = held.get(who)?.rows ?? null
        if (live) setAnswer({ who, rows: kept, failed: kept === null })
      })
    return () => {
      live = false
    }
  }, [who, asks])
  const retry = useCallback(() => {
    setAnswer(null)
    setAsks((n) => n + 1)
  }, [])
  if (answer?.who === who) return { rows: answer.rows, failed: answer.failed, retry }
  return { rows: held.get(who)?.rows ?? null, failed: false, retry }
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
  // The tracks' records are stale now, and taking a record pays: the header's count goes up with it.
  held.clear()
  noteTicketsPaid(result.tickets)
  return result
}
