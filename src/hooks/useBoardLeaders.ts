import { useEffect, useState } from 'react'
import { isDailyGame, isRankedGame } from '../data/games'
import { useActiveGroup } from '../lib/groups'
import { fetchLeaderboardsSummary, getPlayerBoard, type GameBoardPreview, type LeaderboardPeriod } from '../lib/leaderboard'
import { distinctTop, type BoardTop } from '../lib/scoreboard'

/** How many of each board's players a cabinet's high-score table shows. */
const TABLE = 3
/** The top runs asked for to find them: one player can hold several (the boards page asks as many). */
const RUNS = 10

export type BoardLeader = {
  entry: BoardTop
  /** The board's top players, each at their best, the leader first: the cabinet's high-score table. */
  entries: BoardTop[]
  /** Whether these are the period's or, with nobody on the period's board yet, all time's. */
  period: LeaderboardPeriod
}

export type BoardLeaders = {
  /** Each game's leaders once they've come, a game with no scores at all left out; null until then. */
  leaders: Record<string, BoardLeader> | null
  /** They didn't come: a cabinet then says nothing of who leads, rather than that nobody does. */
  failed: boolean
}

/** Each game's leaders from a summary, and in `more` the games whose top runs are one or two players' only. */
function topOf(games: GameBoardPreview[], period: LeaderboardPeriod, into: Record<string, BoardLeader>, more: Set<string>) {
  for (const game of games) {
    // A daily's table is today's runs: its week and month are day points, not runs, and it has no all time. A
    // daily just for fun has no table: it names nobody (data/games.ts Game.ranked).
    if (isDailyGame(game.slug) !== (period === 'daily') || !isRankedGame(game.slug)) continue
    // Players, as a board lists them: a run of theirs below their best isn't a place of its own.
    const entries = distinctTop(game.entries, TABLE)
    const entry = entries[0]
    if (!entry || into[game.slug]) continue
    into[game.slug] = { entry, entries, period }
    if (entries.length < TABLE && game.entries.length >= RUNS) more.add(game.slug)
  }
}

/**
 * Who leads each game's board for a period, and the two players behind: the
 * top runs per slug, from the one summary request the boards page also makes.
 * Early in a week or month a board can be empty, so a game nobody has played
 * yet this period falls back to its all-time table, marked as such. A game
 * with no scores at all is simply absent. The wall shows the leader under
 * every cabinet, the way an arcade shows the high score on every machine, and
 * the three as the table over its screen.
 */
export function useBoardLeaders(period: LeaderboardPeriod): BoardLeaders {
  const groupId = useActiveGroup()
  const [leaders, setLeaders] = useState<BoardLeaders>({ leaders: null, failed: false })

  useEffect(() => {
    let cancelled = false
    // The period's tables, all time's for a board nobody's on yet, and today's for the dailies.
    const loads = [
      fetchLeaderboardsSummary(period, RUNS),
      period !== 'all' ? fetchLeaderboardsSummary('all', RUNS) : Promise.resolve(null),
      period !== 'daily' ? fetchLeaderboardsSummary('daily', RUNS) : Promise.resolve(null),
    ]
    Promise.all(loads)
      .then(([current, allTime, today]) => {
        if (cancelled) return
        const next: Record<string, BoardLeader> = {}
        const more = new Set<string>()
        topOf(current ?? [], period, next, more)
        if (allTime) topOf(allTime, 'all', next, more)
        if (today) topOf(today, 'daily', next, more)
        setLeaders({ leaders: next, failed: false })
        // Ten runs between one or two players: the board as players has its top three, however many runs they
        // hold (as the boards page fills its own). A table that can't be filled keeps the players it has.
        void Promise.all(
          [...more].map(async (slug) => {
            const leader = next[slug]!
            const board = await getPlayerBoard(slug, leader.period, undefined, { limit: TABLE }).catch(() => null)
            const entries = board ? distinctTop(board.entries, TABLE) : []
            return entries.length > leader.entries.length ? ([slug, { ...leader, entries }] as const) : null
          }),
        ).then((filled) => {
          const found = filled.filter((f) => f != null)
          if (cancelled || found.length === 0) return
          setLeaders({ leaders: { ...next, ...Object.fromEntries(found) }, failed: false })
        })
      })
      .catch(() => {
        if (!cancelled) setLeaders({ leaders: null, failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [period, groupId])

  return leaders
}
