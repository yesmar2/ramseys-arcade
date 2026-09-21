import type { CSSProperties, ReactNode } from 'react'
import { getGame } from '../data/games'
import { scoringFor } from '../data/scoring'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { gameBoardHref, recordsHref } from '../hooks/useHashRoute'
import { useBoardRecord } from '../hooks/useBoardRecord'
import { LEADERBOARD_GAMES, type LeaderboardGame } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { gameHasRecords } from '../lib/records'
import { useTournamentPlay } from '../tournaments/TournamentPlayContext'
import { ScoreGuide } from './ScoreGuide'
import { SoundPackSelect } from './SoundPackSelect'
import { HapticsToggle } from './HapticsToggle'
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

export function PauseOverlay({
  paused,
  onResume,
  children,
  showResume = true,
  style,
}: PauseOverlayProps & { showResume?: boolean; style?: CSSProperties }) {
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
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children ?? (
          <>
            <h2>Paused</h2>
            <p>Tap to resume</p>
          </>
        )}
        {children && showResume ? (
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

/**
 * Bests, sound, rules and board links — the middle of the pause panel.
 *
 * Shared with the start card so the screen you see before a run and the one you
 * see when you stop it are the same panel, rather than two that drift apart.
 */
export function GamePanelBody({
  slug,
  personalBest,
  hideBest = false,
  extraMeta,
  tools,
}: {
  slug: string
  personalBest: number
  hideBest?: boolean
  extraMeta?: ReactNode
  tools?: ReactNode
}) {
  const allTime = useBoardRecord(slug)
  const scoring = scoringFor(slug)
  const board = isBoardGame(slug)
  const hasRecords = gameHasRecords(slug)
  const game = getGame(slug)

  return (
    <>
      <div className="game-pause-meta">
        {!hideBest ? (
          <div className="game-pause-meta__row">
            <span>Your best</span>
            <strong>{personalBest > 0 ? formatLeaderboardScore(slug, personalBest) : '—'}</strong>
          </div>
        ) : null}
        <div className="game-pause-meta__row">
          <span>All time</span>
          <strong>{allTime > 0 ? formatLeaderboardScore(slug, allTime) : '—'}</strong>
        </div>
        {extraMeta}
      </div>
      {tools}
      <div className="game-pause-actions">
        <div className="game-sound-row">
          <SoundToggle className="game-sound--bare" />
          <SoundPackSelect />
          {/* Renders nothing where there is no motor to buzz. */}
          <HapticsToggle />
        </div>
        {game?.how ? <ScoreGuide how={game.how} rows={scoring} style={gameAccentStyle(slug)} /> : null}
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
        {hasRecords ? (
          <a
            className="game-pause-btn game-pause-board"
            href={recordsHref(slug)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Record books"
            title="Record books"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 4.5h5.2a2.3 2.3 0 0 1 2.3 2.3V20a1.7 1.7 0 0 0-1.7-1.7H5V4.5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 4.5h-5.2a2.3 2.3 0 0 0-2.3 2.3V20a1.7 1.7 0 0 1 1.7-1.7H19V4.5z"
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
    </>
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
  tools,
}: {
  slug: string
  personalBest: number
  hideBest?: boolean
  paused: boolean
  onResume: () => void
  extraMeta?: ReactNode
  /** Optional admin/debug controls under the meta block. */
  tools?: ReactNode
}) {
  const tournament = useTournamentPlay()
  const game = getGame(slug)
  const gameName = game?.name ?? 'game'
  const leaveLabel = tournament ? 'Back to event' : `Leave ${gameName}`

  return (
    <PauseOverlay paused={paused} onResume={onResume} showResume={false} style={gameAccentStyle(slug)}>
      <h2>Paused</h2>
      <GamePanelBody
        slug={slug}
        personalBest={personalBest}
        hideBest={hideBest}
        extraMeta={extraMeta}
        tools={tools}
      />
      <div className="game-pause-card__nav">
        <button
          type="button"
          className="game-pause-card__resume"
          onClick={onResume}
        >
          Resume
        </button>
        <button
          type="button"
          className="game-pause-card__leave"
          onClick={() => window.dispatchEvent(new Event('arcade:leave-confirm'))}
        >
          {leaveLabel}
        </button>
      </div>
      <p className="game-pause-card__hint">Esc / P to resume</p>
    </PauseOverlay>
  )
}
