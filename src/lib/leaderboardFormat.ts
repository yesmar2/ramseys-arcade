import { formatFindbugBoardScore } from '../games/findbug/score'
import { formatSpotterBoardScore } from '../games/spotter/score'

/** Boards that store inverted time rather than points — they read as a clock. */
export function isTimeBoard(slug: string): boolean {
  return slug === 'spotter' || slug === 'findbug'
}

/** Boards that store inverted time rather than points render as a clock. */
export function formatLeaderboardScore(slug: string, score: number): string {
  if (slug === 'spotter') return formatSpotterBoardScore(score)
  if (slug === 'findbug') return formatFindbugBoardScore(score)
  return score.toLocaleString()
}
