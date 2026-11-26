import { caveDay } from './daily'
import { keepLamp, lampKept } from './lampSwitch'

/*
 * Lander's new look, on test: the cave painted as a place by lamplight (lamplight.ts), a little lander with a
 * lamp in place of the arrow, and moths that gather to the lamp while you fly clean. Ramsey, 2026-11-25, a
 * week after Swoop's new look went live: "can we apply same redesign ideas for lander?", and, shown three
 * looks drawn on real caves beside the game as it is (Lamplight, Glow cave, Storybook): "ok, let's do A
 * actually". With it come three lanterns a day to light, which pay tickets as Swoop's kites do (lanterns.ts;
 * his "yes, lanterns" the same day), a one-beat count when a run is started again and the gap to the ship you
 * race shown all the way down (LanderGame.tsx), as Swoop has them.
 *
 * It's on for a device that has asked for it, until it asks for the usual look back: the admin's Cave Book has
 * a button for each, and so does the address, `?lamp=1` and `?lamp=0` on Lander's page (for a phone, or a
 * device that isn't signed in). Until he says he wants it, everyone else sees Lander as it was. Nothing about
 * a run changes with it: the same cave, the same flying, the same time on the same board.
 *
 * A day keeps the game it was flown in, as Swoop's does (swoop/newLook.ts; his "Keep old days old" there): a
 * cave from a day that's gone is the usual game whatever the switch says. The look is for today's cave, a
 * test flight of one still to come, and the test cave.
 *
 * Lander's pictures follow the same rule, so a device sees one Lander: the day's picture on the home page
 * (lampPicture.ts), the cave's outline on its cards (CaveDrawing.tsx `lamp`) and the card's preview
 * (preview.ts) by `newLookFor(day)`; the small game picture (components/GameArt.tsx), which is no day's, by
 * the switch alone (lampSwitch.ts). The address can ask from any page that draws one of them.
 */

/** The new look on for this device, or off again (lampSwitch.ts keeps it, and tells the pictures that follow it). */
export function setLampLook(on: boolean) {
  keepLamp(on)
}

/** `?lamp=` as an address has it: '1', '0', or null. */
const askedIn = (address: string): string | null => {
  try {
    return new URL(address, 'https://x.invalid').searchParams.get('lamp')
  } catch {
    return null
  }
}

/** The address the page was first opened at has been read: it's asked once, not every time the game opens. */
let firstAddressRead = false

/**
 * Whether this device has the new look on, read as the game opens. The site tidies an address it doesn't know
 * the end of (hooks/useHashRoute.ts) before the game is on the page, so `?lamp=` is read from the address the
 * page was first opened at as well as the one it has now.
 */
export function lampLook(): boolean {
  try {
    if (typeof location === 'undefined' || typeof localStorage === 'undefined') return false
    let asked = askedIn(location.href)
    if (!firstAddressRead) {
      firstAddressRead = true
      const first = performance.getEntriesByType?.('navigation')[0]?.name
      if (asked == null && first) asked = askedIn(first)
    }
    if (asked === '1') setLampLook(true)
    if (asked === '0') setLampLook(false)
    return lampKept()
  } catch {
    return false
  }
}

const isDate = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day)

/** Whether a day's cave is flown in the new look on this device: never a day that's gone. */
export function newLookFor(day: string, today = caveDay()): boolean {
  return lampLook() && (!isDate(day) || day >= today)
}
