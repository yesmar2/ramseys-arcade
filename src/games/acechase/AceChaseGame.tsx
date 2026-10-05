import '../../styles/acechase.css'
import { useEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { GamePauseOverlay, PauseButton } from '../../components/PauseControls'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { RunLabel } from '../../components/RunLabel'
import { useAccountId } from '../../hooks/useAccountId'
import { dailyTabHref, gameArchiveHref, gameHref, navigate } from '../../hooks/useHashRoute'
import { useGamePause } from '../../hooks/useGamePause'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { archiveDayWords } from '../../lib/archive'
import { currentAccountId } from '../../lib/auth'
import { usePastViewer } from '../../lib/dailyPast'
import type { PastKind } from '../../lib/dailyWords'
import { ownerAccount, ownerOf } from '../../lib/deviceRuns'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { haptic } from '../../lib/haptics'
import { markPastSolved, pastProgress, savePastProgress, solvedHere, subscribePastHoles } from '../../lib/pastHoles'
import type { PastPlay } from '../../lib/pastPlay'
import {
  claimableDay,
  dailyDay,
  dailyServer,
  dayProgress,
  dayResult,
  patternOf,
  recordSolved,
  saveProgress,
  subscribeDaily,
  syncDaily,
  takeUpDay,
  todaysHole,
  type TodaysHole,
} from '../../lib/dailyHole'
import { sfx } from '../../lib/sound'
import {
  createInitialState,
  fastForward,
  putt,
  setAngle,
  setPower,
  skipIntro,
  startGame,
  tick,
  toSnapshot,
  type GameState,
  type Phase,
  type Snapshot,
} from './game'
import { DailyResultCard, DailyStartCard } from './DailyCards'
import { PastResultCard, PastStartCard } from './PastCards'
import { hasHoleResult, nextHoleKind, pastHoleFacts, usePastHoleFigures, type PastHoleFigures } from './pastFigures'
import { TrialResultCard, TrialStartCard } from './TrialCards'
import { AceScene, type View } from './scene'
import { rememberPlayed } from '../../lib/lastPlayed'

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
/** Whether the slopes show while aiming: the player's choice, kept on the device. */
const SLOPES_KEY = 'skermix-acechase-slopes'
const slopesChosen = () => {
  try {
    return localStorage.getItem(SLOPES_KEY) === '1'
  } catch {
    return false
  }
}

const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1)
const readNumber = (s: string) => parseFloat(s.replace('−', '-').replace('+', ''))

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

/**
 * Keep where today's play stands, on the run of the player it began with (`owner`, lib/deviceRuns.ts)
 * whoever is signed in by now, and a bullseye as their result for the day.
 */
function keepDay(today: TodaysHole, owner: string, s: GameState) {
  // Their run so far: one from before runs had owners, carried on signed out, is the signed-out run from here.
  const before = dayProgress(today.day, ownerAccount(owner))
  // What the day already has (its result, whether it's sent, what it paid) stays as it is.
  saveProgress(today.day, owner, {
    ...before,
    tries: s.tries,
    shots: [...s.shots],
    ghosts: s.ghosts.map((g) => [...g]),
    power: s.power,
    angle: s.angle,
  })
  const last = s.shots[s.shots.length - 1]
  if (last?.bull && !before?.solved) recordSolved(today.day, owner, { tries: s.tries, at: Date.now(), pattern: patternOf(s.shots) })
}

/** Keep where a past hole's play stands, on its run's player's, and its first bullseye as their result (lib/pastHoles.ts). */
function keepPast(hole: TodaysHole, owner: string, s: GameState) {
  const before = pastProgress(hole.day, ownerAccount(owner))
  savePastProgress(hole.day, owner, {
    tries: s.tries,
    shots: [...s.shots],
    ghosts: s.ghosts.map((g) => [...g]),
    power: s.power,
    angle: s.angle,
    ...(before?.solved ? { solved: before.solved, sent: before.sent } : {}),
  })
  const last = s.shots[s.shots.length - 1]
  if (last?.bull && !before?.solved) markPastSolved(hole.day, owner, { tries: s.tries, at: Date.now(), pattern: patternOf(s.shots) })
}

