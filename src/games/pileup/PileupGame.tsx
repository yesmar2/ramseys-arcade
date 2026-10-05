import '../../styles/pileup.css'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { GameStartCard } from '../../components/GameStartCard'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { haptic } from '../../lib/haptics'
import { getPersonalBest } from '../../lib/personalBest'
import { clearRunAchievements } from '../../lib/runAchievements'
import { beginRun } from '../../lib/runSession'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  hardDrop,
  holdPiece,
  jumpToLevel,
  move,
  rotate,
  setSoftDrop,
  shake,
  softDropBy,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type Phase,
  type Snapshot,
} from './game'
import { pileLayout, type Box, type Layout } from './layout'
import { renderGame } from './render'

/**
 * Where the page's own score and buttons end, measured from the top of the
 * play area, so the strip of boxes can sit under them. They move with the safe
 * area on a notched phone, which the canvas has no other way to know.
 */
function measureTop(play: HTMLElement): number {
  const top = play.getBoundingClientRect().top
  let bottom = 0
  play.querySelectorAll('.play-readout__score, .play-stats, .game-play-chrome').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.height > 0 && r.bottom - top < play.clientHeight * 0.4) bottom = Math.max(bottom, r.bottom - top)
  })
  return bottom > 0 ? Math.round(bottom + 8) : 56
}

function inRun(phase: Phase) {
  return phase === 'playing' || phase === 'topout'
}

/*
 * The keyboard: a held arrow waits DAS seconds, then slides a column every
 * ARR, as anyone who's played one of these expects.
 */
const DAS = 0.16
const ARR = 0.045

type Held = 'left' | 'right'

/*
 * A finger: drag across and the piece follows it, a column for each DRAG_STEP
 * cells the finger travels; drag down and it follows down. A quick touch that
 * barely moves is a turn. A flick down drops it; a flick up holds it.
 */
const DRAG_STEP = 0.85
const TAP_MS = 260
const TAP_SLOP = 0.35
/** Cells a second, over the last moment of a touch, that make a flick. */
const FLICK_DOWN = 16
const FLICK_UP = 12

type Drag = {
  id: number
  x0: number
  y0: number
  /** Where the finger was the last time the piece moved a column, or a row. */
  ax: number
  ay: number
  t0: number
  moved: boolean
  /** The piece it's steering; a new one under the same finger starts from where the finger is. */
  serial: number
  trail: { t: number; x: number; y: number }[]
}

