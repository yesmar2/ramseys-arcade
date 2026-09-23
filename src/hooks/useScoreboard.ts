import { useEffect, useState } from 'react'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  fetchLeaderboardsSummary,
  fetchPlayerBests,
  getLeaderboard,
  normalizePlayerName,
  VISIBLE_LEADERBOARD_GAMES,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import {
  distinctTop,
  fieldSizes,
  lastFinal,
  nextUp,
  periodCopy,
  type BoardLine,
  type BoardTop,
  type LastFinal,
  type Standing,
  type YouStanding,
} from '../lib/scoreboard'
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
}

/** The summary's most runs per board: enough to find three players on all but the lopsided boards. */
const SUMMARY_RUNS = 10

/** How far down a board to look for the player above you. Any further and the hint is left off. */
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
): ScoreboardData {
  const [data, setData] = useState<ScoreboardData>(LOADING)

  useEffect(() => {
    let cancelled = false
    const me = normalizePlayerName(playerName)
    setData((prev) => ({ ...prev, loading: true, error: false }))

    void (async () => {
      try {
        const [board, summary, mine, bests] = await Promise.all([
          fetchGlobalBoard(10, period),
          fetchLeaderboardsSummary(period, SUMMARY_RUNS),
          me ? fetchGlobalRank(me, period) : Promise.resolve(null),
          me ? fetchPlayerBests(me, period).catch(() => ({})) : Promise.resolve({}),
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

        const boards = await Promise.all(
          VISIBLE_LEADERBOARD_GAMES.map(async (slug): Promise<BoardLine> => {
            let runs: LeaderboardEntry[] = runsBySlug.get(slug) ?? []
            let asked = SUMMARY_RUNS
            let top = distinctTop(runs)
            // Ten runs between one or two players: look further down for a third.
            if (top.length < 3 && runs.length >= SUMMARY_RUNS) {
              try {
                asked = 100
                runs = (await getLeaderboard(slug, period, undefined, { limit: asked })).entries
                top = distinctTop(runs)
              } catch {
                /* keep the summary's */
              }
            }
            // A page that came back short is the whole board, so its names can be counted.
            const whole = runs.length < asked
            const players =
              sizes[slug] ??
              (whole ? new Set(runs.map((r) => normalizePlayerName(r.name ?? ''))).size : null)
            return { slug, top, players }
          }),
        )
        if (cancelled) return

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
        })

        // Last period's final, while this one is thin. Trophies are everyone's, so not inside a group.
        const copy = periodCopy(period, Date.now(), Boolean(groupId))
        if (copy.last && !groupId && board.totalPlayers < THIN) {
          const { period: closed, key } = copy.last
          void fetchRecentTrophies(TROPHY_DEPTH)
            .then((awards) => {
              const rows = lastFinal(awards, closed, key)
              // A podium at least, or it is not worth the room.
              if (!cancelled && rows.length >= 3) setData((prev) => ({ ...prev, last: rows }))
            })
            .catch(() => {})
        }

        // The score that takes the next place up, on each board you are on.
        if (you && you.rank != null) {
          const places = Object.entries(you.byGame).filter(([, p]) => p && p.place > 1)
          const found = await Promise.all(
            places.map(async ([slug, place]) => {
              try {
                const depth = Math.min(NEXT_DEPTH, Math.max(50, (place?.place ?? 1) * 3))
                const page = await getLeaderboard(slug, period, me, { limit: depth })
                const rank = page.you?.rank
                if (!rank) return [slug, null] as const
                let runs = page.entries
                if (rank - 1 > runs.length) {
                  if (rank - 1 > NEXT_DEPTH) return [slug, null] as const
                  runs = (await getLeaderboard(slug, period, undefined, { limit: rank - 1 })).entries
                }
                return [slug, nextUp(runs.slice(0, rank - 1), me)] as const
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
  }, [period, playerName, groupId])

  return data
}
