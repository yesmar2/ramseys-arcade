import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  GamePlayChrome,
  PlayReadout,
  PlayReadoutCenter,
  PlayReadoutScore,
} from '../../components/GameHud'
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
  pelletsViewport,
  queueDir,
  startGame,
  surgeReady,
  tick,
  toSnapshot,
  triggerSurge,
  type Dir,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

/** Pixels of drag before a swipe counts as a turn. */
const SWIPE = 18

export function PelletsGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('pellets')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('pellets'))
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const draggedRef = useRef(false)
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

  // Rebuild the maze for the new shape when the window changes between runs.
  useEffect(() => {
    const sync = () => {
      const s = stateRef.current
      if (s.phase !== 'menu') return
      const dims = pelletsViewport()
      if (s.cols === dims.cols && s.rows === dims.rows) return
      stateRef.current = createInitialState(dims)
      setUi(toSnapshot(stateRef.current))
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    stateRef.current = startGame(stateRef.current, pelletsViewport())
    previousBestRef.current = getPersonalBest('pellets')
    startGrace.current = performance.now() + 220
    setUi(toSnapshot(stateRef.current))
  }

  const steer = (dir: Dir) => {
    if (saveOpen || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu') {
      restart()
      stateRef.current = queueDir(stateRef.current, dir)
      setUi(toSnapshot(stateRef.current))
      return
    }
    if (s.phase !== 'playing') return
    stateRef.current = queueDir(s, dir)
  }

  const fireSurge = () => {
    if (saveOpen || pausedRef.current) return
    if (!surgeReady(stateRef.current)) return
    stateRef.current = triggerSurge(stateRef.current)
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
        steer(dir)
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        const s = stateRef.current
        if (s.phase === 'menu' || s.phase === 'gameover') {
          restart()
          return
        }
        fireSurge()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  const dirFromDelta = (dx: number, dy: number): Dir | null => {
    if (Math.hypot(dx, dy) < SWIPE) return null
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
    return dy > 0 ? 'down' : 'up'
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (saveOpen || pausedRef.current) return
    e.preventDefault()
    swipeRef.current = { x: e.clientX, y: e.clientY }
    draggedRef.current = false
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

  // Keep steering through one long drag — each swipe leg turns again.
  const onPointerMove = (e: ReactPointerEvent) => {
    const start = swipeRef.current
    if (!start || saveOpen || pausedRef.current) return
    const dir = dirFromDelta(e.clientX - start.x, e.clientY - start.y)
    if (!dir) return
    steer(dir)
    draggedRef.current = true
    swipeRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || saveOpen || pausedRef.current) return
    const dir = dirFromDelta(e.clientX - start.x, e.clientY - start.y)
    if (dir) {
      steer(dir)
      return
    }
    // A clean tap on the maze fires Surge.
    if (!draggedRef.current) fireSurge()
  }

  const surgeFull = ui.surge >= 1
  const surging = ui.surgeTime > 0
  const inRun = ui.phase === 'playing' || ui.phase === 'dying' || ui.phase === 'clearing'

  return (
    <section className={`pellets pellets--fullscreen${saveOpen ? ' pellets--saving' : ''}`}>
      <div className="pellets__body">
        <div
          className="pellets__play"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipeRef.current = null
          }}
        >
          <div className="pellets__stage">
            <canvas ref={canvasRef} className="pellets__viewport" />

            <GamePlayChrome
              slug="pellets"
              inRun={() => {
                const p = stateRef.current.phase
                return p === 'playing' || p === 'dying' || p === 'clearing'
              }}
              paused={paused}
            >
              {pausable || paused ? (
                <PauseButton paused={paused} onToggle={togglePause} />
              ) : null}
            </GamePlayChrome>

            <PlayReadout>
              <PlayReadoutScore
                hot={ui.phase === 'playing' && ui.score > previousBestRef.current}
              >
                {ui.score}
              </PlayReadoutScore>
              {inRun ? (
                <PlayReadoutCenter label="Lives and level">
                  {ui.lives} {ui.lives === 1 ? 'life' : 'lives'} · L{ui.level}
                </PlayReadoutCenter>
              ) : null}
            </PlayReadout>

            {inRun && !paused && !saveOpen ? (
              <button
                type="button"
                className={`pellets__surge${surgeFull ? ' pellets__surge--ready' : ''}${surging ? ' pellets__surge--live' : ''}`}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  fireSurge()
                }}
                disabled={!surgeFull && !surging}
                aria-label={surging ? 'Surge active' : 'Fire surge'}
              >
                <span
                  className="pellets__surge-fill"
                  style={{ width: `${Math.round((surging ? 1 : ui.surge) * 100)}%` }}
                />
                <span className="pellets__surge-label">
                  {surging ? 'Surging' : surgeFull ? 'Surge ready' : 'Surge'}
                </span>
              </button>
            ) : null}

            <div className="pellets__overlay">
              <GamePauseOverlay
                slug="pellets"
                personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
              />
              {ui.phase === 'menu' && !saveOpen && !paused && (
                <GameStartCard
                  title="Pellets"
                  tagline="Clear the maze. Bank a streak. Surge through the chasers."
                  slug="pellets"
                />
              )}
              {ui.phase === 'gameover' && saveOpen && (
                tournament ? (
                  <TournamentScoreCard
                    tournamentId={tournament.tournamentId}
                    gameSlug="pellets"
                    score={ui.score}
                    onDone={restart}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="pellets"
                    score={ui.score}
                    title="Caught"
                    subtitle={`Level ${ui.level} · ${ui.score.toLocaleString()} points`}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={restart}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
