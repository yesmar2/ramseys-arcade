/*
 * Lander's new look: the cave painted as a place by lamplight (lamplight.ts), a little lander with a lamp in
 * place of the arrow, and moths that gather to the lamp while you fly clean. Ramsey, 2026-11-25, a week after
 * Swoop's new look went live: "can we apply same redesign ideas for lander?", and, shown three looks drawn on
 * real caves beside the game as it is (Lamplight, Glow cave, Storybook): "ok, let's do A actually". With it
 * come three lanterns a day to light, which pay tickets as Swoop's kites do (lanterns.ts; his "yes, lanterns"
 * the same day), a one-beat count when a run is started again and the gap to the ship you race shown all the
 * way down (LanderGame.tsx), as Swoop has them. Nothing about a run changes with it: the same cave, the same
 * flying, the same time on the same board.
 *
 * It was on test for a day, on a device that asked for it (a button in the admin's Cave Book, `?lamp=1` in
 * the address), and is everyone's since Ramsey, 2026-11-26, to "Make Lander's new look everyone's, from
 * today's cave on?": "Yes, for everyone".
 *
 * From a first day, not on every day's cave, as Swoop's is (swoop/newLook.ts; his "Keep old days old" there):
 * a day keeps the game it was flown in, for good. The caves before NEW_LOOK_FROM are the usual painting
 * (scene.ts), with the arrow, no moths and no lanterns, the usual count and split; the caves from it on are the
 * new one, today's and, once they're past, still.
 *
 * Lander's pictures go by the same rule, so a day has one Lander: the day's picture on the home page
 * (lampPicture.ts), the cave's outline on its cards (CaveDrawing.tsx `lamp`), the card's preview (preview.ts)
 * and the day's share card (scripts/today-cards.mjs), each by newLookFor(day). The small game picture
 * (components/GameArt.tsx) is no day's: it's the new look's.
 */

/**
 * The first day whose cave everyone flies in the new look, as YYYY-MM-DD: Cave #42. It has to be the day the
 * look reached the live site, or the days between would be drawn new though they were flown the usual way:
 * if this ships later than the day it names, make it the day it ships. Once it's live, it never moves.
 */
export const NEW_LOOK_FROM = '2026-11-26'

/** That day as a sentence says it, "November 26, 2026": How to play says which past caves have no moths or lanterns. */
export const NEW_LOOK_FROM_WORDS = (() => {
  const [y, m, d] = NEW_LOOK_FROM.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
})()

/** A day of the plan's, as against the test cave's (runs.ts LAB_DAY), which has no date. */
const isDate = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day)

/**
 * Whether a day's cave is flown in the new look: the caves from its first day on, today's, past ones and an
 * admin's test flight of one still to come; and the test cave, which has no day of its own.
 */
export function newLookFor(day: string): boolean {
  return !isDate(day) || day >= NEW_LOOK_FROM
}
