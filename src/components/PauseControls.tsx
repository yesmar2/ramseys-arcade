import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { getGame, isRankedGame } from '../data/games'
import { howToPlayFor } from '../data/howToPlay'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import { boardPlaceHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { useBoardRecord } from '../hooks/useBoardRecord'
import { fitCardToSpace } from '../lib/cardFit'
import { BOARD_NAMES, dailyWords } from '../lib/dailyWords'
import { LEADERBOARD_GAMES, type LeaderboardGame } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { pastKind, type PastPlay } from '../lib/pastPlay'
import { deviceBestSavable } from '../lib/personalBest'
import { isMuted } from '../lib/sound'
import { useTournamentPlay } from '../tournaments/TournamentPlayContext'
import { Panel, PanelHead } from './Panel'
import { PastFacts } from './PastPlay'
import { RunLabel } from './RunLabel'
import { ScoreGuide } from './ScoreGuide'
import { SoundSheet } from './SoundSheet'

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
 *
 * With `past`, the run is on a daily's past course: today's bests aren't its, so
 * the course's own figures stand in for them, and the board link goes to the
 * course's row on the daily's past tab rather than the week's board.
 *
 * `primary` is the card's own button (Start, or the pause card's Resume and the
 * rest): it goes between the figures and the card's other ways on, so it comes
 * first under the figures.
 */
