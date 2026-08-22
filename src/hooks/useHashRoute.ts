import { useEffect, useState } from 'react'
import {
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

export type Route =
  | { name: 'home' }
  | { name: 'leaderboards' }
  | { name: 'records'; game: string; recordId?: string; period?: LeaderboardPeriod }
  | { name: 'rank'; player?: string }
  | { name: 'tournaments' }
  | { name: 'tournament'; id: string }
  | { name: 'tournamentPlay'; id: string; game: string }
  | { name: 'game'; slug: string; period?: LeaderboardPeriod }
  | { name: 'gamePlay'; slug: string }
  | { name: 'authVerify'; token: string }

function isLeaderboardGame(value: string): value is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(value)
}

function isLeaderboardPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as readonly string[]).includes(value)
}

/** Global hub when called with no game; per-game boards live on the game hub. */
export function leaderboardHref(
  game?: LeaderboardGame,
  period: LeaderboardPeriod = 'daily',
) {
  if (!game) return '#/leaderboards'
  return gameHref(game, period)
}

export function rankHref(player?: string) {
  const cleaned = player?.trim().toUpperCase().slice(0, 12)
  if (cleaned) return `#/rank/${encodeURIComponent(cleaned)}`
  return '#/rank'
}

export function gameHref(slug: string, period?: LeaderboardPeriod) {
  if (period) return `#/games/${encodeURIComponent(slug)}/${period}`
  return `#/games/${encodeURIComponent(slug)}`
}

export function gamePlayHref(slug: string) {
  return `#/games/${slug}/play`
}

export function recordsHref(game: string) {
  return `#/records/${encodeURIComponent(game)}`
}

export function recordHref(
  game: string,
  recordId: string,
  period: LeaderboardPeriod = 'all',
) {
  return `#/records/${encodeURIComponent(game)}/${encodeURIComponent(recordId)}/${period}`
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

  const recordBoardMatch = /^records\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (recordBoardMatch) {
    const game = decodeURIComponent(recordBoardMatch[1])
    const recordId = decodeURIComponent(recordBoardMatch[2])
    const periodRaw = recordBoardMatch[3]
      ? decodeURIComponent(recordBoardMatch[3])
      : undefined
    return {
      name: 'records',
      game,
      recordId,
      period: periodRaw && isLeaderboardPeriod(periodRaw) ? periodRaw : 'all',
    }
  }

  const recordsMatch = /^records\/([^/]+)$/.exec(path)
  if (recordsMatch) {
    return { name: 'records', game: decodeURIComponent(recordsMatch[1]) }
  }

  const boardsMatch = /^leaderboards\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (boardsMatch) {
    const gameRaw = decodeURIComponent(boardsMatch[1])
    const periodRaw = boardsMatch[2] ? decodeURIComponent(boardsMatch[2]) : undefined
    if (isLeaderboardGame(gameRaw)) {
      return {
        name: 'game',
        slug: gameRaw,
        period: periodRaw && isLeaderboardPeriod(periodRaw) ? periodRaw : undefined,
      }
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

  const gameMatch = /^games\/([^/]+)(?:\/([^/]+))?$/.exec(path)
  if (gameMatch) {
    const slug = decodeURIComponent(gameMatch[1])
    const periodRaw = gameMatch[2] ? decodeURIComponent(gameMatch[2]) : undefined
    return {
      name: 'game',
      slug,
      period: periodRaw && isLeaderboardPeriod(periodRaw) ? periodRaw : undefined,
    }
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
