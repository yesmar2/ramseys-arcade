import { isDailyGame } from '../data/games'
import { formatAcechaseBoardScore } from '../games/acechase/score'
import { formatFindbugBoardScore } from '../games/findbug/score'
import { formatHotlapBoardScore } from '../games/hotlap/score'
import { formatSpotterBoardScore } from '../games/spotter/score'

/** Boards that store inverted time rather than points — they read as a clock. */
export function isTimeBoard(slug: string): boolean {
  return slug === 'spotter' || slug === 'findbug' || slug === 'hotlap'
}

/** Boards that store inverted tries rather than points: Ace Chase's, the tries a day's first bullseye took. */
export function isTriesBoard(slug: string): boolean {
  return slug === 'acechase'
}

/** Boards kept as a base less what they count, time or tries: fewer is better, and the figure says its unit. */
export function isInvertedBoard(slug: string): boolean {
  return isTimeBoard(slug) || isTriesBoard(slug)
}

/** Boards that store inverted time rather than points render as a clock; inverted tries, as tries. */
export function formatLeaderboardScore(slug: string, score: number): string {
  if (slug === 'acechase') return formatAcechaseBoardScore(score)
  if (slug === 'spotter') return formatSpotterBoardScore(score)
  if (slug === 'findbug') return formatFindbugBoardScore(score)
  if (slug === 'hotlap') return formatHotlapBoardScore(score)
  return score.toLocaleString()
}

/** The gap between two times on a time board: in tenths, or hundredths for a lap, which is won by them. */
export function formatTimeGap(slug: string, ms: number): string {
  return `${(ms / 1000).toFixed(slug === 'hotlap' ? 2 : 1)}s`
}

/**
 * Whether a board is a daily's day points. A daily game's board for a day is that day's runs; for longer
 * (the week, the month, all time) it ranks its players by the points each day's board paid them by place
 * (the API's store.ts dayPointsBoard), since one day's track, hole or scenes can't be weighed against another's.
 */
export function isDayPointsBoard(slug: string, period: string): boolean {
  return period !== 'daily' && isDailyGame(slug)
}

/** "285 pts": a player's day points on a daily's board for longer than a day. */
export function formatDayPoints(points: number): string {
  return `${points.toLocaleString()} ${points === 1 ? 'pt' : 'pts'}`
}

/** A score on a game's board for a period: a run's, or on a daily's board for longer than a day, day points. */
export function formatBoardScore(slug: string, score: number, period: string): string {
  return isDayPointsBoard(slug, period) ? formatDayPoints(score) : formatLeaderboardScore(slug, score)
}
