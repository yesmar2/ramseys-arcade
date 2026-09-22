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
  clearPointerDir,
  createInitialState,
  releaseInput,
  requestDash,
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

const DASH_KEYS = new Set(['Space', 'ShiftLeft', 'ShiftRight'])

/** A touch this short and this still is a tap, and a tap is a dash. */
const TAP_MS = 230
const TAP_SLOP = 14

/**
 * How far the mouse has to travel (px) before it steers. A run starts with it
 * asleep, and the arrow keys put it back to sleep, so a resting hand nudging
 * it never sends the fish off on its own.
 */
const MOUSE_WAKE_PX = 24

export function FrenzyGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('frenzy')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null)
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

  const offsetFromCentre = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: e.clientX - (rect.left + rect.width / 2),
      y: e.clientY - (rect.top + rect.height / 2),
    }
  }

  const aimFromEvent = (e: ReactPointerEvent<HTMLElement>) => {
    const o = offsetFromCentre(e)
    stateRef.current = setPointerDir(stateRef.current, o.x, o.y)
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
    if (phase === 'menu') {
      restart()
      // A finger steers from the moment it lands; a mouse click on Start is not a heading.
      if (e.pointerType !== 'mouse') aimFromEvent(e)
      return
    }
    if (phase !== 'playing') return
    if (e.pointerType === 'mouse') {
      // Mouse steers by hovering, so a click is free to mean dash — and means the mouse is in use.
      mouseRef.current = { awake: true, from: null }
      aimFromEvent(e)
      const o = offsetFromCentre(e)
      stateRef.current = requestDash(stateRef.current, Math.hypot(o.x, o.y) > 8 ? Math.atan2(o.y, o.x) : undefined)
    } else {
      aimFromEvent(e)
      touchRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpen || pausedRef.current) return
    if (stateRef.current.phase !== 'playing') return
    if (e.pointerType === 'mouse' && !mouseRef.current.awake) {
      const from = mouseRef.current.from
      if (!from) {
        mouseRef.current.from = { x: e.clientX, y: e.clientY }
        return
      }
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < MOUSE_WAKE_PX) return
      mouseRef.current = { awake: true, from: null }
    }
    aimFromEvent(e)
  }

  /** The mouse left the water: stop where you are rather than chase a cursor you can't see. */
  const onPointerLeave = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return
    sleepMouse()
    stateRef.current = clearPointerDir(stateRef.current)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const touch = touchRef.current
    touchRef.current = null
    if (
      touch &&
      e.pointerType !== 'mouse' &&
      stateRef.current.phase === 'playing' &&
      performance.now() - touch.t < TAP_MS &&
      Math.hypot(e.clientX - touch.x, e.clientY - touch.y) < TAP_SLOP
    ) {
      const o = offsetFromCentre(e)
      stateRef.current = requestDash(stateRef.current, Math.atan2(o.y, o.x))
    }
    if (e.pointerType !== 'mouse') stateRef.current = clearPointerDir(stateRef.current)
  }

  const onPointerCancel = () => {
    touchRef.current = null
    stateRef.current = clearPointerDir(stateRef.current)
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
        stateRef.current = clearPointerDir(setKey(stateRef.current, dir, true))
        return
      }
      if (DASH_KEYS.has(e.code) || e.code === 'Enter') {
        e.preventDefault()
        if (phase === 'menu') {
          if (e.code !== 'ShiftLeft' && e.code !== 'ShiftRight') restart()
          return
        }
        if (phase === 'playing' && DASH_KEYS.has(e.code) && !e.repeat) {
          stateRef.current = requestDash(stateRef.current)
        }
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
  // Past the twilight the water is dark in either theme, so the readout goes light with it.
  const deep = ui.mult >= 3

  return (
    <section
      className={`frenzy frenzy--fullscreen${deep ? ' frenzy--deep' : ''}${saveOpen ? ' frenzy--saving' : ''}`}
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
                <PlayStat label="Level" value={ui.level.toLocaleString()} urgent={ui.danger} />
                <PlayStat label="Depth" value={`×${ui.mult}`} />
              </PlayReadoutStats>
            ) : null}
          </PlayReadout>

          <div className="frenzy__overlay">
            <GamePauseOverlay
              slug="frenzy"
              personalBest={inRun ? previousBestRef.current : apiBest}
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
