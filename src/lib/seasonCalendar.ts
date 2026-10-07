/*
 * The seasons' names and days, as the API's seasons.ts has them, for what has to know the season without
 * asking the API: the Season page's title (lib/pageMeta.ts), which the prerender writes into the page at build.
 * Everything else asks the API (lib/season.ts). Keep in step with the API's SEASONS.
 */

export type SeasonDates = { id: number; name: string; firstDay: string; lastDay: string }

export const SEASON_CALENDAR: readonly SeasonDates[] = [
  { id: 1, name: 'Space Race', firstDay: '2026-10-31', lastDay: '2027-01-04' },
  { id: 2, name: 'Cold Snap', firstDay: '2027-01-05', lastDay: '2027-03-08' },
]

/** Today's date on the boards (New York), YYYY-MM-DD. */
function boardDay(now: number): string {
  return new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/** The season on a day: the one running, else the next to come, else the last. */
export function seasonOn(now = Date.now()): SeasonDates {
  const day = boardDay(now)
  return SEASON_CALENDAR.find((s) => day <= s.lastDay) ?? SEASON_CALENDAR[SEASON_CALENDAR.length - 1]!
}
