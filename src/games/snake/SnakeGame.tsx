import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { PersonalBestHint } from '../../components/PersonalBestHint'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { usePlayerName } from '../../hooks/usePlayerName'
import { getPersonalBest } from '../../lib/personalBest'
import { normalizePlayerName } from '../../lib/leaderboard'
import {
  SNAKE_LENGTH_MILESTONE_MAX,
  SNAKE_LENGTH_MILESTONE_STEP,
  submitSnakeFastestLength,
} from '../../lib/records'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  queueDir,
  queueTurn,
  snakeLayout,
  startGame,
  tick,
  toSnapshot,
  type Dir,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

function currentLayout() {
  return snakeLayout(typeof window !== 'undefined' && window.innerHeight > window.innerWidth)
}

export function SnakeGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('snake')
  const playerName = normalizePlayerName(usePlayerName())
  const layout0 = currentLayout()
  const stateRef = useRef<GameState>(createInitialState(layout0.cols, layout0.rows, layout0.dir))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [aspect, setAspect] = useState({ w: layout0.aspectW, h: layout0.aspectH })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('snake'))
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const startGrace = useRef(0)
  const holdTimer = useRef<number | null>(null)
  const runStartRef = useRef<number | null>(null)
  const milestonesRef = useRef<Set<number>>(new Set())
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

  useEffect(() => {
    if (ui.phase !== 'playing' || tournament || !playerName) return
    if (runStartRef.current == null) return
    const elapsedMs = performance.now() - runStartRef.current
    if (!(elapsedMs > 0)) return

    for (
      let milestone = SNAKE_LENGTH_MILESTONE_STEP;
      milestone <= SNAKE_LENGTH_MILESTONE_MAX;
      milestone += SNAKE_LENGTH_MILESTONE_STEP
    ) {
      if (ui.length < milestone || milestonesRef.current.has(milestone)) continue
      milestonesRef.current.add(milestone)
      void submitSnakeFastestLength(milestone, elapsedMs, playerName)
    }
  }, [ui.phase, ui.length, playerName, tournament])

  useEffect(() => {
    const sync = () => {
      const s = stateRef.current
      if (s.phase !== 'menu') return
      const next = currentLayout()
      if (s.cols === next.cols && s.rows === next.rows) return
      stateRef.current = createInitialState(next.cols, next.rows, next.dir)
      setAspect({ w: next.aspectW, h: next.aspectH })
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
    const next = currentLayout()
    stateRef.current = startGame({
      ...stateRef.current,
      cols: next.cols,
      rows: next.rows,
    })
    setAspect({ w: next.aspectW, h: next.aspectH })
    previousBestRef.current = getPersonalBest('snake')
    startGrace.current = performance.now() + 220
    runStartRef.current = performance.now()
    milestonesRef.current = new Set()
    setUi(toSnapshot(stateRef.current))
  }

  const turn = (dir: Dir) => {
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

  const steer = (side: 'left' | 'right') => {
    if (saveOpen || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu') {
      restart()
      stateRef.current = queueTurn(stateRef.current, side)
      setUi(toSnapshot(stateRef.current))
      return
    }
    if (s.phase !== 'playing') return
    stateRef.current = queueTurn(s, side)
  }

  const stopHold = () => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  const startHold = (side: 'left' | 'right') => {
    stopHold()
    steer(side)
    const pulse = () => {
      steer(side)
      holdTimer.current = window.setTimeout(pulse, 170)
    }
    holdTimer.current = window.setTimeout(pulse, 260)
  }

  useEffect(() => () => stopHold(), [])

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
        turn(dir)
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

  const SWIPE = 26

  const commitSwipe = (x: number, y: number) => {
    const start = swipeRef.current
    if (!start || saveOpen || pausedRef.current) return
    const dx = x - start.x
    const dy = y - start.y
    if (Math.hypot(dx, dy) < SWIPE) return
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 'right' : 'left')
    else turn(dy > 0 ? 'down' : 'up')
    swipeRef.current = { x, y }
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    if (saveOpen || pausedRef.current) return
    swipeRef.current = { x: e.clientX, y: e.clientY }
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
    if (!swipeRef.current) return
    commitSwipe(e.clientX, e.clientY)
  }

  const onPointerUp = () => {
    swipeRef.current = null
  }

  return (
    <section className={`snake snake--fullscreen${saveOpen ? ' snake--saving' : ''}`}>
      <div className="snake__body">
      <div
        className="snake__play"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <GameStage
          aspectWidth={aspect.w}
          aspectHeight={aspect.h}
        >
          <canvas ref={canvasRef} className="snake__viewport" />

          <GamePlayChrome>
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

          <div className="snake__overlay">
            <GamePauseOverlay
              slug="snake"
              personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
              paused={paused}
              onResume={resume}
            />
            {ui.phase === 'menu' && !saveOpen && !paused && (
              <div className="snake__card" aria-hidden="true">
                <h2>Snake</h2>
                <p>Eat. Grow. Don’t crash.</p>
                <PersonalBestHint slug="snake" />
                <span className="snake__hint snake__hint--keys">Arrows or WASD to steer</span>
                <span className="snake__hint snake__hint--touch">Swipe the board, or tap to turn</span>
              </div>
            )}
            {ui.phase === 'gameover' && saveOpen && (
              tournament ? (
                <TournamentScoreCard
                  tournamentId={tournament.tournamentId}
                  gameSlug="snake"
                  score={ui.score}
                  onDone={restart}
                />
              ) : (
                <ScoreSaveCard
                  gameSlug="snake"
                  score={ui.score}
                  title="Game over"
                  previousBest={Math.max(previousBestRef.current, apiBest)}
                  onDone={restart}
                />
              )
            )}
          </div>
        </GameStage>
      </div>

        <div className="snake__touch" aria-label="Turn">
          <button
            type="button"
            className="snake__turn"
            aria-label="Turn left"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              startHold('left')
            }}
            onPointerUp={stopHold}
            onPointerCancel={stopHold}
            onPointerLeave={stopHold}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 3v5h5"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="snake__turn"
            aria-label="Turn right"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              startHold('right')
            }}
            onPointerUp={stopHold}
            onPointerCancel={stopHold}
            onPointerLeave={stopHold}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 3v5h-5"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
