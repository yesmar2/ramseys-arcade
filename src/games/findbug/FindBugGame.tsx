import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  GamePlayChrome,
  PlayReadout,
  PlayReadoutCenter,
  PlayReadoutScore,
} from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { getPersonalBest } from '../../lib/personalBest'
import { clearRunAchievements } from '../../lib/runAchievements'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  aspectFor,
  clearPointer,
  createInitialState,
  fieldRect,
  stageFor,
  hitAt,
  moveReticle,
  ROUNDS,
  runMs,
  setPointer,
  startGame,
  tick,
  toSnapshot,
  applyHint,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'
import { findbugBoardScore, formatFindbugMs } from './score'

const SCENE_LABEL: Record<Snapshot['sceneKind'], string> = {
  arcade: 'Arcade floor',
  cabinets: 'Cabinet row',
  board: 'Leaderboard',
  loom: 'Cable loom',
  tokens: 'Token spill',
  carpet: 'Arcade carpet',
}

const ARROW_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1],
}

export function FindBugGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('findbug')
  // Upright on a phone, on its side on a desktop, so the scene fills the shell
  // either way. Read once and on resize; a run keeps the shape it started in.
  const [portrait, setPortrait] = useState(
    () => typeof window === 'undefined' || window.innerHeight > window.innerWidth,
  )
  const portraitRef = useRef(portrait)
  portraitRef.current = portrait
  const stateRef = useRef<GameState>(createInitialState(portrait))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 540, h: 720 })
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('findbug'))
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

      const canvas = canvasRef.current
      const parent = canvas?.parentElement
      const w = parent?.clientWidth || 0
      const h = parent?.clientHeight || 0
      if (w > 0 && h > 0 && (w !== sizeRef.current.w || h !== sizeRef.current.h)) {
        sizeRef.current = { w, h }
      }

      if (!pausedRef.current) {
        stateRef.current = tick(stateRef.current, dt)
      }

      const snap = toSnapshot(stateRef.current)
      // Open the score card the moment the run ends, not on the UI throttle.
      if (snap.phase === 'gameover') {
        const score = findbugBoardScore(runMs(stateRef.current))
        if (offeredScore.current !== score) {
          offeredScore.current = score
          saveOpenRef.current = true
          setSaveOpen(true)
          setUi(snap)
          startGrace.current = performance.now() + 400
        }
      }

      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        setUi(snap)
      }

      if (canvas && w > 0 && h > 0) {
        // Back the canvas at the display's pixel density — at 1x the scenes go
        // soft, and this game is asking you to spot a speck. Capped at 2 so a
        // 3x phone is not painting nine times the pixels every frame.
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const bw = Math.round(w * dpr)
        const bh = Math.round(h * dpr)
        if (canvas.width !== bw || canvas.height !== bh) {
          canvas.width = bw
          canvas.height = bh
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
    const sync = () => setPortrait(window.innerHeight > window.innerWidth)
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  // On the menu there is no run to protect, so adopt the new shape at once.
  useEffect(() => {
    if (stateRef.current.phase !== 'menu') return
    if (stateRef.current.round.aspect === aspectFor(portrait)) return
    stateRef.current = createInitialState(portrait)
    setUi(toSnapshot(stateRef.current))
  }, [portrait])

  const restart = () => {
    saveOpenRef.current = false
    setSaveOpen(false)
    offeredScore.current = null
    clearRunAchievements()
    stateRef.current = startGame(stateRef.current, portraitRef.current)
    previousBestRef.current = getPersonalBest('findbug')
    startGrace.current = performance.now() + 220
    setUi(toSnapshot(stateRef.current))
  }

  /**
   * Pointer position in the scene's normalized space. The element now fills the
   * shell while the scene is a fixed 3:4 inside it, so this has to go through
   * the same field rect the renderer draws into or every swat lands offset.
   */
  const normalize = (e: ReactPointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const field = fieldRect(rect.width, rect.height, stateRef.current.round.aspect)
    if (field.w <= 0 || field.h <= 0) return null
    return {
      x: (e.clientX - rect.left - field.x) / field.w,
      y: (e.clientY - rect.top - field.y) / field.h,
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (stateRef.current.phase !== 'playing' || pausedRef.current) return
    const p = normalize(e)
    if (p) stateRef.current = setPointer(stateRef.current, p.x, p.y)
  }

  const onPointerLeave = () => {
    stateRef.current = clearPointer(stateRef.current)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    e.preventDefault()

    const s = stateRef.current
    if (s.phase === 'menu') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    if (s.phase !== 'playing') return
    if (performance.now() < startGrace.current) return

    const p = normalize(e)
    if (!p) return
    // Touch gets no hover, so the tap itself has to feed the startle check.
    stateRef.current = hitAt(setPointer(s, p.x, p.y), p.x, p.y)
    setUi(toSnapshot(stateRef.current))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpenRef.current || pausedRef.current) return
      const s = stateRef.current

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        if (s.phase === 'menu') {
          if (performance.now() < startGrace.current) return
          restart()
          return
        }
        if (s.phase !== 'playing') return
        if (!s.keyboardMode) {
          // First Space just brings the reticle up rather than burning a miss.
          stateRef.current = moveReticle(s, 0, 0)
          setUi(toSnapshot(stateRef.current))
          return
        }
        stateRef.current = hitAt(s, s.reticleX, s.reticleY)
        setUi(toSnapshot(stateRef.current))
        return
      }

      if (e.code === 'KeyH') {
        if (s.phase !== 'playing') return
        e.preventDefault()
        stateRef.current = applyHint(s)
        setUi(toSnapshot(stateRef.current))
        return
      }

      const move = ARROW_KEYS[e.code]
      if (!move || s.phase !== 'playing') return
      e.preventDefault()
      stateRef.current = moveReticle(s, move[0], move[1])
      setUi(toSnapshot(stateRef.current))
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const finalScore = ui.phase === 'gameover' ? findbugBoardScore(ui.runMs) : 0

  return (
    <section className="findbug findbug--fullscreen">
      <div className="game-play">
        <GameStage
          aspectWidth={stageFor(portrait).w}
          aspectHeight={stageFor(portrait).h}
          fill
        >
          <div
            className="findbug__play"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
          >
            <canvas ref={canvasRef} className="findbug__viewport" />

            <GamePlayChrome
              slug="findbug"
              inRun={() => stateRef.current.phase === 'playing'}
              paused={paused}
            >
              {pausable || paused ? (
                <PauseButton paused={paused} onToggle={togglePause} />
              ) : null}
            </GamePlayChrome>

            <PlayReadout>
              <PlayReadoutScore className="findbug__clock">
                {formatFindbugMs(ui.runMs)}
              </PlayReadoutScore>
              <PlayReadoutCenter label="Round">
                {ui.phase === 'menu' ? `1/${ROUNDS}` : `${ui.roundNumber}/${ROUNDS}`}
              </PlayReadoutCenter>
            </PlayReadout>

            {ui.phase === 'playing' && !paused && (
              <div className="findbug__status">
                <span className="findbug__scene">{SCENE_LABEL[ui.sceneKind]}</span>
                {ui.misses > 0 && (
                  <span className="findbug__misses">
                    {ui.misses} miss{ui.misses === 1 ? '' : 'es'} · +
                    {formatFindbugMs(ui.penaltyMs)}
                  </span>
                )}
                {ui.hintReady && (
                  <button
                    type="button"
                    className="findbug__hint"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      stateRef.current = applyHint(stateRef.current)
                      setUi(toSnapshot(stateRef.current))
                    }}
                  >
                    Hint (+8s)
                  </button>
                )}
              </div>
            )}

            <div className="findbug__overlay">
              <GamePauseOverlay
                slug="findbug"
                personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
              />
              {ui.phase === 'menu' && !saveOpen && !paused && (
                <GameStartCard
                  title="Find the Bug"
                  tagline="It is sitting perfectly still. Find it anyway."
                  slug="findbug"
                />
              )}
              {ui.phase === 'gameover' &&
                saveOpen &&
                (tournament ? (
                  <TournamentScoreCard
                    tournamentId={tournament.tournamentId}
                    gameSlug="findbug"
                    score={finalScore}
                    onDone={restart}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="findbug"
                    score={finalScore}
                    title="All clear"
                    subtitle={`${ui.misses} wrong swat${ui.misses === 1 ? '' : 's'}`}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={restart}
                  />
                ))}
            </div>
          </div>
        </GameStage>
      </div>
    </section>
  )
}
