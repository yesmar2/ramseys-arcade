import { useEffect, useState } from 'react'
import { normalizePlayerName, type LeaderboardPeriod } from '../lib/leaderboard'
import { VISIBLE_RECORD_GAMES } from '../lib/recordBook'
import { fetchGameRecords, type RecordSummary } from '../lib/records'
import { fetchSiteRecords, type SiteRecordsResult } from '../lib/siteRecords'

export type RecordBooksData = {
  loading: boolean
  error: boolean
  /** Every book on show, in the catalog's order, with where the viewer stands on each record. */
  books: { game: string; records: RecordSummary[] }[]
  /** The house book: the arcade's own records. Arrives after the rest. */
  site: SiteRecordsResult | null
}

/**
 * Every record book at once, all time, for the index: one request per game,
 * each carrying the viewer's standing on its records, then the house book.
 */
export function useRecordBooks(playerName: string, groupId: string | null): RecordBooksData {
  const [data, setData] = useState<RecordBooksData>({ loading: true, error: false, books: [], site: null })

  useEffect(() => {
    let cancelled = false
    const me = normalizePlayerName(playerName)
    setData((prev) => ({ ...prev, loading: true, error: false }))
    void (async () => {
      try {
        const books = await Promise.all(
          VISIBLE_RECORD_GAMES.map(async (game) => ({
            game,
            records: (await fetchGameRecords(game, 'all', me || undefined)).records,
          })),
        )
        if (cancelled) return
        setData({ loading: false, error: false, books, site: null })
      } catch {
        if (!cancelled) setData({ loading: false, error: true, books: [], site: null })
        return
      }
      try {
        const site = await fetchSiteRecords(me)
        if (!cancelled) setData((prev) => ({ ...prev, site }))
      } catch {
        /* the house book's card stays away */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playerName, groupId])

  return data
}

export type RecordBookData = {
  loading: boolean
  error: boolean
  records: RecordSummary[]
}

/** One game's book for a period, with where the viewer stands on each record. */
export function useRecordBook(
  game: string,
  period: LeaderboardPeriod,
  playerName: string,
  groupId: string | null,
): RecordBookData {
  const [data, setData] = useState<RecordBookData>({ loading: true, error: false, records: [] })

  useEffect(() => {
    let cancelled = false
    const me = normalizePlayerName(playerName)
    setData((prev) => ({ ...prev, loading: true, error: false }))
    fetchGameRecords(game, period, me || undefined)
      .then((result) => {
        if (!cancelled) setData({ loading: false, error: false, records: result.records })
      })
      .catch(() => {
        if (!cancelled) setData({ loading: false, error: true, records: [] })
      })
    return () => {
      cancelled = true
    }
  }, [game, period, playerName, groupId])

  return data
}
