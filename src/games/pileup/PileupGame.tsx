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
import { usePlayerName } from '../../hooks/usePlayerName'
import { haptic } from '../../lib/haptics'
import { normalizePlayerName } from '../../lib/leaderboard'
import { getPersonalBest } from '../../lib/personalBest'
import {
  PILEUP_COMBO_ID,
  PILEUP_FOURS_ID,
  PILEUP_ROWS_ID,
  PILEUP_SHAKE_ID,
  shouldCelebrateRecordSubmit,
  submitPileupBook,
} from '../../lib/records'
import { clearRunAchievements, pushRunAchievement } from '../../lib/runAchievements'
import { beginRun } from '../../lib/runSession'
import { useSkinInto } from '../../lib/skins'
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
  slamDown,
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
 * barely moves is a turn. A flick down slams it to the pile without locking it
 * (game.ts slamDown), so it can still be slid in, and a second flick locks it;
 * a flick up holds it.
 *
 * Each touch goes one way at a time. A swipe down is never quite straight, and
 * its drift across used to move the piece a column on the way (Ramsey,
 * 2026-10-08: "a lot of the time it moves over one, which isn't where i wanted
 * it to go"). So until the finger has clearly gone across, nothing moves across;
 * once it's going up, drift across is ignored until it lets go. Going across,
 * then down, still drops it where it was steered. Going down, a clear turn
 * across (a cell, at twice the slope of any drift) steers it again, so a piece
 * swiped down can be tucked in before it locks, as the arrows can (Ramsey,
 * 2026-10-08: "give the mobile experience the opportunity to shift real quick
 * after a swipe down? like you can on desktop").
 */
const DRAG_STEP = 0.85
const TAP_MS = 260
const TAP_SLOP = 0.35
/** Cells a second, over the last moment of a touch, that make a flick. */
const FLICK_DOWN = 16
const FLICK_UP = 12
/** Cells down, and more than across, that turn a touch into a drop; up, a little further, into a hold. */
const GO_DOWN = 0.6
const GO_UP = 1
/** Cells across, and this many times more than down, that make a touch steer across. */
const GO_ACROSS = 0.5
const ACROSS_OVER_DOWN = 1.2
/** Steered across, then this many cells down, and this many times more than across since: it drops from there. */
const TURN_DOWN = 0.8
const TURN_STEEP = 1.5
/** Going down, then this many cells across, and this many times more than down since its last row: it steers across again. */
const TURN_ACROSS = 1
const TURN_FLAT = 2

type Drag = {
  id: number
  x0: number
  y0: number
  /** Where the finger was the last time the piece moved a column, or a row. */
  ax: number
  ay: number
  /** Which way the touch is going: not yet clear, across (columns), down (rows), or up (to hold). */
  way: 'none' | 'across' | 'down' | 'up'
  /**
   * Where the finger was when the touch last moved the piece across (or down a row), or took its way: where a
   * turn down (or across) is measured from.
   */
  sx: number
  sy: number
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
  const playerName = normalizePlayerName(usePlayerName())
  /** The run whose books have gone, so a re-render never posts them twice. */
  const booksKey = useRef('')
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
  // The player's own skin, if they chose one (lib/skins.ts): looks only.
  const skinRef = useRef<string | null>(null)
  useSkinInto('pileup', skinRef)
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
          renderGame(ctx, stateRef.current, w, h, layoutRef.current, skinRef.current)
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

  /*
   * Its books are run totals, so they post once the run is over, one after
   * another; any that places goes on the run's card. Not from an event's run,
   * which is the event's alone.
   */
  useEffect(() => {
    if (tournament || !playerName || ui.phase !== 'gameover') return
    const key = `${playerName}:${ui.serial}:${ui.score}:${ui.rows}`
    if (booksKey.current === key) return
    booksKey.current = key
    const books: [string, number, string][] = [
      [PILEUP_FOURS_ID, ui.fours, 'Fours in a run'],
      [PILEUP_ROWS_ID, ui.rows, 'Rows cleared in a run'],
      [PILEUP_COMBO_ID, ui.bestCombo, 'Highest combo'],
      [PILEUP_SHAKE_ID, ui.bestShake, 'Biggest Shake'],
    ]
    void (async () => {
      for (const [id, value, label] of books) {
        const result = await submitPileupBook(id, value, playerName)
        if (shouldCelebrateRecordSubmit(result)) {
          pushRunAchievement({
            id: `pileup:${id}`,
            label,
            value: id === PILEUP_COMBO_ID ? `×${value}` : String(value),
            rank: result.rank,
          })
        }
      }
    })()
  }, [ui.phase, ui.serial, ui.score, ui.rows, ui.fours, ui.bestCombo, ui.bestShake, playerName, tournament])

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
      way: 'none',
      sx: at.x,
      sy: at.y,
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
      // A new piece under the same finger: it starts from here, and the touch's way is open again.
      d.serial = s.serial
      d.ax = d.sx = at.x
      d.ay = d.sy = at.y
      d.way = 'none'
      return
    }
    // Which way the touch is going, from where it last went across or took its way.
    const dx = at.x - d.sx
    const dy = at.y - d.sy
    if (d.way === 'none') {
      if (dy > cell * GO_DOWN && dy > Math.abs(dx)) {
        d.way = 'down'
        d.ay = d.sy
      } else if (-dy > cell * GO_UP && -dy > Math.abs(dx)) {
        d.way = 'up'
      } else if (Math.abs(dx) > cell * GO_ACROSS && Math.abs(dx) > Math.abs(dy) * ACROSS_OVER_DOWN) {
        d.way = 'across'
      }
    } else if (d.way === 'across' && dy > cell * TURN_DOWN && dy > Math.abs(dx) * TURN_STEEP) {
      // Steered across, now going down: it drops from the column it's in, and drift across no longer moves it.
      d.way = 'down'
      d.ay = d.sy
    } else if (d.way === 'down' && Math.abs(dx) > cell * TURN_ACROSS && Math.abs(dx) > Math.max(0, dy) * TURN_FLAT) {
      // Going down, then a clear turn across: it steers again, to tuck the piece in before it locks. A swipe
      // down's drift never gets here: it goes down a row, and starts over, before it's gone a cell across.
      d.way = 'across'
      d.ax = d.sx
    }
    if (d.way === 'across') {
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
        d.sx = at.x
        d.sy = at.y
      }
      // Down is measured from the last column it moved, or from the highest the finger has been since.
      if (at.y < d.sy) d.sy = at.y
    }
    // Going down: the piece follows the finger down.
    if (d.way === 'down') {
      const down = at.y - d.ay
      if (down > cell) {
        const rows = Math.trunc(down / cell)
        softDropBy(s, rows)
        d.ay += rows * cell
        // Still going down (landed or not): a turn across is measured from here.
        d.sx = at.x
        d.sy = at.y
      } else if (down < 0) {
        d.ay = at.y
      }
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
      // Down to the pile, not locked: a drag across or a tap still tucks it in its half second; another flick locks it.
      if (slamDown(s)) {
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
