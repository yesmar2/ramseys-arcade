import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import '../../styles/barrage.css'
import { haptic } from '../../lib/haptics'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { GameStartCard } from '../../components/GameStartCard'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { clearRunAchievements } from '../../lib/runAchievements'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  MAX_STOCK,
  STAGE,
  createInitialState,
  jumpToWave,
  setFocus,
  setMove,
  setSteer,
  startGame,
  tick,
  toSnapshot,
  triggerBarrage,
  type GameState,
  type Snapshot,
} from './game'
import { fieldPointAt, renderGame } from './render'
import { beginRun } from '../../lib/runSession'

type HoldKey = 'left' | 'right' | 'up' | 'down' | 'slow'

const BY_CODE: Record<string, HoldKey> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ShiftLeft: 'slow',
  ShiftRight: 'slow',
}

/** Some hosts and layouts deliver no `code`, so fall back to `key`. */
const BY_KEY: Record<string, HoldKey> = {
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
  Shift: 'slow',
}

function holdKeyFor(e: KeyboardEvent): HoldKey | undefined {
  return BY_CODE[e.code] ?? BY_KEY[e.key] ?? BY_KEY[e.key?.toLowerCase()]
}

function isStartKey(e: KeyboardEvent): boolean {
  return e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter'
}

function isBarrageKey(e: KeyboardEvent): boolean {
  return (
    e.code === 'Space' ||
    e.code === 'KeyX' ||
    e.code === 'KeyZ' ||
    e.code === 'KeyB' ||
    e.key === ' ' ||
    e.key === 'x' ||
    e.key === 'z' ||
    e.key === 'b'
  )
}

/**
 * A finger moves the ship by as much as the finger moves, from wherever it
 * lands — never to where the finger is, so the ship is never under it. A touch
 * gets a little more travel than a mouse, since a thumb has less room.
 */
const TOUCH_TRAVEL = 1.3
const MOUSE_TRAVEL = 1

