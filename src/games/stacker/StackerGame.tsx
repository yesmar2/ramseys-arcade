import { useEffect, useRef, useState } from 'react'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  placeBlock,
  startGame,
  tick,
  type GameState,
  type StackerSnapshot,
} from './StackerEngine'
import { renderGame } from './render'

function toSnapshot(s: GameState): StackerSnapshot {
  return { score: s.score, best: s.best, status: s.phase, perfectStreak: s.perfectStreak }
}

export function StackerGame() {
  const tournament = useTournamentPlay()
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<StackerSnapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const placedLock = useRef(false)
  const startGrace = useRef(0)
  const offeredScore = useRef<number | null>(null)

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
        if (
          snap.status === 'gameover' &&
          offeredScore.current !== snap.score
        ) {
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
    startGrace.current = performance.now() + 280
    setUi(toSnapshot(stateRef.current))
  }

  const act = () => {
    if (saveOpen) return
    if (placedLock.current) return
    placedLock.current = true
    setTimeout(() => { placedLock.current = false }, 140)

    const s = stateRef.current
    if (s.phase === 'menu' || s.phase === 'gameover') {
      restart()
      return
    }
    if (performance.now() < startGrace.current) return
    stateRef.current = placeBlock(s)
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (saveOpen) return
        e.preventDefault()
        act()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  return (
    <section className="stacker stacker--fullscreen" onPointerDown={act}>
      <canvas ref={canvasRef} className="stacker__viewport" />

      <div className="stacker__hud" aria-live="polite">
        <div className="stacker__stat">
          <span className="stacker__label">Score</span>
          <strong>{ui.score}</strong>
        </div>
        <div className="stacker__stat">
          <span className="stacker__label">Best</span>
          <strong>{ui.best}</strong>
        </div>
      </div>

      <div className="stacker__overlay">
        {ui.status === 'menu' && !saveOpen && (
          <div className="stacker__centerMessage" aria-hidden="true">
            Tap or Space to start
          </div>
        )}
        {ui.status === 'gameover' && saveOpen && (
          tournament ? (
            <TournamentScoreCard
              tournamentId={tournament.tournamentId}
              gameSlug="stacker"
              score={ui.score}
              onDone={restart}
            />
          ) : (
            <ScoreSaveCard
              gameSlug="stacker"
              score={ui.score}
              title="Nice stack"
              onDone={restart}
            />
          )
        )}
      </div>
    </section>
  )
}
