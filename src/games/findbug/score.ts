/**
 * Inverted-time scoring — higher is better, so the shared leaderboard plumbing
 * treats it like every other board. Same shape Spotter uses.
 */
export const FINDBUG_SCORE_BASE = 1_000_000

export function findbugBoardScore(runMs: number): number {
  return Math.max(0, FINDBUG_SCORE_BASE - Math.round(runMs))
}

export function findbugMsFromBoardScore(score: number): number {
  return FINDBUG_SCORE_BASE - score
}

export function formatFindbugMs(ms: number): string {
  const total = Math.max(0, ms) / 1000
  const m = Math.floor(total / 60)
  const s = total - m * 60
  if (m > 0) return `${m}:${s.toFixed(1).padStart(4, '0')}`
  return `${s.toFixed(1)}s`
}

export function formatFindbugBoardScore(score: number): string {
  return formatFindbugMs(findbugMsFromBoardScore(score))
}
