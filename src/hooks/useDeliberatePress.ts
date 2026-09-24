import { useCallback, useEffect, useRef, type MouseEvent } from 'react'

/** How long a card that ends a run waits before its buttons answer: the run's last presses land on it otherwise. */
const ARM_MS = 900

/**
 * Whether a click on a card that opens as a run ends was meant for it.
 *
 * A run ends mid-press: Space held for a boost, Enter for a shot, a tap still
 * coming down. The card opens with its button in focus or under the finger,
 * so a key let go or a tap finished there would skip the card the run just
 * earned. A click counts only once the card has been up a moment, and only
 * when the press that made it began after that: a pointer pressed since, or a
 * key pressed since and not a held key's repeat. A screen reader's click
 * comes with no key at all and counts.
 */
export function useDeliberatePress(): (e: MouseEvent) => boolean {
  const armAt = useRef(Number.POSITIVE_INFINITY)
  const pointerAt = useRef(Number.NEGATIVE_INFINITY)
  const staleKey = useRef(false)

  useEffect(() => {
    armAt.current = performance.now() + ARM_MS
    // Keys pressed once the card was ready; one let go that isn't among them was held over from the run.
    const fresh = new Set<string>()
    let settle = 0
    // A key's click comes in the same task as the key: judge it, then forget.
    const judge = (stale: boolean) => {
      staleKey.current = stale
      window.clearTimeout(settle)
      settle = window.setTimeout(() => {
        staleKey.current = false
      }, 0)
    }
    const down = (e: KeyboardEvent) => {
      const ready = performance.now() >= armAt.current
      if (ready && !e.repeat) fresh.add(e.code)
      judge(!ready || e.repeat)
    }
    const up = (e: KeyboardEvent) => {
      judge(!fresh.has(e.code))
      fresh.delete(e.code)
    }
    const press = () => {
      const now = performance.now()
      if (now >= armAt.current) pointerAt.current = now
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('pointerdown', press, true)
    return () => {
      window.clearTimeout(settle)
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      window.removeEventListener('pointerdown', press, true)
    }
  }, [])

  return useCallback((e: MouseEvent) => {
    if (performance.now() < armAt.current) return false
    return e.detail > 0 ? pointerAt.current >= armAt.current : !staleKey.current
  }, [])
}
