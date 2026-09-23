import { useEffect, useRef, useState, type ReactNode } from 'react'
import { currentHref, gameHref, navigate, tournamentHref } from '../hooks/useHashRoute'
import { gameAccentStyle } from '../lib/gameAccentStyle'
import {
  exitFullscreen,
  fullscreenSupported,
  isFullscreen,
  subscribeFullscreen,
  toggleFullscreen,
} from '../lib/fullscreen'
import { useTournamentPlay } from '../tournaments/TournamentPlayContext'
import { Panel, PanelHead } from './Panel'

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
  if (tournamentId) return tournamentHref(tournamentId)
  return gameHref(slug)
}

/** Leave the stage for an in-app href. The same URL still re-syncs the route. */
function leaveTo(target: string) {
  void exitFullscreen()
  navigate(target)
}

/**
 * Ask whoever owns the run to pause it, and report whether anyone did.
 *
 * Backing out of a live run should stop it, not ask whether to throw it away:
 * pausing is the ordinary reason to reach for back, and the pause panel already
 * offers leaving for the rare one. A game with no pause to offer must fall back
 * to the old confirm rather than have the control do nothing, so the caller
 * needs an answer — dispatch is synchronous, so the flag is set by the time
 * this returns.
 */
function askToPause() {
  const request = new CustomEvent('arcade:pause', { detail: { handled: false } })
  window.dispatchEvent(request)
  return request.detail.handled === true
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
  const inRunRef = useRef(inRun)
  const pausedRef = useRef(paused)
  const hrefRef = useRef(href)
  const armedRef = useRef(true)
  const stayRef = useRef<HTMLButtonElement>(null)
  inRunRef.current = inRun
  pausedRef.current = paused
  hrefRef.current = href

  const goNow = () => {
    armedRef.current = false
    setConfirming(false)
    leaveTo(hrefRef.current)
  }

  useEffect(() => {
    const onAsk = () => setConfirming(true)
    window.addEventListener('arcade:leave-confirm', onAsk)
    return () => window.removeEventListener('arcade:leave-confirm', onAsk)
  }, [])

  // Mobile / browser back behaves as the in-game back control does: pause a
  // live run, and leave only from the pause panel.
  useEffect(() => {
    const playUrl = currentHref()
    const guard = { arcadeLeaveGuard: true as const }
    history.pushState(guard, '', playUrl)

    armedRef.current = true
    const onPopState = () => {
      if (!armedRef.current) return
      history.pushState(guard, '', playUrl)
      if (pausedRef.current) {
        setConfirming(true)
        return
      }
      if (resolveInRun(inRunRef.current)) {
        if (!askToPause()) setConfirming(true)
        return
      }
      armedRef.current = false
      leaveTo(hrefRef.current)
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      armedRef.current = false
      window.removeEventListener('popstate', onPopState)
    }
  }, [slug])

  const backOut = () => {
    if (paused) {
      setConfirming(true)
      return
    }
    if (!resolveInRun(inRunRef.current)) {
      goNow()
      return
    }
    if (!askToPause()) setConfirming(true)
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
          backOut()
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
      {confirming ? (
        <Panel
          alert
          labelledBy="game-leave-title"
          describedBy="game-leave-copy"
          onClose={() => setConfirming(false)}
          initialFocus={stayRef}
          style={gameAccentStyle(slug)}
        >
          <PanelHead
            titleId="game-leave-title"
            title="Leave this run?"
            onClose={() => setConfirming(false)}
            closeLabel="Stay"
          />
          <div className="panel__body">
            <p id="game-leave-copy" className="panel__text">
              Your score won’t be saved.
            </p>
          </div>
          <div className="panel__actions">
            <button type="button" className="panel__btn panel__btn--ghost" onClick={goNow}>
              Leave
            </button>
            <button ref={stayRef} type="button" className="panel__btn" onClick={() => setConfirming(false)}>
              Stay
            </button>
          </div>
        </Panel>
      ) : null}
    </>
  )
}
