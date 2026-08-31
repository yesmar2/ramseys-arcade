import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  hop,
  pickCols,
  startGame,
  tick,
  toSnapshot,
  type Dir,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

export function StrideGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('stride')
  const stageRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GameState | null>(null)
  if (!stateRef.current) {
    stateRef.current = createInitialState()
  }
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current!))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('stride'))
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const hoppedThisSwipe = useRef(false)
  const startGrace = useRef(0)
  const pausable = ui.phase === 'playing' && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  useLayoutEffect(() => {
    const stage = stageRef.current
    const w = stage?.clientWidth ?? window.innerWidth
    const h = stage?.clientHeight ?? window.innerHeight
    const cols = pickCols(w, h)
    if (stateRef.current && stateRef.current.cols !== cols && stateRef.current.phase === 'menu') {
      stateRef.current = createInitialState(cols)
      setUi(toSnapshot(stateRef.current))
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      if (!pausedRef.current) {
        stateRef.current = tick(stateRef.current!, dt)
      }
      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        const snap = toSnapshot(stateRef.current!)
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
          const dpr = Math.min(2, window.devicePixelRatio || 1)
          canvas.width = Math.floor(w * dpr)
          canvas.height = Math.floor(h * dpr)
          canvas.style.width = `${w}px`
          canvas.style.height = `${h}px`
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            renderGame(ctx, stateRef.current!, w, h)
          }
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
    stateRef.current = startGame(stateRef.current!)
    previousBestRef.current = getPersonalBest('stride')
    startGrace.current = performance.now() + 220
    setUi(toSnapshot(stateRef.current))
  }

  const tryHop = (dir: Dir) => {
    if (saveOpen || pausedRef.current) return
    const s = stateRef.current!
    if (s.phase === 'menu') {
      restart()
      stateRef.current = hop(stateRef.current!, dir)
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
        const s = stateRef.current!
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
    if (stateRef.current?.phase === 'menu') {
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
    const dir = dirFromDelta(e.clientX - start.x, e.clientY - start.y)
    tryHop(dir ?? 'up')
  }

  const padHop = (dir: Dir) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    tryHop(dir)
  }

  return (
    <section className={`stride stride--fullscreen${saveOpen ? ' stride--saving' : ''}`}>
      <div className="stride__body">
        <div
          className="stride__play"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipeRef.current = null
          }}
        >
          <div className="stride__stage" ref={stageRef}>
            <canvas ref={canvasRef} className="stride__viewport" />

            <GamePlayChrome
              slug="stride"
              inRun={() => stateRef.current?.phase === 'playing'}
              paused={paused}
            >
              {(pausable || paused) ? (
                <PauseButton paused={paused} onToggle={togglePause} />
              ) : null}
            </GamePlayChrome>

            <PlayReadout>
              <PlayReadoutScore
                hot={ui.phase === 'playing' && ui.score > previousBestRef.current}
              >
                {ui.score}
              </PlayReadoutScore>
            </PlayReadout>

            <div className="stride__overlay">
              <GamePauseOverlay
                slug="stride"
                personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
              />
              {ui.phase === 'menu' && !saveOpen && !paused && (
                <GameStartCard
                  title="Stride"
                  tagline="Hop forever. Beat your distance."
                  slug="stride"
                />
              )}
              {ui.phase === 'gameover' && saveOpen && (
                tournament ? (
                  <TournamentScoreCard
                    tournamentId={tournament.tournamentId}
                    gameSlug="stride"
                    score={ui.score}
                    onDone={restart}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="stride"
                    score={ui.score}
                    title="Run over"
                    subtitle={`${ui.score} ${ui.score === 1 ? 'row' : 'rows'} forward`}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={restart}
                  />
                )
              )}
            </div>
          </div>
        </div>

        <div className="stride__touch" aria-label="Hop">
          <button
            type="button"
            className="stride__btn stride__btn--up"
            aria-label="Hop up"
            onPointerDown={padHop('up')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5l7 9H5z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="stride__btn stride__btn--left"
            aria-label="Hop left"
            onPointerDown={padHop('left')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12l9-7v14z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="stride__btn stride__btn--down"
            aria-label="Hop down"
            onPointerDown={padHop('down')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 19l7-9H5z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="stride__btn stride__btn--right"
            aria-label="Hop right"
            onPointerDown={padHop('right')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12l-9-7v14z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
