import { useMemo, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { leaderboardHref } from '../hooks/useHashRoute'
import { GameThumbArt } from './GameThumbArt'
import { LEADERBOARD_GAMES, type LeaderboardGame, type LeaderboardPeriod } from '../lib/leaderboard'

type GameBoardSwitcherProps = {
  activeSlug: LeaderboardGame
  period: LeaderboardPeriod
}

export function GameBoardSwitcher({ activeSlug, period }: GameBoardSwitcherProps) {
  const games = useMemo(
    () =>
      [...LEADERBOARD_GAMES].sort((a, b) => {
        const nameA = getGame(a)?.name ?? a
        const nameB = getGame(b)?.name ?? b
        return nameA.localeCompare(nameB)
      }),
    [],
  )

  return (
    <nav className="lb-tabs lb-tabs--games" aria-label="Switch game">
      {games.map((slug) => {
        const game = getGame(slug)
        if (!game) return null
        const active = slug === activeSlug
        return (
          <a
            key={slug}
            href={leaderboardHref(slug, period)}
            className={`lb-tab lb-tab--game${active ? ' lb-tab--active' : ''}`}
            style={{ '--tab-accent': game.accent } as CSSProperties}
            aria-current={active ? 'page' : undefined}
            title={game.name}
          >
            <span className="lb-tab__thumb" aria-hidden="true">
              <GameThumbArt slug={slug} accent={game.accent} />
            </span>
            <span className="lb-tab__name">{game.name}</span>
          </a>
        )
      })}
    </nav>
  )
}
