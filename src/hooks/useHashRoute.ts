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
  | { name: 'rank'; player?: string }
  | { name: 'tournaments' }
  | { name: 'tournament'; id: string }
  | { name: 'tournamentPlay'; id: string; game: string }
  | { name: 'game'; slug: string }
  | { name: 'gamePlay'; slug: string }
  | { name: 'authVerify'; token: string }

function isLeaderboardGame(value: string): value is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(value)
}

function isLeaderboardPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as readonly string[]).includes(value)
}

export function leaderboardHref(
  game: LeaderboardGame = LEADERBOARD_GAMES[0],
  period: LeaderboardPeriod = 'daily',
) {
  return `#/leaderboards/${game}/${period}`
}

export function rankHref(player?: string) {
  const cleaned = player?.trim().toUpperCase().slice(0, 12)
  if (cleaned) return `#/rank/${encodeURIComponent(cleaned)}`
  return '#/rank'
}

export function gameHref(slug: string) {
  return `#/games/${slug}`
}

export function gamePlayHref(slug: string) {
  return `#/games/${slug}/play`
}

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/$/, '')
  if (!path) return { name: 'home' }
  if (path === 'leaderboards') return { name: 'leaderboards' }
  if (path === 'rank') return { name: 'rank' }

  const rankMatch = /^rank\/([^/]+)$/.exec(path)
  if (rankMatch) {
    const player = decodeURIComponent(rankMatch[1]).trim().toUpperCase().slice(0, 12)
    return player ? { name: 'rank', player } : { name: 'rank' }
  }

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

  const authVerifyMatch = /^auth\/verify\/([^/]+)$/.exec(path)
  if (authVerifyMatch) {
    return { name: 'authVerify', token: decodeURIComponent(authVerifyMatch[1]) }
  }

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

  const gamePlayMatch = /^games\/([^/]+)\/play$/.exec(path)
  if (gamePlayMatch) {
    return { name: 'gamePlay', slug: decodeURIComponent(gamePlayMatch[1]) }
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
