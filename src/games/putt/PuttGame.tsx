import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import '../../styles/putt.css'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import { GameStartCard } from '../../components/GameStartCard'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  cancelAim,
  COURSE,
  createInitialState,
  currentHole,
  fieldFrame,
  jumpToHole,
  keyAim,
  lookAt,
  mapFieldY,
  mapLayout,
  onMap,
  panLook,
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
import { renderGame, warmHole } from './render'
import { beginRun } from '../../lib/runSession'

const IN_RUN = new Set(['intro', 'aim', 'roll', 'splash', 'sunk'])
/** A press that moves less than this is a tap, not a pull. */
const TAP_SLOP = 6
/** Holding up or down looks along the hole this fast, in field units a second. */
const KEY_PAN = 180

function toParLabel(toPar: number) {
  if (toPar === 0) return 'Level par'
  const n = Math.abs(toPar)
  return `${n} ${toPar < 0 ? 'under' : 'over'} par`
}

/** "2 under par · 3 holes at a new best", or just the par when nothing was beaten. */
function roundLabel(toPar: number, bests: number) {
  const par = toParLabel(toPar)
  if (bests === 0) return par
  return `${par} · ${bests} ${bests === 1 ? 'hole' : 'holes'} at a new best`
}

/**
 * The field fills the screen, portrait or landscape. Press anywhere and
 * pull back: the ball goes the other way, harder the further the pull, and
 * letting go shoots. A pull that comes back to nothing is a change of mind.
 * Keyboard: left and right turn the aim, hold Space to charge, release to
 * shoot, Escape to think again. A press on the map looks along the hole. A
 * plain tap starts a round from the title; a finished round waits for its
 * score card. P or Escape
 * pauses; the pause menu carries the admin tools to skip a hole, which marks
 * the round assisted so its score stays off the boards.
 */
