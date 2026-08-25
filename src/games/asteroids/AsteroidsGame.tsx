import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { PauseButton, GamePauseOverlay } from '../../components/PauseControls'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import {
  ScoreCelebration,
  ScoreSaveCard,
  booksCelebrationPayload,
} from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { usePlayerName } from '../../hooks/usePlayerName'
import { useDeviceType } from '../../lib/device'
import { getGame } from '../../data/games'
import { getPersonalBest } from '../../lib/personalBest'
import {
  clearRunAchievements,
  pushRunAchievement,
  type RunAchievement,
} from '../../lib/runAchievements'
import {
  submitAsteroidsHighestCombo,
  submitAsteroidsWaveClearBooks,
} from '../../lib/records'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  asteroidsLayout,
  beginNextWave,
  createInitialState,
  formatWaveTime,
  jumpToWave,
  POWER_HUE,
  POWER_LABEL,
  resizeState,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type PowerKind,
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
  const playerName = usePlayerName()
  const apiBest = usePersonalBest('asteroids')
  const accent = getGame('asteroids')?.accent ?? '#2eb87a'
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
  const [waveCeleb, setWaveCeleb] = useState<RunAchievement[] | null>(null)
  const waveCelebRef = useRef(false)
  waveCelebRef.current = Boolean(waveCeleb)
  const offeredScore = useRef<number | null>(null)
  const waveRecordKey = useRef<string | null>(null)
  const comboRecordKey = useRef<string | null>(null)
  const previousBestRef = useRef(getPersonalBest('asteroids'))
  const startGrace = useRef(0)
  const ignorePauseKeys = useRef(false)
  ignorePauseKeys.current = saveOpen
  const pausable =
    (ui.phase === 'playing' || ui.phase === 'waveClear') && !saveOpen
  const { paused, toggle: togglePause, pause, resume } = useGamePause(pausable, ignorePauseKeys)
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
    if (ui.phase !== 'waveClear' || tournament) {
      if (ui.phase !== 'waveClear') {
        waveRecordKey.current = null
      }
      return
    }
    const wave = ui.lastWave
    const time = ui.lastWaveTime
    const key = `${wave}:${time.toFixed(3)}`
    waveRecordKey.current = key
    void (async () => {
      const hits = await submitAsteroidsWaveClearBooks({
        wave,
        seconds: time,
        combo: ui.runComboBest,
        name: playerName,
      })
      if (!hits.length) return
      if (ui.runComboBest >= 2) {
        comboRecordKey.current = `combo:${ui.runComboBest}`
      }
      // Prefer live wave-clear celebration; if they already advanced, queue for game over.
      if (
        stateRef.current.phase === 'waveClear' &&
        stateRef.current.lastWave === wave
      ) {
        setWaveCeleb(hits)
        return
      }
      for (const hit of hits) pushRunAchievement(hit)
    })()
  }, [
    ui.phase,
    ui.lastWave,
    ui.lastWaveTime,
    ui.runComboBest,
    playerName,
    tournament,
  ])

  useEffect(() => {
    if (ui.phase !== 'gameover' || tournament) return
    const combo = ui.runComboBest
    if (combo < 2) return
    const key = `combo:${combo}`
    if (comboRecordKey.current === key) return
    comboRecordKey.current = key
    void (async () => {
      const comboResult = await submitAsteroidsHighestCombo(combo, playerName)
      if (comboResult?.improved) {
        pushRunAchievement({
          id: 'asteroids:highest-combo',
          label: `Combo record · ${combo}`,
          rank: comboResult.rank,
        })
      }
    })()
  }, [ui.phase, ui.runComboBest, playerName, tournament])

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
    waveRecordKey.current = null
    comboRecordKey.current = null
    clearRunAchievements()
    setWaveCeleb(null)
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
    if (waveCelebRef.current) return
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
    <section
      className={`asteroids asteroids--fullscreen${device === 'tablet' ? ' asteroids--tablet' : ''}${saveOpen || ui.phase === 'waveClear' ? ' asteroids--saving' : ''}`}
      style={{ '--accent': accent } as CSSProperties}
    >
      <div className="asteroids__body">
      <div className="asteroids__play" onPointerDown={onPlayTap}>
        <GameStage
          aspectWidth={aspect.w}
          aspectHeight={aspect.h}
          fill
        >
          <canvas ref={canvasRef} className="asteroids__viewport" />

          <GamePlayChrome
            slug="asteroids"
            inRun={() => {
              const phase = stateRef.current.phase
              return phase === 'playing' || phase === 'waveClear'
            }}
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
            {ui.lives > 0 ? (
              <div
                className="play-readout__left asteroids__lives"
                aria-label={`${ui.lives} ${ui.lives === 1 ? 'life' : 'lives'}`}
              >
                {Array.from({ length: ui.lives }, (_, i) => (
                  <svg
                    key={i}
                    className="play-readout__ship"
                    viewBox="0 0 16 20"
                    aria-hidden="true"
                  >
                    <path
                      d="M8 1.5 L14.5 17.5 L8 13.5 L1.5 17.5 Z"
                      fill="currentColor"
                    />
                  </svg>
                ))}
              </div>
            ) : null}
            {ui.phase === 'playing' &&
            (ui.buffRapid > 0 ||
              ui.buffSpread > 0 ||
              ui.buffShield > 0 ||
              ui.buffSlow > 0) ? (
              <div className="asteroids__buffs" aria-label="Active powerups">
                {(
                  [
                    ['rapid', ui.buffRapid],
                    ['spread', ui.buffSpread],
                    ['shield', ui.buffShield],
                    ['slow', ui.buffSlow],
                  ] as const
                )
                  .filter(([, left]) => left > 0)
                  .map(([kind, left]) => (
                    <span
                      key={kind}
                      className="asteroids__buff"
                      style={
                        {
                          '--hue': String(POWER_HUE[kind as PowerKind]),
                        } as CSSProperties
                      }
                    >
                      <span className="asteroids__buff__name">
                        {POWER_LABEL[kind as PowerKind]}
                      </span>
                      <span className="asteroids__buff__time">
                        {Math.ceil(left)}
                      </span>
                    </span>
                  ))}
              </div>
            ) : null}
          </PlayReadout>

          <div className="asteroids__overlay">
            <GamePauseOverlay
              slug="asteroids"
              personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
              hideBest
              paused={paused}
              onResume={resume}
              extraMeta={
                <>
                  <div className="game-pause-meta__row">
                    <span>Wave</span>
                    <strong>
                      {ui.phase === 'waveClear' ? ui.lastWave : ui.wave}
                    </strong>
                  </div>
                  <div className="game-pause-meta__row">
                    <span>Time</span>
                    <strong>
                      {ui.phase === 'playing' || ui.phase === 'waveClear'
                        ? `${formatWaveTime(ui.time)}s`
                        : '—'}
                    </strong>
                  </div>
                </>
              }
              tools={
                ui.phase === 'playing' || ui.phase === 'waveClear' ? (
                  <AdminWaveSkip
                    wave={ui.phase === 'waveClear' ? ui.lastWave : ui.wave}
                    onSkipNext={() => {
                      const current =
                        ui.phase === 'waveClear' ? ui.lastWave : stateRef.current.wave
                      stateRef.current = jumpToWave(stateRef.current, current + 1)
                      setUi(toSnapshot(stateRef.current))
                      resume()
                    }}
                    onJump={(wave) => {
                      stateRef.current = jumpToWave(stateRef.current, wave)
                      setUi(toSnapshot(stateRef.current))
                      resume()
                    }}
                  />
                ) : null
              }
            />
            {ui.phase === 'waveClear' && !saveOpen && !paused && !waveCeleb && (
              <div className="asteroids__card asteroids__card--clear">
                <h2>Wave {ui.lastWave} clear</h2>
                <p className="asteroids__wave-time">{formatWaveTime(ui.lastWaveTime)}s</p>
                <span>
                  {ui.timeBonus > 0 ? `Time bonus +${ui.timeBonus}` : 'No time bonus'}
                </span>
                {ui.comboBest > 1 ? (
                  <span>Best combo {ui.comboBest}</span>
                ) : null}
                {ui.lifeBonus ? (
                  <div className="asteroids__life-bonus" aria-live="polite">
                    <svg
                      className="asteroids__life-bonus__ship"
                      viewBox="0 0 16 20"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 1.5 L14.5 17.5 L8 13.5 L1.5 17.5 Z"
                        fill="currentColor"
                      />
                    </svg>
                    <div className="asteroids__life-bonus__copy">
                      <strong>Extra life</strong>
                      <span>Awarded every 3 waves</span>
                    </div>
                  </div>
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
            {waveCeleb ? (
              <ScoreCelebration
                payload={booksCelebrationPayload(waveCeleb)}
                kicker="Record book"
                onDone={() => setWaveCeleb(null)}
              />
            ) : null}
            {ui.phase === 'menu' && !saveOpen && !paused && (
              <GameStartCard
                title="Asteroids"
                tagline="Clear the rocks. Chain hits."
                slug="asteroids"
              />
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
              className="asteroids__btn asteroids__btn--hyperspace"
              aria-label="Hyperspace"
              {...holdPad('reverse')}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 2.5 L13.6 9.2 L20.5 12 L13.6 14.8 L12 21.5 L10.4 14.8 L3.5 12 L10.4 9.2 Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="2.15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
