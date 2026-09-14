import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
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
  POWER_HUE,
  stageFor,
  POWER_LABEL,
  setFiring,
  setMove,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type Snapshot,
} from './game'
import { renderGame } from './render'

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

/** Active pickups, in the order they matter while you are reading a volley. */
function activeBuffs(ui: Snapshot) {
  const out: { kind: keyof typeof POWER_LABEL; note: string }[] = []
  if (ui.jam) out.push({ kind: 'jam', note: 'next volley' })
  if (ui.slow > 0) out.push({ kind: 'slow', note: `${Math.ceil(ui.slow)}s` })
  if (ui.spread > 0) out.push({ kind: 'spread', note: `${Math.ceil(ui.spread)}s` })
  if (ui.pierce > 0) out.push({ kind: 'pierce', note: `${ui.pierce}` })
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

  const releaseAll = () => {
    for (const key of ['left', 'right', 'fire'] as HoldKey[]) heldRef.current[key].clear()
    syncControls()
  }

  const restart = () => {
    saveOpenRef.current = false
    setSaveOpen(false)
    offeredScore.current = null
    clearRunAchievements()
    releaseAll()
    stateRef.current = startGame(stateRef.current, portraitRef.current)
    previousBestRef.current = getPersonalBest('barrage')
    startGrace.current = performance.now() + 220
    setUi(toSnapshot(stateRef.current))
  }

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
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }
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
      press(key, `pad:${e.pointerId}`)
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => release(key, `pad:${e.pointerId}`),
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) =>
      release(key, `pad:${e.pointerId}`),
    onLostPointerCapture: (e: ReactPointerEvent<HTMLButtonElement>) =>
      release(key, `pad:${e.pointerId}`),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  })

  const onPlayTap = () => {
    if (saveOpenRef.current || pausedRef.current) return
    const s = stateRef.current
    if (s.phase !== 'menu' && s.phase !== 'gameover') return
    if (performance.now() < startGrace.current) return
    restart()
  }

  return (
    <section className={`barrage barrage--fullscreen${saveOpen ? ' barrage--saving' : ''}`}>
      <div className="game-play">
        <GameStage
          aspectWidth={stageFor(portrait).w}
          aspectHeight={stageFor(portrait).h}
          fill
        >
          <div className="barrage__play" onPointerDown={onPlayTap}>
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
              <PlayReadoutCenter label="Wave">
                {ui.wave} · {ui.lives} {ui.lives === 1 ? 'life' : 'lives'}
              </PlayReadoutCenter>
            </PlayReadout>

            {ui.phase !== 'menu' && !paused && activeBuffs(ui).length > 0 && (
              <div className="barrage__buffs">
                {activeBuffs(ui).map((buff) => (
                  <span
                    key={buff.kind}
                    className="barrage__buff"
                    style={{ '--buff-hue': POWER_HUE[buff.kind] } as CSSProperties}
                  >
                    {POWER_LABEL[buff.kind]}
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
                  tagline="They light up before they fire. Be somewhere else."
                  slug="barrage"
                />
              )}
              {ui.phase === 'gameover' &&
                saveOpen &&
                (tournament ? (
                  <TournamentScoreCard
                    tournamentId={tournament.tournamentId}
                    gameSlug="barrage"
                    score={ui.score}
                    onDone={restart}
                  />
                ) : (
                  <ScoreSaveCard
                    gameSlug="barrage"
                    score={ui.score}
                    title="Line broken"
                    subtitle={`Wave ${ui.wave} · ${ui.accuracy}% accuracy`}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={restart}
                  />
                ))}
            </div>
          </div>
        </GameStage>
      </div>

      <div className="barrage__touch" aria-label="Cannon controls">
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
    </section>
  )
}
