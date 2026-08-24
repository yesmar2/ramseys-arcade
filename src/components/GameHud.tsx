import { useEffect, useState, type ReactNode } from 'react'
import { getGame } from '../data/games'
import { gameHref } from '../hooks/useHashRoute'
import {
  exitFullscreen,
  fullscreenSupported,
  isFullscreen,
  subscribeFullscreen,
  toggleFullscreen,
} from '../lib/fullscreen'
import { useTournamentPlay } from '../tournaments/TournamentPlayContext'

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

/** Floating live stats on the playfield (score, time, etc.). */
export function GameStageHud({ children }: { children: ReactNode }) {
  return (
    <div className="game-stage-hud" aria-live="polite">
      {children}
    </div>
  )
}

function FullscreenToggle() {
  const [supported] = useState(() => fullscreenSupported())
  const [active, setActive] = useState(() => isFullscreen())

  useEffect(() => {
    if (!supported) return
    return subscribeFullscreen(() => setActive(isFullscreen()))
  }, [supported])

  if (!supported) return null

  return (
    <button
      type="button"
      className="game-pause-btn game-hud__fullscreen"
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

/** Slim play chrome: back + fullscreen (when supported) + pause. */
export function GameHud({
  slug,
  extra,
}: {
  slug: string
  /** @deprecated Ignored — use GamePauseOverlay for bests. */
  personalBest?: number
  /** @deprecated Ignored — live stats go in GameStageHud. */
  children?: ReactNode
  extra?: ReactNode
  /** @deprecated Ignored. */
  hideBest?: boolean
}) {
  const tournament = useTournamentPlay()
  const gameName = getGame(slug)?.name ?? 'game'
  const backHref = tournament
    ? `#/tournaments/${tournament.tournamentId}`
    : gameHref(slug)
  const backLabel = tournament ? 'Event' : 'Back'

  useEffect(() => {
    return () => {
      void exitFullscreen()
    }
  }, [])

  return (
    <div
      className="game-hud game-hud--chrome"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <a
        className="game-hud__back"
        href={backHref}
        aria-label={
          tournament ? 'Back to event' : `Back to ${gameName}`
        }
        onClick={() => {
          void exitFullscreen()
        }}
      >
        <span aria-hidden="true">←</span>
        <span className="game-hud__back-text">{backLabel}</span>
      </a>
      <div className="game-hud__extra">
        <FullscreenToggle />
        {extra}
      </div>
    </div>
  )
}
