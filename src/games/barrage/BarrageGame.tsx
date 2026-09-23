import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import '../../styles/barrage.css'
import { haptic } from '../../lib/haptics'
import {
  GamePlayChrome,
  PlayReadout,
  PlayReadoutScore,
} from '../../components/GameHud'
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
  createInitialState,
  jumpToWave,
  levelMark,
  MIRROR_HUE,
  POWER_HUE,
  POWER_KINDS,
  stageFor,
  POWER_LABEL,
  setFiring,
  setMove,
  setSteer,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { fieldXAt, renderGame } from './render'
import { beginRun } from '../../lib/runSession'

type HoldKey = 'left' | 'right' | 'fire'

const BY_CODE: Record<string, HoldKey> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'fire',
  ArrowUp: 'fire',
  KeyW: 'fire',
}

/** Some hosts and layouts deliver no `code`, so fall back to `key`. */
const BY_KEY: Record<string, HoldKey> = {
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  ' ': 'fire',
  Spacebar: 'fire',
  ArrowUp: 'fire',
  w: 'fire',
}

function holdKeyFor(e: KeyboardEvent): HoldKey | undefined {
  return BY_CODE[e.code] ?? BY_KEY[e.key] ?? BY_KEY[e.key?.toLowerCase()]
}

/** What the cannon has collected: each power at its level, and the mirrors it holds. */
function activeBuffs(ui: Snapshot) {
  const out: { key: string; label: string; hue: number; note: string }[] = []
  for (const kind of POWER_KINDS) {
    const level = ui[kind]
    if (level > 0) out.push({ key: kind, label: POWER_LABEL[kind], hue: POWER_HUE[kind], note: levelMark(level) })
  }
  if (ui.mirror > 0) out.push({ key: 'mirror', label: 'Mirror', hue: MIRROR_HUE, note: `×${ui.mirror}` })
  return out
}

function isStartKey(e: KeyboardEvent): boolean {
  return e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter'
}

