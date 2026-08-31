/** Stored leaderboard score — higher is better (inverted time). */
export const SPOTTER_SCORE_BASE = 1_000_000

export const SPOTTER_STRIKE_MS = 3000
export const SPOTTER_HINT_MS = 15_000
export const SPOTTER_HARD_CAP_MS = 180_000

export function spotterLeaderboardMs(
  findMs: number,
  strikes: number,
  hintPenaltyMs = 0,
): number {
  return findMs + strikes * SPOTTER_STRIKE_MS + hintPenaltyMs
}

export function spotterBoardScore(leaderboardMs: number): number {
  return Math.max(0, SPOTTER_SCORE_BASE - Math.round(leaderboardMs))
}

export function spotterMsFromBoardScore(score: number): number {
  return SPOTTER_SCORE_BASE - score
}

export function formatSpotterMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`
  return `0:${String(s).padStart(2, '0')}`
}

export function formatSpotterBoardScore(score: number): string {
  return formatSpotterMs(spotterMsFromBoardScore(score))
}

export function formatLeaderboardScore(slug: string, score: number): string {
  if (slug === 'spotter') return formatSpotterBoardScore(score)
  return score.toLocaleString()
}
