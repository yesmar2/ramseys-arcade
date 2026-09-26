import '../../styles/hotlap.css'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { haptic } from '../../lib/haptics'
import { getPersonalBest } from '../../lib/personalBest'
import { clearRunAchievements } from '../../lib/runAchievements'
import { beginRun } from '../../lib/runSession'
import { sfx } from '../../lib/sound'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import { CarSound } from './audio'
import { Ghost, hotlapCourse, keepLap, keptLap, MEDALS, medalFor, progressOf, type GhostLap } from './lap'
import { TrackMap } from './map'
import { HotLapScene } from './scene'
import { formatLap, hotlapBoardScore, hotlapMsFromBoardScore } from './score'
import { botDriver, GHOST_EVERY, newRun, STEP, stepRun, type Controls, type Run } from './sim'

const SLUG = 'hotlap'

type Phase = 'menu' | 'countdown' | 'racing' | 'finished' | 'gameover'
const IN_RUN = new Set<Phase>(['countdown', 'racing'])
/** The lights: three reds a little over half a second apart, then out, and go. */
const LIGHT_GAP = 0.55
const LIGHTS_OUT = 1.65
/** Past the line, a moment to see the time before the card comes. */
const CARD_AFTER = 0.8
/**
 * A press of left or right eases the wheel over in about a seventh of a second, and more gently the
 * faster you go (a third of a second at 90 mph), so at speed a tap is a nudge.
 */
const STEER_EASE = 7
/** The card stands at the right of a wide screen, and the car has the left. */
const WIDE = '(min-width: 900px) and (min-aspect-ratio: 4/3)'
/** Room for the latest sector only, beside the clock. */
const NARROW = '(max-width: 720px)'

type Held = { gas: boolean; brake: boolean; left: boolean; right: boolean }
const NONE: Held = { gas: false, brake: false, left: false, right: false }
const KEYS: Record<string, keyof Held> = {
  ArrowUp: 'gas',
  KeyW: 'gas',
  ArrowDown: 'brake',
  KeyS: 'brake',
  Space: 'brake',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
}

/** Everything a lap is, held outside React: the loop changes it 120 times a second. */
type Game = {
  phase: Phase
  run: Run
  /** Seconds into the countdown, or since the line. */
  clock: number
  /** Seconds since the lights went out: the ghost's clock, which runs on after you finish. */
  t: number
  /** Simulation owed to the clock, less than a step. */
  carry: number
  steps: number
  /** This lap's path, for its ghost if it's your best. */
  record: number[]
  /** The wheel, eased toward what the keys or thumbs ask. */
  steer: number
  /** The lap being chased: your best on this device, or the pace car's. */
  ghost: Ghost
  /** The lap's result, once it's over. */
  lap: { time: number; score: number; splits: number[]; improved: boolean } | null
}

type Ui = {
  phase: Phase
  /** 0 before the lights, 1–3 reds, 4 green. */
  lights: number
  splits: number[]
  cut: boolean
  /** Against the ghost at the same point of the lap; null before that's known. */
  ahead: boolean | null
}

const snapshot = (g: Game): Ui => ({
  phase: g.phase,
  lights: lightsFor(g),
  splits: [...g.run.splits],
  cut: g.run.cut,
  ahead: aheadOf(g),
})

function lightsFor(g: Game) {
  if (g.phase === 'countdown') return g.clock < LIGHTS_OUT ? Math.min(3, Math.floor(g.clock / LIGHT_GAP) + 1) : 4
  if (g.phase === 'racing' && g.run.time < 0.9) return 4
  return 0
}

function aheadOf(g: Game): boolean | null {
  if (g.phase !== 'racing' || g.run.time < 1.5 || g.run.cut) return null
  const { track } = hotlapCourse()
  const at = g.ghost.timeAt(progressOf(track, g.run.dist, g.run.gate > 0))
  return g.run.time < at
}

