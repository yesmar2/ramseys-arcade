import type { ReactNode } from 'react'
import { getGame } from '../data/games'
import { scoringFor } from '../data/scoring'
import { gameBoardHref, gameHref } from '../hooks/useHashRoute'
import { useBoardRecord } from '../hooks/useBoardRecord'
import { exitFullscreen } from '../lib/fullscreen'
import { LEADERBOARD_GAMES, type LeaderboardGame } from '../lib/leaderboard'
import { useTournamentPlay } from '../tournaments/TournamentPlayContext'
import { ScoreGuide } from './ScoreGuide'
import { SoundToggle } from './SoundToggle'

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

type PauseButtonProps = {
  paused: boolean
  onToggle: () => void
}

export function PauseButton({ paused, onToggle }: PauseButtonProps) {
  return (
    <button
      type="button"
      className="game-pause-btn"
      aria-label={paused ? 'Resume' : 'Pause'}
      aria-pressed={paused}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {paused ? (
        <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 6.5v11L18 12 8 6.5z" fill="currentColor" />
        </svg>
      ) : (
        <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="7" y="6" width="3.2" height="12" rx="0.8" fill="currentColor" />
          <rect x="13.8" y="6" width="3.2" height="12" rx="0.8" fill="currentColor" />
        </svg>
      )}
    </button>
  )
}

type PauseOverlayProps = {
  paused: boolean
  onResume: () => void
  children?: ReactNode
}

export function PauseOverlay({ paused, onResume, children }: PauseOverlayProps) {
  if (!paused) return null
  return (
    <div
      className="game-pause-overlay"
      role="dialog"
      aria-label="Paused"
      onPointerDown={(e) => {
        e.stopPropagation()
        if (!(e.target as HTMLElement).closest('.game-pause-card')) {
          onResume()
        }
      }}
    >
      <div
        className="game-pause-card"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children ?? (
          <>
            <h2>Paused</h2>
            <p>Tap to resume</p>
          </>
        )}
        {children ? (
          <button
            type="button"
            className="game-pause-card__resume"
            onClick={onResume}
          >
            Resume
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Pause panel with leave link, bests, optional extra rows, sound, guide, board. */
export function GamePauseOverlay({
  slug,
  personalBest,
  hideBest = false,
  paused,
  onResume,
  extraMeta,
}: {
  slug: string
  personalBest: number
  hideBest?: boolean
  paused: boolean
  onResume: () => void
  extraMeta?: ReactNode
}) {
  const tournament = useTournamentPlay()
  const allTime = useBoardRecord(slug)
  const scoring = scoringFor(slug)
  const board = isBoardGame(slug)
  const gameName = getGame(slug)?.name ?? 'game'
  const leaveHref = tournament
    ? `#/tournaments/${tournament.tournamentId}`
    : gameHref(slug)
  const leaveLabel = tournament ? 'Back to event' : `Leave ${gameName}`

  return (
    <PauseOverlay paused={paused} onResume={onResume}>
      <h2>Paused</h2>
      <div className="game-pause-meta">
        {!hideBest ? (
          <div className="game-pause-meta__row">
            <span>Your best</span>
            <strong>{personalBest > 0 ? personalBest : '—'}</strong>
          </div>
        ) : null}
        <div className="game-pause-meta__row">
          <span>All time</span>
          <strong>{allTime > 0 ? allTime : '—'}</strong>
        </div>
        {extraMeta}
      </div>
      <div className="game-pause-actions">
        <SoundToggle />
        {scoring ? <ScoreGuide rows={scoring} /> : null}
        {board ? (
          <a
            className="game-pause-btn game-pause-board"
            href={gameBoardHref(slug)}
            target="_blank"
            rel="noopener noreferrer"
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
        ) : null}
      </div>
      <a
        className="game-pause-leave"
        href={leaveHref}
        onClick={() => {
          void exitFullscreen()
        }}
      >
        {leaveLabel}
      </a>
      <p className="game-pause-card__hint">Esc / P to resume</p>
    </PauseOverlay>
  )
}
