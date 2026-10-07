import { useEffect, useState } from 'react'
import { useAccountId } from '../../hooks/useAccountId'
import { currentAccountId, recallAccountTag } from '../../lib/auth'
import { getPlayerBoard } from '../../lib/leaderboard'
import { adoptBoardResult, plateDay } from './daily'

/*
 * Today's Plates' board (Centroid's daily), for its cards: how many have played, who leads, and where you
 * are. Signed in, a day the board already has for you (from another device) is the day's here too, so this
 * one doesn't offer a first run the API would turn away. Half Full's todayBoard.ts is its model.
 */

const SLUG = 'centroid'

export type TodayBoard = {
  /** Players on today's board, each at their one day's run. */
  count: number
  leader: { name: string; score: number } | null
  you: { place: number; score: number } | null
}

/**
 * Today's board and your place on it, asked again when the day, your tag, the account signed in or `again`
 * changes; null `day` for none. Only the answer to the latest ask is returned, so a board from before a
 * run never stands in for the one after it.
 */
export function useTodayBoard(day: string | null, me: string, again: unknown = null): TodayBoard | null {
  const viewer = useAccountId()
  const ask = day ? `${day}|${me}|${String(again)}|${String(viewer)}` : null
  const [got, setGot] = useState<{ ask: string; board: TodayBoard } | null>(null)
  useEffect(() => {
    if (!day || !ask) return
    let cancelled = false
    // As players, counted by the API (getPlayerBoard): the leader, how many, and your place among them.
    getPlayerBoard(SLUG, 'daily', me || undefined, { limit: 1, around: 0 })
      .then((b) => {
        if (cancelled) return
        // Just past midnight the API's clock may still be on yesterday: that board isn't today's.
        const onDay = (at: number) => plateDay(at) === day
        const top = b.entries[0] && onDay(b.entries[0].at) ? b.entries[0] : null
        const yours = b.you && onDay(b.you.at) ? { place: b.you.place, score: b.you.score } : null
        // Only the account's own day, under its own tag, and only while it's still the one signed in: a tag
        // left over from whoever was signed in before is never read as this account's.
        const own = typeof viewer === 'string' && me !== '' && recallAccountTag(viewer) === me
        if (yours && own && currentAccountId() === viewer) adoptBoardResult(day, viewer, yours.score, Date.now())
        setGot({
          ask,
          board: {
            count: top ? b.total : 0,
            leader: top ? { name: top.name, score: top.score } : null,
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
  }, [ask, day, me, viewer])
  return got && got.ask === ask ? got.board : null
}
