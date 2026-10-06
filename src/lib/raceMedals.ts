/*
 * Medals on the racing dailies (Hot Lap, Marble Run, Lander): how a day's best went against that day's blue
 * car, ball or ship, on the same steps its tickets are paid by (the API's ticketLadders.ts). Bronze beats the
 * blue; silver, gold and platinum are one, two and three of the game's steps faster (MEDAL_STEP). Ramsey
 * picked them (2026-10-05) so every run has a goal in reach and "gold on all three" is one for the day.
 *
 * They aren't the boards' gold, silver and bronze (PodiumMedal: 1st, 2nd, 3rd). These are against the blue, so
 * anyone can have one. They're worked out here from a day's blue time, which each game's plan holds (and the
 * API's paces are made from), so no medal waits on a request: the caller hands in the pace, and a page that
 * shows one game never loads another's plan.
 *
 * Each is one game's, on one day. Ramsey couldn't tell what "all four" meant (2026-10-05: "are we talking
 * about other games?"), so a run's report shows the four as a ladder, with their times and tickets
 * (RaceMedal MedalLadder), and nothing says "all four": platinum is "the top medal".
 */

export type RaceGame = 'hotlap' | 'marblerun' | 'lander'
export type Medal = 'bronze' | 'silver' | 'gold' | 'platinum'

export const MEDALS: readonly Medal[] = ['bronze', 'silver', 'gold', 'platinum']

export const MEDAL_NAMES: Record<Medal, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }

const BLUE: Record<RaceGame, string> = { hotlap: 'blue car', marblerun: 'blue ball', lander: 'blue ship' }

/**
 * How much faster than the day's blue each medal past bronze is, in each game: silver one step, gold two,
 * platinum three (the API's ticketLadders.ts RACE_MEDAL_STEP). They were 3% and 6% for gold and platinum
 * until Ramsey found platinum came "almost every time" (2026-10-06): his best runs of the day land 15 to 30%
 * under the blue, which drives carefully, and each blue leaves its own slack. Steps of 6, 7 and 8% put
 * platinum about where his best runs land; he found that "still needs to be a little harder", so it's a point
 * more a step in Lander and Marble Run, and platinum is a few points past his usual best: 24% in Lander, 27%
 * in Marble Run. Hot Lap went to 7% too, then back to 6% once he found its platinum "just a little too hard"
 * (18%: his 17.6% lap that day just missed it).
 */
export const MEDAL_STEP: Record<RaceGame, number> = { hotlap: 0.06, marblerun: 0.09, lander: 0.08 }

/**
 * What a day's best at each medal pays in tickets, once a day: the API's ticketLadders.ts steps, the same in
 * all three games (a run short of bronze pays its 3 for a run today). Shown on a run's medal ladder.
 */
export const MEDAL_TICKETS: Record<Medal, number> = { bronze: 5, silver: 8, gold: 11, platinum: 15 }

export function isRaceGame(slug: string): slug is RaceGame {
  return slug === 'hotlap' || slug === 'marblerun' || slug === 'lander'
}

/** The day's blue, as a run's report names it: "blue ship". */
export function blueOf(game: RaceGame): string {
  return BLUE[game]
}

/** A medal's lead on the blue, in percent: 0 for bronze, 8 for Lander's silver, 24 for its platinum. */
export function medalPercent(game: RaceGame, medal: Medal): number {
  return Math.round(MEDALS.indexOf(medal) * MEDAL_STEP[game] * 100)
}

/**
 * A gap between two times, in ms, as the racing dailies say it beside a medal or a place: 0.78s, as their
 * clocks read; 0.004s when hundredths would round it to nothing; 1:02.40 past a minute.
 */
export function raceGapWords(ms: number): string {
  const gap = Math.abs(ms)
  if (gap >= 60_000) {
    const seconds = Math.round(gap / 10) / 100
    const m = Math.floor(seconds / 60)
    return `${m}:${(seconds - m * 60).toFixed(2).padStart(5, '0')}`
  }
  return `${(gap / 1000).toFixed(gap > 0 && gap < 5 ? 3 : 2)}s`
}

/** A day's blue time in ms, from its plan's pace in seconds. */
export function paceMsOf(paceSeconds: number): number {
  return Math.round(paceSeconds * 1000)
}

/**
 * Each medal's time on a day, in ms: the slowest that still takes it. The same sums as the API's
 * ticketLadders.ts steps, so a medal and its tickets come together.
 */
export function medalTimes(game: RaceGame, paceMs: number): Record<Medal, number> {
  const step = MEDAL_STEP[game]
  return {
    bronze: paceMs - 1,
    silver: Math.round(paceMs * (1 - step)),
    gold: Math.round(paceMs * (1 - 2 * step)),
    platinum: Math.round(paceMs * (1 - 3 * step)),
  }
}

/** The best medal a time in ms takes against a day's blue, or none. */
export function medalFor(game: RaceGame, paceMs: number, ms: number | null | undefined): Medal | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null
  const times = medalTimes(game, paceMs)
  let best: Medal | null = null
  for (const medal of MEDALS) if (ms <= times[medal]) best = medal
  return best
}

/** The next medal up from the one held (the first, with none) and its time; none once platinum is held. */
export function nextMedal(game: RaceGame, paceMs: number, held: Medal | null): { medal: Medal; ms: number } | null {
  const medal = MEDALS[held ? MEDALS.indexOf(held) + 1 : 0]
  return medal ? { medal, ms: medalTimes(game, paceMs)[medal] } : null
}

/** What a medal is for, in words: "beating the blue car", "beating the blue car by 12%". */
export function medalWords(game: RaceGame, medal: Medal): string {
  const pct = medalPercent(game, medal)
  return pct ? `beating the ${BLUE[game]} by ${pct}%` : `beating the ${BLUE[game]}`
}

/** Whether `a` is a better medal than `b`. */
export function medalBeats(a: Medal | null, b: Medal | null): boolean {
  return (a ? MEDALS.indexOf(a) : -1) > (b ? MEDALS.indexOf(b) : -1)
}
