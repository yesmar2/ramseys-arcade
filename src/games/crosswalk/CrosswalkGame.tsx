import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { PersonalBestHint } from '../../components/PersonalBestHint'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  hop,
  startGame,
  tick,
  toSnapshot,
  type Dir,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

export function CrosswalkGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('crosswalk')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('crosswalk'))
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const hoppedThisSwipe = useRef(false)
  const startGrace = useRef(0)
  const pausable = ui.phase === 'playing' && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      if (!pausedRef.current) {
        stateRef.current = tick(stateRef.current, dt)
      }
      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        const snap = toSnapshot(stateRef.current)
        setUi(snap)
        if (snap.phase === 'gameover' && offeredScore.current !== snap.score) {
          offeredScore.current = snap.score
          setSaveOpen(true)
        }
      }

      const canvas = canvasRef.current
      if (canvas) {
        const parent = canvas.parentElement
        const w = parent?.clientWidth || 0
        const h = parent?.clientHeight || 0
        if (w > 0 && h > 0) {
          const ctx = canvas.getContext('2d')
          if (ctx) renderGame(ctx, stateRef.current, w, h)
        }
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (ui.phase === 'menu') previousBestRef.current = apiBest
  }, [apiBest, ui.phase])

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    stateRef.current = startGame(stateRef.current)
    previousBestRef.current = getPersonalBest('crosswalk')
    startGrace.current = performance.now() + 220
    setUi(toSnapshot(stateRef.current))
  }

  const tryHop = (dir: Dir) => {
    if (saveOpen || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu') {
      restart()
      stateRef.current = hop(stateRef.current, dir)
      setUi(toSnapshot(stateRef.current))
      return
    }
    if (s.phase !== 'playing') return
    stateRef.current = hop(s, dir)
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpen || pausedRef.current) return
      const map: Record<string, Dir> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        KeyW: 'up',
        KeyS: 'down',
        KeyA: 'left',
        KeyD: 'right',
      }
      const dir = map[e.code]
      if (dir) {
        e.preventDefault()
        tryHop(dir)
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        const s = stateRef.current
        if (s.phase === 'menu' || s.phase === 'gameover') restart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  const SWIPE = 28

  const dirFromDelta = (dx: number, dy: number): Dir | null => {
    if (Math.hypot(dx, dy) < SWIPE) return null
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
    return dy > 0 ? 'down' : 'up'
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    if (saveOpen || pausedRef.current) return
    swipeRef.current = { x: e.clientX, y: e.clientY }
    hoppedThisSwipe.current = false
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (stateRef.current.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const start = swipeRef.current
    if (!start || hoppedThisSwipe.current || saveOpen || pausedRef.current) return
    const dir = dirFromDelta(e.clientX - start.x, e.clientY - start.y)
    if (!dir) return
    tryHop(dir)
    hoppedThisSwipe.current = true
    swipeRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || hoppedThisSwipe.current || saveOpen || pausedRef.current) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    const dir = dirFromDelta(dx, dy)
    tryHop(dir ?? 'up')
  }

  const padHop = (dir: Dir) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    tryHop(dir)
  }

  return (
    <section className={`crosswalk crosswalk--fullscreen${saveOpen ? ' crosswalk--saving' : ''}`}>
      <div className="crosswalk__body">
        <div
          className="crosswalk__play"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipeRef.current = null
          }}
        >
          <GameStage aspectWidth={11} aspectHeight={13}>
            <canvas ref={canvasRef} className="crosswalk__viewport" />

            <GamePlayChrome>
              {(pausable || paused) ? (
                <PauseButton paused={paused} onToggle={togglePause} />
              ) : null}
            </GamePlayChrome>

            <PlayReadout>
              <div className="play-readout__left">
                <PlayReadoutScore
                  hot={ui.phase === 'playing' && ui.score > previousBestRef.current}
                >
                  {ui.score}
                </PlayReadoutScore>
                {ui.phase === 'playing' ? (
                  <span
                    className="crosswalk__lives"
                    aria-label={`${ui.lives} ${ui.lives === 1 ? 'life' : 'lives'}`}
                  >
                    {Array.from({ length: ui.lives }, (_, i) => (
                      <svg
                        key={i}
                        className="play-readout__hopper"
                        viewBox="0 0 16 14"
                        aria-hidden="true"
                      >
                        <ellipse cx="8" cy="7.2" rx="6.2" ry="5.2" fill="currentColor" />
                      </svg>
                    ))}
                  </span>
                ) : null}
              </div>
            </PlayReadout>

            <div className="crosswalk__overlay">
              <GamePauseOverlay
                slug="crosswalk"
                personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
                extraMeta={
                  ui.phase === 'playing' ? (
                    <div className="game-pause-meta__row">
                      <span>Crossings</span>
                      <strong>{ui.crossings}</strong>
                    </div>
                  ) : null
                }
              />
              {ui.phase === 'menu' && !saveOpen && !paused && (
                <div className="crosswalk__card" aria-hidden="true">
                  <h2>Crosswalk</h2>
                  <p>Hop the lanes. Don’t get flattened.</p>
                  <PersonalBestHint slug="crosswalk" />
                  <span className="crosswalk__hint crosswalk__hint--keys">
                    Arrows or WASD to hop · reach Home
                  </span>
                  <span className="crosswalk__hint crosswalk__hint--touch">
                    Swipe or tap to hop · reach Home
                  </span>
                </div>
              )}
              {ui.phase === 'gameover' && saveOpen && (
                tournament ? (
                  <TournamentScoreCard
                    tournamentId={tournament.tournamentId}
                    gameSlug="crosswalk"
                    score={ui.score}
                    onDone={restart}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="crosswalk"
                    score={ui.score}
                    title="Splat"
                    subtitle={
                      ui.crossings === 1
                        ? '1 crossing'
                        : `${ui.crossings} crossings`
                    }
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={restart}
                  />
                )
              )}
            </div>
          </GameStage>
        </div>

        <div className="crosswalk__touch" aria-label="Hop">
          <button
            type="button"
            className="crosswalk__btn crosswalk__btn--up"
            aria-label="Hop up"
            onPointerDown={padHop('up')}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="crosswalk__btn crosswalk__btn--left"
            aria-label="Hop left"
            onPointerDown={padHop('left')}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="crosswalk__btn crosswalk__btn--down"
            aria-label="Hop down"
            onPointerDown={padHop('down')}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 19V5M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="crosswalk__btn crosswalk__btn--right"
            aria-label="Hop right"
            onPointerDown={padHop('right')}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
