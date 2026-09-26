import '../../styles/acechase.css'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AdminWaveSkip } from '../../components/AdminWaveSkip'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GameStartCard } from '../../components/GameStartCard'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { TournamentScoreCard } from '../../components/TournamentScoreCard'
import { gameHref, navigate } from '../../hooks/useHashRoute'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { haptic } from '../../lib/haptics'
import { getPersonalBest } from '../../lib/personalBest'
import { clearRunAchievements } from '../../lib/runAchievements'
import {
  dailyServer,
  dayProgress,
  patternOf,
  recordSolved,
  saveProgress,
  subscribeDaily,
  syncDaily,
  todaysHole,
  type DailyServer,
  type DayProgress,
  type TodaysHole,
} from '../../lib/dailyHole'
import { beginRun } from '../../lib/runSession'
import { sfx } from '../../lib/sound'
import { useTournamentPlay } from '../../tournaments/TournamentPlayContext'
import {
  createInitialState,
  fastForward,
  HOLE_POINTS,
  HOLES,
  jumpToHole,
  putt,
  setAngle,
  setPower,
  skipIntro,
  startGame,
  tick,
  toSnapshot,
  totalTries,
  type GameState,
  type Phase,
  type Snapshot,
} from './game'
import { DailyResultCard, DailyStartCard } from './DailyCards'
import { TrialResultCard, TrialStartCard } from './TrialCards'
import type { HoleDef } from './physics'
import { AceScene, type View } from './scene'

const SLUG = 'acechase'
const IN_RUN = new Set<Phase>(['intro', 'aim', 'roll', 'missed', 'return', 'holed'])
/** While these are on, the panels step aside for the view. */
const CINEMA = new Set<Phase>(['menu', 'intro', 'holed', 'gameover'])
const VIEWS: readonly [View, string][] = [
  ['tee', 'Tee'],
  ['target', 'Target'],
  ['top', 'Above'],
]
const touchScreen = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1)
const readNumber = (s: string) => parseFloat(s.replace('−', '-').replace('+', ''))

/** "9 tries: 3 · 4 · 2", hole by hole. */
function roundLabel(results: Snapshot['results']) {
  const n = totalTries(results)
  return `${n} ${n === 1 ? 'try' : 'tries'}: ${results.map((r) => r.tries || '–').join(' · ')}`
}

/** A hole's points, said the way the card says them. */
function holedLabel(tries: number) {
  const points = Math.round(HOLE_POINTS / Math.max(1, tries))
  return `+${points} · ${tries === 1 ? 'first try' : `${tries} tries`}`
}

/**
 * A stepper: tap for a fine step; hold and it runs, faster the longer it's held.
 */
function Stepper({ label, glyph, onStep, disabled }: { label: string; glyph: string; onStep: (steps: number) => void; disabled: boolean }) {
  const timers = useRef({ hold: 0, again: 0, n: 0 })
  const stop = () => {
    window.clearTimeout(timers.current.hold)
    window.clearTimeout(timers.current.again)
  }
  useEffect(() => stop, [])
  useEffect(() => {
    if (disabled) stop()
  }, [disabled])
  return (
    <button
      type="button"
      className="acechase__step"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const t = timers.current
        t.n = 0
        onStep(1)
        const run = () => {
          t.n++
          onStep(t.n > 24 ? 10 : t.n > 10 ? 4 : 1)
          t.again = window.setTimeout(run, 70)
        }
        t.hold = window.setTimeout(run, 380)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onStep(1)
        }
      }}
    >
      {glyph}
    </button>
  )
}

/**
 * A dial: − and + either side of the number, which can also be typed. The steps are sent as a count, not
 * a new value, so a held button keeps adding to what the dial says now rather than to what it said when
 * the button went down.
 */
