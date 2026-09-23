import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import '../../styles/centroid.css'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { haptic } from '../../lib/haptics'
import { getPersonalBest } from '../../lib/personalBest'
import { clearRunAchievements } from '../../lib/runAchievements'
import { beginRun } from '../../lib/runSession'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  THICK,
  createInitialState,
  jumpToPlate,
  moveCursor,
  pinAtCursor,
  setPin,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame, tablePointAt } from './render'

type Arrow = 'left' | 'right' | 'up' | 'down'

const ARROWS: Record<string, Arrow> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
}

function isGoKey(e: KeyboardEvent) {
  return e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter'
}

/** How fast the keyboard's crosshair crosses the table, in table widths a second; Shift slows it for the last bit. */
const CURSOR_SPEED = 0.42
const CURSOR_FINE = 0.1

export function DeadCenterGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('centroid')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('centroid'))
  const startGrace = useRef(0)
  const heldRef = useRef<Set<Arrow>>(new Set())
  const fineRef = useRef(false)

  const restart = (intoMenu = false) => {
    saveOpenRef.current = false
    setSaveOpen(false)
    offeredScore.current = null
    clearRunAchievements()
    if (!intoMenu) beginRun('centroid')
    heldRef.current.clear()
    stateRef.current = intoMenu ? createInitialState() : startGame(stateRef.current)
    previousBestRef.current = getPersonalBest('centroid')
    startGrace.current = performance.now() + 220
    setUi(toSnapshot(stateRef.current))
  }

  /**
   * Done with the run: back to the start card rather than into another one.
   * That card is where the numbers a run just changed are shown, and dropping
   * the player straight back into play skips past all of it. No run is opened,
   * so nothing counts until they actually start one.
   */
  const toMenu = () => restart(true)

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      const held = heldRef.current
      if (held.size > 0) {
        const speed = (fineRef.current ? CURSOR_FINE : CURSOR_SPEED) * dt
        const dx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0)
        const dy = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0)
        if (dx || dy) moveCursor(stateRef.current, dx * speed, dy * speed)
      }
      stateRef.current = tick(stateRef.current, dt)

      const snap = toSnapshot(stateRef.current)
      if (snap.phase === 'gameover' && offeredScore.current !== snap.score) {
        offeredScore.current = snap.score
        saveOpenRef.current = true
        heldRef.current.clear()
        setSaveOpen(true)
        setUi(snap)
        startGrace.current = performance.now() + 400
      }
      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        setUi(snap)
      }

      const canvas = canvasRef.current
      const parent = canvas?.parentElement
      const w = parent?.clientWidth || 0
      const h = parent?.clientHeight || 0
      if (canvas && w > 0 && h > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const cw = Math.round(w * dpr)
        const ch = Math.round(h * dpr)
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw
          canvas.height = ch
        }
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          renderGame(ctx, stateRef.current, w, h)
        }
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (ui.phase === 'menu') previousBestRef.current = apiBest
  }, [apiBest, ui.phase])

  useEffect(() => {
    const drop = () => heldRef.current.clear()
    window.addEventListener('blur', drop)
    return () => window.removeEventListener('blur', drop)
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (saveOpenRef.current) return
      const s = stateRef.current
      if (s.phase === 'menu' || s.phase === 'gameover') {
        if (isGoKey(e)) {
          e.preventDefault()
          if (performance.now() < startGrace.current) return
          restart()
        }
        return
      }
      if (e.key === 'Shift') fineRef.current = true
      if (isGoKey(e)) {
        e.preventDefault()
        if (e.repeat) return
        const aiming = s.phase === 'aiming'
        pinAtCursor(s)
        if (aiming && s.outcome) haptic('hit')
        setUi(toSnapshot(s))
        return
      }
      const arrow = ARROWS[e.code]
      if (!arrow) return
      e.preventDefault()
      heldRef.current.add(arrow)
      // A press moves it at once, so a tap nudges it.
      if (!e.repeat) {
        const step = fineRef.current ? 0.004 : 0.012
        moveCursor(
          s,
          arrow === 'left' ? -step : arrow === 'right' ? step : 0,
          arrow === 'up' ? -step : arrow === 'down' ? step : 0,
        )
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') fineRef.current = false
      const arrow = ARROWS[e.code]
      if (arrow) heldRef.current.delete(arrow)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (saveOpenRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu' || s.phase === 'gameover') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    // The chrome's buttons sit over the table and are not part of it.
    const canvas = canvasRef.current
    if (!canvas || e.target !== canvas || s.phase !== 'aiming') return
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    // The tap lands on the plate's face, wherever the plate is hovering.
    const at = tablePointAt(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height, s.pose.at.z + THICK)
    s.cursor = null
    setPin(s, at)
    // A plate has no outcome until its pin is in, and a tap before it's down doesn't set one.
    if (s.outcome) haptic('hit')
    setUi(toSnapshot(s))
  }

  const inPlay = ui.phase === 'aiming' || ui.phase === 'settling'

  return (
    <section className="centroid centroid--fullscreen">
      <div className="game-play">
        <GameStage aspectWidth={1} aspectHeight={1.12} fill>
          <div className="centroid__play" onPointerDown={onPointerDown}>
            <canvas ref={canvasRef} className="centroid__viewport" />

            <GamePlayChrome slug="centroid" inRun={() => stateRef.current.phase !== 'menu'} />

            <PlayReadout>
              <PlayReadoutScore hot={inPlay && ui.score > previousBestRef.current}>{ui.score.toLocaleString()}</PlayReadoutScore>
              <PlayReadoutStats>
                <PlayStat label="Plate" value={ui.plateNo} />
                <PlayStat label="Pins" value={ui.pins} urgent={ui.pins === 1 && inPlay} />
                <PlayStat label="Streak" value={ui.streak} />
              </PlayReadoutStats>
            </PlayReadout>

            <div className="centroid__overlay">
              {ui.phase === 'menu' && !saveOpen && (
                <GameStartCard
                  title="Centroid"
                  slug="centroid"
                  tools={
                    <AdminWaveSkip
                      mode="start"
                      unit="plate"
                      onJump={(plate) => {
                        restart()
                        jumpToPlate(stateRef.current, plate)
                        setUi(toSnapshot(stateRef.current))
                      }}
                    />
                  }
                />
              )}
              {ui.phase === 'gameover' &&
                saveOpen &&
                (tournament ? (
                  <TournamentScoreCard
                    tournamentId={tournament.tournamentId}
                    gameSlug="centroid"
                    score={ui.score}
                    subtitle={`${ui.balanced} balanced · best streak ${ui.bestStreak}`}
                    onDone={toMenu}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="centroid"
                    score={ui.score}
                    title="Out of pins"
                    subtitle={`${ui.balanced} balanced · ${ui.deadCenters} dead center · best streak ${ui.bestStreak}`}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={toMenu}
                  />
                ))}
            </div>
          </div>
        </GameStage>
      </div>
    </section>
  )
}
