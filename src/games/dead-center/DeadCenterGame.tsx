import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GameHud, GameHudStat } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PersonalBestHint } from '../../components/PersonalBestHint'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { STAGE_ASPECT } from '../../lib/stage'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  aim,
  createInitialState,
  nextRound,
  resizeState,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

export function DeadCenterGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('dead-center')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 720, h: 540 })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('dead-center'))
  const clickLock = useRef(false)
  const startGrace = useRef(0)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      const canvas = canvasRef.current
      const w = canvas?.parentElement?.clientWidth || canvas?.clientWidth || 0
      const h = canvas?.parentElement?.clientHeight || canvas?.clientHeight || 0
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
    previousBestRef.current = getPersonalBest('dead-center')
    startGrace.current = performance.now() + 180
    setUi(toSnapshot(stateRef.current))
  }

  const goNext = () => {
    if (saveOpen) return
    const s = stateRef.current
    if (s.phase !== 'reveal') return
    stateRef.current = nextRound(s)
    setUi(toSnapshot(stateRef.current))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault()
    if (saveOpen) return
    if (clickLock.current) return
    clickLock.current = true
    setTimeout(() => {
      clickLock.current = false
    }, 80)

    const s = stateRef.current
    if (s.phase === 'menu' || s.phase === 'gameover') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    if (s.phase !== 'playing') return

    const rect = e.currentTarget.getBoundingClientRect()
    stateRef.current = aim(s, e.clientX - rect.left, e.clientY - rect.top)
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpen) return
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        const s = stateRef.current
        if (s.phase === 'menu' || s.phase === 'gameover') restart()
        if (s.phase === 'reveal') goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  const gradeLabel =
    ui.lastGrade === 'perfect'
      ? 'Perfect'
      : ui.lastGrade === 'great'
        ? 'Great'
        : ui.lastGrade === 'close'
          ? 'Close'
          : ui.lastGrade === 'far'
            ? 'Far'
            : ui.lastGrade === 'miss'
              ? 'Miss'
              : null

  return (
    <section className="deadcenter deadcenter--fullscreen">
      <GameHud
        slug="dead-center"
        personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
      >
        <GameHudStat
          label="Score"
          hot={ui.phase === 'playing' && ui.score > previousBestRef.current}
        >
          {ui.score}
        </GameHudStat>
        <GameHudStat label="Round">
          {Math.min(ui.round, ui.totalRounds)}/{ui.totalRounds}
        </GameHudStat>
        <GameHudStat label="Time" className="game-hud__stat--time">
          {ui.phase === 'playing' ? ui.timeLeft : '—'}
        </GameHudStat>
      </GameHud>
      <div className="game-play">
      <GameStage
        aspectWidth={STAGE_ASPECT.deadCenter.w}
        aspectHeight={STAGE_ASPECT.deadCenter.h}
      >
        <div className="deadcenter__play" onPointerDown={onPointerDown}>
          <canvas ref={canvasRef} className="deadcenter__viewport" />

          <div className="deadcenter__overlay">
            {ui.phase === 'menu' && !saveOpen && (
              <div className="deadcenter__card" aria-hidden="true">
                <h2>Centroid</h2>
                <p>Tap the shape’s true center. Closer scores more.</p>
                <PersonalBestHint slug="dead-center" />
                <span>5 shapes · 5 seconds each</span>
              </div>
            )}
            {ui.phase === 'reveal' && gradeLabel && (
              <div className="deadcenter__toast" aria-hidden="true">
                <strong>{gradeLabel}</strong>
                {ui.lastDist != null ? (
                  <span className="deadcenter__toast-off">
                    {Math.round(ui.lastDist) === 0
                      ? 'Dead on'
                      : `${Math.round(ui.lastDist)} px off`}
                  </span>
                ) : null}
                {ui.lastPoints > 0 ? <span>+{ui.lastPoints}</span> : null}
              </div>
            )}
            {ui.phase === 'reveal' && (
              <button
                type="button"
                className="deadcenter__next"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  goNext()
                }}
              >
                {ui.round >= ui.totalRounds ? 'Done' : 'Next'}
              </button>
            )}
            {ui.phase === 'gameover' && saveOpen && (
              tournament ? (
                <TournamentScoreCard
                  tournamentId={tournament.tournamentId}
                  gameSlug="dead-center"
                  score={ui.score}
                  subtitle={`${ui.avgAccuracy}% accuracy`}
                  onDone={restart}
                />
              ) : (
                <ScoreSaveCard
                  gameSlug="dead-center"
                  score={ui.score}
                  title="Round complete"
                  subtitle={`${ui.avgAccuracy}% accuracy`}
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
