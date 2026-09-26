/**
 * Inverted-time scoring, as Find the Bug and Spotter keep it: the board stores a million less the lap
 * in milliseconds, so higher is better and the shared leaderboard plumbing needs nothing new. A lap is
 * shown to the hundredth, as lap times are.
 */
export const HOTLAP_SCORE_BASE = 1_000_000

export function hotlapBoardScore(lapSeconds: number): number {
  return Math.max(0, HOTLAP_SCORE_BASE - Math.round(lapSeconds * 1000))
}

export function hotlapMsFromBoardScore(score: number): number {
  return HOTLAP_SCORE_BASE - score
}

/** 53.36s, or 1:02.45 past a minute. */
export function formatLapMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 10)) / 100
  const m = Math.floor(total / 60)
  const s = total - m * 60
  if (m > 0) return `${m}:${s.toFixed(2).padStart(5, '0')}`
  return `${s.toFixed(2)}s`
}

export function formatLap(seconds: number): string {
  return formatLapMs(seconds * 1000)
}

export function formatHotlapBoardScore(score: number): string {
  return formatLapMs(hotlapMsFromBoardScore(score))
}
