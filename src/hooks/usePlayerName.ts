import { useEffect, useState } from 'react'
import { getLastPlayerName, PLAYER_NAME_EVENT } from '../lib/leaderboard'

/** Live player display name from localStorage. */
export function usePlayerName() {
  const [name, setName] = useState(() => getLastPlayerName())

  useEffect(() => {
    const sync = () => setName(getLastPlayerName())
    window.addEventListener(PLAYER_NAME_EVENT, sync)
    window.addEventListener('storage', sync)
    // A name that came between the first render and now (a sign-in landing as a page loads) had no one listening.
    sync()
    return () => {
      window.removeEventListener(PLAYER_NAME_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return name
}
