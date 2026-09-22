import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import {
  GamePlayChrome,
  PlayReadout,
  PlayReadoutScore,
} from '../../components/GameHud'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { usePlayerName } from '../../hooks/usePlayerName'
import { haptic } from '../../lib/haptics'
import { getPersonalBest } from '../../lib/personalBest'
import { normalizePlayerName } from '../../lib/leaderboard'
import {
  clearRunAchievements,
  pushRunAchievement,
} from '../../lib/runAchievements'
import {
  formatRecordMs,
  CROSSWALK_ROW_MILESTONE_MAX,
  CROSSWALK_ROW_MILESTONE_MIN,
  CROSSWALK_ROW_MILESTONE_STEP,
  submitCrosswalkFastestRow,
  submitCrosswalkMostCoins,
  submitCrosswalkLongestChain,
  CROSSWALK_LONGEST_CHAIN_MIN,
  shouldCelebrateRecordSubmit,
} from '../../lib/records'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  MOMENTUM_SHOW,
  createInitialState,
  hop,
  jumpToRow,
  pickCols,
  startGame,
  tick,
  toSnapshot,
  type DeathCause,
  type Dir,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'
import { beginRun } from '../../lib/runSession'

const DEATH_COPY: Record<DeathCause, string> = {
  car: 'Flattened by traffic',
  train: 'The train got you',
  water: 'Fell in the water',
  edge: 'Swept off the edge',
  stall: 'Ran out of time',
}

