import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  resizeState,
  simonLayout,
  startGame,
  tapPad,
  tapPadId,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

function currentLayout() {
  return simonLayout(typeof window !== 'undefined' && window.innerHeight > window.innerWidth)
}

export function SimonGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('simon')
  const layout0 = currentLayout()
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 540, h: 540 })
  const [aspect, setAspect] = useState({ w: layout0.aspectW, h: layout0.aspectH })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('simon'))
  const startGrace = useRef(0)

  useEffect(() => {
    const sync = () => {
      const next = currentLayout()
      setAspect({ w: next.aspectW, h: next.aspectH })
    }
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      const canvas = canvasRef.current
      const parent = canvas?.parentElement
      const w = parent?.clientWidth || 0
      const h = parent?.clientHeight || 0
      if (w > 0 && h > 0 && (w !== sizeRef.current.w || h !== sizeRef.current.h)) {
        sizeRef.current = { w, h }
        stateRef.current = resizeState(stateRef.current, w, h)
      }

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

      if (canvas && w > 0 && h > 0) {
        const ctx = canvas.getContext('2d')
        if (ctx) renderGame(ctx, stateRef.current, w, h)
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
    const { w, h } = sizeRef.current
    stateRef.current = startGame(resizeState(createInitialState(w, h), w, h))
    previousBestRef.current = getPersonalBest('simon')
    startGrace.current = performance.now() + 180
    setUi(toSnapshot(stateRef.current))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpen) return
    e.preventDefault()

    const s = stateRef.current
    if (s.phase === 'menu' || s.phase === 'gameover') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    if (s.phase !== 'input') return

    const rect = e.currentTarget.getBoundingClientRect()
    stateRef.current = tapPad(s, e.clientX - rect.left, e.clientY - rect.top)
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpen) return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        const s = stateRef.current
        if (s.phase === 'menu' || s.phase === 'gameover') restart()
        return
      }
      const map: Record<string, number> = {
        Digit1: 0,
        Digit2: 1,
        Digit3: 2,
        Digit4: 3,
        KeyQ: 0,
        KeyW: 1,
        KeyA: 2,
        KeyS: 3,
      }
      const pad = map[e.code]
      if (pad == null) return
      if (stateRef.current.phase !== 'input') return
      e.preventDefault()
      stateRef.current = tapPadId(stateRef.current, pad)
      setUi(toSnapshot(stateRef.current))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  return (
    <section className="simon simon--fullscreen">
      <div className="game-play">
        <GameStage
          aspectWidth={aspect.w}
          aspectHeight={aspect.h}
        >
          <div className="simon__play" onPointerDown={onPointerDown}>
            <canvas ref={canvasRef} className="simon__viewport" />
            <GamePlayChrome
              slug="simon"
              inRun={() => {
                const phase = stateRef.current.phase
                return phase === 'watch' || phase === 'input'
              }}
            />
            <PlayReadout>
              <PlayReadoutScore
                hot={
                  (ui.phase === 'watch' || ui.phase === 'input') &&
                  ui.score > previousBestRef.current
                }
              >
                {ui.round || 1}
              </PlayReadoutScore>
            </PlayReadout>
          </div>
        </GameStage>
        <div className="simon__overlay">
          {ui.phase === 'menu' && !saveOpen && (
            <GameStartCard
              title="Simon"
              tagline="Watch. Repeat. Don’t miss."
              slug="simon"
            />
          )}
          {ui.phase === 'gameover' && saveOpen && (
            tournament ? (
              <TournamentScoreCard
                tournamentId={tournament.tournamentId}
                gameSlug="simon"
                score={ui.score}
                onDone={restart}
              />
            ) : (
              <ScoreSaveCard
                gameSlug="simon"
                score={ui.score}
                title="Pattern broke"
                previousBest={Math.max(previousBestRef.current, apiBest)}
                onDone={restart}
              />
            )
          )}
        </div>
      </div>
    </section>
  )
}
