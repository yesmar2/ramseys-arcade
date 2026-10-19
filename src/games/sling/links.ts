import { gamePlayHref } from '../../hooks/useHashRoute'

/**
 * A day's tower on the play page, ?day=YYYY-MM-DD: from today on an admin's test run (TestCards.tsx), before
 * today past towers, onto their All time board (PracticeCards.tsx). The admin's Tower Book links every day this way.
 */
export const towerRunHref = (day: string) => `${gamePlayHref('sling')}?day=${day}`
