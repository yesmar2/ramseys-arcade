import { useEffect, useState, type ReactNode } from 'react'
import { useDeviceType } from '../lib/device'
import {
  enterFullscreen,
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
  const device = useDeviceType()
  const [supported] = useState(() => fullscreenSupported())
  const [active, setActive] = useState(() => isFullscreen())
  const mobile = device === 'phone' || device === 'tablet'

  useEffect(() => {
    if (!supported) return
    return subscribeFullscreen(() => setActive(isFullscreen()))
  }, [supported])

  useEffect(() => {
    return () => {
      void exitFullscreen()
    }
  }, [])

  /* Browsers require a user gesture; enter on first tap when playing on mobile. */
  useEffect(() => {
    if (!supported || !mobile || isFullscreen()) return

    const onFirstGesture = () => {
      void enterFullscreen()
      window.removeEventListener('pointerdown', onFirstGesture, true)
      window.removeEventListener('touchstart', onFirstGesture, true)
    }

    window.addEventListener('pointerdown', onFirstGesture, true)
    window.addEventListener('touchstart', onFirstGesture, true)
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture, true)
      window.removeEventListener('touchstart', onFirstGesture, true)
    }
  }, [supported, mobile])

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
