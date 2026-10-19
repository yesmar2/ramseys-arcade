/**
 * Inverted-time scoring, as Hot Lap, Marble Run and Lander keep it: the board stores a million less the run
 * in milliseconds, so higher is better and the shared leaderboard plumbing needs nothing new. A run is shown
 * to the hundredth while it runs, and to the thousandth on a board, as a lap is.
 */
export const SLING_SCORE_BASE = 1_000_000

export function slingBoardScore(seconds: number): number {
  return Math.max(0, SLING_SCORE_BASE - Math.round(seconds * 1000))
}

export function slingMsFromBoardScore(score: number): number {
  return SLING_SCORE_BASE - score
}

/** 48.37s, or 1:02.45 past a minute; to the thousandth with `digits` 3. */
export function formatRunMs(ms: number, digits = 2): string {
  const unit = 10 ** (3 - digits)
  const total = Math.max(0, Math.round(ms / unit)) / 10 ** digits
  const m = Math.floor(total / 60)
  const s = total - m * 60
  if (m > 0) return `${m}:${s.toFixed(digits).padStart(digits + 3, '0')}`
  return `${s.toFixed(digits)}s`
}

export function formatRun(seconds: number): string {
  return formatRunMs(seconds * 1000)
}

/**
 * A board's time is shown to the thousandth (48.372s): with thousands on the same tower the top runs come
 * within hundredths, and two places shown as the same time look like a mistake. The clock while playing stays
 * at hundredths, easier to read on the move.
 */
export function formatSlingBoardScore(score: number): string {
  return formatRunMs(slingMsFromBoardScore(score), 3)
}

/** "no misses", "1 miss", "3 misses". */
export const missWords = (n: number) => (n === 0 ? 'no misses' : n === 1 ? '1 miss' : `${n} misses`)

/** "no skips", "1 peg skipped", "4 pegs skipped". */
export const skipWords = (n: number) => (n === 0 ? 'no skips' : n === 1 ? '1 peg skipped' : `${n} pegs skipped`)