export function PuttGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('putt')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 540, h: 720 })
  /** A press on the field pulls a shot back; a press on the map looks along the hole. */
  const pressRef = useRef<{ id: number; x: number; y: number; moved: boolean; kind: 'pull' | 'look' } | null>(null)
  const keysRef = useRef({ left: false, right: false, up: false, down: false, charge: false })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('putt'))
  const startGrace = useRef(0)
  const inRun = IN_RUN.has(ui.phase)
  const pausable = inRun && !saveOpen
  /** While a shot is being set, Escape means "think again", not "pause". */
  const ignorePauseKeys = useRef(false)
  const { paused, toggle: togglePause, resume } = useGamePause(pausable, ignorePauseKeys)
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

      ignorePauseKeys.current = stateRef.current.aiming !== 'none'
      // Paused, the world holds still: the ball, the windmills and the sliders all wait.
      if (!pausedRef.current) {
        const keys = keysRef.current
        const turn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
        if (turn !== 0 || keys.charge || stateRef.current.aiming === 'key') {
          stateRef.current = keyAim(stateRef.current, turn, keys.charge, dt)
        }
        // Up looks toward the cup, down back toward the tee.
        const pan = (keys.down ? 1 : 0) - (keys.up ? 1 : 0)
        if (pan !== 0) stateRef.current = panLook(stateRef.current, pan * KEY_PAN * dt)
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

  // The later holes' outlines and gardens take a moment to work out: do it a hole at a time while the
  // first is being looked at, so none of them stalls on its first frame.
  useEffect(() => {
    let next = 1
    let timer = 0
    const warm = () => {
      if (next >= COURSE.length) return
      warmHole(COURSE[next++]!)
      timer = window.setTimeout(warm, 300)
    }
    timer = window.setTimeout(warm, 1500)
    return () => window.clearTimeout(timer)
  }, [])

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
      stateRef.current = shoot({ ...s, aim: angle, power, aiming: 'drag' })
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

  const restart = (intoMenu = false) => {
    setSaveOpen(false)
    offeredScore.current = null
    if (!intoMenu) beginRun('putt')
    pressRef.current = null
    const { w, h } = sizeRef.current
    stateRef.current = startGame(resizeState(createInitialState(w, h), w, h))
    previousBestRef.current = getPersonalBest('putt')
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

  /** Admin and testing: a fresh round, or the round in hand, moved to a hole. */
  const goToHole = (index: number) => {
    stateRef.current = jumpToHole(stateRef.current, index)
    setUi(toSnapshot(stateRef.current))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpen || pausedRef.current) return
    e.preventDefault()
    const s = stateRef.current
    // A run that has ended waits for its report: only the start card starts another, or a press as it ends throws the score away.
    if (s.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    if (s.phase !== 'aim' || s.aiming === 'key') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    // On the map, the press looks along the hole instead of pulling a shot.
    const f = fieldFrame(rect.width, rect.height, currentHole(s).h)
    const m = mapLayout(f, currentHole(s).h, s.mapSide)
    const kind = onMap(m, x, y) ? 'look' : 'pull'
    if (kind === 'look') stateRef.current = lookAt(s, mapFieldY(m, f, x, y))
    pressRef.current = { id: e.pointerId, x, y, moved: false, kind }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // A pointer that is already gone; the press still works off the element.
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current
    if (!press || press.id !== e.pointerId || pausedRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const s = stateRef.current
    const f = fieldFrame(rect.width, rect.height, currentHole(s).h)
    if (press.kind === 'look') {
      stateRef.current = lookAt(s, mapFieldY(mapLayout(f, currentHole(s).h, s.mapSide), f, x, y))
      return
    }
    const dx = x - press.x
    const dy = y - press.y
    if (!press.moved && Math.hypot(dx, dy) < TAP_SLOP) return
    press.moved = true
    const pull = toFieldDelta(f, dx, dy)
    stateRef.current = setDragAim(s, pull.x, pull.y)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current
    if (!press || press.id !== e.pointerId) return
    pressRef.current = null
    if (press.kind === 'look' || pausedRef.current) return
    // Letting go shoots; a pull that never got going, or came back to the ball, does not.
    stateRef.current = press.moved ? shoot(stateRef.current) : cancelAim(stateRef.current)
    setUi(toSnapshot(stateRef.current))
  }

  /** The wheel looks along the hole: down the screen in portrait, along it when the hole lies on its side. */
  const onWheel = (e: ReactWheelEvent<HTMLElement>) => {
    const s = stateRef.current
    if (s.phase !== 'aim' || s.aiming !== 'none' || pausedRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const f = fieldFrame(rect.width, rect.height, currentHole(s).h)
    const px = f.rotated ? -(e.deltaY + e.deltaX) : e.deltaY
    stateRef.current = panLook(s, px / f.s)
  }

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (saveOpen || pausedRef.current) return
      const s = stateRef.current
      if (e.code === 'ArrowLeft') keysRef.current.left = true
      if (e.code === 'ArrowRight') keysRef.current.right = true
      if (e.code === 'ArrowUp') keysRef.current.up = true
      if (e.code === 'ArrowDown') keysRef.current.down = true
      if (e.code.startsWith('Arrow')) e.preventDefault()
      if (e.code === 'Escape' && s.phase === 'aim' && s.aiming === 'key') {
        e.preventDefault()
        keysRef.current.charge = false
        stateRef.current = cancelAim(s)
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (e.repeat) return
        if (s.phase === 'menu') {
          if (performance.now() >= startGrace.current) restart()
          return
        }
        if (s.phase === 'aim' && s.aiming !== 'drag') keysRef.current.charge = true
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') keysRef.current.left = false
      if (e.code === 'ArrowRight') keysRef.current.right = false
      if (e.code === 'ArrowUp') keysRef.current.up = false
      if (e.code === 'ArrowDown') keysRef.current.down = false
      if ((e.code === 'Space' || e.code === 'Enter') && keysRef.current.charge) {
        keysRef.current.charge = false
        if (pausedRef.current) return
        const s = stateRef.current
        if (s.phase === 'aim' && s.aiming === 'key') {
          stateRef.current = shoot(s)
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
            onWheel={onWheel}
          >
            <canvas ref={canvasRef} className="putt__viewport" />
            <GamePlayChrome slug="putt" inRun={() => IN_RUN.has(stateRef.current.phase)} paused={paused}>
              {pausable || paused ? <PauseButton paused={paused} onToggle={togglePause} /> : null}
            </GamePlayChrome>
            <PlayReadout>
              <PlayReadoutScore hot={inRun && ui.score > previousBestRef.current}>
                {ui.score}
              </PlayReadoutScore>
            </PlayReadout>
          </div>
        </GameStage>
        <div
          className="putt__overlay"
          // The start card sits beside the field, not in it: Start's press comes here and goes on to start the round.
          onPointerDown={(e) => {
            if (stateRef.current.phase === 'menu') onPointerDown(e)
          }}
        >
          <GamePauseOverlay
            slug="putt"
            personalBest={inRun ? previousBestRef.current : apiBest}
            paused={paused}
            onResume={resume}
            tools={
              inRun ? (
                <AdminWaveSkip
                  unit="hole"
                  wave={ui.holeIndex + 1}
                  onSkipNext={() => {
                    goToHole(stateRef.current.holeIndex + 1)
                    resume()
                  }}
                  onJump={(hole) => {
                    goToHole(hole - 1)
                    resume()
                  }}
                />
              ) : null
            }
          />
          {ui.phase === 'menu' && !saveOpen && !paused && (
            <GameStartCard
              title="Putt"
              slug="putt"
              tools={
                <AdminWaveSkip
                  mode="start"
                  unit="hole"
                  onJump={(hole) => {
                    restart()
                    goToHole(hole - 1)
                  }}
                />
              }
            />
          )}
          {ui.phase === 'gameover' && saveOpen && (
            tournament ? (
              <TournamentScoreCard
                tournamentId={tournament.tournamentId}
                gameSlug="putt"
                score={ui.score}
                onDone={toMenu}
              />
            ) : (
              <ScoreSaveCard
                gameSlug="putt"
                score={ui.score}
                title="Round over"
                subtitle={roundLabel(ui.toPar, ui.bests)}
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
