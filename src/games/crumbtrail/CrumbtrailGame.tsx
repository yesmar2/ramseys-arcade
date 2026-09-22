import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import '../../styles/crumbtrail.css'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { usePlayerName } from '../../hooks/usePlayerName'
import { normalizePlayerName } from '../../lib/leaderboard'
import { haptic } from '../../lib/haptics'
import { getPersonalBest } from '../../lib/personalBest'
import {
  clearRunAchievements,
  isRunAssisted,
  pushRunAchievement,
} from '../../lib/runAchievements'
import {
  shouldCelebrateRecordSubmit,
  submitCrumbtrailCrumbStreak,
  submitCrumbtrailGhosts,
  submitCrumbtrailRows,
} from '../../lib/records'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  crumbtrailViewport,
  crumbtrailViewportFor,
  jumpToDepth,
  queueDir,
  startGame,
  streakMult,
  surgeReady,
  tick,
  toSnapshot,
  triggerSurge,
  type Dir,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'
import { beginRun } from '../../lib/runSession'

/** Pixels of drag before a swipe counts as a turn. */
const SWIPE = 18

export function CrumbtrailGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('crumbtrail')
  const playerName = normalizePlayerName(usePlayerName())
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('crumbtrail'))
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const draggedRef = useRef(false)
  const startGrace = useRef(0)
  const booksKey = useRef<string | null>(null)
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

  /*
   * Both books are run totals, so they post once the run is over. Distance and
   * the crumb streak go together deliberately — they are the two halves of the
   * same decision, and a board for each says so.
   */
  useEffect(() => {
    if (tournament || !playerName) return
    if (ui.phase !== 'gameover') return
    const key = `${playerName}:${ui.depth}:${ui.crumbStreakBest}:${ui.ghostsEaten}`
    if (booksKey.current === key) return
    booksKey.current = key
    if (isRunAssisted()) return
    void (async () => {
      const rows = await submitCrumbtrailRows(ui.depth, playerName)
      if (shouldCelebrateRecordSubmit(rows)) {
        pushRunAchievement({
          id: 'crumbtrail:most-rows',
          label: 'Rows climbed',
          value: String(ui.depth),
          rank: rows.rank,
        })
      }
      const streak = await submitCrumbtrailCrumbStreak(ui.crumbStreakBest, playerName)
      if (shouldCelebrateRecordSubmit(streak)) {
        pushRunAchievement({
          id: 'crumbtrail:crumb-streak',
          label: 'Crumbs in a row',
          value: String(ui.crumbStreakBest),
          rank: streak.rank,
        })
      }
      const eaten = await submitCrumbtrailGhosts(ui.ghostsEaten, playerName)
      if (shouldCelebrateRecordSubmit(eaten)) {
        pushRunAchievement({
          id: 'crumbtrail:chasers-eaten',
          label: 'Chasers eaten in a run',
          value: String(ui.ghostsEaten),
          rank: eaten.rank,
        })
      }
    })()
  }, [ui.phase, ui.depth, ui.crumbStreakBest, ui.ghostsEaten, playerName, tournament])

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

  const restart = (intoMenu = false) => {
    setSaveOpen(false)
    offeredScore.current = null
    clearRunAchievements()
    if (!intoMenu) beginRun('crumbtrail')
    booksKey.current = null
    stateRef.current = startGame(stateRef.current, fieldViewport())
    previousBestRef.current = getPersonalBest('crumbtrail')
    startGrace.current = performance.now() + 220
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

  /**
   * Buzz for a direction that asks for something new.
   *
   * Not for one already being travelled or already queued. A maze is steered by
   * tapping constantly, and a held arrow key repeats, so buzzing on every call
   * would leave the phone rattling the whole way up rather than marking the
   * moments the player actually decided something.
   */
  const steerFeedback = (before: GameState, dir: Dir) => {
    if (before.player.dir === dir || before.player.pending === dir) return
    haptic('turn')
  }

  const steer = (dir: Dir) => {
    if (saveOpen || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu') {
      restart()
      const from = stateRef.current
      steerFeedback(from, dir)
      stateRef.current = queueDir(from, dir)
      setUi(toSnapshot(stateRef.current))
      return
    }
    if (s.phase !== 'playing') return
    steerFeedback(s, dir)
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

            {/* A band behind the readout, because the maze runs right up to it. */}
            <div
              className={`crumbtrail__headerband${ui.tide > 0.35 ? ' crumbtrail__headerband--warn' : ''}`}
              aria-hidden="true"
            />

            {/*
              * The same readout Snake and Crosswalk use, so a glance finds the
              * score and the figures where it finds them everywhere else. One
              * life, so there is no life counter to make room for.
              */}
            <PlayReadout>
              <PlayReadoutScore
                hot={ui.phase === 'playing' && ui.score > previousBestRef.current}
              >
                {ui.score.toLocaleString()}
              </PlayReadoutScore>
              {inRun ? (
                <PlayReadoutStats>
                  <PlayStat label="Rows" value={ui.depth} />
                  {ui.tide > 0.35 ? (
                    <PlayStat label="Tide" value="Climb!" urgent />
                  ) : ui.crumbStreak >= 2 ? (
                    <PlayStat
                      label="In a row"
                      value={
                        <>
                          {ui.crumbStreak}
                          {streakMult(ui.crumbStreak) >= 2 ? (
                            <span className="crumbtrail__mult">×{streakMult(ui.crumbStreak)}</span>
                          ) : null}
                        </>
                      }
                    />
                  ) : null}
                </PlayReadoutStats>
              ) : null}
            </PlayReadout>

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
                  slug="crumbtrail"
                  tools={
                    <AdminWaveSkip
                      mode="start"
                      unit="row"
                      onJump={(row) => {
                        restart()
                        stateRef.current = jumpToDepth(stateRef.current, row)
                        setUi(toSnapshot(stateRef.current))
                      }}
                    />
                  }
                />
              )}
              {ui.phase === 'gameover' && saveOpen && (
                tournament ? (
                  <TournamentScoreCard
                    tournamentId={tournament.tournamentId}
                    gameSlug="crumbtrail"
                    score={ui.score}
                    onDone={toMenu}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="crumbtrail"
                    score={ui.score}
                    title={ui.cause === 'drowned' ? 'Swallowed' : 'Caught'}
                    subtitle={`${ui.depth} rows · ${ui.score.toLocaleString()} points`}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={toMenu}
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
