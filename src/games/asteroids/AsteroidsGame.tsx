import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GameHud, GameHudStat } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PauseButton, PauseOverlay } from '../../components/PauseControls'
import { PersonalBestHint } from '../../components/PersonalBestHint'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
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
  const apiBest = usePersonalBest('asteroids')
  const layout0 = currentLayout()
  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 960, h: 540 })
  const [aspect, setAspect] = useState({ w: layout0.aspectW, h: layout0.aspectH })
  const pressedRef = useRef(emptyPressed())
  /** Last pressed turn wins — left+right never cancel each other out. */
  const turnDirRef = useRef<-1 | 0 | 1>(0)
  /** Slide pads: -1 … 1. Turn is left/right; thrust is up/down. */
  const slideTurnRef = useRef(0)
  const slideThrustRef = useRef(0)
  const slideTurnHeldRef = useRef(false)
  const slideThrustHeldRef = useRef(false)
  const turnKnobRef = useRef<HTMLDivElement>(null)
  const thrustKnobRef = useRef<HTMLDivElement>(null)
  const saveOpenRef = useRef(false)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current))
  const [saveOpen, setSaveOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest('asteroids'))
  const startGrace = useRef(0)
  const ignorePauseKeys = useRef(false)
  const infoOpenRef = useRef(false)
  ignorePauseKeys.current = saveOpen || infoOpen
  infoOpenRef.current = infoOpen
  const pausable = ui.phase === 'playing' && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable, ignorePauseKeys)
  const pausedRef = useRef(false)
  pausedRef.current = paused || infoOpen
  saveOpenRef.current = saveOpen

  const resetSlideVisuals = () => {
    if (turnKnobRef.current) turnKnobRef.current.style.transform = 'translate(0px, 0px)'
    if (thrustKnobRef.current) thrustKnobRef.current.style.transform = 'translate(0px, 0px)'
  }

  const syncControls = () => {
    const p = pressedRef.current
    const s = stateRef.current
    const analogTurn = slideTurnHeldRef.current
    const rawTurn = Math.max(-1, Math.min(1, slideTurnRef.current))
    const turn = analogTurn && Math.abs(rawTurn) > 0.12 ? rawTurn : 0
    const turnLeft = analogTurn ? false : turnDirRef.current === -1
    const turnRight = analogTurn ? false : turnDirRef.current === 1
    const analogThrust = slideThrustHeldRef.current
    const rawThrust = Math.max(-1, Math.min(1, slideThrustRef.current))
    const thrust = analogThrust ? rawThrust > 0.18 : p.thrust.size > 0
    const reverse = analogThrust ? rawThrust < -0.18 : p.reverse.size > 0
    if (
      s.turnLeft === turnLeft &&
      s.turnRight === turnRight &&
      s.turn === turn &&
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
      turn,
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
    // if both: keep turnDirRef as last pressed (set in press)
  }

  const clearPressed = () => {
    pressedRef.current = emptyPressed()
    turnDirRef.current = 0
    slideTurnRef.current = 0
    slideThrustRef.current = 0
    slideTurnHeldRef.current = false
    slideThrustHeldRef.current = false
    resetSlideVisuals()
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

  const onSlidePad =
    (axis: 'turn' | 'thrust') => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (saveOpenRef.current || pausedRef.current) return
      const s = stateRef.current
      if (s.phase === 'menu') restart()
      else if (s.phase !== 'playing') return

      const originX = e.clientX
      const originY = e.clientY
      const range = 56
      const knobMax = 34
      const knob = axis === 'turn' ? turnKnobRef.current : thrustKnobRef.current
      const clamp = (n: number) => Math.max(-knobMax, Math.min(knobMax, n))

      if (axis === 'turn') slideTurnHeldRef.current = true
      else slideThrustHeldRef.current = true

      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      const apply = (clientX: number, clientY: number) => {
        if (axis === 'turn') {
          const dx = clientX - originX
          slideTurnRef.current = Math.max(-1, Math.min(1, dx / range))
          if (knob) knob.style.transform = `translate(${clamp(dx)}px, 0px)`
        } else {
          const dy = clientY - originY
          slideThrustRef.current = Math.max(-1, Math.min(1, -dy / range))
          if (knob) knob.style.transform = `translate(0px, ${clamp(dy)}px)`
        }
        syncControls()
      }

      apply(e.clientX, e.clientY)
      const target = e.currentTarget
      const pointerId = e.pointerId
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        apply(ev.clientX, ev.clientY)
      }
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        if (axis === 'turn') {
          slideTurnHeldRef.current = false
          slideTurnRef.current = 0
          if (turnKnobRef.current) turnKnobRef.current.style.transform = 'translate(0px, 0px)'
        } else {
          slideThrustHeldRef.current = false
          slideThrustRef.current = 0
          if (thrustKnobRef.current) thrustKnobRef.current.style.transform = 'translate(0px, 0px)'
        }
        syncControls()
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onUp)
        target.removeEventListener('lostpointercapture', onUp)
      }
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
      target.addEventListener('lostpointercapture', onUp)
    }

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
        if (e.code === 'Escape' && infoOpenRef.current) {
          e.preventDefault()
          setInfoOpen(false)
          return
        }
        if (e.code === 'Enter' || e.key === 'Enter' || e.code === 'Space' || e.key === ' ') {
          e.preventDefault()
          if (infoOpenRef.current) return
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
    <section className={`asteroids asteroids--fullscreen${saveOpen || infoOpen || ui.phase === 'waveClear' ? ' asteroids--saving' : ''}`}>
      <GameHud
        slug="asteroids"
        personalBest={ui.phase === 'playing' ? previousBestRef.current : apiBest}
        extra={
          <>
            <button
              type="button"
              className="patriot__info"
              aria-label="Scoring info"
              aria-expanded={infoOpen}
              onPointerDown={(e) => {
                e.stopPropagation()
                setInfoOpen((open) => !open)
              }}
            >
              i
            </button>
            {(pausable || paused) ? (
              <PauseButton paused={paused} onToggle={togglePause} />
            ) : null}
          </>
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
        <GameHudStat label="Lives">{ui.lives}</GameHudStat>
        {ui.phase === 'playing' && ui.combo > 1 ? (
          <GameHudStat label="Combo" hot>
            {ui.combo}
          </GameHudStat>
        ) : null}
      </GameHud>
      <div className="asteroids__body">
      <div className="asteroids__play" onPointerDown={onPlayTap}>
        <GameStage
          aspectWidth={aspect.w}
          aspectHeight={aspect.h}
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
                  ← → turn · ↑ thrust · ↓ reverse · auto-fire
                </span>
                <span className="asteroids__hint asteroids__hint--touch">
                  Slide left to turn · slide right to thrust · auto-fire
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
          <div
            className="asteroids__slide asteroids__slide--turn"
            role="slider"
            aria-label="Slide left and right to turn"
            aria-valuemin={-1}
            aria-valuemax={1}
            aria-orientation="horizontal"
            onPointerDown={onSlidePad('turn')}
          >
            <div className="asteroids__slide-well">
              <span className="asteroids__slide-hint" aria-hidden="true">
                <span className="asteroids__chevron asteroids__chevron--left" />
                <span className="asteroids__chevron asteroids__chevron--right" />
              </span>
              <div className="asteroids__slide-knob" ref={turnKnobRef} />
            </div>
          </div>
          <div
            className="asteroids__slide asteroids__slide--thrust"
            role="slider"
            aria-label="Slide up and down to thrust"
            aria-valuemin={-1}
            aria-valuemax={1}
            aria-orientation="vertical"
            onPointerDown={onSlidePad('thrust')}
          >
            <div className="asteroids__slide-well">
              <span className="asteroids__slide-hint asteroids__slide-hint--vert" aria-hidden="true">
                <span className="asteroids__chevron asteroids__chevron--up" />
                <span className="asteroids__chevron asteroids__chevron--down" />
              </span>
              <div className="asteroids__slide-knob" ref={thrustKnobRef} />
            </div>
          </div>
        </div>
      </div>

      {infoOpen && (
        <div
          className="patriot__info-backdrop"
          onPointerDown={(e) => {
            e.stopPropagation()
            setInfoOpen(false)
          }}
        >
          <div
            className="patriot__info-panel"
            role="dialog"
            aria-label="How scoring works"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="patriot__info-head">
              <span className="patriot__label">Scoring</span>
              <button
                type="button"
                className="patriot__info-close"
                aria-label="Close scoring info"
                onClick={() => setInfoOpen(false)}
              >
                ×
              </button>
            </div>
            <ul className="patriot__info-list">
              <li>
                <span>Large rock</span>
                <strong>+20</strong>
              </li>
              <li>
                <span>Medium rock</span>
                <strong>+50</strong>
              </li>
              <li>
                <span>Small rock</span>
                <strong>+100</strong>
              </li>
              <li>
                <span>Combo (hits within 0.75s)</span>
                <strong>up to 2×</strong>
              </li>
              <li>
                <span>Wave 1 / 2 / 3 clear</span>
                <strong>+100 / +150 / +200</strong>
              </li>
              <li>
                <span>Time under par</span>
                <strong>+20 / sec</strong>
              </li>
              <li>
                <span>Par</span>
                <strong>48s, −2s each wave</strong>
              </li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
