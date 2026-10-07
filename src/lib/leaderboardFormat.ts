import { isDailyGame, isRankedGame } from '../data/games'
import { formatAcechaseBoardScore } from '../games/acechase/score'
import { formatFindbugBoardScore } from '../games/findbug/score'
import { formatBoard } from '../games/halffull/boardFigure'
import { formatBoard as formatPlatesBoard } from '../games/dead-center/boardFigure'
import { formatHotlapBoardScore } from '../games/hotlap/score'
import { formatLanderBoardScore } from '../games/lander/score'
import { formatMarblerunBoardScore } from '../games/marblerun/score'
import { formatSpotterBoardScore } from '../games/spotter/score'
import { formatSwoopBoardScore } from '../games/swoop/score'

/** Boards that store inverted time rather than points — they read as a clock. */
export function isTimeBoard(slug: string): boolean {
  return slug === 'spotter' || slug === 'findbug' || slug === 'hotlap' || slug === 'marblerun' || slug === 'lander' || slug === 'swoop'
}

/** Boards that store inverted tries rather than points: Ace Chase's, the tries a day's first bullseye took. */
export function isTriesBoard(slug: string): boolean {
  return slug === 'acechase'
}

/** Boards kept as a base less what they count, time or tries: fewer is better, and the figure says its unit. */
export function isInvertedBoard(slug: string): boolean {
  return isTimeBoard(slug) || isTriesBoard(slug)
}

/**
 * Boards kept in hundredths of a percent: Half Full's, how close a day's five pours came to half (9124 is
 * 91.2%). Higher is better, as with points, but the figure says its own unit.
 */
export function isPercentBoard(slug: string): boolean {
  return slug === 'halffull' || slug === 'centroid'
}

/** Boards that store inverted time rather than points render as a clock; inverted tries, as tries; a percent, as one. */
export function formatLeaderboardScore(slug: string, score: number): string {
  if (slug === 'acechase') return formatAcechaseBoardScore(score)
  if (slug === 'spotter') return formatSpotterBoardScore(score)
  if (slug === 'findbug') return formatFindbugBoardScore(score)
  if (slug === 'hotlap') return formatHotlapBoardScore(score)
  if (slug === 'marblerun') return formatMarblerunBoardScore(score)
  if (slug === 'lander') return formatLanderBoardScore(score)
  if (slug === 'swoop') return formatSwoopBoardScore(score)
  if (slug === 'halffull') return formatBoard(score)
  // Centroid's daily since 2026-10-06, its days in hundredths of a point (dead-center/score.ts).
  if (slug === 'centroid') return formatPlatesBoard(score)
  return score.toLocaleString()
}

/** The gap between two times on a time board: in tenths, or thousandths for a lap or a run, as their boards show them. */
export function formatTimeGap(slug: string, ms: number): string {
  return `${(ms / 1000).toFixed(slug === 'hotlap' || slug === 'marblerun' || slug === 'lander' || slug === 'swoop' ? 3 : 1)}s`
}

/**
 * The gap between two figures on a percent board, from the tenths on show, so it agrees with them: 91.2%
 * against 90.8% is 0.4%, whatever the hundredths underneath. Two that show the same tenth but aren't tied
 * are hundredths apart, 0.04%, rather than a "0.0%" that reads as a tie.
 */
export function formatPercentGap(a: number, b: number): string {
  const tenths = Math.abs(Math.floor(a / 10) - Math.floor(b / 10))
  if (tenths > 0 || a === b) return `${(tenths / 10).toFixed(1)}%`
  return `${(Math.abs(a - b) / 100).toFixed(2)}%`
}

/**
 * Whether a board is a daily's day points. A daily game's board for a day is that day's runs; for the week
 * or the month it ranks its players by the points each day's board paid them by place (the API's store.ts
 * dayPointsBoard), since one day's track, hole or scenes can't be weighed against another's. It has no board
 * for all time (lib/allTime.ts).
 */
export function isDayPointsBoard(slug: string, period: string): boolean {
  return period !== 'daily' && isDailyGame(slug) && isRankedGame(slug)
}

/** "285 pts": a player's day points on a daily's board for longer than a day. */
export function formatDayPoints(points: number): string {
  return `${points.toLocaleString()} ${points === 1 ? 'pt' : 'pts'}`
}

/** A score on a game's board for a period: a run's, or on a daily's board for longer than a day, day points. */
export function formatBoardScore(slug: string, score: number, period: string): string {
  return isDayPointsBoard(slug, period) ? formatDayPoints(score) : formatLeaderboardScore(slug, score)
}
