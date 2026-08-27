import { useMemo, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameHref } from '../hooks/useHashRoute'
import {
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  type GamePeriodSummary,
} from '../lib/leaderboard'
import { GameThumbArt } from './GameThumbArt'
import { PeriodMiniBoard } from './PeriodMiniBoard'

type LeaderboardSummaryProps = {
  games: GamePeriodSummary[]
  loading?: boolean
  playerName?: string
}

export function LeaderboardSummary({
  games,
  loading,
  playerName = '',
}: LeaderboardSummaryProps) {
  const sorted = useMemo(
    () =>
      [...games].sort((a, b) => {
        const nameA = getGame(a.slug)?.name ?? a.slug
        const nameB = getGame(b.slug)?.name ?? b.slug
        return nameA.localeCompare(nameB)
      }),
    [games],
  )

  if (loading) {
    return (
      <div className="lb-summary" aria-busy="true">
        {LEADERBOARD_GAMES.map((slug) => (
          <article key={slug} className="lb-summary__card lb-summary__card--skeleton" />
        ))}
      </div>
    )
  }

  return (
    <div className="lb-summary">
      {sorted.map(({ slug, byPeriod }) => {
        const game = getGame(slug)
        if (!game) return null
        return (
          <article
            key={slug}
            className="lb-summary__card"
            style={{ '--tab-accent': game.accent } as CSSProperties}
          >
            <header className="lb-summary__head">
              <a
                className="lb-summary__game-link"
                href={gameHref(slug)}
              >
                <GameThumbArt slug={slug} accent={game.accent} />
                <span className="lb-summary__game-name">{game.name}</span>
              </a>
            </header>
            <div className="lb-summary__periods">
              {LEADERBOARD_PERIODS.map((period) => (
                <PeriodMiniBoard
                  key={period}
                  slug={slug}
                  period={period}
                  entries={byPeriod[period]?.entries ?? []}
                  accent={game.accent}
                  playerName={playerName}
                />
              ))}
            </div>
          </article>
        )
      })}
    </div>
  )
}
