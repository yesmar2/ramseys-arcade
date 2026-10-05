import { isDailyGame } from '../data/games'
import { RANKED_LEADERBOARD_GAMES, type GlobalRankResult, type LeaderboardGame, type LeaderboardPeriod } from './leaderboard'

/*
 * All time leaves the dailies out. A daily's board for longer than a day adds up its days' points, and added
 * up since it began that mostly counts the days played, so whoever came first would stay first. So Hot Lap,
 * Marble Run and Lander count toward the week's and the month's standings, where everyone has the same days,
 * and have no board for all time; all time is the other games' (Ramsey, 2026-10-05; API store.ts
 * ALL_TIME_GAMES). Asked for all time, a daily shows its month.
 */

/** Whether a game has a board, and a place in the standings, for a period: a daily has none for all time. */
export function hasBoardFor(slug: string, period: LeaderboardPeriod): boolean {
  return !(period === 'all' && isDailyGame(slug))
}

/** The board a game shows for a period: a daily's for all time is its month's. */
export function boardPeriodFor(slug: string, period: LeaderboardPeriod): LeaderboardPeriod {
  return hasBoardFor(slug, period) ? period : 'monthly'
}

/** The games with a board for all time: the ranked games but the dailies. */
export const ALL_TIME_GAMES: readonly LeaderboardGame[] = RANKED_LEADERBOARD_GAMES.filter((slug) => !isDailyGame(slug))

/** The games a period's standings add up. */
export function standingsGames(period: LeaderboardPeriod): readonly LeaderboardGame[] {
  return period === 'all' ? ALL_TIME_GAMES : RANKED_LEADERBOARD_GAMES
}

/**
 * The ranked dailies a player has played, any day, as their all-time rank says (API routes.ts /rank): the
 * all-time places leave the dailies out, so a player card asks this for every game they've played.
 */
export function dailiesPlayed(rank: GlobalRankResult | null | undefined): readonly string[] {
  const dailies = (rank as { dailies?: unknown } | null | undefined)?.dailies
  return Array.isArray(dailies) ? dailies.filter((slug): slug is string => typeof slug === 'string') : []
}
