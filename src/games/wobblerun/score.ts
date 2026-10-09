/**
 * Inverted-time scoring, as Hot Lap, Marble Run, Lander and Swoop keep it: the board stores a million less the run
 * in milliseconds, so higher is better and the shared leaderboard plumbing needs nothing new. A run is shown to the
 * hundredth while it runs, and to the thousandth on a board, as a lap is.
 */
export const WOBBLERUN_SCORE_BASE = 1_000_000

export function wobblerunBoardScore(seconds: number): number {
  return Math.max(0, WOBBLERUN_SCORE_BASE - Math.round(seconds * 1000))
}

export function wobblerunMsFromBoardScore(score: number): number {
  return WOBBLERUN_SCORE_BASE - score
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
 * A board's time is shown to the thousandth (1:24.372): with thousands on the same gauntlet the top runs come
 * within hundredths, and two places shown as the same time look like a mistake. The clock while running stays at
 * hundredths, easier to read on the move.
 */
export function formatWobblerunBoardScore(score: number): string {
  return formatRunMs(wobblerunMsFromBoardScore(score), 3)
}

/** "no splashes", "1 splash", "3 splashes": a run's falls into the soda sea (the engine counts them as splats). */
export const splashWords = (splats: number) => (splats === 0 ? 'no splashes' : splats === 1 ? '1 splash' : `${splats} splashes`)
