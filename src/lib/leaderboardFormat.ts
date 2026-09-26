import { formatFindbugBoardScore } from '../games/findbug/score'
import { formatHotlapBoardScore } from '../games/hotlap/score'
import { formatSpotterBoardScore } from '../games/spotter/score'

/** Boards that store inverted time rather than points — they read as a clock. */
export function isTimeBoard(slug: string): boolean {
  return slug === 'spotter' || slug === 'findbug' || slug === 'hotlap'
}

/** Boards that store inverted time rather than points render as a clock. */
export function formatLeaderboardScore(slug: string, score: number): string {
  if (slug === 'spotter') return formatSpotterBoardScore(score)
  if (slug === 'findbug') return formatFindbugBoardScore(score)
  if (slug === 'hotlap') return formatHotlapBoardScore(score)
  return score.toLocaleString()
}

/** The gap between two times on a time board: in tenths, or hundredths for a lap, which is won by them. */
export function formatTimeGap(slug: string, ms: number): string {
  return `${(ms / 1000).toFixed(slug === 'hotlap' ? 2 : 1)}s`
}
