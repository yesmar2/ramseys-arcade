import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GameHud, GameHudStat, GameStageHud } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
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
  hitAt,
  hitHole,
  setScale,
  startGame,
  tick,
  toSnapshot,
  HOLE_COUNT,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

export function WhackGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('pop')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 540, h: 720 })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('pop'))
  const hitLock = useRef(false)
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

      const canvas = canvasRef.current
      const parent = canvas?.parentElement
      const w = parent?.clientWidth || 0
      const h = parent?.clientHeight || 0
      if (w > 0 && h > 0 && (w !== sizeRef.current.w || h !== sizeRef.current.h)) {
        sizeRef.current = { w, h }
        stateRef.current = setScale(stateRef.current, w, h)
      }

      if (!pausedRef.current) {
        stateRef.current = tick(stateRef.current, dt)
      }

      const snap = toSnapshot(stateRef.current)
      // Open the score card as soon as the round ends — don't wait on the UI
      // throttle, or a leftover tap can restart before the card mounts.
      if (snap.phase === 'gameover' && offeredScore.current !== snap.score) {
        offeredScore.current = snap.score
        saveOpenRef.current = true
        setSaveOpen(true)
        setUi(snap)
        startGrace.current = performance.now() + 400
      }

      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        setUi(snap)
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
    saveOpenRef.current = false
    setSaveOpen(false)
    offeredScore.current = null
    const { w, h } = sizeRef.current
    stateRef.current = setScale(startGame(stateRef.current), w, h)
    previousBestRef.current = getPersonalBest('pop')
    startGrace.current = performance.now() + 220
    setUi(toSnapshot(stateRef.current))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault()
    if (saveOpenRef.current || pausedRef.current) return
    if (hitLock.current) return
    hitLock.current = true
    setTimeout(() => {
      hitLock.current = false
    }, 70)

    const s = stateRef.current
    // Only the menu starts a run from a tap. Game over waits for the score card
    // (a final frantic tap used to skip straight into a new round).
    if (s.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    if (s.phase !== 'playing') return
    if (performance.now() < startGrace.current) return

    const rect = e.currentTarget.getBoundingClientRect()
    const { w, h } = sizeRef.current
    stateRef.current = hitAt(
      s,
      e.clientX - rect.left,
      e.clientY - rect.top,
      w,
      h,
    )
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpenRef.current || pausedRef.current) return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        const s = stateRef.current
        if (s.phase === 'menu') {
          if (performance.now() < startGrace.current) return
          restart()
        }
        return
      }
      const map: Record<string, number> = {
        Digit1: 0,
        Digit2: 1,
        Digit3: 2,
        Digit4: 3,
        Digit5: 4,
        Digit6: 5,
        Digit7: 6,
        Digit8: 7,
        Digit9: 8,
        Numpad1: 6,
        Numpad2: 7,
        Numpad3: 8,
        Numpad4: 3,
        Numpad5: 4,
        Numpad6: 5,
        Numpad7: 0,
        Numpad8: 1,
        Numpad9: 2,
      }
      const hole = map[e.code]
      if (hole == null || hole >= HOLE_COUNT) return
      if (stateRef.current.phase !== 'playing') return
      if (performance.now() < startGrace.current) return
      e.preventDefault()
      const { w, h } = sizeRef.current
      stateRef.current = hitHole(stateRef.current, hole, w, h)
      setUi(toSnapshot(stateRef.current))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section className="whack whack--fullscreen">
      <GameHud
        slug="pop"
        extra={
          (pausable || paused) ? (
            <PauseButton paused={paused} onToggle={togglePause} />
          ) : undefined
        }
      />
      <div className="game-play">
        <GameStage
          aspectWidth={STAGE_ASPECT.whack.w}
          aspectHeight={STAGE_ASPECT.whack.h}
        >
          <div className="whack__play" onPointerDown={onPointerDown}>
            <canvas ref={canvasRef} className="whack__viewport" />

            <GameStageHud>
              <GameHudStat
                label="Score"
                hot={ui.phase === 'playing' && ui.score > previousBestRef.current}
              >
                {ui.score}
              </GameHudStat>
              <GameHudStat
                label="Time"
                className="game-hud__stat--time"
                urgent={ui.phase === 'playing' && ui.timeLeft <= 10}
              >
                {ui.phase === 'menu' ? 45 : ui.timeLeft}
              </GameHudStat>
            </GameStageHud>

            <div className="whack__overlay">
            <GamePauseOverlay
              slug="pop"
              personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
              paused={paused}
              onResume={resume}
            />
            {ui.phase === 'menu' && !saveOpen && !paused && (
              <div className="whack__card" aria-hidden="true">
                <h2>Pop</h2>
                <p>Tap the circles before they fade. The center scores more.</p>
                <PersonalBestHint slug="pop" />
                <span>Tap to start · 45 seconds</span>
              </div>
            )}
            {ui.phase === 'gameover' && saveOpen && (
              tournament ? (
                <TournamentScoreCard
                  tournamentId={tournament.tournamentId}
                  gameSlug="pop"
                  score={ui.score}
                  onDone={restart}
                />
              ) : (
                <ScoreSaveCard
                  gameSlug="pop"
                  score={ui.score}
                  title="Time’s up"
                  subtitle={`${ui.hits} hits`}
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
