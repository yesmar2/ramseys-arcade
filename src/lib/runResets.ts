/*
 * Games whose runs were all cleared at once. The boards' rows were deleted, and whatever a device kept from
 * before the moment is dropped as it's read: a racing daily's best runs and ghosts (its runStore.ts), and a
 * signed-out device's best (personalBest.ts).
 */

/** When each reset game's runs were cleared, in ms. */
export const RUNS_RESET_AT: Partial<Record<string, number>> = {
  // Swoop's hills went 75% longer (8fbe184), and the runs from the short hills and the first long ones were
  // cleared: Ramsey, 2026-10-06, "can you clear all data for swoop runs? it's still saying best is like 35 for
  // some reason. but just reset".
  swoop: Date.parse('2026-10-06T16:20:00-04:00'),
}

/** Whether a run a device kept at `at` (ms; unknown is the oldest) is still the game's, or from before a reset. */
export function keptSinceReset(slug: string, at: number | undefined): boolean {
  return (at ?? 0) >= (RUNS_RESET_AT[slug] ?? 0)
}