/**
 * Ace Chase: Today's Hole in 3D, played with numbers. Set the power and the angle, putt, and see where it
 * stops; the misses say how far off, and the next try is yours to adjust. The ball has to come to rest on
 * the bull.
 *
 * Everyone plays the same hole that day. Every try is kept on the device as it's played, so leaving and
 * coming back carries on the count, and the first bullseye is the day's result: lib/dailyHole.ts keeps
 * it, and signed in sends it up, where the API puts it on Ace Chase's board. After that the hole can be
 * played again for practice, which counts for nothing.
 *
 * A run is its player's (lib/deviceRuns.ts): the account signed in as it begins, or signed out. It's kept
 * and sent as theirs even if someone else signs in before it ends, and another player on the same device
 * starts their own. One played signed out is the one thing another player can take up, here only: carry
 * it on, put it on the board, or sign in with its result card up.
 *
 * The camera is yours between shots (drag, pinch, two fingers, or the Tee, Target and Above buttons).
 * Keys: ↑ ↓ power (Shift for 5), ← → angle (Shift for 1°), Space or Enter to putt, and again to see how
 * a putt ends without watching it all. A tap skips the flyover. P or Escape pauses.
 *
 * With `ahead`, it plays that day's hole ahead of its day, on trial (the admin's): nothing is kept, and a
 * bullseye ends it. With `past`, a day's hole after its day, from its row on Past holes (AceChasePastGame,
 * with its `figures`): the day's own target, and for a player signed in with no result on it yet, every try
 * kept on the device as on its day and the first bullseye on the hole's own board (lib/pastHoles.ts).
 * Signed out, or with a result on it already, it's practice. Either way it's never today's: the chip, the
 * tab's title, the pause card and Leave all say which hole it is, and leaving goes back to its row.
 */
