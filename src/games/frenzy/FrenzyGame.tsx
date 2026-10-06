import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import '../../styles/frenzy.css'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  clearTarget,
  createInitialState,
  releaseInput,
  resizeState,
  setKey,
  setTarget,
  startGame,
  tick,
  toSnapshot,
  toWorld,
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

const START_KEYS = new Set(['Space', 'Enter'])

/**
 * How far the mouse has to travel (px) before it steers. A run starts with it
 * asleep, and the arrow keys put it back to sleep, so a resting hand nudging
 * it never sends the fish off on its own.
 */
const MOUSE_WAKE_PX = 24

/**
 * Frenzy, the food chain in an open ocean (game.ts). The mouse steers by
 * pointing: the fish swims toward it, and the camera follows. A finger steers like a trackpad, anywhere on the screen: the
 * fish moves the way the finger moves, so it's never under your thumb. The
 * arrow keys or WASD swim too. Swimming up hard through the surface leaps out.
 */
export function FrenzyGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('frenzy')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  /** A finger down: where it landed, and where the fish was then, in world units. */
  const touchRef = useRef<{ id: number; x: number; y: number; fx: number; fy: number } | null>(null)
  const mouseRef = useRef<{ awake: boolean; from: { x: number; y: number } | null }>({ awake: false, from: null })
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

  const sleepMouse = () => {
    mouseRef.current = { awake: false, from: null }
  }

  const restart = (intoMenu = false) => {
    setSaveOpen(false)
    offeredScore.current = null
    sleepMouse()
    if (!intoMenu) beginRun('frenzy')
    stateRef.current = startGame(stateRef.current)
    previousBestRef.current = getPersonalBest('frenzy')
    // Same reset, stopped at the start card instead of in play.
    if (intoMenu) stateRef.current = { ...stateRef.current, phase: 'menu' }
    setUi(toSnapshot(stateRef.current))
  }

  /**
   * Done with the run: back to the start card rather than into another one.
   * That card is where the numbers a run just changed are shown, and dropping
   * the player straight back into play skips past all of it. No run is opened,
   * so nothing counts until they actually start one.
   */
  const toMenu = () => restart(true)

  /** The pointer, in pixels from the canvas's top left. */
  const local = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = (canvasRef.current ?? e.currentTarget).getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const pointTo = (e: ReactPointerEvent<HTMLElement>) => {
    const o = local(e)
    const at = toWorld(stateRef.current, o.x, o.y)
    stateRef.current = setTarget(stateRef.current, at.x, at.y)
  }

  /** A finger: the fish goes where it was when the finger landed, plus how far the finger has moved. */
  const dragTo = (e: ReactPointerEvent<HTMLElement>) => {
    const t = touchRef.current
    if (!t || t.id !== e.pointerId) return
    const s = stateRef.current
    stateRef.current = setTarget(s, t.fx + (e.clientX - t.x) / s.ppu, t.fy + (e.clientY - t.y) / s.ppu)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpen || pausedRef.current) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const phase = stateRef.current.phase
    if (phase === 'menu') restart()
    if (stateRef.current.phase !== 'playing') return
    if (e.pointerType === 'mouse') {
      mouseRef.current = { awake: true, from: null }
      pointTo(e)
    } else {
      const p = stateRef.current.player
      touchRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, fx: p.x, fy: p.y }
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpen || pausedRef.current) return
    if (stateRef.current.phase !== 'playing') return
    if (e.pointerType !== 'mouse') {
      dragTo(e)
      return
    }
    if (!mouseRef.current.awake) {
      const from = mouseRef.current.from
      if (!from) {
        mouseRef.current.from = { x: e.clientX, y: e.clientY }
        return
      }
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < MOUSE_WAKE_PX) return
      mouseRef.current = { awake: true, from: null }
    }
    pointTo(e)
  }

  /** The mouse left the water: stop where you are rather than chase a cursor you can't see. */
  const onPointerLeave = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return
    sleepMouse()
    stateRef.current = clearTarget(stateRef.current)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (touchRef.current?.id === e.pointerId) touchRef.current = null
    if (e.pointerType !== 'mouse') stateRef.current = clearTarget(stateRef.current)
  }

  const onPointerCancel = () => {
    touchRef.current = null
    stateRef.current = clearTarget(stateRef.current)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (saveOpen || pausedRef.current) return
      const phase = stateRef.current.phase
      const dir = KEY_MAP[e.code]
      if (dir) {
        e.preventDefault()
        if (phase === 'menu') restart()
        // The keys take over: the fish now moves only while one is held.
        sleepMouse()
        stateRef.current = clearTarget(setKey(stateRef.current, dir, true))
        return
      }
      if (START_KEYS.has(e.code) && phase === 'menu') {
        e.preventDefault()
        restart()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = KEY_MAP[e.code]
      if (!dir) return
      stateRef.current = setKey(stateRef.current, dir, false)
    }
    // Focus went elsewhere mid-press: no key-up will arrive, so let go of everything now.
    const onBlur = () => {
      sleepMouse()
      stateRef.current = releaseInput(stateRef.current)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [saveOpen])

  const inRun = ui.phase === 'playing'

  return (
    <section
      className={`frenzy frenzy--fullscreen${saveOpen ? ' frenzy--saving' : ''}`}
    >
      <div
        className="frenzy__play"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
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
            <PlayReadoutScore hot={inRun && ui.score > previousBestRef.current}>
              {ui.score.toLocaleString()}
            </PlayReadoutScore>
            {inRun || ui.phase === 'dying' ? (
              <PlayReadoutStats>
                <PlayStat label="Size" value={ui.stage} />
                <PlayStat label="Lives" value={ui.lives} urgent={ui.lives === 1} />
              </PlayReadoutStats>
            ) : null}
          </PlayReadout>

          <div className="frenzy__overlay">
            <GamePauseOverlay
              slug="frenzy"
              personalBest={inRun ? previousBestRef.current : apiBest}
              paused={paused}
              onResume={resume}
              onRestart={restart}
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
                  onDone={toMenu}
                />
              ) : (
                <ScoreSaveCard
                  gameSlug="frenzy"
                  score={ui.score}
                  title={ui.deathCause || 'Eaten'}
                  previousBest={Math.max(previousBestRef.current, apiBest)}
                  onDone={toMenu}
                />
              )
            )}
          </div>
        </GameStage>
      </div>
    </section>
  )
}
