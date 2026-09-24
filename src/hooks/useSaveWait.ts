import { useEffect, useState } from 'react'

/**
 * How long a run report's Play again waits on the save. A save usually lands
 * well inside it, and holding the way on until then means a press can't cut
 * the run off before its place is known. Past it (the server waking from
 * sleep), Play again goes ahead and the save finishes on its own.
 */
export const SAVE_WAIT_MS = 4000

/** Whether a save still going has been waited on long enough: true once SAVE_WAIT_MS has passed. */
export function useSaveWait(saving: boolean): boolean {
  const [over, setOver] = useState(false)
  useEffect(() => {
    if (!saving) return
    setOver(false)
    const timer = window.setTimeout(() => setOver(true), SAVE_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [saving])
  return over
}
