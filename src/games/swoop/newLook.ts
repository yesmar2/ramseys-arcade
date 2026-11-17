/*
 * Swoop's new look, on test: the hills drawn as a place (vista.ts) and the streak as a flock that follows you
 * (flock.ts). Ramsey, 2026-11-17: "can you try redesigning the swoop game with better graphics and maybe
 * somethign to make it a little more addicting/fun? ... just need something to set it apart". And, from the
 * ways to make it more fun he picked the same day: the day's three golden birds to catch (golden.ts), a one-beat
 * count when a run is started again, and the gap to the run you race shown all the way (SwoopGame.tsx).
 *
 * It's on for a device that has asked for it, on every day's hills, until it asks for the usual look back:
 * the admin's Hills Book has a button for each, and so does the address, `?flock=1` and `?flock=0` on Swoop's
 * page (for a phone, or a device that isn't signed in). Until he says which he wants, everyone else sees Swoop
 * as it was. Nothing about a run changes with it: the same hills, the same physics, the same time on the same
 * board.
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