export function GamePanelBody({
  slug,
  personalBest,
  hideBest = false,
  hideRecord = false,
  past,
  extraMeta,
  tools,
  primary,
}: {
  slug: string
  personalBest: number
  hideBest?: boolean
  /** Leaves out the board's best too, where the run isn't on it (a Hot Lap test drive). */
  hideRecord?: boolean
  /** A daily's past course being played (PastPlay.tsx). */
  past?: PastPlay | null
  extraMeta?: ReactNode
  tools?: ReactNode
  primary?: ReactNode
}) {
  const allTime = useBoardRecord(slug)
  const { signedOut } = useAuth()
  const board = isBoardGame(slug)
  const game = getGame(slug)
  // A daily's board is the day's: its best and its leader are today's.
  const daily = game?.daily === true
  // A daily just for fun places nobody (data/games.ts Game.ranked): no 1st, no board, no records.
  const ranked = isRankedGame(slug)
  // In an event with a set number of tries: how many are left, and when one counts.
  const tournament = useTournamentPlay()
  const tries = tournament && tournament.maxAttempts != null ? tournament : null
  const showBest = !hideBest && !past
  const showRecord = !hideRecord && !past && ranked
  // A past course's board link: its row, which holds its board (or its day, where it has none).
  const boardLink = past ? past.href : board && ranked ? boardPlaceHref(slug) : null
  const pastBoard = past ? pastKind(slug, past.kind) === 'board' : false
  const boardLabel = past ? (pastBoard ? `This ${dailyWords(slug).course}’s ${BOARD_NAMES.allTime} board` : dailyWords(slug).pastTab) : 'Leaderboard'
  // On the button, short: the label above is its name for a screen reader and its tip.
  const boardText = past && !pastBoard ? dailyWords(slug).pastTab : 'Board'

  return (
    <>
      {past?.facts ? <PastFacts facts={past.facts} /> : null}
      {showBest || showRecord || extraMeta || tries || !past ? (
        <div className="game-pause-meta">
          {showBest ? (
            <div className="game-pause-meta__row">
              <span>{daily ? 'Your best today' : 'Your best'}</span>
              <strong>{personalBest > 0 ? formatLeaderboardScore(slug, personalBest) : '—'}</strong>
            </div>
          ) : null}
          {showRecord ? (
            <div className="game-pause-meta__row">
              <span>{daily ? '1st today' : 'The record'}</span>
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
      ) : null}
      {/* Notes, not key hints: a phone shows them too. */}
      {tries?.triesAtStart ? <p className="game-card__note">A try counts the moment you start it.</p> : null}
      {/* Signed out, Your best is this device's (lib/personalBest.ts): signing in saves it only while the run that
          set it can still go on the board (a few hours), so only then does it say to. */}
      {showBest && personalBest > 0 && signedOut ? (
        <p className="game-card__note">
          {deviceBestSavable(slug) ? 'Your best on this device. Sign in to save it.' : 'Your best on this device.'}
        </p>
      ) : null}
      {tools}
      {primary}
      <GameCardPills slug={slug} board={boardLink ? { href: boardLink, label: boardLabel, text: boardText } : null} />
    </>
  )
}

/**
 * The card's other ways on, each with its name, under its own button: How to play, the board, and Sound,
 * whose panel holds the music, the sound pack and the buzz (A of the "Launch UX picks" canvas's start card,
 * Ramsey's pick on 2026-10-20). They were seven round icons and a slider, and NEON, the trophy and the book
 * didn't say what they did. The board opens in a tab of its own, so a paused run waits; the record books
 * went from the card (the game's page has them, and the tab bar's Records).
 *
 * `board.label` names the board link for a screen reader and its tip; `board.text` is what the button says.
 */
export function GameCardPills({ slug, board = null }: { slug: string; board?: { href: string; label: string; text: string } | null }) {
  const game = getGame(slug)
  const style = gameAccentStyle(slug)
  const [sound, setSound] = useState(false)
  const muted = isMuted()

  return (
    <div className="game-pause-actions game-pills">
      {game && howToPlayFor(slug) ? <ScoreGuide slug={slug} game={game.name} style={style} look="pill" /> : null}
      {board ? (
        <a
          className="game-pill"
          href={board.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={board.label === board.text ? undefined : board.label}
          title={board.label}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <svg className="game-pill__icon" viewBox="0 0 24 24" aria-hidden="true">
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
          {board.text}
        </a>
      ) : null}
      {/* Opened as the press lands, as How to play is, so the press never reaches the playfield behind. */}
      <button
        type="button"
        className="game-pill"
        aria-haspopup="dialog"
        aria-expanded={sound}
        onPointerDown={(e) => {
          e.stopPropagation()
          setSound(true)
        }}
        onClick={(e) => {
          if (e.detail === 0) setSound(true)
        }}
      >
        <svg className="game-pill__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 10v4h3.2L12 18.5V5.5L7.2 10H4z" fill="currentColor" />
          {muted ? (
            <path d="M15.2 9.2l5.6 5.6M20.8 9.2l-5.6 5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M15.2 9.4a3.4 3.4 0 0 1 0 5.2M17.6 7.2a6.4 6.4 0 0 1 0 9.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          )}
        </svg>
        Sound
        {muted ? <span className="visually-hidden">, off</span> : null}
      </button>
      {sound ? <SoundSheet slug={slug} game={game?.name} style={style} onClose={() => setSound(false)} /> : null}
    </div>
  )
}

/**
 * Pause panel with leave link, bests, optional extra rows, sound, guide, board, and Restart where a run can start again.
 * With `past`, a daily's past course: its label and figures, and leaving goes back to its row.
 */
export function GamePauseOverlay({
  slug,
  personalBest,
  hideBest = false,
  hideRecord = false,
  past,
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
  /** A daily's past course being played: the same one the game's GamePlayChrome takes, whose Leave this uses. */
  past?: PastPlay | null
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
  const leaveLabel = tournament
    ? 'Back to event'
    : past
      ? `Back to ${dailyWords(slug).pastTab.toLowerCase()}`
      : `Leave ${gameName}`
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
          {/* A past course: its name with the game's, so the card never reads as today's. */}
          <span className="game-card__kicker">{past?.title ? `${gameName} · ${past.title}` : gameName}</span>
          <h2 className="game-card__title">Paused</h2>
          {past ? <RunLabel kind={pastKind(slug, past.kind)} slug={slug} /> : null}
        </div>
        <GamePanelBody
          slug={slug}
          personalBest={personalBest}
          hideBest={hideBest}
          hideRecord={hideRecord}
          past={past}
          extraMeta={extraMeta}
          tools={tools}
          primary={
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
          }
        />
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
