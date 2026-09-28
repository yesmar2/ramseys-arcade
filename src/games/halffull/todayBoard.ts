import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { playersFromRuns } from '../../lib/gameBoard'
import { getLeaderboard } from '../../lib/leaderboard'
import { adoptBoardResult, dayDone, dayRun, pourDay } from './daily'

/*
 * Today's Pour's board, for its cards: how many have poured, who leads, and where you are. Signed in, a
 * pour the board already has for you today (from another device) is the day's here too, so this one
 * doesn't offer a first pour the API would turn away.
 */

const SLUG = 'halffull'

export type TodayBoard = {
  /** Players on today's board, each at their one pour. */
  count: number
  leader: { name: string; score: number } | null
  you: { place: number; score: number } | null
}

/**
 * Today's board and your place on it, asked again when the day, your tag or `again` changes; null `day`
 * for none. Only the answer to the latest ask is returned, so a board from before a pour never stands in
 * for the one after it.
 */
export function useTodayBoard(day: string | null, me: string, again: unknown = null): TodayBoard | null {
  const { signedIn } = useAuth()
  const ask = day ? `${day}|${me}|${String(again)}|${signedIn}` : null
  const [got, setGot] = useState<{ ask: string; board: TodayBoard } | null>(null)
  useEffect(() => {
    if (!day || !ask) return
    let cancelled = false
    getLeaderboard(SLUG, 'daily', me || undefined, { limit: 100 })
      .then(({ entries, you, total }) => {
        if (cancelled) return
        // Just past midnight the API's clock may still be on yesterday: that board isn't today's.
        const onDay = (at: number) => pourDay(at) === day
        const players = playersFromRuns(entries.filter((e) => onDay(e.at)))
        const top = players[0]
        const mine = me ? players.find((p) => p.name === me && onDay(p.best.at)) : undefined
        const yours = mine
          ? { place: mine.place, score: mine.best.score }
          : you && onDay(you.at)
            ? { place: you.rank, score: you.score }
            : null
        if (yours && signedIn && !dayDone(dayRun(day))) adoptBoardResult(day, yours.score, Date.now())
        setGot({
          ask,
          board: {
            // Past the first page, the board's own count (one run a player: first run only).
            count: players.length < entries.length ? players.length : Math.max(total, players.length),
            leader: top ? { name: top.name, score: top.best.score } : null,
            you: yours,
          },
        })
      })
      .catch(() => {
        /* no board to show */
      })
    return () => {
      cancelled = true
    }
  }, [ask, day, me, signedIn])
  return got && got.ask === ask ? got.board : null
}
