import { formatLeaderboardScore } from './leaderboardFormat'

/*
 * Medals on the racing dailies (Hot Lap, Marble Run, Lander, Swoop, Wobble Run): how a day's best went against
 * that day's blue car, ball, ship, bird or blip, on the same steps its tickets are paid by (the API's ticketLadders.ts). Bronze
 * beats the blue; silver, gold and platinum are one, two and three of the game's steps faster (MEDAL_STEP).
 * Ramsey picked them (2026-10-05) so every run has a goal in reach and "gold on all three" is one for the day.
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

export type RaceGame = 'hotlap' | 'marblerun' | 'lander' | 'swoop' | 'wobblerun'
export type Medal = 'bronze' | 'silver' | 'gold' | 'platinum'

export const MEDALS: readonly Medal[] = ['bronze', 'silver', 'gold', 'platinum']

export const MEDAL_NAMES: Record<Medal, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }

const BLUE: Record<RaceGame, string> = { hotlap: 'blue car', marblerun: 'blue ball', lander: 'blue ship', swoop: 'blue bird', wobblerun: 'blue blip' }

/**
 * How much faster than the day's blue each medal past bronze is, in each game: silver one step, gold two,
 * platinum three (the API's ticketLadders.ts RACE_MEDAL_STEP). They were 3% and 6% for gold and platinum
 * until Ramsey found platinum came "almost every time" (2026-10-06): his best runs of the day land 15 to 30%
 * under the blue, which drives carefully, and each blue leaves its own slack. Steps of 6, 7 and 8% put
 * platinum about where his best runs land; he found that "still needs to be a little harder", so it's a point
 * more a step in Lander and Marble Run, and platinum is a few points past his usual best: 24% in Lander, 27%
 * in Marble Run. Hot Lap went to 7% too, then back to 6% once he found its platinum "just a little too hard"
 * (18%: his 17.6% lap that day just missed it). Swoop came at 7% (platinum 21%), between the two; on its
 * first day his run was 36.6% under the blue bird, so its blue went 10% quicker (swoop sim.ts BLUE_PACE) and
 * its steps to 10% (platinum 30%), where that run is gold, 0.24s off platinum. On the longer hills his best
 * runs then landed 35 to 38% under the quicker bird, platinum every time, and he found the medals still needed
 * to be "a little more difficult" (2026-10-07): 12% a step puts platinum at 36%, where his 35% run that day is
 * gold, 0.9s off it, and his 38% run on #1 still takes it. Marble Run went to 12% too when he asked for its
 * medals to be harder (2026-10-08), right after its marble got easier to turn and slow down (marblerun sim.ts
 * PLAYER_TILT_MAX, PLAYER_BRAKE): his runs had landed 27 to 32% under the blue ball, platinum both times, and
 * the easier marble takes about 4% more off a quick player's time, so platinum at 36% is just past his best.
 * Wobble Run came at 12% from the start (2026-10-09), where the two newest settled: its blue blip waits out
 * every gap and takes no shortcut, and its plan keeps a day only when a perfect run comes in at 48 to 60% of
 * the blue blip's time, so platinum at 36% takes most of the gold lines in one run, short of perfect.
 * Hot Lap's step went to 5% and Marble Run's to 10% on 2026-10-14, when Ramsey found gold and platinum "too hard"
 * in both: his best Hot Lap laps had landed 13 to 25% under the blue car (17% the middle day, 12.8% that day, short of
 * gold at 14%), and no one's Marble Run had reached platinum's 36% (the best 34.5%; his 30.8% that day was gold).
 */
export const MEDAL_STEP: Record<RaceGame, number> = { hotlap: 0.05, marblerun: 0.1, lander: 0.1, swoop: 0.13, wobblerun: 0.12 }

/**
 * How many of the game's steps faster than the blue each medal is. Platinum stays three, where it was tuned to
 * his best runs; the others sit closer under it, bronze no longer just beating the blue (Ramsey, 2026-10-11:
 * "the medals on the dailies should be closer together in times, bronze is too easy"). Hot Lap's are 6, 9, 12
 * and 15% now (7, 11, 14 and 18 until 2026-10-14); Marble Run's 12, 18, 24, 30 (14, 22, 29, 36 till then, as
 * Wobble Run's still are). Lander's step went to 10%
 * and Swoop's to 13% the same day, when he found their platinum "a little too easy": his best Lander days had
 * landed 27 to 28% under the blue ship (platinum was 24%), his best Swoop days 36 to 38% under the blue bird
 * (platinum was 36%). Lander's are 12, 18, 24, 30 now; Swoop's 16, 23, 31, 39. The API's ticketLadders.ts
 * RACE_MEDAL_RUNGS and RACE_MEDAL_STEP are the same.
 */
export const MEDAL_RUNGS: Record<Medal, number> = { bronze: 1.2, silver: 1.8, gold: 2.4, platinum: 3 }

/**
 * What a day's best at each medal pays in tickets, once a day: the API's ticketLadders.ts steps, the same in
 * all three games (a run short of bronze pays its 3 for a run today). Shown on a run's medal ladder.
 */
export const MEDAL_TICKETS: Record<Medal, number> = { bronze: 5, silver: 8, gold: 11, platinum: 15 }

export function isRaceGame(slug: string): slug is RaceGame {
  return slug === 'hotlap' || slug === 'marblerun' || slug === 'lander' || slug === 'swoop' || slug === 'wobblerun'
}

/** The day's blue, as a run's report names it: "blue ship". */
export function blueOf(game: RaceGame): string {
  return BLUE[game]
}

/** A medal's lead on the blue, in percent: 10 for Lander's bronze, 14 for its silver, 24 for its platinum. */
export function medalPercent(game: RaceGame, medal: Medal): number {
  return Math.round(MEDAL_RUNGS[medal] * MEDAL_STEP[game] * 100)
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
 * A time in seconds as the game's boards say it, to the thousandth: 1:02.457. A start card, a pause card and the
 * Dailies ticket show runs from the boards (your best today, the #1's), so every time on them reads this way, and
 * two runs never look tied that aren't. A run's report keeps the clock's hundredths (needsThousandths).
 */
export function boardTime(game: RaceGame, seconds: number): string {
  return formatLeaderboardScore(game, 1_000_000 - Math.round(seconds * 1000))
}

/**
 * Whether a run's report says its times to the thousandth rather than the clock's hundredths: when two of them
 * (the run, the day's best before it, the blue's, a medal's) would read the same without being the same. A run
 * 3ms short of bronze read 1:06.28 beside bronze's 1:06.28, under "No medal yet".
 */
export function needsThousandths(times: readonly (number | null | undefined)[], format: (seconds: number) => string): boolean {
  const shown = times.filter((ms): ms is number => ms != null && Number.isFinite(ms) && ms > 0)
  return shown.some((a, i) => shown.some((b, j) => j > i && a !== b && format(a / 1000) === format(b / 1000)))
}

/**
 * Each medal's time on a day, in ms: the slowest that still takes it. The same sums as the API's
 * ticketLadders.ts steps, so a medal and its tickets come together.
 */
export function medalTimes(game: RaceGame, paceMs: number): Record<Medal, number> {
  const step = MEDAL_STEP[game]
  return {
    bronze: Math.round(paceMs * (1 - MEDAL_RUNGS.bronze * step)),
    silver: Math.round(paceMs * (1 - MEDAL_RUNGS.silver * step)),
    gold: Math.round(paceMs * (1 - MEDAL_RUNGS.gold * step)),
    platinum: Math.round(paceMs * (1 - MEDAL_RUNGS.platinum * step)),
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
