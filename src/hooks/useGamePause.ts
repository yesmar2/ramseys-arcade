import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  isFullscreenCoverActive,
  subscribeFullscreenCover,
} from '../lib/fullscreen'

/** Pause while a round is active. Esc / P toggle; hiding the tab pauses. */
export function useGamePause(
  enabled: boolean,
  ignoreKeysRef?: RefObject<boolean>,
) {
  const [paused, setPaused] = useState(false)
  const [fsCover, setFsCover] = useState(() => isFullscreenCoverActive())
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabled) setPaused(false)
  }, [enabled])

  useEffect(() => {
    return subscribeFullscreenCover(() => setFsCover(isFullscreenCoverActive()))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code !== 'Escape' && e.code !== 'KeyP') return
      if (ignoreKeysRef?.current) return
      if (!enabledRef.current) return
      // Don't open the pause menu while the fullscreen toast cover is up.
      if (isFullscreenCoverActive()) return
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
    /** User-toggled pause (pause overlay). */
    paused,
    /** Freeze sim + input: user pause or mobile fullscreen toast cover. */
    held: paused || fsCover,
    toggle: () => {
      if (!enabledRef.current || isFullscreenCoverActive()) return
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
