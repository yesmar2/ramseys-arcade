/*
 * A game playing itself in a home page preview runs the same code that plays
 * sounds, buzzes the phone and banks coins in a real run. Anything it does
 * inside `quietly` stays silent and still and leaves the player's own things
 * alone: sound and haptics check `isQuiet` before they fire, and so does
 * anything a run would save. The player's own settings are never touched.
 */
let hushed = 0

export function quietly<T>(run: () => T): T {
  hushed += 1
  try {
    return run()
  } finally {
    hushed -= 1
  }
}

/** True while a preview is running: nothing it does should be heard, felt or kept. */
export function isQuiet() {
  return hushed > 0
}
