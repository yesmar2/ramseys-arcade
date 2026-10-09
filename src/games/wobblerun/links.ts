import { gamePlayHref } from '../../hooks/useHashRoute'

/**
 * A day's gauntlet on the play page by its number, ?track=<n>, as the admin's Gauntlet Book links them: from today
 * on an admin's test run (TestCards.tsx), before today a past gauntlet, onto its All time board
 * (PracticeCards.tsx). pages/WobbleRunPage.tsx reads it as daily.ts trackDay does.
 */
export const gauntletRunHref = (n: number) => `${gamePlayHref('wobblerun')}?track=${n}`

/** The same by its day, ?day=YYYY-MM-DD, as the Past tab links a past gauntlet. */
export const gauntletDayHref = (day: string) => `${gamePlayHref('wobblerun')}?day=${day}`

/** The test course, every built round at every tier, an admin's, on the play page (?lab=1); the Gauntlet Book links to it. */
export const LAB_HREF = `${gamePlayHref('wobblerun')}?lab=1`
