import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
import { Panel, PanelHead } from './Panel'
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
  hideRecord = false,
  extraMeta,
  tools,
}: {
  slug: string
  personalBest: number
  hideBest?: boolean
  /** Leaves out the board's best too, where the run isn't on it (a Hot Lap test drive). */
  hideRecord?: boolean
  extraMeta?: ReactNode
  tools?: ReactNode
}) {
  const allTime = useBoardRecord(slug)
  const board = isBoardGame(slug)
  const hasRecords = gameHasRecords(slug)
  const game = getGame(slug)
  // A daily's board is the day's: its best and its record are today's.
  const daily = game?.daily === true
  // In an event with a set number of tries: how many are left, and when one counts.
  const tournament = useTournamentPlay()
  const tries = tournament && tournament.maxAttempts != null ? tournament : null

  return (
    <>
      <div className="game-pause-meta">
        {!hideBest ? (
          <div className="game-pause-meta__row">
            <span>{daily ? 'Your best today' : 'Your best'}</span>
            <strong>{personalBest > 0 ? formatLeaderboardScore(slug, personalBest) : '—'}</strong>
          </div>
        ) : null}
        {!hideRecord ? (
          <div className="game-pause-meta__row">
            <span>{daily ? 'Today’s best' : 'The record'}</span>
            <strong>{allTime > 0 ? formatLeaderboardScore(slug, allTime) : '—'}</strong>
          </div>
        ) : null}
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

/** Pause panel with leave link, bests, optional extra rows, sound, guide, board, and Restart where a run can start again. */
export function GamePauseOverlay({
  slug,
  personalBest,
  hideBest = false,
  hideRecord = false,
  paused,
  onResume,
  onRestart,
  extraMeta,
  tools,
}: {
  slug: string
  personalBest: number
  hideBest?: boolean
  hideRecord?: boolean
  paused: boolean
  onResume: () => void
  /**
   * Start the run again from the beginning, this one left unsaved, as Play again starts one. Left out where
   * a run can't start again: a daily's first run, which is the day's result, or Ace Chase's hole, whose every
   * try counts.
   */
  onRestart?: () => void
  extraMeta?: ReactNode
  /** Optional admin/debug controls under the meta block. */
  tools?: ReactNode
}) {
  const tournament = useTournamentPlay()
  const game = getGame(slug)
  const gameName = game?.name ?? 'game'
  const leaveLabel = tournament ? 'Back to event' : `Leave ${gameName}`
  // An event with a set number of tries spends one as each run starts: starting again would spend another.
  const canRestart = Boolean(onRestart) && !(tournament && tournament.maxAttempts != null)
  const [confirming, setConfirming] = useState(false)
  const keepRef = useRef<HTMLButtonElement>(null)
  const restartRef = useRef(onRestart)
  restartRef.current = onRestart

  useEffect(() => {
    if (!paused) setConfirming(false)
  }, [paused])

  // R asks, as the button does. Only while paused: in play the key is the game's (Hot Lap's lap again).
  useEffect(() => {
    if (!paused || !canRestart) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.code !== 'KeyR' || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      setConfirming(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paused, canRestart])

  const restartNow = () => {
    setConfirming(false)
    onResume()
    restartRef.current?.()
  }

  return (
    <>
      <PauseOverlay paused={paused} onResume={onResume} showResume={false} style={gameAccentStyle(slug)}>
        <div className="game-card__head">
          <span className="game-card__kicker">{gameName}</span>
          <h2 className="game-card__title">Paused</h2>
        </div>
        <GamePanelBody
          slug={slug}
          personalBest={personalBest}
          hideBest={hideBest}
          hideRecord={hideRecord}
          extraMeta={extraMeta}
          tools={tools}
        />
        <div className="game-card__actions">
          <button type="button" className="panel__btn" onClick={onResume}>
            Resume
          </button>
          {canRestart ? (
            <button type="button" className="panel__btn panel__btn--ghost" onClick={() => setConfirming(true)}>
              Restart
            </button>
          ) : null}
          <button
            type="button"
            className="panel__btn panel__btn--ghost"
            onClick={() => window.dispatchEvent(new Event('arcade:leave-confirm'))}
          >
            {leaveLabel}
          </button>
        </div>
        <p className="game-card__hint">{canRestart ? 'Esc or P to resume, R to restart' : 'Esc or P to resume'}</p>
      </PauseOverlay>
      {paused && confirming ? (
        <Panel
          alert
          labelledBy="game-restart-title"
          describedBy="game-restart-copy"
          onClose={() => setConfirming(false)}
          initialFocus={keepRef}
          style={gameAccentStyle(slug)}
        >
          <PanelHead
            titleId="game-restart-title"
            title="Restart this run?"
            onClose={() => setConfirming(false)}
            closeLabel="Keep this run"
          />
          <div className="panel__body">
            <p id="game-restart-copy" className="panel__text">
              It starts again from the beginning, and this score won’t be saved.
            </p>
          </div>
          <div className="panel__actions">
            <button type="button" className="panel__btn panel__btn--ghost" onClick={restartNow}>
              Restart
            </button>
            <button ref={keepRef} type="button" className="panel__btn" onClick={() => setConfirming(false)}>
              Keep this run
            </button>
          </div>
        </Panel>
      ) : null}
    </>
  )
}
