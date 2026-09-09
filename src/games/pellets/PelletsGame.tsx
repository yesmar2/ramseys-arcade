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
  queueDir,
  startGame,
  tick,
  toSnapshot,
  type Dir,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

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
          const dpr = Math.min(2, window.devicePixelRatio || 1)
          canvas.width = Math.floor(w * dpr)
          canvas.height = Math.floor(h * dpr)
          canvas.style.width = `${w}px`
          canvas.style.height = `${h}px`
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            renderGame(ctx, stateRef.current, w, h)
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
    stateRef.current = startGame(stateRef.current)
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
        if (s.phase === 'menu' || s.phase === 'gameover') restart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  const SWIPE = 24

  const dirFromDelta = (dx: number, dy: number): Dir | null => {
    if (Math.hypot(dx, dy) < SWIPE) return null
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
    return dy > 0 ? 'down' : 'up'
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (saveOpen || pausedRef.current) return
    e.preventDefault()
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
    steer(dir)
    hoppedThisSwipe.current = true
    swipeRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || hoppedThisSwipe.current || saveOpen || pausedRef.current) return
    const dir = dirFromDelta(e.clientX - start.x, e.clientY - start.y)
    if (dir) steer(dir)
  }

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
              {ui.phase === 'playing' || ui.phase === 'dying' || ui.phase === 'clearing' ? (
                <PlayReadoutCenter label="Lives and level">
                  {ui.lives} {ui.lives === 1 ? 'life' : 'lives'} · L{ui.level}
                </PlayReadoutCenter>
              ) : null}
            </PlayReadout>

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
                  tagline="Clear the maze. Outrun the chasers."
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
