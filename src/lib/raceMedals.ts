/*
 * Medals on the racing dailies (Hot Lap, Marble Run, Lander): how a day's best went against that day's blue
 * car, ball or ship, on the same steps its tickets are paid by (the API's ticketLadders.ts): bronze within 2%
 * of it, silver beating it, gold beating it by 3%, platinum by 6%. Ramsey picked them (2026-10-05) so every run
 * has a goal in reach and "gold on all three" is one for the day.
 *
 * They aren't the boards' gold, silver and bronze (PodiumMedal: 1st, 2nd, 3rd). These are against the blue, so
 * anyone can have one. They're worked out here from a day's blue time, which each game's plan holds (and the
 * API's paces are made from), so no medal waits on a request: the caller hands in the pace, and a page that
 * shows one game never loads another's plan.
 */

export type RaceGame = 'hotlap' | 'marblerun' | 'lander'
export type Medal = 'bronze' | 'silver' | 'gold' | 'platinum'

export const MEDALS: readonly Medal[] = ['bronze', 'silver', 'gold', 'platinum']

export const MEDAL_NAMES: Record<Medal, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }

const BLUE: Record<RaceGame, string> = { hotlap: 'blue car', marblerun: 'blue ball', lander: 'blue ship' }

export function isRaceGame(slug: string): slug is RaceGame {
  return slug === 'hotlap' || slug === 'marblerun' || slug === 'lander'
}

/** A day's blue time in ms, from its plan's pace in seconds. */
export function paceMsOf(paceSeconds: number): number {
  return Math.round(paceSeconds * 1000)
}

/** Each medal's time on a day, in ms: the slowest that still takes it (ticketLadders.ts's steps). */
export function medalTimes(paceMs: number): Record<Medal, number> {
  return {
    bronze: Math.round(paceMs * 1.02),
    silver: paceMs - 1,
    gold: Math.round(paceMs * 0.97),
    platinum: Math.round(paceMs * 0.94),
  }
}

/** The best medal a time in ms takes against a day's blue, or none. */
export function medalFor(paceMs: number, ms: number | null | undefined): Medal | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null
  const times = medalTimes(paceMs)
  let best: Medal | null = null
  for (const medal of MEDALS) if (ms <= times[medal]) best = medal
  return best
}

/** The next medal up from the one held (the first, with none) and its time; none once platinum is held. */
export function nextMedal(paceMs: number, held: Medal | null): { medal: Medal; ms: number } | null {
  const medal = MEDALS[held ? MEDALS.indexOf(held) + 1 : 0]
  return medal ? { medal, ms: medalTimes(paceMs)[medal] } : null
}

/** What a medal is for, in words: "beating the blue car by 3%". */
export function medalWords(game: RaceGame, medal: Medal): string {
  const blue = BLUE[game]
  if (medal === 'bronze') return `within 2% of the ${blue}`
  if (medal === 'silver') return `beating the ${blue}`
  return `beating the ${blue} by ${medal === 'gold' ? 3 : 6}%`
}

/** Whether `a` is a better medal than `b`. */
export function medalBeats(a: Medal | null, b: Medal | null): boolean {
  return (a ? MEDALS.indexOf(a) : -1) > (b ? MEDALS.indexOf(b) : -1)
}
