/*
 * Swoop's new look: the hills drawn as a place (vista.ts) and a flock that follows you, a bird for every clean
 * landing, until a thump scatters it (flock.ts). Ramsey, 2026-11-17: "can you try redesigning the swoop game
 * with better graphics and maybe somethign to make it a little more addicting/fun? ... just need something to
 * set it apart". And, from the ways to make it more fun he picked the same day: three kites a day to catch
 * (golden.ts; golden birds at first), a one-beat count when a run is started again, and the gap to the run you
 * race shown all the way (SwoopGame.tsx). Nothing about a run changes with it: the same hills, the same
 * physics, the same time on the same board.
 *
 * It was on test for two days, on a device that asked for it (a button in the admin's Hills Book, `?flock=1`
 * on Swoop's page), and is everyone's since Ramsey, 2026-11-18: "ok, let's make the new look for everyone".
 *
 * From a first day, though, not on every day's hills. The same day he'd asked "are the old tracks still giong
 * to look like the old ones without new functionality?"; they weren't (the look went by the device, whatever
 * the day), and asked whether past days should have the new look and the kites too he said: "Keep old days
 * old". So a day keeps the game it was flown in, for good: the hills before NEW_LOOK_FROM are the usual
 * painting (scene.ts), with no flock, no kites, the usual count and split, and the hills from it on are the new
 * one, today's and, once they're past, still.
 */

/**
 * The first day whose hills everyone flies in the new look, as YYYY-MM-DD: Hills #34. It has to be the day the
 * look reached the live site, or the days between would be drawn new though they were flown the usual way:
 * if this ships later than the day it names, make it the day it ships.
 */
export const NEW_LOOK_FROM = '2026-11-18'

/** That day as a sentence says it, "November 18, 2026": How to play says which past hills have no flock or kites. */
export const NEW_LOOK_FROM_WORDS = (() => {
  const [y, m, d] = NEW_LOOK_FROM.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
})()

/** A day of the plan's, as against the test hills' (runs.ts LAB_DAY), which have no date. */
const isDate = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day)

/**
 * Whether a day's hills are flown in the new look: the hills from its first day on, today's, past ones and an
 * admin's test run of some still to come; and the test hills, which have no day of their own.
 */
export function newLookFor(day: string): boolean {
  return !isDate(day) || day >= NEW_LOOK_FROM
}
