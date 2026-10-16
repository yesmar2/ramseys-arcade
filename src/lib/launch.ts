/*
 * When Blipka opens: midnight in New York at the start of Nov 14, 2026, the moment the coming-soon page counts
 * down to (public/soon.html). Until then the site is a test run, and its data is reset at launch: the admin
 * page's Reset test data (the API's resetWorld.ts), which works until launch day is over.
 */
export const OPENS_AT = Date.UTC(2026, 10, 14, 5, 0, 0)

/** The end of launch day in New York. The API's reset stops working then (resetWorld.ts RESET_UNTIL). */
export const LAUNCH_DAY_ENDS = Date.UTC(2026, 10, 15, 5, 0, 0)
