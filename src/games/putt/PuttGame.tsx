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
  aimAt,
  cancelSwing,
  catchUp,
  COURSE,
  createInitialState,
  currentHole,
  endAim,
  fieldFrame,
  jumpToHole,
  resizeState,
  shoot,
  startGame,
  swing,
  tick,
  toField,
  toSnapshot,
  turnAim,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

const IN_RUN = new Set(['intro', 'aim', 'roll', 'splash', 'sunk', 'pickup'])
/** A press that moves less than this is a tap. */
const TAP_SLOP = 8

function toParLabel(toPar: number) {
  if (toPar === 0) return 'Level par'
  const n = Math.abs(toPar)
  return `${n} ${toPar < 0 ? 'under' : 'over'} par`
}

/**
 * The field fills the screen, portrait or landscape. Drag anywhere to aim:
 * the line points from the ball to the finger. Then three taps: one starts
 * the swing gauge, one takes the power, and one has to land on the line as
 * the gauge comes back. Keyboard: left and right turn the aim, Space is the
 * tap. A plain tap starts a round from the title or the score card.
 */
export function PuttGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('putt')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 540, h: 720 })
  const pressRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const keysRef = useRef({ left: false, right: false })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('putt'))
  const startGrace = useRef(0)
  /** When the last frame ran, so a tap can be placed between frames. */
  const frameAtRef = useRef(performance.now())

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      frameAtRef.current = now

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
      if (turn !== 0) stateRef.current = turnAim(stateRef.current, turn, dt)
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
      __puttJump?: (index: number) => void
      __puttCourse?: typeof COURSE
    }
    w.__putt = () => stateRef.current
    w.__puttShoot = (angle, power) => {
      const s = stateRef.current
      if (s.phase !== 'aim') return
      stateRef.current = shoot({ ...s, aim: angle, power, swing: 'idle' }, 0)
    }
    w.__puttJump = (index) => {
      stateRef.current = jumpToHole(stateRef.current, index)
    }
    w.__puttCourse = COURSE
    return () => {
      delete w.__putt
      delete w.__puttShoot
      delete w.__puttJump
      delete w.__puttCourse
    }
  }, [])

  /** A tap that counts right now: the power or the strike, taken as of this instant. */
  const tapNow = () => {
    const dt = Math.min(0.06, (performance.now() - frameAtRef.current) / 1000)
    stateRef.current = swing(catchUp(stateRef.current, dt))
    setUi(toSnapshot(stateRef.current))
  }

  const cancel = () => {
    stateRef.current = cancelSwing(stateRef.current)
    setUi(toSnapshot(stateRef.current))
  }

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    pressRef.current = null
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
    // Once the swing is under way a press is the tap, on the press itself: waiting for the
    // release would put the strike a click's length late, and that is a miss.
    if (s.swing !== 'idle') {
      pressRef.current = null
      tapNow()
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    pressRef.current = { id: e.pointerId, x: e.clientX - rect.left, y: e.clientY - rect.top, moved: false }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // A pointer that is already gone; the press still works off the element.
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current
    if (!press || press.id !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (!press.moved && Math.hypot(x - press.x, y - press.y) < TAP_SLOP) return
    press.moved = true
    const s = stateRef.current
    const f = fieldFrame(rect.width, rect.height, currentHole(s).h)
    stateRef.current = aimAt(s, toField(f, s.cam, x, y))
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current
    if (!press || press.id !== e.pointerId) return
    pressRef.current = null
    stateRef.current = press.moved ? endAim(stateRef.current) : swing(stateRef.current)
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (saveOpen) return
      const s = stateRef.current
      if (e.code === 'ArrowLeft') keysRef.current.left = true
      if (e.code === 'ArrowRight') keysRef.current.right = true
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') e.preventDefault()
      if (e.code === 'Escape' && s.phase === 'aim' && s.swing !== 'idle') {
        e.preventDefault()
        cancel()
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (e.repeat) return
        if (s.phase === 'menu' || s.phase === 'gameover') {
          if (performance.now() >= startGrace.current) restart()
          return
        }
        if (s.phase === 'aim') tapNow()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') keysRef.current.left = false
      if (e.code === 'ArrowRight') keysRef.current.right = false
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
            {ui.phase === 'aim' && ui.swing !== 'idle' && (
              <button
                type="button"
                className="putt__cancel"
                onPointerDown={(e) => {
                  // Not a swing tap: this press is the way out of the swing.
                  e.stopPropagation()
                  e.preventDefault()
                  cancel()
                }}
              >
                Cancel
              </button>
            )}
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
