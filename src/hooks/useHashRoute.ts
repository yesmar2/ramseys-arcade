import { useEffect, useState } from 'react'
import {
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

export type Route =
  | { name: 'home' }
  | { name: 'leaderboards'; game?: LeaderboardGame; period?: LeaderboardPeriod }
  | { name: 'tournaments' }
  | { name: 'tournament'; id: string }
  | { name: 'tournamentPlay'; id: string; game: string }
  | { name: 'game'; slug: string }

function isLeaderboardGame(value: string): value is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(value)
}

function isLeaderboardPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as readonly string[]).includes(value)
}

export function leaderboardHref(
  game: LeaderboardGame = 'stacker',
  period: LeaderboardPeriod = 'daily',
) {
  return `#/leaderboards/${game}/${period}`
}

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/$/, '')
  if (!path) return { name: 'home' }
  if (path === 'leaderboards') return { name: 'leaderboards' }

  const boardsMatch = /^leaderboards\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (boardsMatch) {
    const gameRaw = decodeURIComponent(boardsMatch[1])
    const periodRaw = boardsMatch[2] ? decodeURIComponent(boardsMatch[2]) : undefined
    return {
      name: 'leaderboards',
      game: isLeaderboardGame(gameRaw) ? gameRaw : undefined,
      period: periodRaw && isLeaderboardPeriod(periodRaw) ? periodRaw : undefined,
    }
  }

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
