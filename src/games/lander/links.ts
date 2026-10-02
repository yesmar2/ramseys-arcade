import { gamePlayHref } from '../../hooks/useHashRoute'

/**
 * A day's cave on the play page, ?day=YYYY-MM-DD: from today on an admin's test run (TestCards.tsx), before
 * today a past cave, onto its All time board (PracticeCards.tsx). The admin's Cave Book links every day this way.
 */
export const caveRunHref = (day: string) => `${gamePlayHref('lander')}?day=${day}`
