import { useSyncExternalStore } from 'react'

/*
 * How far this device has come with the arcade: the runs it has begun and the
 * day it first came. Kept on the device, like the recent games, since it is
 * about the seat in front of the screen and has to work before anyone signs
 * in. It holds the asks back: nobody is asked to install the arcade before
 * they have played a few runs here or come back on another day.
 */

const RUNS_KEY = 'skermix-runs-begun'
const FIRST_KEY = 'skermix-first-seen'
const EVENT = 'arcade-engagement'

/** Runs begun on this device before it counts as playing here, not just trying it. */
const RUNS_TO_SETTLE = 3

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function runsBegun(): number {
  try {
    const n = Number(localStorage.getItem(RUNS_KEY) ?? 0)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

/** A run has begun on this device (runSession's beginRun). */
export function noteRunBegun() {
  if (typeof window === 'undefined') return
  const next = runsBegun() + 1
  // Past the point that settles it, there's nothing more to count.
  if (next > RUNS_TO_SETTLE + 1) return
  try {
    localStorage.setItem(RUNS_KEY, String(next))
  } catch {
    /* storage off: the asks stay held back, the kind way to fail */
  }
  window.dispatchEvent(new Event(EVENT))
}

/** The day this device first opened the arcade, noted once at boot. */
export function noteVisit() {
  if (typeof window === 'undefined') return
  try {
    if (!localStorage.getItem(FIRST_KEY)) localStorage.setItem(FIRST_KEY, today())
  } catch {
    /* as above */
  }
}

/** Played a few runs here, or come back on another day. */
export function isSettled(): boolean {
  if (typeof window === 'undefined') return false
  if (runsBegun() >= RUNS_TO_SETTLE) return true
  try {
    const first = localStorage.getItem(FIRST_KEY)
    return first != null && first !== today()
  } catch {
    return false
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** isSettled, kept current as runs begin. */
export function useSettled(): boolean {
  return useSyncExternalStore(subscribe, isSettled, () => false)
}