/** A sector's time, or how it went against the same sector of the lap being chased. */
function sectorFigure(k: number, splits: number[], chased: number[]) {
  const at = splits[k]
  if (at == null) return { text: '–', tone: '' }
  const mine = at - (k === 0 ? 0 : splits[k - 1]!)
  const ref = chased[k]
  if (ref == null) return { text: mine.toFixed(2), tone: '' }
  const d = mine - (ref - (k === 0 ? 0 : chased[k - 1]!))
  return { text: `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`, tone: d <= 0 ? 'good' : 'bad' }
}

function freshGame(ghostLap: GhostLap): Game {
  const { track } = hotlapCourse()
  return {
    phase: 'menu',
    run: newRun(track),
    clock: 0,
    t: 0,
    carry: 0,
    steps: 0,
    record: [],
    steer: 0,
    ghost: new Ghost(track, ghostLap),
    lap: null,
  }
}

const touchScreen = () =>
  typeof window !== 'undefined' && ((typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window)

/** The times to beat: the blue car's, then gold, silver and bronze, lit up to the one your best lap has. */
function Targets({ ghost, best }: { ghost: number; best: number | null }) {
  const won = medalFor(best)
  return (
    <div className="hotlap-medals" aria-label="Times to beat">
      <span className="hotlap-medal hotlap-medal--ghost">
        <i aria-hidden="true" />
        Blue car
        <b>{formatLap(ghost)}</b>
      </span>
      {MEDALS.map((m) => (
        <span key={m.name} className={`hotlap-medal hotlap-medal--${m.name.toLowerCase()}${won && m.time >= won.time ? ' is-won' : ''}`}>
          <i aria-hidden="true" />
          {m.name}
          <b>{`${Number(m.time.toFixed(2))}s`}</b>
        </span>
      ))}
    </div>
  )
}

/**
 * Hot Lap: one lap of a racing circuit against the clock, in 3D. Gas, brake and steering; the skill is
 * when to brake for a corner, how much of the road to use, and how soon to get back on the gas.
 *
 * The ghost is the lap to beat, driven alongside you the whole way: your best on this device, or before
 * you have one, the pace car's. It stays on the road all lap, fainter while it's right on top of you,
 * and waits where it finished if it gets there first. A cut across the grass skips a gate and the lap
 * can't count; R or the restart button starts another.
 *
 * Keys: ↑ or W gas, ↓, S or Space brake, ← → or A D steer, R restart, P or Escape pause. On a touch
 * screen: steer with the left thumb, pedals under the right. A lap is scored as its time: the board
 * keeps a million less the milliseconds (score.ts), so the fastest lap is the highest score.
 */
export function HotLapGame() {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest(SLUG)
  const pace = hotlapCourse().pace
  const gameRef = useRef<Game | null>(null)
  if (!gameRef.current) gameRef.current = freshGame(keptLap() ?? pace)
  const [ui, setUi] = useState<Ui>(() => snapshot(gameRef.current!))
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const [noGl, setNoGl] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [touch] = useState(touchScreen)
  const [narrow, setNarrow] = useState(() => typeof matchMedia === 'function' && matchMedia(NARROW).matches)
  const [pads, setPads] = useState<Held>(NONE)
  const holderRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const speedRef = useRef<HTMLElement>(null)
  const sceneRef = useRef<HotLapScene | null>(null)
  const soundRef = useRef<CarSound | null>(null)
  const keysRef = useRef<Held>({ ...NONE })
  const fingersRef = useRef(new Map<number, keyof Held>())
  const padRef = useRef<Held>({ ...NONE })
  const previousBestRef = useRef(getPersonalBest(SLUG))
  const startGrace = useRef(0)
  const autopilot = useRef<((run: Run) => Controls) | null>(null)
  const toastTimer = useRef(0)
  const inRun = IN_RUN.has(ui.phase)
  const pausable = inRun && !saveOpen
  const { paused, toggle: togglePause, resume } = useGamePause(pausable)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  const say = (text: string | null, seconds = 3) => {
    window.clearTimeout(toastTimer.current)
    setToast(text)
    if (text) toastTimer.current = window.setTimeout(() => setToast(null), seconds * 1000)
  }

  const clearThumbs = () => {
    fingersRef.current.clear()
    padRef.current = { ...NONE }
    setPads(NONE)
  }

  /** Lights, and a new lap: a new run for the boards, chasing the best lap there is. */
  const start = () => {
    saveOpenRef.current = false
    setSaveOpen(false)
    clearRunAchievements()
    beginRun(SLUG)
    previousBestRef.current = getPersonalBest(SLUG)
    const g = freshGame(keptLap() ?? pace)
    g.phase = 'countdown'
    gameRef.current = g
    sceneRef.current?.startLap()
    soundRef.current?.wake()
    say(null)
    setUi(snapshot(g))
  }

  /** Done with the lap: back to the start card, where what it changed shows. Nothing counts until the next one starts. */
  const toMenu = () => {
    saveOpenRef.current = false
    setSaveOpen(false)
    gameRef.current = freshGame(keptLap() ?? pace)
    previousBestRef.current = getPersonalBest(SLUG)
    startGrace.current = performance.now() + 300
    clearThumbs()
    say(null)
    setUi(snapshot(gameRef.current))
  }

  const restart = () => {
    if (!IN_RUN.has(gameRef.current!.phase) || pausedRef.current || saveOpenRef.current) return
    start()
  }

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    const { track } = hotlapCourse()
    // A canvas of the scene's own: when it goes, its GL context goes with it, and a remount starts clean.
    const canvas = document.createElement('canvas')
    canvas.className = 'hotlap__view'
    canvas.setAttribute('aria-label', 'The track, seen from behind your car')
    holder.append(canvas)
    let scene: HotLapScene
    try {
      scene = new HotLapScene(canvas, track)
    } catch {
      canvas.remove()
      setNoGl(true)
      return
    }
    sceneRef.current = scene
    const sound = new CarSound()
    soundRef.current = sound
    const map = mapRef.current ? new TrackMap(mapRef.current, track) : null
    const wide = window.matchMedia(WIDE)
    const retheme = () => map?.rebuild()
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    dark.addEventListener?.('change', retheme)
    const themeWatch = new MutationObserver(retheme)
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    const controls = (g: Game): Controls => {
      const run = g.run
      if (autopilot.current) return autopilot.current(run)
      const keys = keysRef.current
      const pad = padRef.current
      const gas = keys.gas || pad.gas
      const brake = keys.brake || pad.brake
      const want = (keys.left || pad.left ? 1 : 0) - (keys.right || pad.right ? 1 : 0)
      const ease = STEER_EASE * Math.max(0.45, Math.min(1, 18 / Math.max(run.u, 1)))
      const toward = want === 0 || Math.sign(want) !== Math.sign(g.steer) ? ease * 1.6 : ease
      g.steer += Math.max(-toward * STEP, Math.min(toward * STEP, want - g.steer))
      return { steer: g.steer, throttle: gas ? 1 : 0, brake: brake ? 1 : 0 }
    }

    const finishLap = (g: Game) => {
      const run = g.run
      const time = run.lapTime!
      const kept = keptLap()
      const improved = !kept || time < kept.time
      if (improved) keepLap({ time, splits: [...run.splits], ghost: g.record })
      g.lap = { time, score: hotlapBoardScore(time), splits: [...run.splits], improved }
      sfx(improved ? 'perfect' : 'good')
      haptic('boost')
    }

    let raf = 0
    let alive = true
    let last = performance.now()
    let shown = ''
    /** Frames in a row that failed to draw. */
    let failed = 0

    const loop = (now: number) => {
      if (!alive) return
      // The next frame first, so one that fails to draw can't stop the lap.
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const box = holder.getBoundingClientRect()
      scene.resize(box.width, box.height)
      const g = gameRef.current!
      const run = g.run
      const live = !pausedRef.current

      if (live && g.phase === 'countdown') {
        const before = lightsFor(g)
        g.clock += dt
        const after = lightsFor(g)
        if (after !== before) sfx(after === 4 ? 'good' : 'tap')
        if (g.clock >= LIGHTS_OUT) {
          g.phase = 'racing'
          g.carry = 0
        }
      }
      if (live && (g.phase === 'racing' || g.phase === 'finished' || g.phase === 'gameover')) {
        g.carry += dt
        while (g.carry >= STEP) {
          g.carry -= STEP
          const racing = g.phase === 'racing'
          const input = racing ? controls(g) : { steer: 0, throttle: 0, brake: 0.35 }
          const bumpedBefore = run.bumped
          const wasCut = run.cut
          if (racing && g.steps % GHOST_EVERY === 0) g.record.push(run.x, run.y, run.h)
          stepRun(run, input, track)
          g.steps += 1
          g.t += STEP
          if (run.bumped > 0 && bumpedBefore === 0) {
            scene.bump()
            haptic('hit')
          }
          if (run.cut && !wasCut) {
            sfx('miss')
            say('You cut the track, so this lap won’t count. Restart to go again.', 6)
          }
          if (run.finished && racing) {
            g.phase = 'finished'
            g.clock = 0
            finishLap(g)
          }
        }
      }
      if (live && g.phase === 'finished') {
        g.clock += dt
        // The card opens by itself, so a stray press can't start another lap first.
        if (g.clock >= CARD_AFTER) {
          g.phase = 'gameover'
          saveOpenRef.current = true
          setSaveOpen(true)
          clearThumbs()
        }
      }

      const pose = g.phase === 'menu' ? null : g.ghost.at(g.t)
      try {
        scene.frame(
          { run, showroom: g.phase === 'menu', driving: g.phase !== 'menu' && g.phase !== 'countdown', ghost: pose, cardAside: wide.matches },
          live ? dt : 0,
        )
        failed = 0
      } catch (err) {
        // A phone can take the 3D context back (memory, a long time in the background); three.js stops
        // drawing until it's restored, though a frame or two can fail first. If drawing never comes back, say so.
        failed += 1
        if (failed === 1) console.warn('Hot Lap: a frame failed to draw', err)
        if (failed > 120) {
          alive = false
          setNoGl(true)
          return
        }
      }
      map?.draw(run.x, run.y, pose)
      const keys = keysRef.current
      const gasDown = !autopilot.current && (keys.gas || padRef.current.gas)
      sound.update(
        run,
        g.phase === 'racing' ? (gasDown ? 1 : 0) : g.phase === 'countdown' && gasDown ? 0.8 : 0,
        g.phase === 'countdown',
        live && (g.phase === 'countdown' || g.phase === 'racing' || g.phase === 'finished'),
      )
      if (clockRef.current) {
        const text = formatLap(g.lap ? g.lap.time : g.phase === 'racing' ? run.time : 0)
        if (clockRef.current.textContent !== text) clockRef.current.textContent = text
      }
      if (speedRef.current) {
        const text = String(Math.round(run.v * 2.237))
        if (speedRef.current.textContent !== text) speedRef.current.textContent = text
      }

      // The rest of the heads-up changes only when something happens: the lights, a sector, the ghost.
      const next = snapshot(g)
      const key = `${next.phase}|${next.lights}|${next.splits.length}|${next.cut}|${next.ahead}`
      if (key !== shown) {
        shown = key
        setUi(next)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      dark.removeEventListener?.('change', retheme)
      themeWatch.disconnect()
      sound.dispose()
      soundRef.current = null
      scene.dispose()
      canvas.remove()
      sceneRef.current = null
    }
  }, [])

  // The keys: held while down; a lap starts from the card on Space or Enter, and R starts it again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (saveOpenRef.current || pausedRef.current) return
      const g = gameRef.current!
      if (g.phase === 'menu') {
        if (e.code !== 'Space' && e.code !== 'Enter') return
        e.preventDefault()
        if (!e.repeat && performance.now() >= startGrace.current) start()
        return
      }
      if (!IN_RUN.has(g.phase)) return
      const held = KEYS[e.code]
      if (held) {
        // While driving, Space is the brake: a button still focused from a click mustn't take it too.
        e.preventDefault()
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
        keysRef.current[held] = true
      } else if (e.code === 'KeyR' && !e.repeat) {
        e.preventDefault()
        restart()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      const held = KEYS[e.code]
      if (held) keysRef.current[held] = false
    }
    const letGo = () => {
      keysRef.current = { ...NONE }
      clearThumbs()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', letGo)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', letGo)
    }
  })

  // Paused: nothing held carries over into the lap when it resumes.
  useEffect(() => {
    if (!paused) return
    keysRef.current = { ...NONE }
    clearThumbs()
  }, [paused])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    const query = matchMedia(NARROW)
    const update = () => setNarrow(query.matches)
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  // Dev only: read the lap, or let the pace driver take the wheel, for a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __hotlap?: () => Game
      __hotlapScene?: () => HotLapScene | null
      __hotlapAuto?: (on?: boolean) => void
      __hotlapStart?: () => void
    }
    w.__hotlap = () => gameRef.current!
    w.__hotlapScene = () => sceneRef.current
    w.__hotlapAuto = (on = true) => {
      autopilot.current = on ? botDriver(hotlapCourse().track) : null
    }
    w.__hotlapStart = () => start()
    return () => {
      delete w.__hotlap
      delete w.__hotlapScene
      delete w.__hotlapAuto
      delete w.__hotlapStart
    }
  })

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    // Only the start card starts a lap from a tap; the end of one waits for its card.
    if (gameRef.current!.phase !== 'menu') return
    e.preventDefault()
    if (performance.now() >= startGrace.current) start()
  }

  /* Touch: each thumb on a side is one control, and sliding across that side changes which. */
  const readThumbs = () => {
    const on: Held = { ...NONE }
    for (const what of fingersRef.current.values()) on[what] = true
    padRef.current = on
    setPads(on)
  }
  const thumbZone = (a: keyof Held, b: keyof Held) => {
    const pick = (e: ReactPointerEvent<HTMLDivElement>) => {
      const [first, second] = Array.from(e.currentTarget.querySelectorAll('.hotlap__btn'))
      if (!first || !second) return a
      const split = (first.getBoundingClientRect().right + second.getBoundingClientRect().left) / 2
      return e.clientX < split ? a : b
    }
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        fingersRef.current.set(e.pointerId, pick(e))
        readThumbs()
      },
      onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!fingersRef.current.has(e.pointerId)) return
        const now = pick(e)
        if (fingersRef.current.get(e.pointerId) === now) return
        fingersRef.current.set(e.pointerId, now)
        readThumbs()
      },
      onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
        fingersRef.current.delete(e.pointerId)
        readThumbs()
      },
      onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => {
        fingersRef.current.delete(e.pointerId)
        readThumbs()
      },
      onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!fingersRef.current.delete(e.pointerId)) return
        readThumbs()
      },
    }
  }

  const g = gameRef.current!
  const chased = g.ghost.lap.splits
  const sectors = [0, 1, 2].map((k) => sectorFigure(k, ui.splits, chased))
  const latest = Math.max(0, ui.splits.length - 1)
  const best = Math.max(apiBest, 0)
  const bestText = best > 0 ? formatLap(hotlapMsFromBoardScore(best) / 1000) : '–'
  const showroom = ui.phase === 'menu'
  const lap = g.lap
  const medal = lap ? medalFor(lap.time) : null
  const extra = <Targets ghost={g.ghost.lap.time} best={best > 0 ? hotlapMsFromBoardScore(best) / 1000 : null} />

  return (
    <section
      className={`hotlap hotlap--fullscreen${showroom ? ' hotlap--showroom' : ''}${touch ? ' hotlap--touch' : ''}`}
      style={gameAccentStyle(SLUG)}
    >
      <div className="game-play">
        <GameStage aspectWidth={16} aspectHeight={9} fill>
          <div className="hotlap__play" onPointerDown={onPointerDown}>
            <div ref={holderRef} className="hotlap__holder" />

            <GamePlayChrome slug={SLUG} inRun={() => IN_RUN.has(gameRef.current!.phase)} paused={paused}>
              {inRun && !paused ? (
                <button
                  type="button"
                  className="game-pause-btn"
                  aria-label="Restart the lap (R)"
                  title="Restart (R)"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.currentTarget.blur()
                    restart()
                  }}
                >
                  <svg className="game-pause-btn__icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M4.2 4.5v4.3h4.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}
              {pausable || paused ? <PauseButton paused={paused} onToggle={togglePause} /> : null}
            </GamePlayChrome>

            {!showroom ? (
              <PlayReadout>
                <PlayReadoutScore className={`hotlap__clock${ui.ahead === true ? ' is-ahead' : ui.ahead === false ? ' is-behind' : ''}`}>
                  <span ref={clockRef}>0.00s</span>
                </PlayReadoutScore>
                <PlayReadoutStats>
                  <PlayStat label="Best" value={bestText} />
                  {(narrow ? [latest] : [0, 1, 2]).map((k) => (
                    <PlayStat
                      key={k}
                      label={`S${k + 1}`}
                      value={<span className={sectors[k]!.tone ? `hotlap__delta--${sectors[k]!.tone}` : undefined}>{sectors[k]!.text}</span>}
                    />
                  ))}
                </PlayReadoutStats>
              </PlayReadout>
            ) : null}

            <canvas ref={mapRef} className="hotlap__map" aria-hidden="true" />

            {!showroom ? (
              <div className="hotlap__speed" aria-hidden="true">
                <b ref={speedRef}>0</b>
                <span>mph</span>
              </div>
            ) : null}

            {ui.lights > 0 && !paused ? (
              <div className={`hotlap__lights${ui.lights === 4 ? ' is-go' : ''}`} role="status" aria-label={ui.lights === 4 ? 'Go' : 'Ready'}>
                {[1, 2, 3].map((k) => (
                  <i key={k} className={ui.lights === 4 || ui.lights >= k ? 'is-on' : undefined} />
                ))}
              </div>
            ) : null}

            {toast && !paused && !saveOpen ? (
              <div className="hotlap__toast" role="status">
                {toast}
              </div>
            ) : null}

            {touch && inRun && !paused ? (
              <div className="hotlap__pad">
                <div className="hotlap__zone hotlap__zone--steer" {...thumbZone('left', 'right')}>
                  <span className={`hotlap__btn${pads.left ? ' is-on' : ''}`} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.5 4.5 6 12l9.5 7.5z" />
                    </svg>
                  </span>
                  <span className={`hotlap__btn${pads.right ? ' is-on' : ''}`} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8.5 4.5 18 12l-9.5 7.5z" />
                    </svg>
                  </span>
                </div>
                <div className="hotlap__zone hotlap__zone--pedals" {...thumbZone('brake', 'gas')}>
                  <span className={`hotlap__btn hotlap__btn--brake${pads.brake ? ' is-on' : ''}`}>Brake</span>
                  <span className={`hotlap__btn hotlap__btn--gas${pads.gas ? ' is-on' : ''}`}>Gas</span>
                </div>
              </div>
            ) : null}

            {noGl ? (
              <div className="hotlap__nogl">
                <p>Hot Lap is drawn in 3D, and this browser can’t draw 3D (WebGL is off or missing).</p>
              </div>
            ) : null}

            <div className="hotlap__overlay">
              <GamePauseOverlay
                slug={SLUG}
                personalBest={inRun ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
                extraMeta={extra}
              />
              {showroom && !saveOpen && !paused && !noGl ? <GameStartCard title="Hot Lap" slug={SLUG} extraMeta={extra} /> : null}
              {ui.phase === 'gameover' && saveOpen && lap ? (
                tournament ? (
                  <TournamentScoreCard tournamentId={tournament.tournamentId} gameSlug={SLUG} score={lap.score} onDone={toMenu} />
                ) : (
                  <ScoreSaveCard
                    gameSlug={SLUG}
                    score={lap.score}
                    title={medal ? `${medal.name} time` : 'Lap complete'}
                    subtitle={`Sectors ${lap.splits.map((at, k) => (at - (k === 0 ? 0 : lap.splits[k - 1]!)).toFixed(2)).join(' · ')}`}
                    previousBest={Math.max(previousBestRef.current, apiBest)}
                    onDone={toMenu}
                  />
                )
              ) : null}
            </div>
          </div>
        </GameStage>
      </div>
    </section>
  )
}