export function BarrageGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest('barrage')
  // Upright on a phone, on its side on a desktop. A run keeps the shape it
  // started in; the menu adopts a new one straight away.
  const [portrait, setPortrait] = useState(
    () => typeof window === 'undefined' || window.innerHeight > window.innerWidth,
  )
  const portraitRef = useRef(portrait)
  portraitRef.current = portrait
  const stateRef = useRef<GameState>(createInitialState(portrait))
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

  /** Held inputs keyed by source, so a key and a thumb pad cannot fight. */
  const heldRef = useRef<Record<HoldKey, Set<string>>>({
    left: new Set(),
    right: new Set(),
    fire: new Set(),
  })

  const syncControls = () => {
    const held = heldRef.current
    const dir = (held.right.size > 0 ? 1 : 0) - (held.left.size > 0 ? 1 : 0)
    stateRef.current = setFiring(setMove(stateRef.current, dir), held.fire.size > 0)
  }

  const press = (key: HoldKey, id: string) => {
    heldRef.current[key].add(id)
    syncControls()
  }

  const release = (key: HoldKey, id: string) => {
    heldRef.current[key].delete(id)
    syncControls()
  }

  /** The finger or pointer steering the cannon across the field, if any. */
  const steerRef = useRef<number | null>(null)

  const steerTo = (clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const portraitField = stateRef.current.layout.fieldH > 1
    const x = fieldXAt(clientX - rect.left, rect.width, rect.height, portraitField)
    stateRef.current = setSteer(stateRef.current, x)
  }

  const endSteer = () => {
    steerRef.current = null
    stateRef.current = setSteer(stateRef.current, null)
  }

  const releaseAll = () => {
    for (const key of ['left', 'right', 'fire'] as HoldKey[]) heldRef.current[key].clear()
    endSteer()
    syncControls()
  }

  const restart = (intoMenu = false) => {
    saveOpenRef.current = false
    setSaveOpen(false)
    offeredScore.current = null
    clearRunAchievements()
    if (!intoMenu) beginRun('barrage')
    releaseAll()
    stateRef.current = startGame(stateRef.current, portraitRef.current)
    previousBestRef.current = getPersonalBest('barrage')
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

      if (!pausedRef.current) stateRef.current = tick(stateRef.current, dt)

      const snap = toSnapshot(stateRef.current)
      if (snap.phase === 'gameover') {
        if (offeredScore.current !== snap.score) {
          offeredScore.current = snap.score
          saveOpenRef.current = true
          releaseAll()
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
        // Drawn at the screen's own density, or a phone shows every outline soft.
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

  useEffect(() => {
    if (stateRef.current.phase !== 'menu') return
    if (stateRef.current.layout.fieldH > 1 === portrait) return
    stateRef.current = createInitialState(portrait)
    setUi(toSnapshot(stateRef.current))
  }, [portrait])

  // Losing the tab mid-hold would otherwise leave the cannon driving itself.
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
      const key = holdKeyFor(e)
      const s = stateRef.current

      if (s.phase === 'menu' || s.phase === 'gameover') {
        if (isStartKey(e)) {
          e.preventDefault()
          if (performance.now() < startGrace.current) return
          restart()
        }
        return
      }
      if (!key) return
      e.preventDefault()
      if (e.repeat) return
      press(key, 'key')
    }

    const up = (e: KeyboardEvent) => {
      const key = holdKeyFor(e)
      if (!key) return
      release(key, 'key')
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const holdPad = (key: HoldKey) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety; the pad still works without it */
      }
      // Every pad, one place: an on-screen control gives the eye
      // feedback and the hand none, which is the gap this closes.
      haptic(key === 'fire' ? 'hit' : 'turn')
      press(key, `pad:${e.pointerId}`)
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => release(key, `pad:${e.pointerId}`),
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) =>
      release(key, `pad:${e.pointerId}`),
    onLostPointerCapture: (e: ReactPointerEvent<HTMLButtonElement>) =>
      release(key, `pad:${e.pointerId}`),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  })

  const onPlayPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    const s = stateRef.current
    if (s.phase === 'menu' || s.phase === 'gameover') {
      if (performance.now() < startGrace.current) return
      restart()
      return
    }
    // Touching the field steers: the cannon runs to where the finger is, at
    // its own speed, so a finger is no faster than the keys. The chrome's
    // buttons sit on top of the field and are not part of it.
    if (e.target !== canvasRef.current || steerRef.current !== null) return
    steerRef.current = e.pointerId
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety; steering still follows moves over the field */
    }
    steerTo(e.clientX)
  }

  const onPlayPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId === steerRef.current) steerTo(e.clientX)
  }

  const onPlayPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId === steerRef.current) endSteer()
  }

  return (
    <section className={`barrage barrage--fullscreen${saveOpen ? ' barrage--saving' : ''}`}>
      <div className="game-play">
        <GameStage
          aspectWidth={stageFor(portrait).w}
          aspectHeight={stageFor(portrait).h}
          fill
        >
          <div
            className="barrage__play"
            onPointerDown={onPlayPointerDown}
            onPointerMove={onPlayPointerMove}
            onPointerUp={onPlayPointerEnd}
            onPointerCancel={onPlayPointerEnd}
            onLostPointerCapture={onPlayPointerEnd}
          >
            <canvas ref={canvasRef} className="barrage__viewport" />

            <GamePlayChrome
              slug="barrage"
              inRun={() => stateRef.current.phase !== 'menu'}
              paused={paused}
            >
              {pausable || paused ? (
                <PauseButton paused={paused} onToggle={togglePause} />
              ) : null}
            </GamePlayChrome>

            <PlayReadout>
              <PlayReadoutScore>{ui.score.toLocaleString()}</PlayReadoutScore>
              <PlayReadoutStats>
                <PlayStat label="Wave" value={ui.wave} />
                <PlayStat label="Lives" value={ui.lives} urgent={ui.lives === 1 && ui.phase !== 'menu'} />
                {ui.chain >= 2 && ui.phase !== 'menu' ? (
                  <PlayStat
                    label="Chain"
                    value={
                      <>
                        {ui.chain}
                        {ui.mult >= 2 ? <span className="barrage__mult">×{ui.mult}</span> : null}
                      </>
                    }
                  />
                ) : null}
              </PlayReadoutStats>
            </PlayReadout>

            {ui.phase !== 'menu' && !paused && activeBuffs(ui).length > 0 && (
              <div className="barrage__buffs">
                {activeBuffs(ui).map((buff) => (
                  <span
                    key={buff.key}
                    className="barrage__buff"
                    style={{ '--buff-hue': buff.hue } as CSSProperties}
                  >
                    {buff.label}
                    <b>{buff.note}</b>
                  </span>
                ))}
              </div>
            )}

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
                        stateRef.current = jumpToWave(stateRef.current, ui.wave + 1)
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
                        stateRef.current = jumpToWave(stateRef.current, wave)
                        setUi(toSnapshot(stateRef.current))
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
                    gameSlug="barrage"
                    score={ui.score}
                    onDone={toMenu}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="barrage"
                    score={ui.score}
                    title={ui.endCause === 'line' ? 'Line broken' : 'Out of cannons'}
                    subtitle={`Wave ${ui.wave} · best chain ${ui.bestChain} · ${ui.accuracy}% accuracy`}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={toMenu}
                  />
                ))}
            </div>
          </div>
        </GameStage>
      </div>

      {/*
        Steering under the left thumb and the trigger under the right, so both
        can be held at once. The fire pad used to sit between the arrows, which
        took the same thumb off the move to shoot. Dragging on the field steers
        as well.
      */}
      <div className="barrage__touch" aria-label="Cannon controls">
        <div className="barrage__steer">
          <button type="button" className="barrage__btn" aria-label="Move left" {...holdPad('left')}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 5 L8 12 L15 19"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button type="button" className="barrage__btn" aria-label="Move right" {...holdPad('right')}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 5 L16 12 L9 19"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className="barrage__btn barrage__btn--fire"
          aria-label="Fire"
          {...holdPad('fire')}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3 L12 21 M6 9 L12 3 L18 9"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Fire</span>
        </button>
      </div>
    </section>
  )
}
