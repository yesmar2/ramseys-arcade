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
  cancelAim,
  COURSE,
  createInitialState,
  fieldFrame,
  keyAim,
  resizeState,
  setDragAim,
  shoot,
  startGame,
  tick,
  toFieldDelta,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

const IN_RUN = new Set(['intro', 'aim', 'roll', 'sunk', 'pickup'])

function toParLabel(toPar: number) {
  if (toPar === 0) return 'Level par'
  const n = Math.abs(toPar)
  return `${n} ${toPar < 0 ? 'under' : 'over'} par`
}

/**
 * The field fills the screen, portrait or landscape. To shoot, press anywhere
 * and pull back; the ball goes the other way, harder the further you pull.
 * Keyboard: left and right turn the aim, hold space to charge, release to
 * shoot. A plain tap starts a round from the title or the score card.
 */
export function PuttGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('putt')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 540, h: 720 })
  const dragRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const keysRef = useRef({ left: false, right: false, charge: false })
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

      const keys = keysRef.current
      const turn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
      if (turn !== 0 || keys.charge || stateRef.current.aiming === 'key') {
        stateRef.current = keyAim(stateRef.current, turn, keys.charge, dt)
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

  // Dev only: lets a script read and drive the state for a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __putt?: () => GameState
      __puttShoot?: (angle: number, power: number) => void
      __puttCourse?: typeof COURSE
    }
    w.__putt = () => stateRef.current
    w.__puttCourse = COURSE
    w.__puttShoot = (angle, power) => {
      const s = stateRef.current
      if (s.phase !== 'aim') return
      stateRef.current = shoot({ ...s, aim: angle, power, aiming: 'drag' })
    }
    return () => {
      delete w.__putt
      delete w.__puttShoot
      delete w.__puttCourse
    }
  }, [])

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    dragRef.current = null
    const { w, h } = sizeRef.current
    stateRef.current = startGame(resizeState(createInitialState(w, h), w, h))
    previousBestRef.current = getPersonalBest('putt')
    startGrace.current = performance.now() + 260
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
    if (s.phase !== 'aim') return
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = { id: e.pointerId, x: e.clientX - rect.left, y: e.clientY - rect.top, moved: false }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // A pointer that is already gone; the drag still works off the element.
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - rect.left - drag.x
    const dy = e.clientY - rect.top - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < 4) return
    drag.moved = true
    const f = fieldFrame(rect.width, rect.height)
    const pull = toFieldDelta(f, dx, dy)
    stateRef.current = setDragAim(stateRef.current, pull.x, pull.y)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    dragRef.current = null
    stateRef.current = drag.moved ? shoot(stateRef.current) : cancelAim(stateRef.current)
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (saveOpen) return
      const s = stateRef.current
      if (e.code === 'ArrowLeft') keysRef.current.left = true
      if (e.code === 'ArrowRight') keysRef.current.right = true
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (e.repeat) return
        if (s.phase === 'menu' || s.phase === 'gameover') {
          if (performance.now() >= startGrace.current) restart()
          return
        }
        if (s.phase === 'aim' && s.aiming !== 'drag') keysRef.current.charge = true
      }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') keysRef.current.left = false
      if (e.code === 'ArrowRight') keysRef.current.right = false
      if ((e.code === 'Space' || e.code === 'Enter') && keysRef.current.charge) {
        keysRef.current.charge = false
        if (stateRef.current.phase === 'aim' && stateRef.current.aiming === 'key') {
          stateRef.current = shoot(stateRef.current)
          setUi(toSnapshot(stateRef.current))
        }
      }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [saveOpen])

  const inRun = IN_RUN.has(ui.phase)

  return (
    <section className="putt putt--fullscreen">
      <div className="game-play">
        <GameStage aspectWidth={3} aspectHeight={4} fill>
          <div
            className="putt__play"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
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
          {ui.phase === 'menu' && !saveOpen && <GameStartCard title="Putt" slug="putt" />}
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
