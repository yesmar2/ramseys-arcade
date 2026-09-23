import { useEffect, useState } from 'react'
import {
  ApiError,
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  type YouEntry,
} from '../lib/leaderboard'
import { fetchGameRecords, fetchRecordBoard, type RecordDef, type RecordSummary } from '../lib/records'

export type RecordPageData = {
  loading: boolean
  error: boolean
  /** The API doesn't know the record: a stale or mistyped link. */
  missing: boolean
  record: RecordDef | null
  /** Everyone's best, one row per player, best first (up to PLAYER_CAP). */
  entries: LeaderboardEntry[]
  /** Players on the board, loaded or not. */
  total: number
  you: YouEntry | null
  /** Every run that broke it, oldest first. Empty on an API that predates it. */
  progression: LeaderboardEntry[]
  /** The viewer's own best, each time it moved, oldest first. */
  youProgression: { score: number; at: number }[]
  /** The viewer's best of all time, for a week or month they haven't played it. */
  allTimeYou: YouEntry | null
  /** The game's book for the period, for the records beside this one. Arrives after the rest. */
  book: RecordSummary[]
}

const LOADING: RecordPageData = {
  loading: true,
  error: false,
  missing: false,
  record: null,
  entries: [],
  total: 0,
  you: null,
  progression: [],
  youProgression: [],
  allTimeYou: null,
  book: [],
}

/** Players per request: the most the API sends at once. */
const PAGE = 500

/** How many players to read at most; a guard, far past any record board so far. */
const PLAYER_CAP = 2000

/**
 * One record for a period, whole: every player's best, the record's story and
 * the viewer's, and their best of all time when the period has none. The
 * rest of the game's book follows on its own.
 */
export function useRecordPage(
  game: string,
  recordId: string,
  period: LeaderboardPeriod,
  playerName: string,
  groupId: string | null,
): RecordPageData {
  const [data, setData] = useState<RecordPageData>(LOADING)

  useEffect(() => {
    let cancelled = false
    const me = normalizePlayerName(playerName)
    setData(LOADING)

    void (async () => {
      try {
        const first = await fetchRecordBoard(game, recordId, period, me || undefined, { limit: PAGE })
        const entries = [...first.entries]
        const total = first.total ?? entries.length
        while (entries.length < total && entries.length < PLAYER_CAP) {
          const next = await fetchRecordBoard(game, recordId, period, undefined, { offset: entries.length, limit: PAGE })
          if (!next.entries.length) break
          entries.push(...next.entries)
        }
        let allTimeYou: YouEntry | null = null
        if (me && !first.you && period !== 'all') {
          try {
            allTimeYou = (await fetchRecordBoard(game, recordId, 'all', me, { limit: 1 })).you
          } catch {
            /* the card falls back to how to get on */
          }
        }
        if (cancelled) return
        setData({
          ...LOADING,
          loading: false,
          record: first.record,
          entries,
          total,
          you: first.you,
          progression: first.progression ?? [],
          youProgression: first.youProgression ?? [],
          allTimeYou,
        })
      } catch (err) {
        if (!cancelled) setData({ ...LOADING, loading: false, error: true, missing: err instanceof ApiError && err.status === 404 })
        return
      }

      // The records beside it, and where the viewer stands on each. The page reads fine without them.
      try {
        const { records } = await fetchGameRecords(game, period, me || undefined)
        if (!cancelled) setData((prev) => ({ ...prev, book: records }))
      } catch {
        /* the card stays away */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [game, recordId, period, playerName, groupId])

  return data
}
