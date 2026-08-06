import { useEffect, useState } from 'react'
import { getLastPlayerName } from '../lib/leaderboard'

const PLAYER_NAME_EVENT = 'arcade-player-name'

/** Live player display name from localStorage. */
export function usePlayerName() {
  const [name, setName] = useState(() => getLastPlayerName())

  useEffect(() => {
    const sync = () => setName(getLastPlayerName())
    window.addEventListener(PLAYER_NAME_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(PLAYER_NAME_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return name
}
