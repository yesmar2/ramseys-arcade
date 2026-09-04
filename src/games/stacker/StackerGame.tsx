import { useEffect, useRef, useState } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { usePlayerName } from '../../hooks/usePlayerName'
import { normalizePlayerName } from '../../lib/leaderboard'
import { getPersonalBest } from '../../lib/personalBest'
import {
  clearRunAchievements,
  pushRunAchievement,
} from '../../lib/runAchievements'
import {
  shouldCelebrateRecordSubmit,
  submitStackerPerfectStreak,
} from '../../lib/records'
import { STAGE_ASPECT } from '../../lib/stage'
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
  return {
    score: s.score,
    best: s.best,
    status: s.phase,
    perfectStreak: s.perfectStreak,
    perfectStreakBest: s.perfectStreakBest,
  }
}

export function StackerGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('stacker')
  const playerName = normalizePlayerName(usePlayerName())
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<StackerSnapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const placedLock = useRef(false)
  const startGrace = useRef(0)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('stacker'))
  const streakRecordKey = useRef('')
  const pausable = ui.status === 'playing' && !saveOpen
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
    if (ui.status === 'menu') previousBestRef.current = apiBest
  }, [apiBest, ui.status])

  useEffect(() => {
    if (tournament || !playerName) return
    if (ui.status !== 'playing' && ui.status !== 'gameover') return
    const streak = ui.perfectStreakBest
    if (streak < 2) return
    const key = `perfect:${streak}`
    if (streakRecordKey.current === key) return
    streakRecordKey.current = key
    void (async () => {
      const result = await submitStackerPerfectStreak(streak, playerName)
      if (shouldCelebrateRecordSubmit(result)) {
        pushRunAchievement({
          id: 'stacker:perfect-streak',
          label: 'Perfects in a row',
          value: String(streak),
          rank: result.rank,
        })
      }
    })()
  }, [ui.status, ui.perfectStreakBest, playerName, tournament])

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    streakRecordKey.current = ''
    clearRunAchievements()
    stateRef.current = startGame(stateRef.current)
    previousBestRef.current = getPersonalBest('stacker')
    startGrace.current = performance.now() + 280
    setUi(toSnapshot(stateRef.current))
  }

  const act = (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.()
    if (saveOpen || pausedRef.current) return
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
    <section className="stacker stacker--fullscreen">
      <div className="game-play" onPointerDown={act}>
      <GameStage
        aspectWidth={STAGE_ASPECT.stacker.w}
        aspectHeight={STAGE_ASPECT.stacker.h}
      >
        <canvas ref={canvasRef} className="stacker__viewport" />

        <GamePlayChrome
          slug="stacker"
          inRun={() => stateRef.current.phase === 'playing'}
          paused={paused}
        >
          {(pausable || paused) ? (
            <PauseButton paused={paused} onToggle={togglePause} />
          ) : null}
        </GamePlayChrome>

        <PlayReadout>
          <PlayReadoutScore
            hot={ui.status === 'playing' && ui.score > previousBestRef.current}
          >
            {ui.score}
          </PlayReadoutScore>
        </PlayReadout>

        <div className="stacker__overlay">
          <GamePauseOverlay
            slug="stacker"
            personalBest={ui.status === 'playing' ? previousBestRef.current : apiBest}
            paused={paused}
            onResume={resume}
          />
          {ui.status === 'menu' && !saveOpen && !paused && (
            <GameStartCard
              title="Stacker"
              tagline="Time the drop. Don’t miss."
              slug="stacker"
            />
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
                previousBest={Math.max(previousBestRef.current, apiBest)}
                onDone={restart}
              />
            )
          )}
        </div>
      </GameStage>
      </div>
    </section>
  )
}
