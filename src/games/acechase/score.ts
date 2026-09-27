/**
 * Ace Chase's board keeps a day's result the way the time boards keep theirs: a million less the tries
 * Today's Hole's first bullseye took, so higher is better and the shared leaderboard plumbing needs
 * nothing new. The API (dailyHole.ts, scoreLimits.ts) puts it there, so 999,999 is an ace.
 */
export const ACECHASE_SCORE_BASE = 1_000_000

export function acechaseTriesFromBoardScore(score: number): number {
  return ACECHASE_SCORE_BASE - score
}

/** 1 try, 3 tries; an average to a tenth, 2.4 tries. */
export function formatTries(tries: number): string {
  const n = Number.isInteger(tries) ? tries.toLocaleString() : tries.toFixed(1)
  return `${n} ${tries === 1 ? 'try' : 'tries'}`
}

/**
 * A board score as tries. Anything outside a day's tries is a round of the three holes Ace Chase had
 * before it was a daily, in points, which no longer reads as anything.
 */
export function formatAcechaseBoardScore(score: number): string {
  const tries = acechaseTriesFromBoardScore(score)
  return tries >= 1 && tries <= 1000 ? formatTries(Math.round(tries * 10) / 10) : '—'
}
