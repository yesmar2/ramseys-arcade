import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import '../../styles/frenzy.css'
import { GamePlayChrome, PlayReadout, PlayReadoutCenter, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  clearPointerDir,
  createInitialState,
  resizeState,
  setKey,
  setPointerDir,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'
import { beginRun } from '../../lib/runSession'

const KEY_MAP: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
}

export function FrenzyGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('frenzy')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('frenzy'))
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
    beginRun('frenzy')
    stateRef.current = startGame(stateRef.current)
    previousBestRef.current = getPersonalBest('frenzy')
    setUi(toSnapshot(stateRef.current))
  }

  const aimFromEvent = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    stateRef.current = setPointerDir(
      stateRef.current,
      e.clientX - (rect.left + rect.width / 2),
      e.clientY - (rect.top + rect.height / 2),
    )
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpen || pausedRef.current) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (stateRef.current.phase !== 'playing') {
      restart()
    }
    aimFromEvent(e)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpen || pausedRef.current) return
    if (stateRef.current.phase !== 'playing') return
    aimFromEvent(e)
  }

  const onPointerUp = () => {
    stateRef.current = clearPointerDir(stateRef.current)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = KEY_MAP[e.code]
      if (dir) {
        if (saveOpen || pausedRef.current) return
        e.preventDefault()
        if (stateRef.current.phase !== 'playing') restart()
        stateRef.current = setKey(stateRef.current, dir, true)
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        if (saveOpen || pausedRef.current) return
        e.preventDefault()
        if (stateRef.current.phase !== 'playing') restart()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = KEY_MAP[e.code]
      if (!dir) return
      stateRef.current = setKey(stateRef.current, dir, false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [saveOpen])

  return (
    <section className={`frenzy frenzy--fullscreen${saveOpen ? ' frenzy--saving' : ''}`}>
      <div
        className="frenzy__play"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <GameStage aspectWidth={16} aspectHeight={9} fill>
          <canvas ref={canvasRef} className="frenzy__viewport" />

          <GamePlayChrome
            slug="frenzy"
            inRun={() => stateRef.current.phase === 'playing'}
            paused={paused}
          >
            {(pausable || paused) ? (
              <PauseButton paused={paused} onToggle={togglePause} />
            ) : null}
          </GamePlayChrome>

          <PlayReadout>
            <PlayReadoutScore hot={ui.phase === 'playing' && ui.score > previousBestRef.current}>
              {ui.score}
            </PlayReadoutScore>
            {ui.phase === 'playing' ? (
              <PlayReadoutCenter label="Current level" urgent={ui.danger}>
                Level {ui.level}
              </PlayReadoutCenter>
            ) : null}
          </PlayReadout>

          <div className="frenzy__overlay">
            <GamePauseOverlay
              slug="frenzy"
              personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
              paused={paused}
              onResume={resume}
            />
            {ui.phase === 'menu' && !saveOpen && !paused && (
              <GameStartCard title="Frenzy" slug="frenzy" />
            )}
            {ui.phase === 'gameover' && saveOpen && (
              tournament ? (
                <TournamentScoreCard
                  tournamentId={tournament.tournamentId}
                  gameSlug="frenzy"
                  score={ui.score}
                  onDone={restart}
                />
              ) : (
                <ScoreSaveCard
                  gameSlug="frenzy"
                  score={ui.score}
                  title="Eaten"
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
