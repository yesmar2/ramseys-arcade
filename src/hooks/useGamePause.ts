import { useEffect, useRef, useState, type RefObject } from 'react'

/** Pause while a round is active. Esc / P toggle; hiding the tab pauses. */
export function useGamePause(
  enabled: boolean,
  ignoreKeysRef?: RefObject<boolean>,
) {
  const [paused, setPaused] = useState(false)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabled) setPaused(false)
  }, [enabled])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code !== 'Escape' && e.code !== 'KeyP') return
      if (ignoreKeysRef?.current) return
      if (!enabledRef.current) return
      e.preventDefault()
      setPaused((open) => !open)
    }
    const onVis = () => {
      if (document.hidden && enabledRef.current) setPaused(true)
    }
    /**
     * Someone else wants this run paused — the back control, which pauses
     * rather than asking whether to abandon the run.
     *
     * The asker needs to know whether anybody was listening: a game with no
     * pause to offer must fall back to its old behaviour rather than have the
     * control do nothing. Dispatch is synchronous, so a flag on the event is
     * readable the moment it returns.
     */
    const onPauseRequest = (event: Event) => {
      if (!enabledRef.current) return
      setPaused(true)
      const detail = (event as CustomEvent<{ handled?: boolean }>).detail
      if (detail) detail.handled = true
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('arcade:pause', onPauseRequest)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('arcade:pause', onPauseRequest)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [ignoreKeysRef])

  return {
    paused,
    toggle: () => {
      if (!enabledRef.current) return
      setPaused((open) => !open)
    },
    pause: () => {
      if (!enabledRef.current) return false
      setPaused(true)
      return true
    },
    resume: () => setPaused(false),
  }
}
