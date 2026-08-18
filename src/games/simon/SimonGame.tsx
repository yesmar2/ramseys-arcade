import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GameHud, GameHudStat } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PauseButton, PauseOverlay } from '../../components/PauseControls'
import { PersonalBestHint } from '../../components/PersonalBestHint'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { STAGE_ASPECT } from '../../lib/stage'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  resizeState,
  startGame,
  tapPad,
  tapPadId,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

export function SimonGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('simon')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 540, h: 540 })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('simon'))
  const tapLock = useRef(false)
  const startGrace = useRef(0)
  const pausable = (ui.phase === 'watch' || ui.phase === 'input') && !saveOpen
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

      const canvas = canvasRef.current
      const parent = canvas?.parentElement
      const w = parent?.clientWidth || 0
      const h = parent?.clientHeight || 0
      if (w > 0 && h > 0 && (w !== sizeRef.current.w || h !== sizeRef.current.h)) {
        sizeRef.current = { w, h }
        stateRef.current = resizeState(stateRef.current, w, h)
      }

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
    e.preventDefault()
    if (saveOpen || pausedRef.current) return
    if (tapLock.current) return
    tapLock.current = true
    setTimeout(() => {
      tapLock.current = false
    }, 80)

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
      if (saveOpen || pausedRef.current) return
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
      <GameHud
        slug="simon"
        personalBest={
          ui.phase === 'watch' || ui.phase === 'input'
            ? previousBestRef.current
            : apiBest
        }
        extra={
          (pausable || paused) ? (
            <PauseButton paused={paused} onToggle={togglePause} />
          ) : undefined
        }
      >
        <GameHudStat
          label="Score"
          hot={
            (ui.phase === 'watch' || ui.phase === 'input') &&
            ui.score > previousBestRef.current
          }
        >
          {ui.score}
        </GameHudStat>
        <GameHudStat label="Round">{ui.round || 1}</GameHudStat>
      </GameHud>
      <div className="game-play">
        <GameStage
          aspectWidth={STAGE_ASPECT.simon.w}
          aspectHeight={STAGE_ASPECT.simon.h}
        >
          <div className="simon__play" onPointerDown={onPointerDown}>
            <canvas ref={canvasRef} className="simon__viewport" />

            <div className="simon__overlay">
            <PauseOverlay paused={paused} onResume={resume} />
            {ui.phase === 'menu' && !saveOpen && !paused && (
              <div className="simon__card" aria-hidden="true">
                <h2>Simon</h2>
                <p>Watch the pattern. Repeat it. Don’t miss.</p>
                <PersonalBestHint slug="simon" />
                <span>Tap to start</span>
              </div>
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
        </GameStage>
      </div>
    </section>
  )
}
