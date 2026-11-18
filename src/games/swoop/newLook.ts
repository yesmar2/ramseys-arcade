/*
 * Swoop's new look, on test: the hills drawn as a place (vista.ts) and a flock that follows you, a bird for
 * every clean landing, until a thump scatters it (flock.ts). Ramsey, 2026-11-17: "can you try redesigning the
 * swoop game with better graphics and maybe somethign to make it a little more addicting/fun? ... just need
 * something to set it apart". And, from the ways to make it more fun he picked the same day: three kites a day
 * to catch (golden.ts; golden birds at first), a one-beat count when a run is started again, and the gap to the
 * run you race shown all the way (SwoopGame.tsx).
 *
 * It's on for a device that has asked for it, until it asks for the usual look back: the admin's Hills Book
 * has a button for each, and so does the address, `?flock=1` and `?flock=0` on Swoop's page (for a phone, or a
 * device that isn't signed in). Until he says which he wants, everyone else sees Swoop as it was. Nothing
 * about a run changes with it: the same hills, the same physics, the same time on the same board.
 *
 * And only on hills whose day hasn't gone (newLookFor): today's, an admin's test run of some still to come,
 * and the test hills. A past day's hills keep the game they were flown in on their day: the usual painting,
 * no flock, no kites, the usual count and split. Ramsey, 2026-11-18, asked "are the old tracks still giong to
 * look like the old ones without new functionality?"; they weren't (the look went by the device, whatever the
 * day), and asked whether past days should have the new look and the kites too he said: "Keep old days old".
 * So a day keeps the look it was flown in, for good: when the new look becomes everyone's it does so from a
 * first day (NEW_LOOK_FROM), the days before that one stay as they were, and the days from it on keep the new
 * look once they're past.
 */

const KEY = 'skermix-swoop-flock'

/** The new look on for this device, or off again. */
export function setFlockLook(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* a private window keeps nothing: the usual look */
  }
}

/** `?flock=` as an address has it: '1', '0', or null. */
const askedIn = (address: string): string | null => {
  try {
    return new URL(address, 'https://x.invalid').searchParams.get('flock')
  } catch {
    return null
  }
}

/** The address the page was first opened at has been read: it's asked once, not every time the game opens. */
let firstAddressRead = false

/**
 * Whether this device has the new look on, read as the game opens. The site tidies an address it doesn't know
 * the end of (hooks/useHashRoute.ts) before the game is on the page, so `?flock=` is read from the address the
 * page was first opened at as well as the one it has now.
 */
export function flockLook(): boolean {
  try {
    if (typeof location === 'undefined' || typeof localStorage === 'undefined') return false
    let asked = askedIn(location.href)
    if (!firstAddressRead) {
      firstAddressRead = true
      const first = performance.getEntriesByType?.('navigation')[0]?.name
      if (asked == null && first) asked = askedIn(first)
    }
    if (asked === '1') setFlockLook(true)
    if (asked === '0') setFlockLook(false)
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The first day whose hills everyone flies in the new look, as YYYY-MM-DD, once he says it's Swoop's look: from
 * then on those days keep it, past or not, and the days before keep the usual one. Null while it's on test.
 */
export const NEW_LOOK_FROM: string | null = null

/** A day of the plan's, as against the test hills' (runs.ts LAB_DAY), which have no date to have gone. */
const isDate = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day)

/**
 * Whether a day's hills are flown in the new look on this device, read as the game opens: `today` is the day on
 * the boards' clock (daily.ts hillsDay). Hills whose day has gone keep the look they were flown in, whatever the
 * device has asked for.
 */
export function newLookFor(day: string, today: string): boolean {
  // Read whichever hills these are, so `?flock=` on a past day's page is still kept for today's.
  const asked = flockLook()
  if (!isDate(day)) return asked || NEW_LOOK_FROM !== null
  if (NEW_LOOK_FROM !== null && day >= NEW_LOOK_FROM) return true
  return asked && day >= today
}
