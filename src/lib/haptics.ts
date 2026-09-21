/**
 * A short buzz under a thumb, where a physical control would have had a click.
 *
 * On-screen controls give the eye feedback and the hand none, which is most of
 * what makes them feel cheap. This is the part that was missing.
 *
 * Progressive enhancement, deliberately. `navigator.vibrate` is Android's;
 * iOS Safari does not expose it at all, so half the phones that play here will
 * never feel any of this and nothing may depend on it. It fires only from the
 * handlers of real taps, which is also the only time a browser will honour it —
 * a vibration asked for outside a gesture is dropped, and some browsers log a
 * warning for it.
 */

import { detectDeviceType } from './device'

const OFF_KEY = 'skermix-haptics-off'

/**
 * Patterns in ms. Short — a turn happens several times a second at speed, and
 * anything longer reads as a rumble rather than a click.
 */
const PATTERNS = {
  /** A direction taken: the lightest thing the hardware will do. */
  turn: 8,
  /** Boost engaging. Slightly fuller, because it is a thing you hold. */
  boost: 14,
  /** Landing a hit — a swat, a pad, a drop. */
  hit: 12,
  /** The run ending. The only one that is allowed to be felt properly. */
  crash: [26, 40, 18],
} as const

export type HapticName = keyof typeof PATTERNS

function readOff() {
  try {
    return localStorage.getItem(OFF_KEY) === '1'
  } catch {
    return false
  }
}

let off = readOff()

/**
 * Whether this device can actually do it.
 *
 * Not the API alone: desktop Chrome exposes `navigator.vibrate` and quietly
 * does nothing with it, so presence would offer a switch on machines with no
 * motor behind it. The device has to be a handheld one as well — which leaves
 * this false on every iPhone, where the API is absent, and on every desktop,
 * where it is present and hollow.
 */
export function hapticsSupported() {
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.vibrate !== 'function') return false
  return detectDeviceType() !== 'desktop'
}

export function hapticsOff() {
  return off
}

export function setHapticsOff(next: boolean) {
  off = next
  try {
    localStorage.setItem(OFF_KEY, next ? '1' : '0')
  } catch {
    /* ignore */
  }
  // A short confirming buzz on the way back on, so the toggle says what it did.
  if (!next) haptic('turn')
}

/**
 * Buzz, if this device does that and the player has not turned it off.
 *
 * Never throws and never needs checking by the caller: a game should be able to
 * ask for this on any input without knowing what it is running on.
 */
export function haptic(name: HapticName) {
  if (off || !hapticsSupported()) return
  try {
    navigator.vibrate(PATTERNS[name] as number | number[])
  } catch {
    /* A browser that refuses is a browser that simply does not buzz. */
  }
}
