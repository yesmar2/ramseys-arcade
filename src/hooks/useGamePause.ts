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
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [ignoreKeysRef])

  return {
    paused,
    toggle: () => {
      if (!enabledRef.current) return
      setPaused((open) => !open)
    },
    resume: () => setPaused(false),
  }
}
