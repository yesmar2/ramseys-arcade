import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import { GamePlayChrome } from '../../components/GameHud'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { clearRunAchievements } from '../../lib/runAchievements'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  crumbtrailViewport,
  crumbtrailViewportFor,
  jumpToDepth,
  queueDir,
  startGame,
  surgeReady,
  tick,
  toSnapshot,
  triggerSurge,
  type Dir,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

/** Pixels of drag before a swipe counts as a turn. */
const SWIPE = 18

export function CrumbtrailGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('crumbtrail')
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('crumbtrail'))
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const draggedRef = useRef(false)
  const startGrace = useRef(0)
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

      const canvas = canvasRef.current
      if (canvas) {
        const parent = canvas.parentElement
        const w = parent?.clientWidth || 0
        const h = parent?.clientHeight || 0
        if (w > 0 && h > 0) {
          const ctx = canvas.getContext('2d')
          if (ctx) renderGame(ctx, stateRef.current, w, h)
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

  // The grid is sized from the viewport, so rebuild it between runs on resize.
  useEffect(() => {
    const sync = () => {
      const s = stateRef.current
      if (s.phase !== 'menu') return
      const dims = fieldViewport()
      if (s.cols === dims.cols && s.rows === dims.rows) return
      stateRef.current = createInitialState(dims)
      setUi(toSnapshot(stateRef.current))
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  /** The playfield sits under the header, so the grid is sized from it. */
  const fieldViewport = () => {
    const field = canvasRef.current?.parentElement
    const w = field?.clientWidth ?? 0
    const h = field?.clientHeight ?? 0
    if (w > 0 && h > 0) return crumbtrailViewportFor(w, h)
    return crumbtrailViewport()
  }

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    clearRunAchievements()
    stateRef.current = startGame(stateRef.current, fieldViewport())
    previousBestRef.current = getPersonalBest('crumbtrail')
    startGrace.current = performance.now() + 220
    setUi(toSnapshot(stateRef.current))
  }

  const steer = (dir: Dir) => {
    if (saveOpen || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu') {
      restart()
      stateRef.current = queueDir(stateRef.current, dir)
      setUi(toSnapshot(stateRef.current))
      return
    }
    if (s.phase !== 'playing') return
    stateRef.current = queueDir(s, dir)
  }

  const fireSurge = () => {
    if (saveOpen || pausedRef.current) return
    if (!surgeReady(stateRef.current)) return
    stateRef.current = triggerSurge(stateRef.current)
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpen || pausedRef.current) return
      const map: Record<string, Dir> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        KeyW: 'up',
        KeyS: 'down',
        KeyA: 'left',
        KeyD: 'right',
      }
      const dir = map[e.code]
      if (dir) {
        e.preventDefault()
        steer(dir)
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        const s = stateRef.current
        if (s.phase === 'menu' || s.phase === 'gameover') {
          restart()
          return
        }
        fireSurge()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  const dirFromDelta = (dx: number, dy: number): Dir | null => {
    if (Math.hypot(dx, dy) < SWIPE) return null
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
    return dy > 0 ? 'down' : 'up'
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (saveOpen || pausedRef.current) return
    e.preventDefault()
    swipeRef.current = { x: e.clientX, y: e.clientY }
    draggedRef.current = false
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (stateRef.current.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const start = swipeRef.current
    if (!start || saveOpen || pausedRef.current) return
    const dir = dirFromDelta(e.clientX - start.x, e.clientY - start.y)
    if (!dir) return
    steer(dir)
    draggedRef.current = true
    swipeRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || saveOpen || pausedRef.current) return
    const dir = dirFromDelta(e.clientX - start.x, e.clientY - start.y)
    if (dir) {
      steer(dir)
      return
    }
    if (!draggedRef.current) fireSurge()
  }

  const surgeFull = ui.surge >= 1
  const surging = ui.surgeTime > 0
  const inRun = ui.phase === 'playing' || ui.phase === 'dying'

  return (
    <section
      className={`crumbtrail crumbtrail--fullscreen${saveOpen ? ' crumbtrail--saving' : ''}`}
    >
      <div className="crumbtrail__body">
        <div
          className="crumbtrail__play"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipeRef.current = null
          }}
        >
          <div className="crumbtrail__stage">
            <div className="crumbtrail__field">
              <canvas ref={canvasRef} className="crumbtrail__viewport" />
            </div>

            <header
              className={`crumbtrail__header${ui.tide > 0.35 ? ' crumbtrail__header--warn' : ''}`}
            >
              <div
                className="crumbtrail__lives"
                aria-label={`${ui.lives} ${ui.lives === 1 ? 'life' : 'lives'}`}
              >
                {Array.from({ length: inRun ? ui.lives : 0 }, (_, i) => (
                  <svg
                    key={i}
                    className="crumbtrail__pac"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path d="M8 8 L14.14 11.36 A7 7 0 1 1 14.14 4.64 Z" fill="currentColor" />
                  </svg>
                ))}
              </div>

              <p
                className={`crumbtrail__score${
                  ui.phase === 'playing' && ui.score > previousBestRef.current
                    ? ' crumbtrail__score--hot'
                    : ''
                }`}
              >
                {ui.score.toLocaleString()}
              </p>

              {/*
                * One secondary stat at a time. Lives, score, distance and
                * streak all at once do not fit a phone header beside the two
                * button clusters — the score ends up ellipsised, and the score
                * is the one number that can never be cut. So the slot shows
                * whatever matters most right now: the tide if it is coming,
                * the streak while you are on one, distance otherwise. Your
                * distance is barely moving while you work a streak anyway.
                */}
              <div className="crumbtrail__stats">
                {!inRun ? null : ui.tide > 0.35 ? (
                  <p className="crumbtrail__stat crumbtrail__stat--warn">
                    <span className="crumbtrail__stat-value">Climb!</span>
                  </p>
                ) : ui.crumbStreak >= 2 ? (
                  <p
                    className="crumbtrail__stat crumbtrail__stat--streak"
                    aria-label="Crumbs in a row"
                  >
                    <span className="crumbtrail__stat-value">{ui.crumbStreak}</span>
                    <span className="crumbtrail__stat-label">in a row</span>
                  </p>
                ) : (
                  <p className="crumbtrail__stat" aria-label="Rows climbed">
                    <span className="crumbtrail__stat-value">{ui.depth}</span>
                    <span className="crumbtrail__stat-label">rows</span>
                  </p>
                )}
              </div>
            </header>

            <GamePlayChrome
              slug="crumbtrail"
              inRun={() => {
                const p = stateRef.current.phase
                return p === 'playing' || p === 'dying'
              }}
              paused={paused}
            >
              {pausable || paused ? (
                <PauseButton paused={paused} onToggle={togglePause} />
              ) : null}
            </GamePlayChrome>


            {inRun && !paused && !saveOpen ? (
              <button
                type="button"
                className={`crumbtrail__surge${surgeFull ? ' crumbtrail__surge--ready' : ''}${surging ? ' crumbtrail__surge--live' : ''}`}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  fireSurge()
                }}
                disabled={!surgeFull && !surging}
                aria-label={surging ? 'Surge active' : 'Fire surge'}
              >
                <span
                  className="crumbtrail__surge-fill"
                  style={{ width: `${Math.round((surging ? 1 : ui.surge) * 100)}%` }}
                />
                <span className="crumbtrail__surge-label">
                  {surging ? 'Surging' : surgeFull ? 'Surge ready' : 'Surge'}
                </span>
              </button>
            ) : null}

            <div className="crumbtrail__overlay">
              <GamePauseOverlay
                slug="crumbtrail"
                personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
                tools={
                  ui.phase === 'playing' ? (
                    <AdminWaveSkip
                      unit="row"
                      wave={ui.depth}
                      onSkipNext={() => {
                        stateRef.current = jumpToDepth(
                          stateRef.current,
                          stateRef.current.depth + 25,
                        )
                        setUi(toSnapshot(stateRef.current))
                        resume()
                      }}
                      onJump={(row) => {
                        stateRef.current = jumpToDepth(stateRef.current, row)
                        setUi(toSnapshot(stateRef.current))
                        resume()
                      }}
                    />
                  ) : null
                }
              />
              {ui.phase === 'menu' && !saveOpen && !paused && (
                <GameStartCard
                  title="Crumbtrail"
                  tagline="The maze never ends and the floor is eating it. Keep climbing."
                  slug="crumbtrail"
                />
              )}
              {ui.phase === 'gameover' && saveOpen && (
                tournament ? (
                  <TournamentScoreCard
                    tournamentId={tournament.tournamentId}
                    gameSlug="crumbtrail"
                    score={ui.score}
                    onDone={restart}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="crumbtrail"
                    score={ui.score}
                    title={ui.cause === 'drowned' ? 'Swallowed' : 'Caught'}
                    subtitle={`${ui.depth} rows · ${ui.score.toLocaleString()} points`}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={restart}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
