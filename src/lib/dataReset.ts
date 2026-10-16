/*
 * After the API's data is reset (the admin page's Reset test data, before launch), a device forgets the scores
 * it kept from before: its bests, runs waiting for a sign-in to be saved, the dailies' results and runs, the bug
 * hunt, the records and wins it was showing, its tickets' ladders and the season it last heard. None of them then
 * shows, or saves, on the fresh boards. Settings, sound, skins picked, groups and the rest stay.
 *
 * The season answer says when the last reset was (lib/season.ts calls this with it), and the device keeps the
 * last one it acted on, so it happens once a reset.
 */

const SEEN_KEY = 'skermix-data-reset-seen'

/** What a device keeps that came from playing. */
const PLAYED_KEYS = [
  'skermix-device-bests',
  'skermix-pending-runs',
  'skermix-swoop-runs',
  'skermix-marblerun-runs',
  'skermix-lander-runs',
  'skermix-wobblerun-runs',
  'skermix-hotlap-owned-laps',
  'skermix-halffull-daily',
  'skermix-halffull-daily-2',
  'skermix-findbug-daily',
  'skermix-findbug-daily-2',
  'skermix-centroid-daily',
  'skermix-acechase-daily',
  'skermix-bug-hunt',
  'skermix-held-record',
  'skermix-hero-rungs',
  'skermix-seen-wins',
  'skermix-moments-seen',
  'skermix-ticket-ladders',
  'skermix-season',
  'skermix-passplus-missed',
  'skermix-today-rivals',
  'skermix-challenges',
]

/** Forget what this device kept from playing, once, if the data was reset after it last looked. */
export function forgetScoresFromBefore(resetAt: number | null | undefined): void {
  if (!resetAt) return
  try {
    const seen = Number(localStorage.getItem(SEEN_KEY) ?? 0)
    if (seen >= resetAt) return
    for (const key of PLAYED_KEYS) localStorage.removeItem(key)
    localStorage.setItem(SEEN_KEY, String(resetAt))
  } catch {
    /* a private window keeps nothing to forget */
  }
}