function Dial({
  id,
  label,
  hint,
  value,
  format,
  onStep,
  onSet,
  disabled,
}: {
  id: string
  label: string
  hint: string
  value: number
  format: (v: number) => string
  onStep: (steps: number) => void
  onSet: (v: number) => void
  disabled: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const v = readNumber(draft)
    if (Number.isFinite(v)) onSet(v)
    setDraft(null)
  }
  return (
    <div className="acechase__dial" id={`${id}-dial`}>
      <label htmlFor={id}>
        {label} <small>{hint}</small>
      </label>
      <Stepper label={`${label} down`} glyph="−" disabled={disabled} onStep={(k) => onStep(-k)} />
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={draft ?? format(value)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            commit()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            setDraft(null)
            e.currentTarget.blur()
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <Stepper label={`${label} up`} glyph="+" disabled={disabled} onStep={(k) => onStep(k)} />
    </div>
  )
}

/** Keep where today's play stands, and a bullseye as the day's result. */
function keepDay(today: TodaysHole, s: GameState) {
  const before = dayProgress(today.day)
  saveProgress(today.day, {
    tries: s.tries,
    shots: [...s.shots],
    ghosts: s.ghosts.map((g) => [...g]),
    power: s.power,
    angle: s.angle,
    solved: before?.solved,
    sent: before?.sent,
  })
  const last = s.shots[s.shots.length - 1]
  if (last?.bull && !before?.solved) recordSolved(today.day, { tries: s.tries, at: Date.now(), pattern: patternOf(s.shots) })
}

/**
 * Ace Chase: a 3D trick-shot course, played with numbers. Set the power and the angle, putt, and see
 * where it stops; the misses say how far off, and the next try is yours to adjust. The ball has to come
 * to rest on the bull; a hole pays 1000 ÷ the tries it took.
 *
 * The camera is yours between shots (drag, pinch, two fingers, or the Tee, Target and Above buttons).
 * Keys: ↑ ↓ power (Shift for 5), ← → angle (Shift for 1°), Space or Enter to putt, and again to see how
 * a putt ends without watching it all. A plain tap starts a round from the title, and skips a hole's
 * flyover; a finished round waits for its score card. P or Escape pauses.
 *
 * With `daily`, the same page plays Today's Hole: one hole, the same for everyone that day. Every try is
 * kept on the device as it's played, so leaving and coming back carries on the count, and the first
 * bullseye is the day's result (lib/dailyHole.ts keeps it, and sends it up signed in). After that the
 * hole can be played again for practice, which counts for nothing.
 *
 * With `test`, it plays that one hole on trial: nothing is kept, and a bullseye ends it.
 */
export function AceChaseGame({ daily = false, test }: { daily?: boolean; test?: HoleDef }) {
  const tournament = useTournamentPlay()
  const apiBest = usePersonalBest(SLUG)
  /** Today's Hole, for the whole visit: a visit that runs past midnight keeps the hole it started on. */
  const todayRef = useRef<TodaysHole | null>(null)
  if (daily && !todayRef.current) todayRef.current = todaysHole()
  const today = todayRef.current
  const stateRef = useRef<GameState | null>(null)
  const fresh = () => createInitialState(Math.random, today?.def ?? test, today ? 'daily' : test ? 'test' : 'round')
  if (!stateRef.current) stateRef.current = fresh()
  const [progress, setProgress] = useState<DayProgress | null>(() => (today ? dayProgress(today.day) : null))
  const [server, setServer] = useState<DailyServer | null>(() => dailyServer())
  /** How many of today's shots are kept on the device. */
  const keptShots = useRef(0)
  const holderRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<AceScene | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current!))
  const [view, setView] = useState<View | null>('tee')
  const [noGl, setNoGl] = useState(false)
  const [hint, setHint] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  const offeredScore = useRef<number | null>(null)
  const previousBestRef = useRef(getPersonalBest(SLUG))
  const startGrace = useRef(0)
  const toldHowToLook = useRef(false)
  const inRun = IN_RUN.has(ui.phase)
  const pausable = inRun && !saveOpen
  /** Typing in a dial: Escape and P belong to the field, not the pause. */
  const ignorePauseKeys = useRef(false)
  const { paused, toggle: togglePause, resume } = useGamePause(pausable, ignorePauseKeys)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    // A canvas of the scene's own: when it goes, its GL context goes with it, and a remount starts clean.
    const canvas = document.createElement('canvas')
    canvas.className = 'acechase__viewport'
    canvas.setAttribute('aria-label', 'The hole, in 3D. Drag to look around; right-drag or two fingers to move; scroll or pinch to zoom.')
    holder.append(canvas)
    let scene: AceScene
    try {
      scene = new AceScene(canvas)
    } catch {
      canvas.remove()
      setNoGl(true)
      return
    }
    sceneRef.current = scene
    scene.onUserMove = () => setView(null)
    let raf = 0
    let last = performance.now()
    let uiAcc = 0

    const loop = (now: number) => {
      const raw = Math.min(0.25, (now - last) / 1000)
      last = now
      const dt = Math.min(0.05, raw)
      ignorePauseKeys.current = document.activeElement instanceof HTMLInputElement

      // The clear band between the hole's card and the dials, which the camera frames its views in.
      const box = canvas.getBoundingClientRect()
      const card = cardRef.current?.getBoundingClientRect()
      const dock = dockRef.current?.getBoundingClientRect()
      scene.resize(box.width, box.height, {
        top: card ? card.bottom - box.top + 6 : 0,
        bottom: dock ? dock.top - box.top - 6 : box.height,
      })

      if (!pausedRef.current) {
        const before = stateRef.current!
        stateRef.current = tick(before, dt)
        if (before.phase !== 'holed' && stateRef.current.phase === 'holed') haptic('hit')
      }
      const s = stateRef.current!
      // Today's tries are kept the moment each one ends, however it ended: a skip, a bullseye, a miss.
      const hole = todayRef.current
      if (hole && s.mode === 'daily' && !s.practice && s.shots.length > keptShots.current) {
        keptShots.current = s.shots.length
        keepDay(hole, s)
      }
      // Open the score card the moment the round ends, so a stray tap can't start another first.
      if (s.phase === 'gameover' && offeredScore.current !== s.score) {
        offeredScore.current = s.score
        saveOpenRef.current = true
        setSaveOpen(true)
        setUi(toSnapshot(s))
        startGrace.current = performance.now() + 400
      }
      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        setUi(toSnapshot(s))
      }
      scene.frame(s, pausedRef.current ? 0 : raw)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      scene.dispose()
      canvas.remove()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    if (ui.phase === 'menu') previousBestRef.current = apiBest
  }, [apiBest, ui.phase])

  // Today's Hole: what this device has done at it, and what the API says about everyone's day.
  useEffect(() => {
    if (!today) return
    const update = () => {
      setProgress(dayProgress(today.day))
      setServer(dailyServer())
    }
    const off = subscribeDaily(update)
    void syncDaily(true)
    return off
  }, [today])

  // Once, the first time the camera is handed over: how to look round.
  useEffect(() => {
    if (ui.phase !== 'aim' || toldHowToLook.current) return
    toldHowToLook.current = true
    setHint(true)
    const t = window.setTimeout(() => setHint(false), 4200)
    return () => window.clearTimeout(t)
  }, [ui.phase])

  // Dev only: lets a script read and drive the state for a play-test.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as {
      __acechaseScene?: () => AceScene | null
      __acechase?: () => GameState
      __acechasePutt?: (power: number, angle: number, instant?: boolean) => void
      __acechaseSkip?: () => void
      __acechaseTick?: (seconds: number) => void
    }
    w.__acechase = () => stateRef.current!
    w.__acechaseScene = () => sceneRef.current
    w.__acechasePutt = (power, angle, instant = true) => {
      let s = skipIntro(stateRef.current!)
      s = putt(setAngle(setPower(s, power), angle))
      stateRef.current = instant ? fastForward(s) : s
    }
    w.__acechaseSkip = () => {
      stateRef.current = skipIntro(stateRef.current!)
    }
    w.__acechaseTick = (seconds) => {
      for (let t = 0; t < seconds; t += 0.05) stateRef.current = tick(stateRef.current!, 0.05)
    }
    return () => {
      delete w.__acechase
      delete w.__acechaseScene
      delete w.__acechasePutt
      delete w.__acechaseSkip
      delete w.__acechaseTick
    }
  }, [])

  const refresh = () => setUi(toSnapshot(stateRef.current!))

  const restart = (intoMenu = false, practice = false) => {
    saveOpenRef.current = false
    setSaveOpen(false)
    offeredScore.current = null
    previousBestRef.current = getPersonalBest(SLUG)
    startGrace.current = performance.now() + 260
    if (intoMenu) {
      stateRef.current = fresh()
    } else if (today) {
      // Today's Hole carries on from where the device left it; once it's done, it's practice.
      const p = dayProgress(today.day)
      const again = practice || Boolean(p?.solved)
      const resume = p && !again ? { tries: p.tries, shots: p.shots, ghosts: p.ghosts, power: p.power, angle: p.angle } : null
      stateRef.current = startGame(stateRef.current!, Math.random, resume, again)
      keptShots.current = stateRef.current.shots.length
    } else if (test) {
      stateRef.current = startGame(stateRef.current!)
    } else {
      clearRunAchievements()
      beginRun(SLUG)
      stateRef.current = startGame(stateRef.current!)
    }
    setView('tee')
    refresh()
  }

  /**
   * Done with the round: back to the start card rather than into another one. That card is where the
   * numbers a round just changed are shown. No run is opened, so nothing counts until they start one.
   */
  const toMenu = () => restart(true)

  /** Admin and testing: the round in hand moved to a hole. */
  const goToHole = (index: number) => {
    stateRef.current = jumpToHole(stateRef.current!, index)
    refresh()
  }

  const change = (f: (s: GameState) => GameState) => {
    const before = stateRef.current!
    const after = f(before)
    if (after === before) return
    stateRef.current = after
    refresh()
  }

  const dialsLive = ui.phase === 'aim' && !paused && !saveOpen
  /** The dials turn only at the tee, between shots. */
  const dial = (f: (s: GameState) => GameState) => {
    if (stateRef.current!.phase !== 'aim' || pausedRef.current || saveOpenRef.current) return
    const before = stateRef.current
    change(f)
    if (stateRef.current !== before) sfx('click', 1)
  }
  const stepPower = (steps: number) => dial((s) => setPower(s, s.power + steps * 0.5))
  const stepAngle = (steps: number) => dial((s) => setAngle(s, s.angle + steps * 0.1))
  const shoot = () => {
    if (pausedRef.current || saveOpenRef.current) return
    const s = stateRef.current!
    if (s.phase === 'roll') change(fastForward)
    else if (s.phase === 'aim') change(putt)
  }
  const pickView = (v: View) => {
    if (stateRef.current!.phase !== 'aim') return
    sceneRef.current?.setView(v)
    setView(v)
  }

  /** Today's Hole is done: only its card's buttons play it again, a stray tap doesn't. */
  const dailyDone = () => Boolean(today && dayProgress(today.day)?.solved)

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    const s = stateRef.current!
    // Only the title starts a round from a tap; the end of one waits for its score card.
    if (s.phase === 'menu') {
      e.preventDefault()
      if (performance.now() >= startGrace.current && !dailyDone()) restart()
      return
    }
    if (s.phase === 'intro') change(skipIntro)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpenRef.current || pausedRef.current) return
      if (e.target instanceof HTMLInputElement) return
      const s = stateRef.current!
      if (e.code === 'Space' || e.code === 'Enter') {
        // A focused button does its own thing with these.
        if (e.target instanceof HTMLButtonElement && (s.phase !== 'menu' || today || test)) return
        e.preventDefault()
        if (e.repeat) return
        if (s.phase === 'menu') {
          if (performance.now() >= startGrace.current && !dailyDone()) restart()
        } else if (s.phase === 'intro') change(skipIntro)
        else shoot()
        return
      }
      const steps = e.shiftKey ? 10 : 1
      if (e.code === 'ArrowUp') stepPower(steps)
      else if (e.code === 'ArrowDown') stepPower(-steps)
      else if (e.code === 'ArrowRight') stepAngle(steps)
      else if (e.code === 'ArrowLeft') stepAngle(-steps)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const last = ui.shots[ui.shots.length - 1]
  const showMiss = (ui.phase === 'missed' || ui.phase === 'return') && last && !last.bull
  const cinema = CINEMA.has(ui.phase)
  const touch = touchScreen()

  return (
    <section className={`acechase acechase--fullscreen${cinema ? ' acechase--cinema' : ''}`} style={gameAccentStyle(SLUG)}>
      <div className="game-play">
        <GameStage aspectWidth={3} aspectHeight={4} fill>
          <div className="acechase__play" onPointerDown={onPointerDown}>
            <div ref={holderRef} className="acechase__holder" />

            <GamePlayChrome slug={SLUG} inRun={() => IN_RUN.has(stateRef.current!.phase)} paused={paused}>
              {pausable || paused ? <PauseButton paused={paused} onToggle={togglePause} /> : null}
            </GamePlayChrome>

            {today ? (
              <PlayReadout>
                <PlayReadoutScore>{ui.tries}</PlayReadoutScore>
                <PlayReadoutStats>
                  <PlayStat label={ui.practice ? 'Practice' : 'Today'} value={`#${today.n}`} />
                  <PlayStat label="Tries" value={ui.tries} />
                </PlayReadoutStats>
              </PlayReadout>
            ) : test ? (
              <PlayReadout>
                <PlayReadoutScore>{ui.tries}</PlayReadoutScore>
                <PlayReadoutStats>
                  <PlayStat label="Hole" value="Trial" />
                  <PlayStat label="Tries" value={ui.tries} />
                </PlayReadoutStats>
              </PlayReadout>
            ) : (
              <PlayReadout>
                <PlayReadoutScore hot={inRun && ui.score > previousBestRef.current}>{ui.score}</PlayReadoutScore>
                <PlayReadoutStats>
                  <PlayStat label="Hole" value={`${ui.holeIndex + 1}/${HOLES}`} />
                  <PlayStat label="Tries" value={ui.tries} />
                </PlayReadoutStats>
              </PlayReadout>
            )}

            <div className="acechase__hud" aria-hidden={cinema}>
              <div className="acechase__card" ref={cardRef} onPointerDown={(e) => e.stopPropagation()}>
                <div className="acechase__card-head">
                  <h2 className="acechase__name">{ui.holeName}</h2>
                  <div className="acechase__views" role="group" aria-label="Camera">
                    {VIEWS.map(([v, label]) => (
                      <button key={v} type="button" aria-pressed={view === v} disabled={ui.phase !== 'aim'} onClick={() => pickView(v)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {ui.tries === 0 ? <p className="acechase__note">{ui.holeNote}</p> : null}
              </div>

              <div className="acechase__bottom">
                <div className="acechase__log" aria-live="polite">
                  {ui.shots.slice(-4).map((shot, i, all) => (
                    <span key={shot.n} className={`${i === all.length - 1 ? 'is-last' : ''}${shot.bull ? ' is-bull' : ''}`}>
                      #{shot.n} · <b>{shot.power.toFixed(1)}</b> · <b>{signed(shot.angle)}°</b> → {shot.what}
                    </span>
                  ))}
                </div>
                <div className="acechase__dock" ref={dockRef} onPointerDown={(e) => e.stopPropagation()}>
                  <Dial
                    id="acechase-power"
                    label="Power"
                    hint="0–100, steps of 0.5"
                    value={ui.power}
                    format={(v) => v.toFixed(1)}
                    onStep={stepPower}
                    onSet={(v) => dial((st) => setPower(st, v))}
                    disabled={!dialsLive}
                  />
                  <Dial
                    id="acechase-angle"
                    label="Angle"
                    hint="degrees, + is right"
                    value={ui.angle}
                    format={signed}
                    onStep={stepAngle}
                    onSet={(v) => dial((st) => setAngle(st, v))}
                    disabled={!dialsLive}
                  />
                  <button
                    type="button"
                    className={`acechase__putt${ui.phase === 'roll' ? ' is-skip' : ''}`}
                    disabled={!(ui.phase === 'aim' || ui.phase === 'roll') || paused}
                    onClick={shoot}
                  >
                    {ui.phase === 'roll' ? 'Skip ahead' : 'Putt'}
                  </button>
                </div>
              </div>
            </div>

            {showMiss ? (
              <div className="acechase__toast" role="status">
                Try {last.n}: {last.what}
              </div>
            ) : hint && ui.phase === 'aim' ? (
              <div className="acechase__toast acechase__toast--hint" role="status">
                {touch ? 'Drag to look around · pinch to zoom · two fingers to move' : 'Drag to look around · scroll to zoom · right-drag to move'}
              </div>
            ) : null}

            {ui.phase === 'intro' && !paused ? (
              <div className="acechase__banner">
                <strong>{ui.holeName}</strong>
                <span>
                  {today ? `Today’s Hole #${today.n}` : test ? 'A hole on trial' : `Hole ${ui.holeIndex + 1} of ${HOLES}`} · {touch ? 'tap' : 'click'} to skip
                </span>
              </div>
            ) : null}

            {ui.phase === 'holed' && last?.bull ? (
              <div className="acechase__holed" role="status">
                <strong>Bullseye!</strong>
                <span>
                  {today
                    ? ui.practice
                      ? 'Practice: it doesn’t count'
                      : `In ${last.n} ${last.n === 1 ? 'try' : 'tries'}`
                    : test
                      ? `In ${last.n} ${last.n === 1 ? 'try' : 'tries'}`
                      : holedLabel(last.n)}
                </span>
              </div>
            ) : null}

            {noGl ? (
              <div className="acechase__nogl">
                <p>Ace Chase is drawn in 3D, and this browser can’t draw 3D (WebGL is off or missing).</p>
              </div>
            ) : null}

            <div className="acechase__overlay">
              <GamePauseOverlay
                slug={SLUG}
                personalBest={inRun ? previousBestRef.current : apiBest}
                paused={paused}
                onResume={resume}
                tools={
                  inRun && !today && !test ? (
                    <AdminWaveSkip
                      unit="hole"
                      wave={ui.holeIndex + 1}
                      onSkipNext={() => {
                        goToHole(stateRef.current!.holeIndex + 1)
                        resume()
                      }}
                      onJump={(hole) => {
                        goToHole(hole - 1)
                        resume()
                      }}
                    />
                  ) : null
                }
              />
              {today && ui.phase === 'menu' && !saveOpen && !paused && !noGl ? (
                <DailyStartCard hole={today} progress={progress} server={server} onStart={() => restart()} onPractice={() => restart(false, true)} />
              ) : null}
              {test && ui.phase === 'menu' && !saveOpen && !paused && !noGl ? <TrialStartCard def={test} onStart={() => restart()} /> : null}
              {!today && !test && ui.phase === 'menu' && !saveOpen && !paused && !noGl ? (
                <GameStartCard
                  title="Ace Chase"
                  slug={SLUG}
                  tools={
                    <AdminWaveSkip
                      mode="start"
                      unit="hole"
                      onJump={(hole) => {
                        restart()
                        goToHole(hole - 1)
                      }}
                    />
                  }
                />
              ) : null}
              {today && ui.phase === 'gameover' && saveOpen ? (
                <DailyResultCard
                  hole={today}
                  progress={progress}
                  server={server}
                  practice={ui.practice}
                  onPractice={() => restart(false, true)}
                  onLeave={() => navigate(gameHref(SLUG))}
                />
              ) : null}
              {test && ui.phase === 'gameover' && saveOpen ? (
                <TrialResultCard
                  def={test}
                  tries={last?.n ?? ui.tries}
                  onAgain={() => restart()}
                  onLeave={() => navigate(gameHref(SLUG))}
                />
              ) : null}
              {!today && !test && ui.phase === 'gameover' && saveOpen ? (
                tournament ? (
                  <TournamentScoreCard tournamentId={tournament.tournamentId} gameSlug={SLUG} score={ui.score} onDone={toMenu} />
                ) : (
                  <ScoreSaveCard
                    gameSlug={SLUG}
                    score={ui.score}
                    title="Round over"
                    subtitle={roundLabel(ui.results)}
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
