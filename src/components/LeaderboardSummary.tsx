import { useMemo, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameHref } from '../hooks/useHashRoute'
import { GameThumbArt } from './GameThumbArt'
import {
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  PERIOD_LABELS,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

export type GamePeriodSummary = {
  slug: LeaderboardGame
  byPeriod: Record<
    LeaderboardPeriod,
    { entries: LeaderboardEntry[] }
  >
}

type LeaderboardSummaryProps = {
  games: GamePeriodSummary[]
  loading?: boolean
}

function MiniBoard({
  slug,
  period,
  entries,
  accent,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  accent: string
}) {
  const label = PERIOD_LABELS[period]

  return (
    <a
      className="lb-summary__period"
      href={gameHref(slug, period)}
      style={{ '--tab-accent': accent } as CSSProperties}
      aria-label={`${getGame(slug)?.name ?? slug} ${label} board`}
    >
      <span className="lb-summary__period-label">{label}</span>
      {entries.length === 0 ? (
        <p className="lb-summary__empty">No scores</p>
      ) : (
        <ol className="lb-summary__rows">
          {entries.map((entry, i) => (
            <li key={entry.id} className="lb-summary__row">
              <span className="lb-summary__rank">#{i + 1}</span>
              <span className="lb-summary__name" title={entry.name}>
                {entry.name}
              </span>
              <span className="lb-summary__score">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </a>
  )
}

export function LeaderboardSummary({ games, loading }: LeaderboardSummaryProps) {
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
              <a className="lb-summary__game" href={gameHref(slug)}>
                <span className="lb-summary__art" aria-hidden="true">
                  <GameThumbArt slug={slug} accent={game.accent} />
                </span>
                <span className="lb-summary__game-name">{game.name}</span>
              </a>
              <a className="lb-summary__open" href={gameHref(slug, 'daily')}>
                Full board →
              </a>
            </header>
            <div className="lb-summary__periods">
              {LEADERBOARD_PERIODS.map((period) => (
                <MiniBoard
                  key={period}
                  slug={slug}
                  period={period}
                  entries={byPeriod[period].entries}
                  accent={game.accent}
                />
              ))}
            </div>
          </article>
        )
      })}
    </div>
  )
}
