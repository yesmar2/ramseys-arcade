import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

/*
 * How big a list or block was the last time this device showed it, so its skeleton can hold that much room
 * while it loads and nothing below it moves when it comes (a list of ten that loads as five skeleton rows
 * pushes the page down by five rows). Kept per key in localStorage; the first look uses a best guess.
 */

const PREFIX = 'skermix-shape:'

function read(key: string): number | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    const n = raw == null ? NaN : Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
  } catch {
    return null
  }
}

/**
 * The size to hold for `key` while it loads: what it was last time, else `guess`. Pass `now` once it has
 * loaded (undefined until then) and it's kept for next time.
 */
export function useHeldShape(key: string, now: number | undefined, guess: number): number {
  const [held] = useState(() => read(key) ?? guess)
  useEffect(() => {
    if (now === undefined) return
    try {
      localStorage.setItem(PREFIX + key, String(now))
    } catch {
      /* a private window keeps nothing: the guess stands next time */
    }
  }, [key, now])
  return held
}

/** A width's key: the same block wraps differently at another width, so each keeps its own. */
const widthKey = (key: string) => `${key}@${typeof window === 'undefined' ? 0 : Math.round(window.innerWidth / 40)}`

/**
 * A block whose height comes with what loads (a headline that may wrap to two lines): while it loads it's
 * held at the height it had last time at this width, and once loaded its height is kept for next time.
 */
export function useHeldHeight<T extends HTMLElement>(key: string, loading: boolean): { ref: RefObject<T | null>; style: CSSProperties | undefined } {
  const ref = useRef<T | null>(null)
  const [held] = useState(() => read(widthKey(key)))
  useLayoutEffect(() => {
    const el = ref.current
    if (loading || !el) return
    // Its height as it settles, not only the moment it loaded: more of it can come after (a second ask).
    const keep = () => {
      try {
        localStorage.setItem(PREFIX + widthKey(key), String(Math.round(el.getBoundingClientRect().height)))
      } catch {
        /* nothing kept: next time it isn't held */
      }
    }
    keep()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(keep)
    watch.observe(el)
    return () => watch.disconnect()
  }, [key, loading])
  return { ref, style: loading && held ? { minHeight: `${held}px` } : undefined }
}
