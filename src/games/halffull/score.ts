import { frac, type Glass } from './glasses'
import { splitShare, type Split } from './plan'

/*
 * Half Full's scoring. A pour is judged by how full the glass really is: 45% full scores 90, 31% full
 * scores 62 (100, less twice the points off half). The split is judged the same way by the first
 * glass's share of the juice. The day is the mean of the five, and the board keeps it in hundredths
 * (9120 is 91.2%).
 *
 * How far off half is taken to a tenth of a point, and everything a player sees is worked from that one
 * figure: the fill, the words, the points and the square always agree, and a dead-on pour is 100.
 */

/** How full a glass is at a level, in percent (unrounded). */
export function fillPercent(g: Glass, level: number): number {
  return 100 * frac(g, level)
}

/** The split's first glass's share of the juice, in percent. */
export function sharePercent(s: Split, levelA: number): number {
  return 100 * splitShare(s, levelA)
}

/** How far off half, to a tenth of a point. */
export function offHalf(percent: number): number {
  return Math.round(10 * Math.abs(percent - 50)) / 10
}

/** A pour's score: 100 at half, less two for every point off (a multiple of 0.2). */
export function pourScore(percent: number): number {
  return Math.max(0, 100 - 2 * offHalf(percent))
}

/** The day's score, the mean of its pours. */
export function dayScore(scores: readonly number[]): number {
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
}

/** The board's figure: hundredths of a point. */
export function boardScore(day: number): number {
  return Math.round(100 * day)
}

/** The day to a tenth, rounded down, as it's shown and as its tier is judged: never "96.0%" short of Spot On. */
export function dayTenths(day: number): number {
  return Math.floor(10 * day + 1e-6) / 10
}

/** "91.2%" */
export function formatScore(day: number): string {
  return `${dayTenths(day).toFixed(1)}%`
}

export type Tier = 'Spot On' | 'Steady Hand' | 'Good Pour' | 'Sloshy' | 'Spill Hazard'

export function tierFor(day: number): Tier {
  day = dayTenths(day)
  if (day >= 96) return 'Spot On'
  if (day >= 92) return 'Steady Hand'
  if (day >= 86) return 'Good Pour'
  if (day >= 76) return 'Sloshy'
  return 'Spill Hazard'
}

export type Mark = '🎯' | '🟩' | '🟨' | '🟧' | '🟥'

/** A pour as a square: within 2 points, 5, 10, 20, or further off. */
export function markFor(score: number): Mark {
  if (score >= 96) return '🎯'
  if (score >= 90) return '🟩'
  if (score >= 80) return '🟨'
  if (score >= 60) return '🟧'
  return '🟥'
}

export type Team = 'Full' | 'Empty'

/** Over-poured on the whole (or dead even): Team Half-Full. Under: Team Half-Empty. */
export function teamFor(halfPercents: readonly number[]): Team {
  const signed = halfPercents.reduce((a, p) => a + (p - 50), 0)
  return signed >= 0 ? 'Full' : 'Empty'
}

/** How full, to a tenth, as the player sees it: half, give or take the tenths it was off ("30.8%"). */
export function formatPercent(percent: number): string {
  const off = offHalf(percent)
  return `${(percent < 50 ? 50 - off : 50 + off).toFixed(1)}%`
}

/** How far off half: "0.4", "19.2". */
export function formatOff(percent: number): string {
  return offHalf(percent).toFixed(1)
}

/** A pour's points: "100", "99.4". */
export function formatPoints(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}
