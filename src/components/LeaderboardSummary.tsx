import { useMemo, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameBoardHref, gameHref, rankHref } from '../hooks/useHashRoute'
import {
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  PERIOD_LABELS,
  normalizePlayerName,
  type GamePeriodSummary,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { GameThumbArt } from './GameThumbArt'
import { PlayerAvatar } from './PlayerAvatar'
import { PodiumMedal, medalKind } from './PodiumMedal'

type LeaderboardSummaryProps = {
  games: GamePeriodSummary[]
  loading?: boolean
  playerName?: string
}

const PODIUM_SLOTS = 3

function MiniBoard({
  slug,
  period,
  entries,
  accent,
  playerName,
}: {
  slug: LeaderboardGame
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  accent: string
  playerName: string
}) {
  const label = PERIOD_LABELS[period]
  const slots = Array.from({ length: PODIUM_SLOTS }, (_, i) => entries[i] ?? null)

  return (
    <div
      className="lb-summary__period"
      style={{ '--tab-accent': accent } as CSSProperties}
    >
      <a
        className="lb-summary__period-head"
        href={gameBoardHref(slug, period)}
        aria-label={`${getGame(slug)?.name ?? slug} — ${label} board`}
      >
        <span className="lb-summary__period-label">{label}</span>
        <span className="lb-summary__period-go" aria-hidden="true">
          →
        </span>
      </a>
      <ol className="lb-summary__rows">
        {slots.map((entry, i) => {
          const rank = i + 1
          const medal = medalKind(rank)
          if (!entry) {
            return (
              <li key={`empty-${rank}`} className="lb-summary__row lb-summary__row--empty">
                <span className="lb-summary__rank">
                  <span className="lb-summary__rank-num">#{rank}</span>
                  {medal ? <PodiumMedal kind={medal} /> : null}
                </span>
                <span className="lb-summary__name lb-summary__placeholder">Open</span>
                <span className="lb-summary__score lb-summary__placeholder">—</span>
              </li>
            )
          }
          const name = normalizePlayerName(entry.name ?? '')
          const isYou = Boolean(playerName) && name === playerName
          return (
            <li
              key={entry.id ?? `${period}-${rank}`}
              className={`lb-summary__row${isYou ? ' lb-summary__row--you' : ''}${medal ? ' lb-summary__row--medal' : ''}`}
            >
              <span className="lb-summary__rank">
                <span className="lb-summary__rank-num">#{rank}</span>
                {medal ? <PodiumMedal kind={medal} /> : null}
              </span>
              <a className="lb-summary__player" href={rankHref(name)} title={name}>
                <PlayerAvatar avatarId={entry.avatarId} name={name} size="sm" />
                <span className="lb-summary__name">{name}</span>
                {isYou ? <span className="lb-summary__you">You</span> : null}
              </a>
              <span className="lb-summary__score">{entry.score}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
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
                <span className="lb-summary__thumb" aria-hidden="true">
                  <GameThumbArt slug={slug} accent={game.accent} />
                </span>
                <span className="lb-summary__game-name">{game.name}</span>
              </a>
            </header>
            <div className="lb-summary__periods">
              {LEADERBOARD_PERIODS.map((period) => (
                <MiniBoard
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