export function CrosswalkGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('crosswalk')
  const playerName = normalizePlayerName(usePlayerName())
  const stageRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GameState | null>(null)
  if (!stateRef.current) {
    stateRef.current = createInitialState()
  }
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current!))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('crosswalk'))
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const hoppedThisSwipe = useRef(false)
  const startGrace = useRef(0)
  const runStartRef = useRef<number | null>(null)
  const milestonesRef = useRef<Set<number>>(new Set())
  const coinsRecordedRef = useRef(false)
  const chainRecordedRef = useRef(false)
  const pausable = ui.phase === 'playing' && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  useLayoutEffect(() => {
    // Column count is baked into lane wrap maths, so only re-fit between runs.
    const fit = () => {
      const stage = stageRef.current
      const w = stage?.clientWidth ?? window.innerWidth
      const h = stage?.clientHeight ?? window.innerHeight
      if (w <= 0 || h <= 0) return
      const cols = pickCols(w, h)
      const state = stateRef.current
      if (state && state.cols !== cols && state.phase === 'menu') {
        stateRef.current = createInitialState(cols)
        setUi(toSnapshot(stateRef.current))
      }
    }
    fit()
    window.addEventListener('resize', fit)
    window.addEventListener('orientationchange', fit)
    return () => {
      window.removeEventListener('resize', fit)
      window.removeEventListener('orientationchange', fit)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      if (!pausedRef.current) {
        stateRef.current = tick(stateRef.current!, dt)
      }
      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        const snap = toSnapshot(stateRef.current!)
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
          const dpr = Math.min(2, window.devicePixelRatio || 1)
          canvas.width = Math.floor(w * dpr)
          canvas.height = Math.floor(h * dpr)
          canvas.style.width = `${w}px`
          canvas.style.height = `${h}px`
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            renderGame(ctx, stateRef.current!, w, h)
          }
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
    if (ui.phase !== 'playing' || tournament || !playerName) return
    if (runStartRef.current == null) return
    const elapsedMs = performance.now() - runStartRef.current
    if (!(elapsedMs > 0)) return

    for (
      let milestone = CROSSWALK_ROW_MILESTONE_MIN;
      milestone <= CROSSWALK_ROW_MILESTONE_MAX;
      milestone += CROSSWALK_ROW_MILESTONE_STEP
    ) {
      if (ui.score < milestone || milestonesRef.current.has(milestone)) continue
      milestonesRef.current.add(milestone)
      void (async () => {
        const result = await submitCrosswalkFastestRow(milestone, elapsedMs, playerName)
        if (shouldCelebrateRecordSubmit(result)) {
          pushRunAchievement({
            id: `crosswalk:fastest-row-${milestone}`,
            label: `Fastest to ${milestone}`,
            value: formatRecordMs(Math.max(1, Math.round(elapsedMs))),
            rank: result.rank,
          })
        }
      })()
    }
  }, [ui.phase, ui.score, playerName, tournament])

  useEffect(() => {
    if (tournament || !playerName) return
    if (ui.phase !== 'dying' && ui.phase !== 'gameover') return
    if (coinsRecordedRef.current || ui.runCoins < 1) return
    coinsRecordedRef.current = true
    const coins = ui.runCoins
    void (async () => {
      const result = await submitCrosswalkMostCoins(coins, playerName)
      if (shouldCelebrateRecordSubmit(result)) {
        pushRunAchievement({
          id: 'crosswalk:most-coins',
          label: 'Most coins in a run',
          value: String(coins),
          rank: result.rank,
        })
      }
    })()
  }, [ui.phase, ui.runCoins, playerName, tournament])

  useEffect(() => {
    if (tournament || !playerName) return
    if (ui.phase !== 'dying' && ui.phase !== 'gameover') return
    if (chainRecordedRef.current || ui.bestChain < CROSSWALK_LONGEST_CHAIN_MIN) return
    chainRecordedRef.current = true
    const chain = ui.bestChain
    void (async () => {
      const result = await submitCrosswalkLongestChain(chain, playerName)
      if (shouldCelebrateRecordSubmit(result)) {
        pushRunAchievement({
          id: 'crosswalk:longest-chain',
          label: 'Longest chain',
          value: String(chain),
          rank: result.rank,
        })
      }
    })()
  }, [ui.phase, ui.bestChain, playerName, tournament])


  const restart = (intoMenu = false) => {
    setSaveOpen(false)
    offeredScore.current = null
    clearRunAchievements()
    if (!intoMenu) beginRun('crosswalk')
    stateRef.current = startGame(stateRef.current!)
    previousBestRef.current = getPersonalBest('crosswalk')
    startGrace.current = performance.now() + 220
    runStartRef.current = performance.now()
    milestonesRef.current = new Set()
    coinsRecordedRef.current = false
    chainRecordedRef.current = false
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
   * Buzz for a hop that actually happened.
   *
   * Not for a blocked one — that bumps against a tree, and telling the hand it
   * moved when it did not is worse than saying nothing. Not for one that took a
   * coin either: `collectCoin` buzzes for itself, and since `vibrate` replaces
   * whatever is running, a tick fired afterwards would just erase it.
   */
  const hopFeedback = (before: GameState, after: GameState) => {
    const moved = after.row !== before.row || after.col !== before.col
    const tookCoin = after.runCoins !== before.runCoins
    if (moved && !tookCoin) haptic('turn')
  }

  const tryHop = (dir: Dir) => {
    if (saveOpen || pausedRef.current) return
    const s = stateRef.current!
    if (s.phase === 'menu') {
      restart()
      const from = stateRef.current!
      const next = hop(from, dir)
      hopFeedback(from, next)
      stateRef.current = next
      setUi(toSnapshot(next))
      return
    }
    if (s.phase !== 'playing') return
    const next = hop(s, dir)
    hopFeedback(s, next)
    stateRef.current = next
    setUi(toSnapshot(next))
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
        tryHop(dir)
        return
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        const s = stateRef.current!
        if (s.phase === 'menu' || s.phase === 'gameover') restart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saveOpen])

  const SWIPE = 28

  const dirFromDelta = (dx: number, dy: number): Dir | null => {
    if (Math.hypot(dx, dy) < SWIPE) return null
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
    return dy > 0 ? 'down' : 'up'
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (saveOpen || pausedRef.current) return
    e.preventDefault()
    swipeRef.current = { x: e.clientX, y: e.clientY }
    hoppedThisSwipe.current = false
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (stateRef.current?.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const start = swipeRef.current
    if (!start || hoppedThisSwipe.current || saveOpen || pausedRef.current) return
    const dir = dirFromDelta(e.clientX - start.x, e.clientY - start.y)
    if (!dir) return
    tryHop(dir)
    hoppedThisSwipe.current = true
    swipeRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start || hoppedThisSwipe.current || saveOpen || pausedRef.current) return
    const dir = dirFromDelta(e.clientX - start.x, e.clientY - start.y)
    tryHop(dir ?? 'up')
  }

  return (
    <section className={`crosswalk crosswalk--fullscreen${saveOpen ? ' crosswalk--saving' : ''}`}>
      <div className="crosswalk__body">
        <div
          className="crosswalk__play"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipeRef.current = null
          }}
        >
          <div className="crosswalk__stage" ref={stageRef}>
            <canvas ref={canvasRef} className="crosswalk__viewport" />

            <GamePlayChrome
              slug="crosswalk"
              inRun={() => stateRef.current?.phase === 'playing'}
              paused={paused}
            >
              {(pausable || paused) ? (
                <PauseButton paused={paused} onToggle={togglePause} />
              ) : null}
            </GamePlayChrome>

            <PlayReadout>
              <PlayReadoutScore
                hot={ui.phase === 'playing' && ui.score > previousBestRef.current}
              >
                {ui.score}
              </PlayReadoutScore>
              {ui.phase === 'playing' ? (
                <PlayReadoutStats>
                  {ui.target > 0 ? (
                    /* Lit once you are past it — the old line said NEW BEST
                       here, and the marker on the road says it louder. */
                    <PlayStat label="Best" value={ui.target} urgent={ui.beatBest} />
                  ) : null}
                  <PlayStat label="Coins" value={ui.runCoins} />
                  {/* Only once it means something — a chain of one or two is
                      just walking, and a readout that never rests is noise. */}
                  {ui.chain >= MOMENTUM_SHOW ? (
                    <PlayStat label="Chain" value={ui.chain} urgent />
                  ) : null}
                </PlayReadoutStats>
              ) : null}
            </PlayReadout>

            <div className="crosswalk__overlay">
              <GamePauseOverlay
                slug="crosswalk"
                personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
                tools={
                  ui.phase === 'playing' ? (
                    <AdminWaveSkip
                      unit="row"
                      wave={Math.max(1, ui.score)}
                      onSkipNext={() => {
                        const state = stateRef.current
                        if (!state) return
                        const current = Math.max(state.row, state.furthest)
                        stateRef.current = jumpToRow(state, current + 25)
                        setUi(toSnapshot(stateRef.current))
                        resume()
                      }}
                      onJump={(row) => {
                        const state = stateRef.current
                        if (!state) return
                        stateRef.current = jumpToRow(state, row)
                        setUi(toSnapshot(stateRef.current))
                        resume()
                      }}
                    />
                  ) : null
                }
              />
              {ui.phase === 'menu' && !saveOpen && !paused && (
                <GameStartCard
                  title="Crosswalk"
                  slug="crosswalk"
                  tools={
                    <AdminWaveSkip
                      mode="start"
                      unit="row"
                      onJump={(row) => {
                        restart()
                        stateRef.current = jumpToRow(stateRef.current!, row)
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
                    gameSlug="crosswalk"
                    score={ui.score}
                    onDone={toMenu}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="crosswalk"
                    score={ui.score}
                    title="Run over"
                    subtitle={
                      ui.cause
                        ? `${DEATH_COPY[ui.cause]} · ${ui.score} ${ui.score === 1 ? 'row' : 'rows'}${
                            ui.runCoins > 0 ? ` · +${ui.runCoins} coins` : ''
                          }`
                        : `${ui.score} ${ui.score === 1 ? 'row' : 'rows'} forward`
                    }
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
