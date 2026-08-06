import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'leaderboards' }
  | { name: 'tournaments' }
  | { name: 'tournament'; id: string }
  | { name: 'tournamentPlay'; id: string; game: string }
  | { name: 'game'; slug: string }

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/$/, '')
  if (!path) return { name: 'home' }
  if (path === 'leaderboards') return { name: 'leaderboards' }
  if (path === 'tournaments') return { name: 'tournaments' }

  const tournamentPlayMatch = /^tournaments\/([^/]+)\/play\/([^/]+)$/.exec(path)
  if (tournamentPlayMatch) {
    return {
      name: 'tournamentPlay',
      id: decodeURIComponent(tournamentPlayMatch[1]),
      game: decodeURIComponent(tournamentPlayMatch[2]),
    }
  }

  const tournamentMatch = /^tournaments\/([^/]+)$/.exec(path)
  if (tournamentMatch) {
    return { name: 'tournament', id: decodeURIComponent(tournamentMatch[1]) }
  }

  const gameMatch = /^games\/([^/]+)$/.exec(path)
  if (gameMatch) {
    return { name: 'game', slug: decodeURIComponent(gameMatch[1]) }
  }

  return { name: 'home' }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return route
}
