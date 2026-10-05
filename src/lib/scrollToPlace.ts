/*
 * Bringing the part of a page a link names into view (an address's #anchor, a profile's ?focus=), and keeping it
 * there while the page fills in. Ramsey (2026-10-05): "make sure that every link that automatically scrolls to a
 * section, actually scrolls to the correct part of that page". They didn't all: a lazy page draws its sections once
 * its data comes, after the route's own scroll had looked and found nothing (a day board's All time link, the house
 * book's rows, the counter's How tickets work, opened from elsewhere), and what loads above a section pushed it
 * down after the scroll was aimed (a trophy link on a phone, where the best board above fills in late).
 *
 * So this waits for the place to be drawn, jumps to it, and aims again whenever it moves on the page, until it has
 * stayed put a while. It lets go the moment the player scrolls, taps or types, so it never fights them.
 */

/** The longest it waits for the place to be drawn: a slow first visit's data. */
const WAIT_MS = 8000
/** How long the place must stay put before it's left alone: a page's later requests land within it, on a slow phone too. */
const SETTLE_MS = 4000
/** Never steer for longer than this, however the page moves. */
const MOST_MS = 15_000
const TICK_MS = 100
/** Movement smaller than this is rounding, not the page moving. */
const SLACK_PX = 3

const PLAYER_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

/** Scroll to what `find` returns once it's there, and keep it there while the page settles. Returns a stop. */
export function scrollToPlace(find: () => Element | null, block: ScrollLogicalPosition = 'start'): () => void {
  const started = Date.now()
  let done = false
  let timer = 0
  // Where the place was on the page, and on the screen, when last aimed at.
  let aimedPage: number | null = null
  let aimedScreen = 0
  let stillSince = 0

  const stop = () => {
    if (done) return
    done = true
    window.clearTimeout(timer)
    for (const type of PLAYER_INPUT) window.removeEventListener(type, stop, true)
  }
  for (const type of PLAYER_INPUT) window.addEventListener(type, stop, { capture: true, passive: true })

  const aim = (place: Element, now: number) => {
    place.scrollIntoView({ block, behavior: 'instant' })
    const top = place.getBoundingClientRect().top
    aimedScreen = top
    aimedPage = top + window.scrollY
    stillSince = now
  }

  const tick = () => {
    if (done) return
    const now = Date.now()
    const place = find()
    if (!place) {
      // Not drawn yet, or gone again with the page it was on.
      if (now - started > (aimedPage === null ? WAIT_MS : MOST_MS)) return stop()
      timer = window.setTimeout(tick, TICK_MS)
      return
    }
    const screen = place.getBoundingClientRect().top
    const page = screen + window.scrollY
    if (aimedPage === null) aim(place, now)
    else if (Math.abs(screen - aimedScreen) <= SLACK_PX) {
      // Where it was aimed. The browser may have kept it there as things loaded above (scroll anchoring): the
      // page is still settling, so it's watched a while longer.
      if (Math.abs(page - aimedPage) > SLACK_PX) stillSince = now
      aimedPage = page
      if (now - stillSince > SETTLE_MS) return stop()
    } else if (Math.abs(page - aimedPage) > SLACK_PX) {
      // Moved on the page, something above it having loaded: aim again.
      aim(place, now)
    } else {
      // Still on the page but not on the screen: the page was scrolled some other way, and that's not this to undo.
      return stop()
    }
    if (now - started > MOST_MS) return stop()
    timer = window.setTimeout(tick, TICK_MS)
  }

  tick()
  return stop
}
