/**
 * Inverted-time scoring, as Hot Lap and Marble Run keep it: the board stores a million less the run in
 * milliseconds, so higher is better and the shared leaderboard plumbing needs nothing new. A run is shown to
 * the hundredth, as a lap is.
 */
export const LANDER_SCORE_BASE = 1_000_000

export function landerBoardScore(seconds: number): number {
  return Math.max(0, LANDER_SCORE_BASE - Math.round(seconds * 1000))
}

export function landerMsFromBoardScore(score: number): number {
  return LANDER_SCORE_BASE - score
}

/** 48.37s, or 1:02.45 past a minute. */
export function formatRunMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 10)) / 100
  const m = Math.floor(total / 60)
  const s = total - m * 60
  if (m > 0) return `${m}:${s.toFixed(2).padStart(5, '0')}`
  return `${s.toFixed(2)}s`
}

export function formatRun(seconds: number): string {
  return formatRunMs(seconds * 1000)
}

export function formatLanderBoardScore(score: number): string {
  return formatRunMs(landerMsFromBoardScore(score))
}

/** "no crashes", "1 crash", "3 crashes". */
export const crashWords = (crashes: number) => (crashes === 0 ? 'no crashes' : crashes === 1 ? '1 crash' : `${crashes} crashes`)
