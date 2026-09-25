import type { CSSProperties, ReactNode } from 'react'
import { getGame } from '../data/games'
import { howToPlayFor } from '../data/howToPlay'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { gameBoardHref, recordsHref } from '../hooks/useHashRoute'
import { useBoardRecord } from '../hooks/useBoardRecord'
import { fitCardToSpace } from '../lib/cardFit'
import { LEADERBOARD_GAMES, type LeaderboardGame } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { gameHasRecords } from '../lib/records'
import { useTournamentPlay } from '../tournaments/TournamentPlayContext'
import { ScoreGuide } from './ScoreGuide'
import { SoundPackSelect } from './SoundPackSelect'
import { HapticsToggle } from './HapticsToggle'
import { MusicToggle } from './MusicToggle'
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
        if (!(e.target as HTMLElement).closest('.game-card')) {
          onResume()
        }
      }}
    >
      <div
        ref={fitCardToSpace}
        className="game-card game-card--pause"
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children ?? (
          <>
            <h2 className="game-card__title">Paused</h2>
            <p className="game-card__blurb">Tap to resume</p>
          </>
        )}
        {children && showResume ? (
          <button type="button" className="panel__btn" onClick={onResume}>
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
  const board = isBoardGame(slug)
  const hasRecords = gameHasRecords(slug)
  const game = getGame(slug)
  // In an event with a set number of tries: how many are left, and when one counts.
  const tournament = useTournamentPlay()
  const tries = tournament && tournament.maxAttempts != null ? tournament : null

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
          <span>The record</span>
          <strong>{allTime > 0 ? formatLeaderboardScore(slug, allTime) : '—'}</strong>
        </div>
        {extraMeta}
        {tries ? (
          <div className="game-pause-meta__row">
            <span>Tries left</span>
            <strong>
              {tries.attemptsRemaining ?? tries.maxAttempts} of {tries.maxAttempts}
            </strong>
          </div>
        ) : null}
      </div>
      {tries?.triesAtStart ? <p className="game-card__hint">A try counts the moment you start it.</p> : null}
      {tools}
      <div className="game-pause-actions">
        <div className="game-sound-row">
          <SoundToggle className="game-sound--bare" />
          <MusicToggle className="game-sound--bare" />
          <SoundPackSelect />
          {/* Renders nothing where there is no motor to buzz. */}
          <HapticsToggle />
        </div>
        {game && howToPlayFor(slug) ? <ScoreGuide slug={slug} game={game.name} style={gameAccentStyle(slug)} /> : null}
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
      <div className="game-card__head">
        <span className="game-card__kicker">{gameName}</span>
        <h2 className="game-card__title">Paused</h2>
      </div>
      <GamePanelBody
        slug={slug}
        personalBest={personalBest}
        hideBest={hideBest}
        extraMeta={extraMeta}
        tools={tools}
      />
      <div className="game-card__actions">
        <button type="button" className="panel__btn" onClick={onResume}>
          Resume
        </button>
        <button
          type="button"
          className="panel__btn panel__btn--ghost"
          onClick={() => window.dispatchEvent(new Event('arcade:leave-confirm'))}
        >
          {leaveLabel}
        </button>
      </div>
      <p className="game-card__hint">Esc or P to resume</p>
    </PauseOverlay>
  )
}
