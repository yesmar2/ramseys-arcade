import { useEffect, useState } from 'react'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  fetchLeaderboardsSummary,
  fetchPlayerBests,
  getPlayerBoard,
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { standingsGames } from '../lib/allTime'
import {
  distinctTop,
  fieldSizes,
  lastFinal,
  nextUp,
  nextUpOn,
  periodCopy,
  type BoardLine,
  type BoardTop,
  type LastFinal,
  type Standing,
  type YouStanding,
} from '../lib/scoreboard'
import { isDayPointsBoard } from '../lib/leaderboardFormat'
import type { SeasonPrizes } from '../lib/seasonStandings'
import { fetchRecentTrophies } from '../lib/trophies'

export type ScoreboardData = {
  loading: boolean
  error: boolean
  totalPlayers: number
  /** The top ten overall. */
  standings: Standing[]
  /** Every board on the page, in catalog order, with or without runs. */
  boards: BoardLine[]
  /** The viewer, when they have a name; `rank` is null until they have runs this period. */
  you: YouStanding | null
  /** The viewer's best score on each board. */
  bests: Partial<Record<string, number>>
  /** The player directly above the viewer on each board; arrives after the rest. */
  nexts: Partial<Record<string, BoardTop | null>>
  /** How the period before finished, shown while this one is still thin. */
  last: LastFinal | null
  /** Whether `last` is still being asked for, after the rest is in: its room stays held till it comes. */
  lastWaiting: boolean
  /** The season's: what its places win, for the lines under them (lib/seasonStandings.ts prizeLines). */
  prizes: SeasonPrizes | null
}

const LOADING: ScoreboardData = {
  loading: true,
  error: false,
  totalPlayers: 0,
  standings: [],
  boards: [],
  you: null,
  bests: {},
  nexts: {},
  last: null,
  lastWaiting: false,
  prizes: null,
}

/** The summary's most runs per board: enough to find three players on all but the lopsided boards. */
const SUMMARY_RUNS = 10

/**
 * How many players above you a board is read for the one just above, and every place a run could land in. Any
 * further down, the API names the one just above and where beating them lands (nextUpOn).
 */
const NEXT_DEPTH = 500

/** Below this many players, the period before gets a look in under the standings. */
const THIN = 10

/**
 * How many of the latest awards to read for it: all the API will send. A
 * period's ten are handed out together as it closes, so the one just closed
 * is always among them.
 */
const TROPHY_DEPTH = 50

/**
 * Everything the boards page shows for one period: the standings, every
 * board's top three, and, for a player with a name, where they stand and the
 * score that takes each next place. The main numbers land together; the
 * next-place scores and last period's final follow, since each needs a
 * little more digging and the page reads fine without them.
 */
export function useScoreboard(
  period: LeaderboardPeriod,
  playerName: string,
  groupId: string | null,
  /** `groupId` when it's the page's own, not the site's: How your rank works from a group's page. */
  pageGroup?: string,
): ScoreboardData {
  const [data, setData] = useState<ScoreboardData>(LOADING)

  useEffect(() => {
    let cancelled = false
    const me = normalizePlayerName(playerName)
    setData((prev) => ({ ...prev, loading: true, error: false }))

    void (async () => {
      try {
        const [board, summary, mine, bests] = await Promise.all([
          fetchGlobalBoard(10, period, 0, pageGroup),
          fetchLeaderboardsSummary(period, SUMMARY_RUNS, pageGroup),
          me ? fetchGlobalRank(me, period, pageGroup) : Promise.resolve(null),
          me ? fetchPlayerBests(me, period, pageGroup).catch(() => ({})) : Promise.resolve({}),
        ])
        if (cancelled) return

        const standings = board.entries
        const you: YouStanding | null =
          me && mine
            ? {
                name: me,
                rank: mine.rank,
                score: mine.score,
                totalPlayers: mine.totalPlayers,
                byGame: mine.byGame ?? {},
                nearby: mine.nearby ?? [],
                avatarId: mine.avatarId,
              }
            : null
        const sizes = fieldSizes([...standings.map((s) => s.byGame), you?.byGame])
        const runsBySlug = new Map(summary.map((g) => [g.slug, g.entries]))

        // The boards the period's standings add up: all time's leave the dailies out (lib/allTime.ts).
        const boards = await Promise.all(
          standingsGames(period).map(async (slug): Promise<BoardLine> => {
            const runs: LeaderboardEntry[] = runsBySlug.get(slug) ?? []
            let top = distinctTop(runs)
            // A page that came back short is the whole board, so its names can be counted.
            let players =
              sizes[slug] ??
              (runs.length < SUMMARY_RUNS ? new Set(runs.map((r) => normalizePlayerName(r.name ?? ''))).size : null)
            // Ten runs between one or two players: the board as players has its top three, however many runs they hold.
            if (top.length < 3 && runs.length >= SUMMARY_RUNS) {
              try {
                const board = await getPlayerBoard(slug, period, undefined, { limit: 3 }, pageGroup)
                top = distinctTop(board.entries)
                players = sizes[slug] ?? board.total
              } catch {
                /* keep the summary's */
              }
            }
            // A daily's board for longer than a day is its day points (leaderboardFormat isDayPointsBoard).
            return { slug, top, players, points: isDayPointsBoard(slug, period) }
          }),
        )
        if (cancelled) return

        // Last period's final, while this one is thin. Trophies are everyone's, so not inside a group.
        const copy = periodCopy(period, Date.now(), Boolean(groupId))
        const askLast = Boolean(copy.last && !groupId && board.totalPlayers < THIN)

        setData({
          loading: false,
          error: false,
          totalPlayers: board.totalPlayers,
          standings,
          boards,
          you,
          bests,
          nexts: {},
          last: null,
          lastWaiting: askLast,
          prizes: board.prizes ?? null,
        })

        if (askLast && copy.last) {
          const { period: closed, key } = copy.last
          void fetchRecentTrophies(TROPHY_DEPTH)
            .then((awards) => {
              const rows = lastFinal(awards, closed, key)
              // A podium at least, or it is not worth the room.
              if (!cancelled) setData((prev) => ({ ...prev, last: rows.length >= 3 ? rows : null, lastWaiting: false }))
            })
            .catch(() => {
              if (!cancelled) setData((prev) => ({ ...prev, lastWaiting: false }))
            })
        }

        // The score that takes the next place up, on each board scored by runs.
        // A daily's week/month/all-time board is day points, which climb a day at a time: nothing reads a next score there.
        if (you && you.rank != null) {
          const places = Object.entries(you.byGame).filter(
            ([slug, p]) => p && p.place > 1 && !isDayPointsBoard(slug, period),
          )
          const found = await Promise.all(
            places.map(async ([slug, place]) => {
              try {
                // Every player above you, once each at their best, rather than every run of theirs above yours.
                const above = (place?.place ?? 1) - 1
                if (above > NEXT_DEPTH) {
                  const board = await getPlayerBoard(slug, period, me, { limit: 1, around: 1 }, pageGroup)
                  return [slug, nextUpOn(board)] as const
                }
                const board = await getPlayerBoard(slug, period, undefined, { limit: above }, pageGroup)
                return [slug, nextUp(board.entries, me)] as const
              } catch {
                return [slug, null] as const
              }
            }),
          )
          if (!cancelled) setData((prev) => ({ ...prev, nexts: Object.fromEntries(found) }))
        }
      } catch {
        if (!cancelled) setData({ ...LOADING, loading: false, error: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [period, playerName, groupId, pageGroup])

  return data
}
