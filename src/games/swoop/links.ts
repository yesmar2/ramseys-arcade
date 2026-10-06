import { gamePlayHref } from '../../hooks/useHashRoute'

/**
 * A day's hills on the play page, ?day=YYYY-MM-DD: from today on an admin's test run (TestCards.tsx), before
 * today past hills, onto their All time board (PracticeCards.tsx). The admin's Hills Book links every day this way.
 */
export const hillsRunHref = (day: string) => `${gamePlayHref('swoop')}?day=${day}`
