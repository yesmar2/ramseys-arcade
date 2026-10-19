/*
 * When Blipka opens: midnight in New York at the start of Oct 31, 2026, the moment the coming-soon page counts
 * down to (public/soon.html). Until then the site is a test run, and its data is reset at launch: the admin
 * page's Reset test data (the API's resetWorld.ts), which works until launch day is over. Launch moved to Nov 14
 * on 2026-10-14 and back to Oct 31 on 2026-10-19.
 */
export const OPENS_AT = Date.UTC(2026, 9, 31, 4, 0, 0)

/** The end of launch day in New York (Nov 1, 00:00 EDT). The API's reset stops working then (resetWorld.ts RESET_UNTIL). */
export const LAUNCH_DAY_ENDS = Date.UTC(2026, 10, 1, 4, 0, 0)
