import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GameHud, GameHudStat } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PauseButton, PauseOverlay } from '../../components/PauseControls'
import { PersonalBestHint } from '../../components/PersonalBestHint'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { useDeviceType } from '../../lib/device'
import { getPersonalBest } from '../../lib/personalBest'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  asteroidsLayout,
  beginNextWave,
  createInitialState,
  formatWaveTime,
  resizeState,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

type HoldKey = 'turnLeft' | 'turnRight' | 'thrust' | 'reverse'

const KEY_MAP: Record<string, HoldKey> = {
  ArrowLeft: 'turnLeft',
  KeyA: 'turnLeft',
  KeyQ: 'turnLeft',
  KeyZ: 'turnLeft',
  ArrowRight: 'turnRight',
  KeyD: 'turnRight',
  KeyE: 'turnRight',
  ArrowUp: 'thrust',
  KeyW: 'thrust',
  ArrowDown: 'reverse',
  KeyS: 'reverse',
}

function emptyPressed(): Record<HoldKey, Set<string>> {
  return {
    turnLeft: new Set(),
    turnRight: new Set(),
    thrust: new Set(),
    reverse: new Set(),
  }
}

function currentLayout() {
  return asteroidsLayout(typeof window !== 'undefined' && window.innerHeight > window.innerWidth)
}

