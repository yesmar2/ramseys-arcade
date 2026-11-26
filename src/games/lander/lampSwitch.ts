import { useSyncExternalStore } from 'react'

/*
 * Whether this device has Lander's new look on, by itself: where it's kept, and a way to be told when it
 * changes. What the look is, and which days it's for, is newLook.ts; that knows the days, so it carries the
 * plan of every cave, and the small game picture (components/GameArt.tsx), which is on every page, wants only
 * the switch.
 */

const KEY = 'skermix-lander-lamp'
const CHANGED = 'skermix:lander-lamp'

/** The new look on, on this device. */
export function lampKept(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** The new look on for this device, or off again. */
export function keepLamp(on: boolean) {
  try {
    if (lampKept() === on) return
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* a private window keeps nothing: the usual look */
    return
  }
  // Said once this turn is over: the switch is read while a page draws itself (an address asking for the
  // look), and a picture can't be told to draw again from inside another's drawing.
  queueMicrotask(() => window.dispatchEvent(new Event(CHANGED)))
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGED, onChange)
  return () => window.removeEventListener(CHANGED, onChange)
}

/** Whether this device has the new look on, kept up as it's switched. Off where there's no device to ask. */
export function useLampLook(): boolean {
  return useSyncExternalStore(subscribe, lampKept, () => false)
}
