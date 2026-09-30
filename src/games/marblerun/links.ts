import { gamePlayHref } from '../../hooks/useHashRoute'

/**
 * A day's course on the play page, ?day=YYYY-MM-DD: from today on an admin's test run (TestCards.tsx), before
 * today practice (PracticeCards.tsx). The admin's Course Book links every day this way.
 */
export const courseRunHref = (day: string) => `${gamePlayHref('marblerun')}?day=${day}`
