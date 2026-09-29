import { useEffect, useRef, useState } from 'react'
import { api, type LeaderboardGame } from './leaderboard'

/*
 * How each of today's dailies stands on its board, for the home page's Today row (HomeToday.tsx): how
 * many have played it today, who leads, and the viewer's place. It's today's line of each game's days
 * (the API's GET /leaderboards/:game/days, as How your rank works reads them). It's asked for when the row
 * opens, and again past the browser's copy whenever the viewer punches another, since their place moves.
 */

export type DayStanding = {
  /** Players on the day's board. */
  players: number
  top: { name: string; score: number }
  /** The viewer's best that day and its place among the players, when their tag is on the board. */
  you: { score: number; place: number } | null
}

type DaysReply = {
  days?: { day: string; players: number; top: { name: string; score: number }; you: { score: number; place: number } | null }[]
}

/** One game's day, or null for a day nobody has played it yet; undefined when the API couldn't say. */
async function standingOf(slug: LeaderboardGame, day: string, me: string, fresh: boolean): Promise<DayStanding | null | undefined> {
  try {
    const query = me ? `?name=${encodeURIComponent(me)}` : ''
    const reply = await api<DaysReply>(`/leaderboards/${slug}/days${query}`, fresh ? { cache: 'no-cache' } : undefined)
    const found = reply.days?.find((d) => d.day === day)
    return found ? { players: found.players, top: found.top, you: found.you } : null
  } catch {
    return undefined
  }
}

/**
 * Each daily's standing today, by game: null for one nobody has played today. The whole map is null until
 * the first answers are in. `punched` is how many the viewer has done: when it changes, the day is asked
 * for again.
 */
export function useDayStandings(slugs: readonly LeaderboardGame[], day: string, me: string, punched: number): Map<string, DayStanding | null> | null {
  const [got, setGot] = useState<{ ask: string; standings: Map<string, DayStanding | null> } | null>(null)
  const asked = useRef<string | null>(null)
  const games = slugs.join(',')
  const ask = `${games}|${day}|${me}`
  useEffect(() => {
    let live = true
    // The same games, day and tag asked again for a new punch: past the browser's copy, which may be older than it.
    const fresh = asked.current === ask
    asked.current = ask
    const list = games.split(',').filter(Boolean) as LeaderboardGame[]
    void Promise.all(list.map((slug) => standingOf(slug, day, me, fresh))).then((answers) => {
      if (!live) return
      setGot((had) => {
        const standings = new Map<string, DayStanding | null>()
        list.forEach((slug, i) => {
          const answer = answers[i]
          // One the API couldn't answer keeps what was known of it.
          if (answer !== undefined) standings.set(slug, answer)
          else if (had?.ask === ask && had.standings.has(slug)) standings.set(slug, had.standings.get(slug)!)
        })
        return { ask, standings }
      })
    })
    return () => {
      live = false
    }
  }, [ask, games, day, me, punched])
  return got && got.ask === ask ? got.standings : null
}
