import type { ReactNode } from 'react'
import { scoringFor } from '../data/scoring'
import { gameHref } from '../hooks/useHashRoute'
import { useBoardRecord } from '../hooks/useBoardRecord'
import { LEADERBOARD_GAMES, type LeaderboardGame } from '../lib/leaderboard'
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
  /** Optional rich pause panel (bests, sound, board, etc.). */
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

/** Pause panel with Your best, All time, sound, guide, and board link. */
export function GamePauseOverlay({
  slug,
  personalBest,
  hideBest = false,
  paused,
  onResume,
}: {
  slug: string
  personalBest: number
  hideBest?: boolean
  paused: boolean
  onResume: () => void
}) {
  const allTime = useBoardRecord(slug)
  const scoring = scoringFor(slug)
  const board = isBoardGame(slug)

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
      </div>
      <div className="game-pause-actions">
        <SoundToggle />
        {scoring ? <ScoreGuide rows={scoring} /> : null}
        {board ? (
          <a
            className="game-pause-btn game-pause-board"
            href={gameHref(slug)}
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
      <p className="game-pause-card__hint">Esc / P to resume</p>
    </PauseOverlay>
  )
}
