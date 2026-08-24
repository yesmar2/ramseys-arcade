import { useEffect, useState, type ReactNode } from 'react'
import {
  exitFullscreen,
  fullscreenSupported,
  isFullscreen,
  subscribeFullscreen,
  toggleFullscreen,
} from '../lib/fullscreen'

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

/** Top-right play controls on the stage (fullscreen + pause). No header bar. */
export function GamePlayChrome({ children }: { children?: ReactNode }) {
  return (
    <div
      className="game-play-chrome"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <FullscreenToggle />
      {children}
    </div>
  )
}
