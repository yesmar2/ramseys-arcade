/**
 * Inverted-time scoring, as Find the Bug and Spotter keep it: the board stores a million less the lap
 * in milliseconds, so higher is better and the shared leaderboard plumbing needs nothing new. A lap is
 * shown to the hundredth while it's driven, and to the thousandth on a board.
 */
export const HOTLAP_SCORE_BASE = 1_000_000

export function hotlapBoardScore(lapSeconds: number): number {
  return Math.max(0, HOTLAP_SCORE_BASE - Math.round(lapSeconds * 1000))
}

export function hotlapMsFromBoardScore(score: number): number {
  return HOTLAP_SCORE_BASE - score
}

/** 53.36s, or 1:02.45 past a minute; to the thousandth with `digits` 3. */
export function formatLapMs(ms: number, digits = 2): string {
  const unit = 10 ** (3 - digits)
  const total = Math.max(0, Math.round(ms / unit)) / 10 ** digits
  const m = Math.floor(total / 60)
  const s = total - m * 60
  if (m > 0) return `${m}:${s.toFixed(digits).padStart(digits + 3, '0')}`
  return `${s.toFixed(digits)}s`
}

export function formatLap(seconds: number): string {
  return formatLapMs(seconds * 1000)
}

/**
 * A board's time is shown to the thousandth (48.372s): with thousands on a course the top runs come within
 * hundredths, and two places shown as the same time look like a mistake. The clock while playing stays at
 * hundredths, easier to read on the move.
 */
export function formatHotlapBoardScore(score: number): string {
  return formatLapMs(hotlapMsFromBoardScore(score), 3)
}
