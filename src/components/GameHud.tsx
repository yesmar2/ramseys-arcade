import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { gameHref } from '../hooks/useHashRoute'
import {
  exitFullscreen,
  fullscreenSupported,
  isFullscreen,
  subscribeFullscreen,
  toggleFullscreen,
} from '../lib/fullscreen'
import { useTournamentPlay } from '../tournaments/TournamentPlayContext'

/** Plain playfield readouts (Asteroids-style): score left, secondary center. */
export function PlayReadout({ children }: { children: ReactNode }) {
  return (
    <div className="play-readout" aria-live="polite">
      {children}
    </div>
  )
}

export function PlayReadoutScore({
  children,
  hot,
  className,
}: {
  children: ReactNode
  hot?: boolean
  className?: string
}) {
  return (
    <p
      className={`play-readout__score${hot ? ' play-readout__score--hot' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </p>
  )
}

export function PlayReadoutCenter({
  children,
  label,
  urgent,
  className,
}: {
  children: ReactNode
  /** Accessible name when children aren’t self-describing. */
  label?: string
  urgent?: boolean
  className?: string
}) {
  return (
    <div
      className={`play-readout__center${urgent ? ' play-readout__center--urgent' : ''}${className ? ` ${className}` : ''}`}
      aria-label={label}
    >
      {children}
    </div>
  )
}

export function FullscreenToggle() {
  const [supported] = useState(() => fullscreenSupported())
  const [active, setActive] = useState(() => isFullscreen())

  useEffect(() => {
    if (!supported) return
    return subscribeFullscreen(() => setActive(isFullscreen()))
  }, [supported])

  useEffect(() => {
    return () => {
      void exitFullscreen()
    }
  }, [])

  if (!supported) return null

  return (
    <button
      type="button"
      className="game-pause-btn game-play-chrome__btn"
      aria-label={active ? 'Exit fullscreen' : 'Enter fullscreen'}
      aria-pressed={active}
      title={active ? 'Exit fullscreen' : 'Fullscreen'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        void toggleFullscreen()
      }}
    >
      {active ? (
        <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  )
}

type InRun = boolean | (() => boolean)

function resolveInRun(inRun: InRun) {
  return typeof inRun === 'function' ? inRun() : inRun
}

/** Stage chrome: leave (left icon) + fullscreen/pause (right). No header bar. */
export function GamePlayChrome({
  slug,
  inRun = false,
  paused = false,
  children,
}: {
  slug: string
  /** True when leaving would abandon an in-progress run. Prefer a getter over lagged UI. */
  inRun?: InRun
  paused?: boolean
  children?: ReactNode
}) {
  return (
    <>
      <div
        className="game-play-chrome game-play-chrome--leave"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <PlayLeaveButton slug={slug} inRun={inRun} paused={paused} />
      </div>
      <div
        className="game-play-chrome game-play-chrome--actions"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <FullscreenToggle />
        {children}
      </div>
    </>
  )
}

function playLeaveHref(slug: string, tournamentId?: string) {
  if (tournamentId) return `#/tournaments/${tournamentId}`
  return gameHref(slug)
}

function PlayLeaveButton({
  slug,
  inRun,
  paused,
}: {
  slug: string
  inRun: InRun
  paused: boolean
}) {
  const tournament = useTournamentPlay()
  const href = playLeaveHref(slug, tournament?.tournamentId)
  const [confirming, setConfirming] = useState(false)
  const label = tournament ? 'Back to event' : 'Leave game'

  useEffect(() => {
    const onAsk = () => setConfirming(true)
    window.addEventListener('arcade:leave-confirm', onAsk)
    return () => window.removeEventListener('arcade:leave-confirm', onAsk)
  }, [])

  useEffect(() => {
    if (!confirming) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setConfirming(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [confirming])

  const goNow = () => {
    void exitFullscreen()
    window.location.assign(href)
  }

  const onClick = () => {
    const running = resolveInRun(inRun) || paused
    if (!running) {
      goNow()
      return
    }
    setConfirming(true)
  }

  return (
    <>
      <button
        type="button"
        className="game-play-back"
        aria-label={label}
        title={label}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <svg className="game-play-back__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M14.5 5.5L8 12l6.5 6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {confirming
        ? createPortal(
            <div
              className="game-leave-overlay"
              role="alertdialog"
              aria-labelledby="game-leave-title"
              aria-describedby="game-leave-copy"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="game-leave-card">
                <p id="game-leave-title">Leave this run?</p>
                <p id="game-leave-copy" className="game-leave-card__copy">
                  Your score won’t be saved.
                </p>
                <div className="game-leave-card__actions">
                  <button
                    type="button"
                    className="game-leave-card__stay"
                    onClick={() => setConfirming(false)}
                  >
                    Stay
                  </button>
                  <a
                    className="game-leave-card__go"
                    href={href}
                    onClick={() => {
                      void exitFullscreen()
                    }}
                  >
                    Leave
                  </a>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
