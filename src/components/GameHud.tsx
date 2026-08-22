import type { ReactNode } from 'react'
import { scoringFor } from '../data/scoring'
import { getGame } from '../data/games'
import { gameBoardHref, gameHref } from '../hooks/useHashRoute'
import { useBoardRecord } from '../hooks/useBoardRecord'
import { LEADERBOARD_GAMES, type LeaderboardGame } from '../lib/leaderboard'
import { useTournamentPlay } from '../tournaments/TournamentPlayContext'
import { ScoreGuide } from './ScoreGuide'
import { SoundToggle } from './SoundToggle'

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

export function GameHudStat({
  label,
  children,
  hot,
  urgent,
  className,
}: {
  label: string
  children: ReactNode
  hot?: boolean
  urgent?: boolean
  className?: string
}) {
  return (
    <div
      className={`game-hud__stat${hot ? ' game-stat--beat' : ''}${urgent ? ' game-hud__stat--urgent' : ''}${className ? ` ${className}` : ''}`}
    >
      <span className="game-hud__label">{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

export function GameHud({
  slug,
  personalBest,
  children,
  extra,
  hideBest = false,
}: {
  slug: string
  personalBest: number
  children?: ReactNode
  extra?: ReactNode
  hideBest?: boolean
}) {
  const allTime = useBoardRecord(slug)
  const scoring = scoringFor(slug)
  const tournament = useTournamentPlay()
  const gameName = getGame(slug)?.name ?? 'game'
  const backHref = tournament
    ? `#/tournaments/${tournament.tournamentId}`
    : gameHref(slug)
  const backLabel = tournament ? 'Event' : 'Back'

  return (
    <div
      className="game-hud"
      aria-live="polite"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <a
        className="game-hud__back"
        href={backHref}
        aria-label={
          tournament ? 'Back to event' : `Back to ${gameName}`
        }
      >
        <span aria-hidden="true">←</span>
        <span className="game-hud__back-text">{backLabel}</span>
      </a>
      <div className="game-hud__stats">
        {children}
        {!hideBest && (
          <GameHudStat className="game-hud__stat--best" label="Your best">
            {personalBest > 0 ? personalBest : '—'}
          </GameHudStat>
        )}
        <GameHudStat className="game-hud__stat--alltime" label="All time">
          {allTime > 0 ? allTime : '—'}
        </GameHudStat>
      </div>
      <div className="game-hud__extra">
        {isBoardGame(slug) && (
          <a
            className="game-pause-btn game-hud__board"
            href={gameBoardHref(slug, 'daily')}
            aria-label="Leaderboard"
            title="Leaderboard"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M8 21h8M12 17v4M7 4h10v3a5 5 0 0 1-5 5h0a5 5 0 0 1-5-5V4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M17 6h2.2a1.8 1.8 0 0 1 0 3.6H17M7 6H4.8a1.8 1.8 0 0 0 0 3.6H7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
        {scoring && <ScoreGuide rows={scoring} />}
        <SoundToggle />
        {extra}
      </div>
    </div>
  )
}
