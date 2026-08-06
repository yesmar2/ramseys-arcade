import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
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

export function SnakeGame() {
  const tournament = useTournamentPlay()
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const startGrace = useRef(0)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      stateRef.current = tick(stateRef.current, dt)
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
        const w = parent?.clientWidth || window.innerWidth
        const h = parent?.clientHeight || window.innerHeight
        const ctx = canvas.getContext('2d')
        if (ctx) renderGame(ctx, stateRef.current, w, h)
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    stateRef.current = startGame(stateRef.current)
    startGrace.current = performance.now() + 220
    setUi(toSnapshot(stateRef.current))
  }

  const turn = (dir: Dir) => {
    if (saveOpen) return
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
      if (saveOpen) return
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

  const onPointerDown = (e: ReactPointerEvent) => {
    if (saveOpen) return
    swipeStart.current = { x: e.clientX, y: e.clientY }
    if (stateRef.current.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || saveOpen) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) < 28) return
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 'right' : 'left')
    else turn(dy > 0 ? 'down' : 'up')
  }

  return (
    <section
      className="snake snake--fullscreen"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipeStart.current = null
      }}
    >
      <canvas ref={canvasRef} className="snake__viewport" />

      <div className="snake__hud" aria-live="polite">
        <div className="snake__stat">
          <span className="snake__label">Score</span>
          <strong>{ui.score}</strong>
        </div>
        <div className="snake__stat">
          <span className="snake__label">Best</span>
          <strong>{ui.best}</strong>
        </div>
        <div className="snake__stat">
          <span className="snake__label">Length</span>
          <strong>{ui.length}</strong>
        </div>
      </div>

      <div className="snake__overlay">
        {ui.phase === 'menu' && !saveOpen && (
          <div className="snake__card" aria-hidden="true">
            <h2>Snake</h2>
            <p>Swipe or use arrows. Eat. Grow. Don’t crash.</p>
            <span>Tap or press a direction to start</span>
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
              title="Ouch"
              subtitle={`Best ${ui.best}`}
              onDone={restart}
            />
          )
        )}
      </div>
    </section>
  )
}