export function AsteroidsGame() {
  const tournament = useTournamentPlay()
  const device = useDeviceType()
  const apiBest = usePersonalBest('asteroids')
  const layout0 = currentLayout()
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 960, h: 540 })
  const [aspect, setAspect] = useState({ w: layout0.aspectW, h: layout0.aspectH })
  const pressedRef = useRef(emptyPressed())
  /** Last pressed turn wins — left+right never cancel each other out. */
  const turnDirRef = useRef<-1 | 0 | 1>(0)
  const saveOpenRef = useRef(false)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('asteroids'))
  const startGrace = useRef(0)
  const ignorePauseKeys = useRef(false)
  ignorePauseKeys.current = saveOpen
  const pausable = ui.phase === 'playing' && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable, ignorePauseKeys)
  const pausedRef = useRef(false)
  pausedRef.current = paused
  saveOpenRef.current = saveOpen

  const syncControls = () => {
    const p = pressedRef.current
    const s = stateRef.current
    const turnLeft = turnDirRef.current === -1
    const turnRight = turnDirRef.current === 1
    const thrust = p.thrust.size > 0
    const reverse = p.reverse.size > 0
    if (
      s.turnLeft === turnLeft &&
      s.turnRight === turnRight &&
      s.turn === 0 &&
      s.thrust === thrust &&
      s.reverse === reverse &&
      s.fireHeld === false
    ) {
      return
    }
    stateRef.current = {
      ...s,
      turnLeft,
      turnRight,
      turn: 0,
      thrust,
      reverse,
      fireHeld: false,
    }
  }

  const recomputeTurnDir = () => {
    const left = pressedRef.current.turnLeft.size > 0
    const right = pressedRef.current.turnRight.size > 0
    if (left && !right) turnDirRef.current = -1
    else if (right && !left) turnDirRef.current = 1
    else if (!left && !right) turnDirRef.current = 0
  }

  const clearPressed = () => {
    pressedRef.current = emptyPressed()
    turnDirRef.current = 0
    syncControls()
  }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now

      const canvas = canvasRef.current
      const w = canvas?.parentElement?.clientWidth || canvas?.clientWidth || 0
      const h = canvas?.parentElement?.clientHeight || canvas?.clientHeight || 0
      if (w > 0 && h > 0 && (w !== sizeRef.current.w || h !== sizeRef.current.h)) {
        sizeRef.current = { w, h }
        stateRef.current = resizeState(stateRef.current, w, h)
      }

      syncControls()
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
          clearPressed()
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

  useEffect(() => {
    const sync = () => {
      if (stateRef.current.phase !== 'menu') return
      const next = currentLayout()
      setAspect((cur) =>
        cur.w === next.aspectW && cur.h === next.aspectH ? cur : { w: next.aspectW, h: next.aspectH },
      )
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])

  const restart = () => {
    setSaveOpen(false)
    offeredScore.current = null
    clearPressed()
    const next = currentLayout()
    setAspect({ w: next.aspectW, h: next.aspectH })
    const { w, h } = sizeRef.current
    stateRef.current = startGame(resizeState(createInitialState(w, h), w, h))
    previousBestRef.current = getPersonalBest('asteroids')
    startGrace.current = performance.now() + 180
    setUi(toSnapshot(stateRef.current))
  }

  const press = (key: HoldKey, id: string) => {
    if (saveOpenRef.current || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu') {
      restart()
    } else if (s.phase !== 'playing') {
      return
    }
    pressedRef.current[key].add(id)
    if (key === 'turnLeft') turnDirRef.current = -1
    if (key === 'turnRight') turnDirRef.current = 1
    syncControls()
  }

  const release = (key: HoldKey, id: string) => {
    pressedRef.current[key].delete(id)
    if (key === 'turnLeft' || key === 'turnRight') recomputeTurnDir()
    syncControls()
  }

  const holdPad = (key: HoldKey) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      press(key, `pad:${e.pointerId}`)
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      release(key, `pad:${e.pointerId}`)
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
      release(key, `pad:${e.pointerId}`)
    },
    onLostPointerCapture: (e: ReactPointerEvent<HTMLButtonElement>) => {
      release(key, `pad:${e.pointerId}`)
    },
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault()
    },
  })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Prefer e.code; also accept e.key for ArrowLeft (some layouts/hosts)
      const fromCode = KEY_MAP[e.code]
      const fromKey =
        e.key === 'ArrowLeft'
          ? 'turnLeft'
          : e.key === 'ArrowRight'
            ? 'turnRight'
            : e.key === 'ArrowUp'
              ? 'thrust'
              : e.key === 'ArrowDown'
                ? 'reverse'
                : null
      const key = fromCode ?? fromKey
      if (!key) {
        if (e.code === 'Enter' || e.key === 'Enter' || e.code === 'Space' || e.key === ' ') {
          e.preventDefault()
          const s = stateRef.current
          if (s.phase === 'waveClear') continueWave()
          else if (s.phase === 'menu' || s.phase === 'gameover') restart()
        }
        return
      }
      e.preventDefault()
      if (e.repeat) return
      press(key, `key:${e.code || e.key}`)
    }
    const up = (e: KeyboardEvent) => {
      const fromCode = KEY_MAP[e.code]
      const fromKey =
        e.key === 'ArrowLeft'
          ? 'turnLeft'
          : e.key === 'ArrowRight'
            ? 'turnRight'
            : e.key === 'ArrowUp'
              ? 'thrust'
              : e.key === 'ArrowDown'
                ? 'reverse'
                : null
      const key = fromCode ?? fromKey
      if (!key) return
      e.preventDefault()
      release(key, `key:${e.code || e.key}`)
      // Also drop the alternate id if code/key differed
      if (e.code && e.key) {
        release(key, `key:${e.code}`)
        release(key, `key:${e.key}`)
      }
    }
    const blur = () => clearPressed()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const continueWave = (e?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (stateRef.current.phase !== 'waveClear') return
    clearPressed()
    stateRef.current = beginNextWave(stateRef.current)
    setUi(toSnapshot(stateRef.current))
  }

  const onPlayTap = (e: ReactPointerEvent) => {
    e.preventDefault()
    if (saveOpenRef.current || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu' || s.phase === 'gameover') {
      if (performance.now() < startGrace.current) return
      restart()
    }
  }

  return (
    <section className={`asteroids asteroids--fullscreen${device === 'tablet' ? ' asteroids--tablet' : ''}${saveOpen || ui.phase === 'waveClear' ? ' asteroids--saving' : ''}`}>
      <GameHud
        slug="asteroids"
        personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
        hideBest
        extra={
          (pausable || paused) ? (
            <PauseButton paused={paused} onToggle={togglePause} />
          ) : undefined
        }
      >
        <GameHudStat
          label="Score"
          hot={ui.phase === 'playing' && ui.score > previousBestRef.current}
        >
          {ui.score}
        </GameHudStat>
        <GameHudStat label="Wave">
          {ui.phase === 'waveClear' ? ui.lastWave : ui.wave}
        </GameHudStat>
        <GameHudStat label="Time" className="game-hud__stat--time">
          {ui.phase === 'playing' || ui.phase === 'waveClear'
            ? `${formatWaveTime(ui.time)}s`
            : '—'}
        </GameHudStat>
        <GameHudStat label="Lives" className="game-hud__stat--lives">
          {ui.lives}
        </GameHudStat>
      </GameHud>
      <div className="asteroids__body">
      <div className="asteroids__play" onPointerDown={onPlayTap}>
        <GameStage
          aspectWidth={aspect.w}
          aspectHeight={aspect.h}
          fill
        >
          <canvas ref={canvasRef} className="asteroids__viewport" />

          <div className="asteroids__overlay">
            <PauseOverlay paused={paused} onResume={resume} />
            {ui.phase === 'waveClear' && !saveOpen && !paused && (
              <div className="asteroids__card asteroids__card--clear">
                <h2>Wave {ui.lastWave} clear</h2>
                <p className="asteroids__wave-time">{formatWaveTime(ui.lastWaveTime)}s</p>
                <span>
                  {ui.timeBonus > 0 ? `Time bonus +${ui.timeBonus}` : 'No time bonus'}
                </span>
                {ui.comboBest > 1 ? (
                  <span>Best combo {ui.comboBest}</span>
                ) : null}
                <button
                  type="button"
                  className="asteroids__next"
                  onPointerDown={continueWave}
                >
                  Next wave
                </button>
              </div>
            )}
            {ui.phase === 'menu' && !saveOpen && !paused && (
              <div className="asteroids__card" aria-hidden="true">
                <h2>Asteroids</h2>
                <p>Spin, thrust, and clear the rocks. Chain hits for a multiplier.</p>
                <PersonalBestHint slug="asteroids" />
                <span className="asteroids__hint asteroids__hint--keys">
                  ← → turn · ↑ thrust · ↓ reverse · auto-fire · grab powerups
                </span>
                <span className="asteroids__hint asteroids__hint--touch">
                  Hold to turn and thrust · grab powerups · auto-fire
                </span>
              </div>
            )}
            {ui.phase === 'gameover' && saveOpen && (
              tournament ? (
                <TournamentScoreCard
                  tournamentId={tournament.tournamentId}
                  gameSlug="asteroids"
                  score={ui.score}
                  onDone={restart}
                />
              ) : (
                <ScoreSaveCard
                  gameSlug="asteroids"
                  score={ui.score}
                  title="Ship down"
                  subtitle={`Wave ${ui.wave}`}
                  previousBest={Math.max(previousBestRef.current, apiBest)}
                  onDone={restart}
                />
              )
            )}
          </div>
        </GameStage>
      </div>

        <div className="asteroids__touch" aria-label="Ship controls">
          <div className="asteroids__turns">
            <button
              type="button"
              className="asteroids__btn"
              aria-label="Turn left"
              {...holdPad('turnLeft')}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 3v5h5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="asteroids__btn"
              aria-label="Turn right"
              {...holdPad('turnRight')}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 3v5h-5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="asteroids__drive">
            <button
              type="button"
              className="asteroids__btn asteroids__btn--thrust"
              aria-label="Thrust"
              {...holdPad('thrust')}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5.5 L12 18.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <path
                  d="M7.5 10.5 L12 5.5 L16.5 10.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="asteroids__btn asteroids__btn--reverse"
              aria-label="Reverse"
              {...holdPad('reverse')}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5.5 L12 18.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <path
                  d="M7.5 13.5 L12 18.5 L16.5 13.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
