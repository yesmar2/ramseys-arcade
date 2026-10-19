/*
 * Pictures a game paints once and copies into every frame after: each bug in each pose, layers of stars, a
 * maze's hedges. The browser can drop what such a picture holds, when the computer's graphics restart (a
 * laptop waking, a driver update) or while the page sits in the background, and nothing painted it again:
 * Crumbtrail's bugs went invisible and still caught you, and its caterpillar lost its cars but kept the body
 * drawn between them (Ramsey, 2026-10-19: "sometimes the bugs dissapear but they still kill me"). keptEpoch()
 * moves on whenever that may have happened, and each kept picture paints itself again when it has.
 */

let epoch = 0
const bump = () => {
  epoch++
}

/** Moves on whenever kept pictures may have been wiped: a picture painted at another one paints itself again. */
export function keptEpoch(): number {
  return epoch
}

const watched = new WeakSet<HTMLCanvasElement>()

/** Watch a kept canvas that isn't on the page: its drawing lost, or given back blank, moves the epoch on. */
export function watchKept(canvas: HTMLCanvasElement) {
  if (watched.has(canvas)) return
  watched.add(canvas)
  canvas.addEventListener('contextlost', bump)
  canvas.addEventListener('contextrestored', bump)
}

if (typeof window !== 'undefined') {
  // A canvas on the page losing its drawing: the events don't bubble, so they're caught on their way down.
  window.addEventListener('contextlost', bump, true)
  window.addEventListener('contextrestored', bump, true)
  // Back from the background, or from the back and forward cache: paint them all again, in case they went.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') bump()
  })
  window.addEventListener('pageshow', bump)
}
