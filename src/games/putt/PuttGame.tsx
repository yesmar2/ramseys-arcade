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
  puttLayout,
  resizeState,
  startGame,
  tap,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

const IN_RUN = new Set(['intro', 'aim', 'power', 'roll', 'sunk', 'pickup'])

function toParLabel(toPar: number) {
  if (toPar === 0) return 'Level par'
  const n = Math.abs(toPar)
  return `${n} ${toPar < 0 ? 'under' : 'over'} par`
}

export function PuttGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('putt')
  const layout = puttLayout()
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 540, h: 720 })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('putt'))
  const startGrace = useRef(0)

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

  // Dev only: lets a script read the state to drive a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __putt?: () => GameState }
    w.__putt = () => stateRef.current
    return () => {
      delete w.__putt
    }
  }, [])

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    const { w, h } = sizeRef.current
    stateRef.current = startGame(resizeState(createInitialState(w, h), w, h))
    previousBestRef.current = getPersonalBest('putt')
    startGrace.current = performance.now() + 260
    setUi(toSnapshot(stateRef.current))
  }

  const onTap = () => {
    const s = stateRef.current
    if (s.phase === 'menu' || s.phase === 'gameover') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    if (performance.now() < startGrace.current) return
    stateRef.current = tap(s)
    setUi(toSnapshot(stateRef.current))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpen) return
    e.preventDefault()
    onTap()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpen) return
      if (e.code === 'Space' || e.code === 'Enter') {
        if (e.repeat) return
        e.preventDefault()
        onTap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  const inRun = IN_RUN.has(ui.phase)

  return (
    <section className="putt putt--fullscreen">
      <div className="game-play">
        <GameStage aspectWidth={layout.aspectW} aspectHeight={layout.aspectH}>
          <div className="putt__play" onPointerDown={onPointerDown}>
            <canvas ref={canvasRef} className="putt__viewport" />
            <GamePlayChrome slug="putt" inRun={() => IN_RUN.has(stateRef.current.phase)} />
            <PlayReadout>
              <PlayReadoutScore hot={inRun && ui.score > previousBestRef.current}>
                {ui.score}
              </PlayReadoutScore>
            </PlayReadout>
          </div>
        </GameStage>
        <div className="putt__overlay">
          {ui.phase === 'menu' && !saveOpen && (
            <GameStartCard title="Putt" slug="putt" />
          )}
          {ui.phase === 'gameover' && saveOpen && (
            tournament ? (
              <TournamentScoreCard
                tournamentId={tournament.tournamentId}
                gameSlug="putt"
                score={ui.score}
                onDone={restart}
              />
            ) : (
              <ScoreSaveCard
                gameSlug="putt"
                score={ui.score}
                title="Round over"
                subtitle={toParLabel(ui.toPar)}
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
