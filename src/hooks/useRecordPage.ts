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
  /** The board's first players' bests, one row per player, best first (FIRST_PLAYERS of them). */
  entries: LeaderboardEntry[]
  /** The viewer's best and the players either side of it, with their places, when it's past the first ones. */
  around: { place: number; entry: LeaderboardEntry }[]
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
  around: [],
  total: 0,
  you: null,
  progression: [],
  youProgression: [],
  allTimeYou: null,
  book: [],
}

/** Players a record's board opens on; the rest are asked a page at a time as they're opened. */
export const FIRST_PLAYERS = 10

/**
 * One record for a period, as it opens: its first players' bests, the viewer's with the players either side
 * of it (the record's board is one row a player, and its places are the API's), the record's story and the
 * viewer's, and their best of all time when the period has none. The rest of the game's book follows on its
 * own.
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
        const first = await fetchRecordBoard(game, recordId, period, me || undefined, { limit: FIRST_PLAYERS })
        const entries = first.entries
        const total = first.total ?? entries.length
        // Past the first rows: the two either side of the viewer, read where they are.
        let around: RecordPageData['around'] = []
        const rank = first.you?.rank ?? 0
        if (rank > FIRST_PLAYERS) {
          const from = Math.max(FIRST_PLAYERS, rank - 3)
          const near = await fetchRecordBoard(game, recordId, period, undefined, { offset: from, limit: rank + 2 - from }).catch(() => null)
          around = (near?.entries ?? []).map((entry, i) => ({ place: from + i + 1, entry }))
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
          around,
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