export function AceChaseGame({ ahead, past, figures }: { ahead?: TodaysHole; past?: TodaysHole; figures?: PastHoleFigures }) {
  const apiBest = usePersonalBest(SLUG)
  /** Today's Hole, for the whole visit: a visit that runs past midnight keeps the hole it started on. */
  const todayRef = useRef<TodaysHole | null>(null)
  if (!ahead && !past && !todayRef.current) todayRef.current = todaysHole()
  const today = todayRef.current
  /** A past hole, for the loop to keep its tries. */
  const pastRef = useRef<TodaysHole | null>(past ?? null)
  // Who's looking: the start cards show their own play, and never another account's.
  const viewer = useAccountId()
  /** Whose the counted run under way, or just ended, is: its stamp (lib/deviceRuns.ts); null for practice or a trial. */
  const runOwner = useRef<string | null>(null)
  const [runBy, setRunBy] = useState<string | null>(null)
  // What this device and the API have is read as it's drawn: this asks for a fresh look when either changes.
  const [, refreshDevice] = useReducer((n: number) => n + 1, 0)
  /** A past hole's board, asked again once a result goes on it. */
  const stateRef = useRef<GameState | null>(null)
  // A past hole is played as its day had it, the day's one target; a trial picks a fresh one each go.
  const fresh = () =>
    today
      ? createInitialState(today.def, 'daily')
      : past
        ? createInitialState(past.def, 'daily')
        : createInitialState(ahead!.def, 'test')
  if (!stateRef.current) stateRef.current = fresh()
  /** How many of today's shots are kept on the device. */
  const keptShots = useRef(0)
  const holderRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<AceScene | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const [ui, setUi] = useState<Snapshot>(() => toSnapshot(stateRef.current!))
  const [view, setView] = useState<View | null>('tee')
  const [slopes, setSlopes] = useState(slopesChosen)
  const [noGl, setNoGl] = useState(false)
  const [hint, setHint] = useState(false)
  /** The result card is up: the day's bullseye, or a trial's. */
  const [saveOpen, setSaveOpen] = useState(false)
  const saveOpenRef = useRef(false)
  /** The bullseye whose card has been shown, so each brings it up once. */
  const shownBull = useRef(-1)
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
    canvas.setAttribute(
      'aria-label',
      'The hole, in 3D. Drag to look around; right-drag or two fingers to move; scroll or pinch to zoom; double-tap or double-click a spot to look closer.',
    )
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
      // Today's tries are kept the moment each one ends, however it ended: a skip, a bullseye, a miss. They're
      // kept on the run's own player's, whoever is signed in by now.
      const hole = todayRef.current
      const owner = runOwner.current
      if (hole && owner && s.mode === 'daily' && !s.practice && s.shots.length > keptShots.current) {
        keptShots.current = s.shots.length
        keepDay(hole, owner, s)
      }
      // And a past hole's, the same way.
      const pastHole = pastRef.current
      if (pastHole && owner && s.mode === 'daily' && !s.practice && s.shots.length > keptShots.current) {
        keptShots.current = s.shots.length
        keepPast(pastHole, owner, s)
      }
      // Open the result card the moment the hole's done, so a stray tap can't start another first.
      if (s.phase === 'gameover' && shownBull.current !== s.bulls) {
        shownBull.current = s.bulls
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
    if (sceneRef.current) sceneRef.current.showSlopes = slopes
  }, [slopes])

  // Today's Hole: what this device has done at it, and what the API says about everyone's day.
  useEffect(() => {
    if (!today) return
    const off = subscribeDaily(refreshDevice)
    void syncDaily(true)
    return off
  }, [today])

  // A past hole: what this device has done at it. Nothing goes up: Ace Chase is just for fun, so a past
  // hole keeps no board (data/games.ts Game.ranked).
  useEffect(() => {
    if (!past) return
    const off = subscribePastHoles(refreshDevice)
    refreshDevice()
    return off
  }, [past])

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

  const restart = (practice = false) => {
    const viewerNow = currentAccountId()
    const owner = ownerOf(viewerNow)
    const again = practice || dailyDone()
    // A counted run is its player's, so none starts until the account signed in is known (lib/deviceRuns.ts).
    if ((today || past) && !again && owner === undefined) return
    saveOpenRef.current = false
    setSaveOpen(false)
    startGrace.current = performance.now() + 260
    if (today) {
      // Today's Hole carries on from where the player's own run left it; once they have a result, here or
      // on the board, it's practice.
      const p = dayProgress(today.day, viewerNow)
      const resume = p && !again ? { tries: p.tries, shots: p.shots, ghosts: p.ghosts, power: p.power, angle: p.angle } : null
      stateRef.current = startGame(stateRef.current!, Math.random, resume, again)
      keptShots.current = stateRef.current.shots.length
    } else if (past) {
      // A past hole carries on from where the player left it too; signed out, or with a result on it
      // already, it's practice.
      const p = pastProgress(past.day, viewerNow)
      const resume = p && !again ? { tries: p.tries, shots: p.shots, ghosts: p.ghosts, power: p.power, angle: p.angle } : null
      stateRef.current = startGame(stateRef.current!, Math.random, resume, again)
      keptShots.current = stateRef.current.shots.length
    } else {
      stateRef.current = startGame(stateRef.current!)
    }
    // Stamped as it begins, and kept and sent as theirs to the end, whoever signs in meanwhile.
    runOwner.current = (today || past) && !again ? (owner ?? null) : null
    setRunBy(runOwner.current)
    setView('tee')
    refresh()
  }

  /** Carry on today's run from signed out as the account signed in: it's theirs from here. */
  const takeUp = () => {
    if (today) takeUpDay(today.day)
    restart()
  }

  /** The run that has ended is `owner`'s now: put on the board from signed out by the account signed in. */
  const ownRunAs = (owner: string) => {
    runOwner.current = owner
    setRunBy(owner)
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
    else if (s.phase === 'aim') {
      // Ace Chase opens no run (runSession.ts), so its putts are what count as having played it.
      rememberPlayed('acechase')
      change(putt)
    }
  }
  const pickView = (v: View) => {
    if (stateRef.current!.phase !== 'aim') return
    sceneRef.current?.setView(v)
    setView(v)
  }
  const toggleSlopes = () => {
    const next = !slopes
    setSlopes(next)
    try {
      localStorage.setItem(SLOPES_KEY, next ? '1' : '0')
    } catch {
      /* kept for this visit only */
    }
  }

  /** Today's Hole has the player's result already: their own bullseye here, or one on the board from wherever. */
  const todayDone = () => {
    if (!today) return false
    const told = dailyServer()
    return dayResult(dayProgress(today.day, currentAccountId()), told?.day === today.day ? told.you : undefined) != null
  }

  /**
   * A past hole plays as practice from here: signed out, where nothing is kept, or with the player's result
   * on it already, their own on this device or one on its board or its day's.
   */
  const pastDone = () => {
    if (!past) return false
    const viewerNow = currentAccountId()
    return viewerNow === null || hasHoleResult(figures, solvedHere(past.day, viewerNow))
  }

  /** Today's Hole (or a past one) is done: only its card's buttons play it again, a stray tap doesn't. */
  const dailyDone = () => todayDone() || pastDone()

  /**
   * A tap or a key starts the hole only when that's the one thing to do: not once it's done, not before
   * the account signed in is known, and not while a run from signed out is on offer to take up.
   */
  const tapStarts = () => {
    if (dailyDone()) return false
    const viewerNow = currentAccountId()
    const known = ownerOf(viewerNow) !== undefined
    if (today) return known && (Boolean(dayProgress(today.day, viewerNow)) || !claimableDay(today.day, viewerNow))
    if (past) return known
    return true
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (saveOpenRef.current || pausedRef.current) return
    const s = stateRef.current!
    // A tap at the start card starts the hole; the end of one waits for its card.
    if (s.phase === 'menu') {
      e.preventDefault()
      if (performance.now() >= startGrace.current && tapStarts()) restart()
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
        if (e.target instanceof HTMLButtonElement) return
        e.preventDefault()
        if (e.repeat) return
        if (s.phase === 'menu') {
          if (performance.now() >= startGrace.current && tapStarts()) restart()
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

  // The viewer's own play at the hole, and a run from signed out they may take up, for the start cards.
  const own = today ? dayProgress(today.day, viewer) : null
  const claim = today ? claimableDay(today.day, viewer) : null
  const server = today ? dailyServer() : null
  const pastOwn = past ? pastProgress(past.day, viewer) : null
  // The run that has just ended, as its own player has it, for its result card.
  const ended = today && runBy ? dayProgress(today.day, ownerAccount(runBy)) : null
  const pastEnded = past && runBy ? pastProgress(past.day, ownerAccount(runBy)) : null

  // A past hole: the player's result on it, what the next run does, and so what the screen says about it.
  const pastSolved = past ? solvedHere(past.day, viewer) : null
  const pastHad = hasHoleResult(figures, pastSolved)
  const pastNext: PastKind = nextHoleKind(viewer !== null, pastHad)
  // The chip and the pause card say what the run under way does; before one starts, what it will do.
  const pastRun: PastKind = ui.phase === 'menu' ? pastNext : ui.practice ? 'practice' : 'board'
  const pastFacts =
    past && figures ? pastHoleFacts({ figures, signedIn: viewer !== null, solved: pastSolved, progress: pastNext === 'board' ? pastOwn : null }) : []
  const pastPlay: PastPlay | null = past
    ? { href: dailyTabHref(SLUG, 'past', past.n), kind: pastRun, title: past.def.name, facts: pastFacts }
    : null
  // Today's Hole played again after the day's result: practice, and its chip says so for the whole run, as
  // a past hole's does (Find the Bug and Half Full do the same).
  const todayChip = Boolean(today && ui.practice && ui.phase !== 'menu')
  // Leaving a counted run throws nothing away: each try is kept as it ends, and the run carries on from
  // there. Practice keeps nothing. A trial says what every game says.
  const leaveNote =
    today || past
      ? ui.practice
        ? 'It’s practice: nothing is saved.'
        : 'Your tries so far are kept. Every try counts, so you carry on from here when you come back.'
      : undefined

  return (
    <section
      className={`acechase acechase--fullscreen${cinema ? ' acechase--cinema' : ''}${past || todayChip ? ' acechase--chip' : ''}`}
      style={gameAccentStyle(SLUG)}
    >
      <div className="game-play">
        <GameStage aspectWidth={3} aspectHeight={4} fill>
          <div className="acechase__play" onPointerDown={onPointerDown}>
            <div ref={holderRef} className="acechase__holder" />

            <GamePlayChrome
              slug={SLUG}
              inRun={() => IN_RUN.has(stateRef.current!.phase)}
              paused={paused}
              past={pastPlay}
              leaveNote={leaveNote}
            >
              {pausable || paused ? <PauseButton paused={paused} onToggle={togglePause} /> : null}
            </GamePlayChrome>
            {todayChip ? (
              <div className="play-past">
                <RunLabel kind="practice" slug={SLUG} short className="run-label--hud" />
              </div>
            ) : null}

            <PlayReadout>
              <PlayReadoutScore>{ui.tries}</PlayReadoutScore>
              <PlayReadoutStats>
                {today ? (
                  <PlayStat label={ui.practice ? 'Practice' : 'Today'} value={`#${today.n}`} />
                ) : past ? (
                  <PlayStat label={ui.practice ? 'Practice' : 'Hole'} value={`#${past.n}`} />
                ) : (
                  <PlayStat label="Trial" value={`#${ahead!.n}`} />
                )}
                <PlayStat label="Tries" value={ui.tries} />
              </PlayReadoutStats>
            </PlayReadout>

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
                    <span className="acechase__views-gap" aria-hidden="true" />
                    <button
                      type="button"
                      aria-pressed={slopes}
                      title="Show which way the green runs: dots flow downhill, faster where it's steeper"
                      onClick={toggleSlopes}
                    >
                      Slopes
                    </button>
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
                {touch
                  ? 'Drag to look around · pinch to zoom · two fingers to move · double-tap a spot to look closer'
                  : 'Drag to look around · scroll to zoom · right-drag to move · double-click a spot to look closer'}
              </div>
            ) : null}

            {ui.phase === 'intro' && !paused ? (
              <div className="acechase__banner">
                <strong>{ui.holeName}</strong>
                <span>
                  {today
                    ? `Today’s Hole #${today.n}`
                    : past
                      ? `Past hole #${past.n} · ${archiveDayWords(past.day)}`
                      : `Hole #${ahead!.n}, on trial`}{' '}
                  ·{' '}
                  {touch ? 'tap' : 'click'} to skip
                </span>
              </div>
            ) : null}

            {ui.phase === 'holed' && last?.bull ? (
              <div className="acechase__holed" role="status">
                <strong>Bullseye!</strong>
                <span>{ui.practice ? 'Practice: nothing is saved' : `In ${last.n} ${last.n === 1 ? 'try' : 'tries'}`}</span>
              </div>
            ) : null}

            {noGl ? (
              <div className="acechase__nogl">
                <p>Ace Chase is drawn in 3D, and this browser can’t draw 3D (WebGL is off or missing).</p>
              </div>
            ) : null}

            <div className="acechase__overlay">
              <GamePauseOverlay slug={SLUG} personalBest={apiBest} past={pastPlay} paused={paused} onResume={resume} />
              {today && ui.phase === 'menu' && !saveOpen && !paused && !noGl ? (
                <DailyStartCard
                  hole={today}
                  progress={own}
                  claim={claim}
                  server={server}
                  onStart={() => restart()}
                  onTakeUp={takeUp}
                  onPractice={() => restart(true)}
                />
              ) : null}
              {ahead && ui.phase === 'menu' && !saveOpen && !paused && !noGl ? <TrialStartCard hole={ahead} onStart={() => restart()} /> : null}
              {past && figures && ui.phase === 'menu' && !saveOpen && !paused && !noGl ? (
                <PastStartCard
                  hole={past}
                  kind={pastNext}
                  facts={pastFacts}
                  progress={pastOwn}
                  hadResult={pastHad}
                  onStart={() => restart(pastNext === 'practice')}
                />
              ) : null}
              {past && figures && ui.phase === 'gameover' && saveOpen ? (
                <PastResultCard
                  hole={past}
                  tries={last?.n ?? ui.tries}
                  practice={ui.practice}
                  solved={pastEnded?.solved ? { ...pastEnded.solved, sent: pastEnded.sent } : null}
                  own={pastSolved}
                  owner={runBy}
                  figures={figures}
                  next={pastNext}
                  onSent={() => figures.refresh()}
                  onAgain={() => restart(pastNext === 'practice')}
                />
              ) : null}
              {today && ui.phase === 'gameover' && saveOpen ? (
                <DailyResultCard
                  hole={today}
                  progress={ended}
                  own={own}
                  server={server}
                  practice={ui.practice}
                  owner={runBy}
                  onTakenUp={ownRunAs}
                  onPractice={() => restart(true)}
                  onLeave={() => navigate(gameHref(SLUG))}
                />
              ) : null}
              {ahead && ui.phase === 'gameover' && saveOpen ? (
                <TrialResultCard
                  hole={ahead}
                  tries={last?.n ?? ui.tries}
                  onAgain={() => restart()}
                  onLeave={() => navigate(ahead.day < dailyDay() ? gameArchiveHref(SLUG) : gameHref(SLUG))}
                />
              ) : null}
            </div>
          </div>
        </GameStage>
      </div>
    </section>
  )
}

/**
 * A past hole, from its row on Past holes: how its day went and its board, asked for the visit, and the
 * hole played. Asked by the tag the past tab asks by (none signed out), so what it has just shown is here
 * at once.
 */
export function AceChasePastGame({ hole }: { hole: TodaysHole }) {
  const viewer = usePastViewer()
  const figures = usePastHoleFigures(hole, viewer.name)
  return <AceChaseGame past={hole} figures={figures} />
}