export function BarrageGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('barrage')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('barrage'))
  const startGrace = useRef(0)
  const pausable = ui.phase !== 'menu' && ui.phase !== 'gameover' && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  const heldRef = useRef<Set<HoldKey>>(new Set())

  const syncKeys = () => {
    const held = heldRef.current
    const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0)
    const y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0)
    setMove(stateRef.current, x, y)
    setFocus(stateRef.current, held.has('slow'))
  }

  /** The finger or pointer flying the ship: where it landed, and where the ship was then. */
  const dragRef = useRef<{ id: number; fx: number; fy: number; sx: number; sy: number; travel: number } | null>(null)

  const fieldPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return fieldPointAt(clientX - rect.left, clientY - rect.top, rect.width, rect.height)
  }

  const endDrag = () => {
    dragRef.current = null
    setSteer(stateRef.current, null)
  }

  const releaseAll = () => {
    heldRef.current.clear()
    syncKeys()
    endDrag()
  }

  const restart = (intoMenu = false) => {
    saveOpenRef.current = false
    setSaveOpen(false)
    offeredScore.current = null
    clearRunAchievements()
    if (!intoMenu) beginRun('barrage')
    releaseAll()
    stateRef.current = startGame(stateRef.current)
    previousBestRef.current = getPersonalBest('barrage')
    startGrace.current = performance.now() + 220
    if (intoMenu) stateRef.current = createInitialState()
    setUi(toSnapshot(stateRef.current))
  }

  /** Done with the run: back to the start card rather than straight into another. */
  const toMenu = () => restart(true)

  const barrage = () => {
    const s = stateRef.current
    if (s.phase !== 'playing' || s.stock < 1) return
    triggerBarrage(s)
    haptic('boost')
  }

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

      if (!pausedRef.current) {
        const before = stateRef.current.lives
        stateRef.current = tick(stateRef.current, dt)
        if (stateRef.current.lives < before) haptic(stateRef.current.lives > 0 ? 'hit' : 'crash')
      }

      const snap = toSnapshot(stateRef.current)
      if (snap.phase === 'gameover' && offeredScore.current !== snap.score) {
        offeredScore.current = snap.score
        saveOpenRef.current = true
        releaseAll()
        setSaveOpen(true)
        setUi(snap)
        startGrace.current = performance.now() + 400
      }

      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        setUi(snap)
      }

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

  // Losing the tab mid-hold would otherwise leave the ship flying itself.
  useEffect(() => {
    const drop = () => releaseAll()
    window.addEventListener('blur', drop)
    return () => window.removeEventListener('blur', drop)
  }, [])

  useEffect(() => {
    if (paused) releaseAll()
  }, [paused])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (saveOpenRef.current || pausedRef.current) return
      const s = stateRef.current
      if (s.phase === 'menu' || s.phase === 'gameover') {
        if (isStartKey(e)) {
          e.preventDefault()
          if (performance.now() < startGrace.current) return
          restart()
        }
        return
      }
      if (isBarrageKey(e)) {
        e.preventDefault()
        if (!e.repeat) barrage()
        return
      }
      const key = holdKeyFor(e)
      if (!key) return
      e.preventDefault()
      heldRef.current.add(key)
      syncKeys()
    }
    const up = (e: KeyboardEvent) => {
      const key = holdKeyFor(e)
      if (!key) return
      heldRef.current.delete(key)
      syncKeys()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const onPlayPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu' || s.phase === 'gameover') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    // The chrome's buttons and the Barrage button sit over the field and are not part of it.
    if (e.target !== canvasRef.current || dragRef.current !== null) return
    const at = fieldPoint(e.clientX, e.clientY)
    if (!at) return
    dragRef.current = {
      id: e.pointerId,
      fx: at.x,
      fy: at.y,
      sx: s.ship.x,
      sy: s.ship.y,
      travel: e.pointerType === 'mouse' ? MOUSE_TRAVEL : TOUCH_TRAVEL,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety; the drag still follows moves over the field */
    }
  }

  const onPlayPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.id) return
    const at = fieldPoint(e.clientX, e.clientY)
    if (!at) return
    const want = { x: d.sx + (at.x - d.fx) * d.travel, y: d.sy + (at.y - d.fy) * d.travel }
    setSteer(stateRef.current, want)
    // A ship held against a wall: take the next move from where it is, so it comes off the wall at once.
    const s = stateRef.current.ship
    if (Math.abs(want.x - s.x) > 0.2 || Math.abs(want.y - s.y) > 0.2) {
      dragRef.current = { ...d, fx: at.x, fy: at.y, sx: s.x, sy: s.y }
    }
  }

  const onPlayPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current && e.pointerId === dragRef.current.id) endDrag()
  }

  const barrageReady = ui.stock > 0 && ui.phase === 'playing'

  return (
    <section className={`barrage barrage--fullscreen${saveOpen ? ' barrage--saving' : ''}`}>
      <div className="game-play">
        <GameStage aspectWidth={STAGE.w} aspectHeight={STAGE.h} fill>
          <div
            className="barrage__play"
            onPointerDown={onPlayPointerDown}
            onPointerMove={onPlayPointerMove}
            onPointerUp={onPlayPointerEnd}
            onPointerCancel={onPlayPointerEnd}
            onLostPointerCapture={onPlayPointerEnd}
          >
            <canvas ref={canvasRef} className="barrage__viewport" />

            <GamePlayChrome slug="barrage" inRun={() => stateRef.current.phase !== 'menu'} paused={paused}>
              {pausable || paused ? <PauseButton paused={paused} onToggle={togglePause} /> : null}
            </GamePlayChrome>

            <PlayReadout>
              <PlayReadoutScore>{ui.score.toLocaleString()}</PlayReadoutScore>
              <PlayReadoutStats>
                <PlayStat label="Wave" value={ui.wave} />
                <PlayStat label="Ships" value={ui.lives} urgent={ui.lives === 1 && ui.phase !== 'menu'} />
                {ui.phase !== 'menu' ? (
                  <PlayStat label="Heat" value={<span className="barrage__heat">×{ui.heat.toFixed(1)}</span>} />
                ) : null}
              </PlayReadoutStats>
            </PlayReadout>

            {ui.phase !== 'menu' && ui.phase !== 'gameover' && !paused ? (
              <button
                type="button"
                className={`barrage__blast${barrageReady ? ' barrage__blast--ready' : ''}`}
                aria-label={`Barrage, ${ui.stock} ready`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  barrage()
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <span className="barrage__blast-label">Barrage</span>
                <span className="barrage__blast-pips" aria-hidden="true">
                  {Array.from({ length: MAX_STOCK }, (_, i) => (
                    <i
                      key={i}
                      className={i < ui.stock ? 'on' : i === ui.stock ? 'filling' : ''}
                      style={i === ui.stock ? ({ '--fill': `${Math.round(ui.charge * 100)}%` } as CSSProperties) : undefined}
                    />
                  ))}
                </span>
              </button>
            ) : null}

            <div className="barrage__overlay">
              <GamePauseOverlay
                slug="barrage"
                personalBest={ui.phase === 'menu' ? apiBest : previousBestRef.current}
                paused={paused}
                onResume={resume}
                tools={
                  pausable ? (
                    <AdminWaveSkip
                      unit="wave"
                      wave={ui.wave}
                      onSkipNext={() => {
                        jumpToWave(stateRef.current, ui.wave + 1)
                        setUi(toSnapshot(stateRef.current))
                        resume()
                      }}
                      onJump={(wave) => {
                        jumpToWave(stateRef.current, wave)
                        setUi(toSnapshot(stateRef.current))
                        resume()
                      }}
                    />
                  ) : null
                }
              />
              {ui.phase === 'menu' && !saveOpen && !paused && (
                <GameStartCard
                  title="Barrage"
                  slug="barrage"
                  tools={
                    <AdminWaveSkip
                      mode="start"
                      unit="wave"
                      onJump={(wave) => {
                        restart()
                        jumpToWave(stateRef.current, wave)
                        setUi(toSnapshot(stateRef.current))
                      }}
                    />
                  }
                />
              )}
              {ui.phase === 'gameover' &&
                saveOpen &&
                (tournament ? (
                  <TournamentScoreCard tournamentId={tournament.tournamentId} gameSlug="barrage" score={ui.score} onDone={toMenu} />
                ) : (
                  <ScoreSaveCard
                    gameSlug="barrage"
                    score={ui.score}
                    title="Out of ships"
                    subtitle={`Wave ${ui.wave} · ${ui.grazes.toLocaleString()} grazes · heat ×${ui.bestHeat.toFixed(1)}`}
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