function boxStyle(box: Box): CSSProperties {
  return { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` }
}

export function PileupGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('pileup')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef({ w: 0, h: 0, top: 0 })
  const [layout, setLayout] = useState<Layout>(() => pileLayout(390, 700))
  const layoutRef = useRef(layout)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('pileup'))
  const startGrace = useRef(0)
  // The pile tumbling out is its own ending; pausing through it would only hold the card back.
  const pausable = ui.phase === 'playing' && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  const heldRef = useRef<{ dir: Held | null; t: number; repeat: number; keys: Set<Held> }>({
    dir: null,
    t: 0,
    repeat: 0,
    keys: new Set(),
  })
  const dragRef = useRef<Drag | null>(null)

  const releaseAll = () => {
    const held = heldRef.current
    held.keys.clear()
    held.dir = null
    setSoftDrop(stateRef.current, false)
    dragRef.current = null
  }

  const restart = (intoMenu = false) => {
    saveOpenRef.current = false
    setSaveOpen(false)
    offeredScore.current = null
    clearRunAchievements()
    releaseAll()
    if (!intoMenu) beginRun('pileup')
    const time = stateRef.current.time
    stateRef.current = intoMenu ? { ...createInitialState(), time } : startGame(stateRef.current)
    previousBestRef.current = getPersonalBest('pileup')
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

  const sync = () => setUi(toSnapshot(stateRef.current))

  const doShake = () => {
    if (pausedRef.current || saveOpenRef.current) return
    if (shake(stateRef.current)) {
      haptic('boost')
      sync()
    }
  }

  const doHold = () => {
    if (pausedRef.current || saveOpenRef.current) return
    if (holdPiece(stateRef.current)) {
      haptic('turn')
      sync()
    }
  }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      const canvas = canvasRef.current
      const play = playRef.current
      const w = play?.clientWidth || 0
      const h = play?.clientHeight || 0
      if (play && w > 0 && h > 0) {
        const top = measureTop(play)
        const size = sizeRef.current
        if (w !== size.w || h !== size.h || top !== size.top) {
          sizeRef.current = { w, h, top }
          const next = pileLayout(w, h, top)
          layoutRef.current = next
          setLayout(next)
        }
      }

      if (!pausedRef.current && !saveOpenRef.current) {
        const s = stateRef.current
        // A held arrow, after its wait, slides the piece a column at a time.
        const held = heldRef.current
        if (held.dir && s.phase === 'playing') {
          held.t += dt
          if (held.t >= DAS) {
            held.repeat += dt
            while (held.repeat >= ARR) {
              held.repeat -= ARR
              if (!move(s, held.dir === 'left' ? -1 : 1)) {
                held.repeat = 0
                break
              }
            }
          }
        }
        const before = s.phase
        stateRef.current = tick(s, dt)
        if (before === 'playing' && stateRef.current.phase === 'topout') {
          haptic('crash')
          releaseAll()
        }
      }

      const snap = toSnapshot(stateRef.current)
      // The card opens the moment the pile has tumbled out, so a stray tap can't start another first.
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
          renderGame(ctx, stateRef.current, w, h, layoutRef.current)
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

  // Dev only: lets a script read and steer the run for a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __pileup?: () => GameState }
    w.__pileup = () => stateRef.current
    return () => {
      delete w.__pileup
    }
  }, [])

  // Losing the tab mid-hold would otherwise leave a key held down.
  useEffect(() => {
    const drop = () => releaseAll()
    window.addEventListener('blur', drop)
    return () => window.removeEventListener('blur', drop)
  }, [])

  useEffect(() => {
    if (paused) releaseAll()
  }, [paused])

  useEffect(() => {
    const pressSide = (dir: Held) => {
      const held = heldRef.current
      held.keys.add(dir)
      held.dir = dir
      held.t = 0
      held.repeat = 0
      move(stateRef.current, dir === 'left' ? -1 : 1)
    }
    const down = (e: KeyboardEvent) => {
      if (saveOpenRef.current || pausedRef.current) return
      const s = stateRef.current
      if (s.phase === 'menu') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          if (performance.now() >= startGrace.current) restart()
        }
        return
      }
      if (s.phase !== 'playing') return
      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault()
          if (!e.repeat) pressSide('left')
          return
        case 'ArrowRight':
          e.preventDefault()
          if (!e.repeat) pressSide('right')
          return
        case 'ArrowDown':
          e.preventDefault()
          setSoftDrop(s, true)
          return
        case 'ArrowUp':
        case 'KeyX':
          e.preventDefault()
          if (!e.repeat) rotate(s, 1)
          return
        case 'KeyZ':
        case 'ControlLeft':
        case 'ControlRight':
          e.preventDefault()
          if (!e.repeat) rotate(s, -1)
          return
        case 'Space':
          e.preventDefault()
          if (!e.repeat && hardDrop(s)) sync()
          return
        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight':
          e.preventDefault()
          if (!e.repeat) doHold()
          return
        case 'KeyS':
          e.preventDefault()
          if (!e.repeat) doShake()
          return
      }
    }
    const up = (e: KeyboardEvent) => {
      const held = heldRef.current
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        const dir: Held = e.code === 'ArrowLeft' ? 'left' : 'right'
        held.keys.delete(dir)
        // Letting go of one with the other still down goes back to the other, from its wait.
        if (held.dir === dir) {
          const other: Held = dir === 'left' ? 'right' : 'left'
          held.dir = held.keys.has(other) ? other : null
          held.t = 0
          held.repeat = 0
        }
      } else if (e.code === 'ArrowDown') {
        setSoftDrop(stateRef.current, false)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const pointAt = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    if (s.phase !== 'playing') return
    // The chrome's buttons, Hold and the Shake sit over the well and are not part of it.
    if (e.target !== canvasRef.current) return
    e.preventDefault()
    if (dragRef.current) {
      // A second finger down while one steers turns the piece.
      if (e.pointerId !== dragRef.current.id && rotate(s, 1)) haptic('turn')
      return
    }
    const at = pointAt(e)
    const now = performance.now()
    dragRef.current = {
      id: e.pointerId,
      x0: at.x,
      y0: at.y,
      ax: at.x,
      ay: at.y,
      t0: now,
      moved: false,
      serial: s.serial,
      trail: [{ t: now, x: at.x, y: at.y }],
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety; the drag still follows moves over the well */
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.id) return
    const s = stateRef.current
    if (s.phase !== 'playing') return
    const at = pointAt(e)
    const now = performance.now()
    d.trail.push({ t: now, x: at.x, y: at.y })
    while (d.trail.length > 2 && now - d.trail[0]!.t > 90) d.trail.shift()
    const cell = layoutRef.current.cell
    if (!d.moved && Math.hypot(at.x - d.x0, at.y - d.y0) > cell * TAP_SLOP) d.moved = true
    if (s.serial !== d.serial) {
      d.serial = s.serial
      d.ax = at.x
      d.ay = at.y
      return
    }
    const step = cell * DRAG_STEP
    let n = Math.trunc((at.x - d.ax) / step)
    while (n !== 0) {
      const dir = n > 0 ? 1 : -1
      // Against a wall, or the pile: the finger's place becomes the new start, so it comes straight back.
      if (!move(s, dir)) {
        d.ax = at.x
        break
      }
      d.ax += dir * step
      n -= dir
    }
    // Down, when the finger is going down more than across: the piece follows it.
    const down = at.y - d.ay
    if (down > cell && Math.abs(at.y - d.y0) > Math.abs(at.x - d.x0) * 0.8) {
      const rows = Math.trunc(down / cell)
      softDropBy(s, rows)
      d.ay += rows * cell
    } else if (down < 0) {
      d.ay = at.y
    }
  }

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.id) return
    dragRef.current = null
    const s = stateRef.current
    if (s.phase !== 'playing' || e.type !== 'pointerup') return
    const at = pointAt(e)
    const now = performance.now()
    const cell = layoutRef.current.cell
    if (!d.moved && now - d.t0 < TAP_MS) {
      if (rotate(s, 1)) haptic('turn')
      return
    }
    // How fast the finger was going as it let go, in cells a second.
    const first = d.trail.find((p) => now - p.t <= 90) ?? d.trail[0]!
    const span = Math.max(16, now - first.t)
    const vy = ((at.y - first.y) / span) * (1000 / cell)
    const vx = ((at.x - first.x) / span) * (1000 / cell)
    const steep = Math.abs(vy) > Math.abs(vx) * 1.4
    if (steep && vy > FLICK_DOWN && at.y - d.y0 > cell * 1.2) {
      if (hardDrop(s)) {
        haptic('hit')
        sync()
      }
    } else if (steep && vy < -FLICK_UP && d.y0 - at.y > cell * 1.5) {
      doHold()
    }
  }

  const playing = ui.phase === 'playing'
  const chargePct = `${Math.round(ui.charge * 100)}%`

  return (
    <section className={`pileup pileup--fullscreen${saveOpen ? ' pileup--saving' : ''}`}>
      <div className="game-play">
        <GameStage aspectWidth={9} aspectHeight={16} fill>
          <div
            ref={playRef}
            className="pileup__play"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onLostPointerCapture={onPointerEnd}
          >
            <canvas ref={canvasRef} className="pileup__viewport" />

            <GamePlayChrome slug="pileup" inRun={() => inRun(stateRef.current.phase)} paused={paused}>
              {pausable || paused ? <PauseButton paused={paused} onToggle={togglePause} /> : null}
            </GamePlayChrome>

            <PlayReadout>
              <PlayReadoutScore hot={inRun(ui.phase) && ui.score > previousBestRef.current}>
                {ui.score.toLocaleString()}
              </PlayReadoutScore>
              <PlayReadoutStats>
                <PlayStat label="Level" value={ui.level} />
                <PlayStat label="Rows" value={ui.rows} />
              </PlayReadoutStats>
            </PlayReadout>

            {playing && !paused ? (
              <>
                <button
                  type="button"
                  className={`pileup__hold${ui.canHold ? '' : ' pileup__hold--used'}`}
                  style={boxStyle(layout.hold)}
                  aria-label="Hold this piece"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    doHold()
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                />
                <button
                  type="button"
                  className={`pileup__shake${ui.shakeReady ? ' pileup__shake--ready' : ''}${layout.side ? ' pileup__shake--side' : ''}`}
                  style={{ ...boxStyle(layout.shake), '--fill': chargePct } as CSSProperties}
                  aria-label={ui.shakeReady ? 'Shake: ready' : `Shake: ${chargePct} charged`}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    doShake()
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <span className="pileup__shake-label">Shake</span>
                  <span className="pileup__shake-meter" aria-hidden="true">
                    <i />
                  </span>
                </button>
              </>
            ) : null}

            <div className="pileup__overlay">
              <GamePauseOverlay
                slug="pileup"
                personalBest={inRun(ui.phase) ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
                onRestart={restart}
                tools={
                  pausable ? (
                    <AdminWaveSkip
                      unit="level"
                      wave={ui.level}
                      onSkipNext={() => {
                        jumpToLevel(stateRef.current, ui.level + 1)
                        sync()
                        resume()
                      }}
                      onJump={(level) => {
                        jumpToLevel(stateRef.current, level)
                        sync()
                        resume()
                      }}
                    />
                  ) : null
                }
              />
              {ui.phase === 'menu' && !saveOpen && !paused && (
                <GameStartCard
                  title="Pileup"
                  slug="pileup"
                  tools={
                    <AdminWaveSkip
                      mode="start"
                      unit="level"
                      onJump={(level) => {
                        restart()
                        jumpToLevel(stateRef.current, level)
                        sync()
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
                    gameSlug="pileup"
                    score={ui.score}
                    onDone={toMenu}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="pileup"
                    score={ui.score}
                    title="Piled to the top"
                    subtitle={`Level ${ui.level} · ${ui.rows.toLocaleString()} ${ui.rows === 1 ? 'row' : 'rows'}${
                      ui.fours > 0 ? ` · ${ui.fours} ${ui.fours === 1 ? 'four' : 'fours'}` : ''
                    }`}
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
