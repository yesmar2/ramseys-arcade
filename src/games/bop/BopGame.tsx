import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import '../../styles/bop.css'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  act,
  bopLayout,
  controlAt,
  createInitialState,
  resizeState,
  startGame,
  tick,
  toSnapshot,
  type Control,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'
import { beginRun } from '../../lib/runSession'

function currentLayout() {
  return bopLayout(typeof window !== 'undefined' && window.innerHeight > window.innerWidth)
}

/** How far a drag has to travel, in stage units, before it counts as the gesture. */
const DRAG_UNITS = 5

/**
 * Each control has its own gesture, so the wrong gesture on the right control
 * does nothing rather than failing you: a tap bops, a sideways drag twists, a
 * drag down pulls, a drag up flicks, and a drag any which way spins.
 */
type Drag = { control: Control; x: number; y: number; done: boolean }

export function BopGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('bop')
  const layout0 = currentLayout()
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 540, h: 540 })
  const dragRef = useRef<Drag | null>(null)
  const [aspect, setAspect] = useState({ w: layout0.aspectW, h: layout0.aspectH })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('bop'))
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

  // Dev only: lets a script read the current call to drive a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __bop?: () => GameState }).__bop = () => stateRef.current
    return () => {
      delete (window as unknown as { __bop?: () => GameState }).__bop
    }
  }, [])

  const restart = (intoMenu = false) => {
    setSaveOpen(false)
    offeredScore.current = null
    if (!intoMenu) beginRun('bop')
    dragRef.current = null
    const { w, h } = sizeRef.current
    stateRef.current = startGame(resizeState(createInitialState(w, h), w, h))
    previousBestRef.current = getPersonalBest('bop')
    startGrace.current = performance.now() + 260
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

  const perform = (control: Control) => {
    stateRef.current = act(stateRef.current, control)
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
    if (s.phase !== 'call') return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const control = controlAt(s, x, y)
    if (!control) return
    if (control === 'bop') {
      perform('bop')
      return
    }
    dragRef.current = { control, x, y, done: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.done) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - rect.left - drag.x
    const dy = e.clientY - rect.top - drag.y
    const need = DRAG_UNITS * (Math.min(rect.width, rect.height) / 100)
    const gestured =
      drag.control === 'twist'
        ? Math.abs(dx) >= need && Math.abs(dx) > Math.abs(dy)
        : drag.control === 'pull'
          ? dy >= need && dy > Math.abs(dx)
          : drag.control === 'flick'
            ? -dy >= need && -dy > Math.abs(dx)
            : Math.hypot(dx, dy) >= need * 1.4
    if (!gestured) return
    drag.done = true
    perform(drag.control)
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpen) return
      const s = stateRef.current
      if (s.phase === 'menu' || s.phase === 'gameover') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          restart()
        }
        return
      }
      const map: Record<string, Control> = {
        Space: 'bop',
        Enter: 'bop',
        ArrowLeft: 'twist',
        ArrowRight: 'twist',
        ArrowDown: 'pull',
        ArrowUp: 'flick',
        KeyS: 'spin',
        KeyB: 'bop',
        KeyT: 'twist',
        KeyP: 'pull',
        KeyF: 'flick',
      }
      const control = map[e.code]
      if (!control || e.repeat) return
      e.preventDefault()
      // The keypress that started the run must not also answer its first call.
      if (performance.now() < startGrace.current) return
      perform(control)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  const inRun = ui.phase === 'call'
  const title = ui.ended === 'late' ? 'Too slow' : 'Wrong one'

  return (
    <section className="bop bop--fullscreen">
      <div className="game-play">
        <GameStage aspectWidth={aspect.w} aspectHeight={aspect.h}>
          <div
            className="bop__play"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas ref={canvasRef} className="bop__viewport" />
            <GamePlayChrome slug="bop" inRun={() => stateRef.current.phase === 'call'} />
            <PlayReadout>
              <PlayReadoutScore hot={inRun && ui.score > previousBestRef.current}>
                {ui.score}
              </PlayReadoutScore>
            </PlayReadout>
          </div>
        </GameStage>
        <div className="bop__overlay">
          {ui.phase === 'menu' && !saveOpen && (
            <GameStartCard title="Bop" slug="bop" />
          )}
          {ui.phase === 'gameover' && saveOpen && (
            tournament ? (
              <TournamentScoreCard
                tournamentId={tournament.tournamentId}
                gameSlug="bop"
                score={ui.score}
                onDone={toMenu}
              />
            ) : (
              <ScoreSaveCard
                gameSlug="bop"
                score={ui.score}
                title={title}
                subtitle={`${ui.streak} in a row`}
                previousBest={Math.max(previousBestRef.current, apiBest)}
                onDone={toMenu}
              />
            )
          )}
        </div>
      </div>
    </section>
  )
}
