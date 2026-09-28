import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import '../../styles/halffull.css'
import { GamePlayChrome } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { HapticsToggle } from '../../components/HapticsToggle'
import { MusicToggle } from '../../components/MusicToggle'
import { ScoreGuide } from '../../components/ScoreGuide'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { copyText } from '../../components/ShareBoardButton'
import { SoundPackSelect } from '../../components/SoundPackSelect'
import { SoundToggle } from '../../components/SoundToggle'
import { isGameListed } from '../../data/games'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { gameArchiveHref } from '../../hooks/useHashRoute'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { usePlayerName } from '../../hooks/usePlayerName'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { noteRunBegun } from '../../lib/engagement'
import { haptic } from '../../lib/haptics'
import { normalizePlayerName } from '../../lib/leaderboard'
import { ordinal } from '../../lib/profileMath'
import { beginRun, resumeRun, runIdFor } from '../../lib/runSession'
import { sfx } from '../../lib/sound'
import {
  dayDone,
  dayRun,
  dayTag,
  keptResults,
  msUntilNextDay,
  pourDay,
  shareText,
  subscribePourDay,
  updateDayRun,
  weekdayShort,
  type DayRun,
} from './daily'
import {
  AUTO_LOCK,
  RING_AT,
  canLock,
  createState,
  isSplitRound,
  lock,
  moveLevel,
  nextRound,
  skipTip,
  startRun,
  stepLevel,
  summarize,
  tick,
  type GameState,
  type Phase,
  type PourResult,
} from './game'
import { absVolume, levelForAbsVol } from './glasses'
import { glassOwner, guestFor, guestName } from './looks'
import { dayPlan, ROUNDS, splitLevelB, type DayPlan } from './plan'
import { dragSpan, renderHalfFull, splitDragSpan, splitGlassAt, splitLevels, type View } from './render'
import { formatBoard, formatOff, formatPercent, formatPoints, judgeLevels, markFor, tierFor } from './score'
import { useTodayBoard, type TodayBoard } from './todayBoard'

/*
 * Half Full: fill four glasses exactly half full, by what they hold, then share a jug fairly between
 * two friends. A drag anywhere pours (up fills, down takes back), the nudges and the arrow keys do
 * the last little bit, and "That's half" locks it. Then the glass is tipped into a measuring jug. On
 * the split, a drag up on a glass pours into it, as it would on any other, and one sideways pours
 * toward the glass it goes toward.
 *
 * The day's first run is its result and is kept on the device as it goes; after it, or on a past
 * day, the glasses pour again as practice.
 */

const SLUG = 'halffull'
const RESULT_ID = 'halffull-result'

type Snap = {
  phase: Phase
  round: number
  level: number
  armed: boolean
  /** 0 until the auto-lock ring shows, then up to 1 as the clock runs out. */
  ring: number
  moved: boolean
  results: PourResult[]
  practice: boolean
}

function snapOf(s: GameState, moved: boolean): Snap {
  return {
    phase: s.phase,
    round: s.round,
    level: s.level,
    armed: canLock(s),
    ring: s.phase === 'pour' && s.roundT >= RING_AT ? Math.min(1, (s.roundT - RING_AT) / (AUTO_LOCK - RING_AT)) : 0,
    moved,
    results: s.results.slice(),
    practice: s.practice,
  }
}

type Safe = { top: number; bottom: number }

/**
 * Kept clear of the glasses: the prompt at the top, the controls at the bottom (px). On a phone with a
 * notch or a home bar, the prompt and the controls move in by the safe area (styles/halffull.css), and
 * the counter moves with them.
 */
function insets(h: number, safe: Safe) {
  return {
    top: Math.round(Math.min(118, Math.max(84, h * 0.11)) + Math.max(0, safe.top - 7)),
    bottom: Math.round(Math.min(124, Math.max(92, h * 0.135)) + Math.max(0, safe.bottom - 12)),
  }
}

/** Above the buttons, clear of the ring that closes round "That's half" (7 px) and of a glass's shadow. */
const OVER_BUTTONS = 15

function isGoKey(e: KeyboardEvent) {
  return e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter'
}

function prefersStill() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useDayRun(day: string): DayRun | null {
  const [run, setRun] = useState(() => dayRun(day))
  useEffect(() => {
    setRun(dayRun(day))
    return subscribePourDay(() => setRun(dayRun(day)))
  }, [day])
  return run
}

export function HalfFullGame({ testDay = null }: { testDay?: string | null }) {
  // Today moves on at midnight (checked below); a past day from the archive is always practice.
  const [today, setToday] = useState(pourDay)
  const day = testDay ?? today
  const pastDay = testDay != null
  const plan = useMemo(() => dayPlan(day), [day])
  const run = useDayRun(day)
  const kept = useMemo(() => keptResults(plan, run), [plan, run])

  const stateRef = useRef<GameState>(createState(plan))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playRef = useRef<HTMLDivElement>(null)
  const safeRef = useRef<HTMLDivElement>(null)
  const safe = useRef<Safe>({ top: 0, bottom: 0 })
  /** How far up from the bottom the button row reaches, as laid out (0 until it's been measured). */
  const buttons = useRef(0)
  const movedRef = useRef(false)
  const [ui, setUi] = useState<Snap>(() => snapOf(stateRef.current, false))
  const handled = useRef(0)
  const stamped = useRef(-1)
  const shownAt = useRef(0)
  const soundAt = useRef(0)
  /**
   * A drag under way: the round it began in, where it began and last was, and on the split which glass it
   * began on and which way it goes (up and down or sideways, decided once it has gone a few pixels).
   */
  const drag = useRef<{
    id: number
    round: number
    x: number
    y: number
    sx: number
    sy: number
    glass: 'a' | 'b'
    axis: 'x' | 'y' | null
  } | null>(null)
  const fontRef = useRef('system-ui, sans-serif')
  /** The counted run this page is playing, by when it began: a lock is kept only onto that run. */
  const pageRun = useRef<number | null>(null)
  /** The counted run this page opened on the API, by when it began: its id may still be on the way. */
  const openedRun = useRef<number | null>(null)
  /** A finished first pour put on the board late, from the day's card (played signed out, or its save never landed). */
  const [lateSave, setLateSave] = useState(false)
  /** Saves that have had their answer: the day's card reads the board again after each. */
  const [settledSaves, setSettledSaves] = useState(0)
  const noteSaved = useCallback(() => setSettledSaves((n) => n + 1), [])
  const apiBest = usePersonalBest(SLUG)
  const me = normalizePlayerName(usePlayerName())
  // Nothing goes on a board while the game is on deck, but in the dev build.
  const saves = isGameListed(SLUG) || import.meta.env.DEV
  // Read for the day's card, not glass by glass: again once the day's pour has moved on, or gone on late.
  const board = useTodayBoard(
    pastDay || !saves || ui.phase !== 'menu' ? null : today,
    me,
    `${run?.levels.length ?? 0}|${run?.board ?? ''}|${lateSave}|${settledSaves}`,
  )

  const refresh = useCallback(() => setUi(snapOf(stateRef.current, movedRef.current)), [])

  const viewOf = useCallback((w: number, h: number, time: number): View => {
    // Until the row has been laid out, what the stylesheet makes it: 0.75rem (or the home bar) under a
    // 3.6rem button.
    const row = buttons.current || Math.max(12, safe.current.bottom) + 58
    return { w, h, ...insets(h, safe.current), clear: row + OVER_BUTTONS, font: fontRef.current, time }
  }, [])

  /** Keep the counted run's pours on the device as they lock, and sound each one. */
  const settle = useCallback(() => {
    const s = stateRef.current
    while (handled.current < s.results.length) {
      const r = s.results[handled.current]!
      handled.current += 1
      if (!s.practice) {
        const at = handled.current - 1
        let keptIt = false
        updateDayRun(s.plan.day, (prev) => {
          // Only onto the run this page began, glass by glass: another tab's run, or one cleared, isn't this.
          if (!prev || prev.startedAt !== pageRun.current || prev.levels.length !== at) return prev
          keptIt = true
          return { ...prev, levels: [...prev.levels, r.level], auto: [...prev.auto, r.auto] }
        })
        // Something else has the day's run now, so this one plays on as practice.
        if (!keptIt) s.practice = true
      }
      sfx('whoosh')
      haptic('hit')
      if (s.phase === 'tip' && prefersStill()) {
        skipTip(s)
        shownAt.current = performance.now()
      }
    }
    const t = s.tipT
    if ((s.phase === 'tip' && t >= 2.05) || s.phase === 'shown') {
      if (stamped.current !== s.round && s.results[s.round]) {
        stamped.current = s.round
        const score = s.results[s.round]!.score
        sfx(score >= 96 ? 'perfect' : score >= 80 ? 'good' : score >= 60 ? 'hop' : 'miss')
      }
    }
  }, [])

  /**
   * Go on under a counted run's id: the one kept on the device, or, while that isn't back yet, the one this
   * page asked the API for (which the device's blank would otherwise overwrite).
   */
  const keepRun = useCallback((r: DayRun) => {
    if (r.runId || openedRun.current !== r.startedAt) resumeRun(SLUG, r.runId)
  }, [])

  const begin = useCallback(
    (practice: boolean) => {
      // A card left up past midnight: show the new day's first.
      const now = pourDay()
      if (!testDay && now !== today) {
        setToday(now)
        return
      }
      let done: PourResult[] = []
      pageRun.current = null
      if (!practice) {
        if (run) {
          // A first pour left halfway carries on under the id it was opened with.
          pageRun.current = run.startedAt
          done = kept
          keepRun(run)
        } else {
          // Today's first pour, the one that counts: opened on the API and kept on the device as it goes.
          const startedAt = Date.now()
          pageRun.current = startedAt
          openedRun.current = startedAt
          beginRun(SLUG)
          updateDayRun(day, () => ({ startedAt, levels: [], auto: [] }))
          // Kept whenever it comes, even after the fifth glass: a late save goes under it.
          void runIdFor(SLUG).then((runId) => {
            if (runId) updateDayRun(day, (r) => (r && r.startedAt === startedAt && !r.runId ? { ...r, runId } : r))
          })
        }
      } else {
        // Practice opens nothing on the API: a run there would make the day's real first pour not the first.
        noteRunBegun()
      }
      const s = startRun(plan, practice, done)
      stateRef.current = s
      handled.current = s.results.length
      stamped.current = -1
      movedRef.current = false
      drag.current = null
      refresh()
    },
    [day, keepRun, kept, plan, refresh, run, testDay, today],
  )

  const toMenu = useCallback(() => {
    const now = pourDay()
    if (!testDay && now !== today) setToday(now)
    stateRef.current = createState(plan)
    handled.current = 0
    refresh()
  }, [plan, refresh, testDay, today])

  // Midnight with the page open: between runs, it moves on to the new day's glasses. A run under way
  // finishes on its own day.
  useEffect(() => {
    if (testDay) return
    const t = window.setInterval(() => {
      const now = pourDay()
      const phase = stateRef.current.phase
      if (now !== today && (phase === 'menu' || phase === 'done')) setToday(now)
    }, 30_000)
    return () => window.clearInterval(t)
  }, [testDay, today])

  // The day's glasses changed under the start card: it shows the new ones.
  useEffect(() => {
    const s = stateRef.current
    if (s.plan !== plan && (s.phase === 'menu' || s.phase === 'done')) {
      stateRef.current = createState(plan)
      handled.current = 0
      refresh()
    }
  }, [plan, refresh])

  /** A finished first pour that isn't on the board: save it now, under the run it was opened with. */
  const saveLate = useCallback(() => {
    if (!run || run.levels.length < ROUNDS) return
    keepRun(run)
    setLateSave(true)
  }, [keepRun, run])

  const doLock = useCallback(() => {
    const s = stateRef.current
    if (!lock(s)) return
    drag.current = null
    settle()
    refresh()
  }, [refresh, settle])

  const doNext = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'shown' || performance.now() - shownAt.current < 420) return
    nextRound(s)
    movedRef.current = false
    if ((s.phase as Phase) === 'done') sfx('wave')
    refresh()
  }, [refresh])

  const skip = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'tip') return
    skipTip(s)
    shownAt.current = performance.now()
    settle()
    refresh()
  }, [refresh, settle])

  const nudge = useCallback(
    (steps: number) => {
      const s = stateRef.current
      if (s.phase !== 'pour') return
      stepLevel(s, steps)
      movedRef.current = true
      sfx('tap')
      refresh()
    },
    [refresh],
  )

  // For a test in the dev build: the run's state, to read and to steer.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __halffull?: unknown }
    w.__halffull = { state: () => stateRef.current, refresh }
    return () => {
      delete w.__halffull
    }
  }, [refresh])

  // The safe area, read off a probe the stylesheet pads with it.
  useEffect(() => {
    const read = () => {
      const el = safeRef.current
      if (!el) return
      const cs = getComputedStyle(el)
      safe.current = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 }
    }
    read()
    window.addEventListener('resize', read)
    window.addEventListener('orientationchange', read)
    return () => {
      window.removeEventListener('resize', read)
      window.removeEventListener('orientationchange', read)
    }
  }, [])

  // The frame loop: the clock, the sounds, the picture.
  useEffect(() => {
    fontRef.current = getComputedStyle(document.body).getPropertyValue('--font-display').trim() || 'system-ui, sans-serif'
    let raf = 0
    let last = performance.now()
    let uiAcc = 0
    let lastPhase: Phase = stateRef.current.phase
    let complained = false
    const loop = (now: number) => {
      // The next frame is asked for first, so one that fails to draw can't stop the game.
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = stateRef.current
      tick(s, dt)
      settle()
      if (s.phase !== lastPhase) {
        if (s.phase === 'shown' && lastPhase === 'tip' && s.tipT >= 2.6) shownAt.current = now
        // A pour locked by the clock ends any drag with it.
        if (s.phase !== 'pour') drag.current = null
        lastPhase = s.phase
        uiAcc = 1
      }
      // The glug as it fills, higher as it gets fuller; the count as the jug fills.
      if (now - soundAt.current > 110) {
        if (s.phase === 'pour' && s.flow > 60) {
          soundAt.current = now
          sfx('plink', Math.round((s.level / 1000) * 8))
        } else if (s.phase === 'tip' && s.tipT > 0.55 && s.tipT < 1.7) {
          soundAt.current = now
          sfx('plink', Math.round(((s.tipT - 0.5) / 1.2) * 6))
        }
      }
      uiAcc += dt
      if (uiAcc > 0.07) {
        uiAcc = 0
        setUi(snapOf(s, movedRef.current))
        // Where the button row really is (the home bar, a bigger text size): the counter stays above it.
        const play = playRef.current
        const row = play?.querySelector<HTMLElement>('.halffull__controls')
        if (play && row && play.clientHeight > 0) buttons.current = play.clientHeight - row.offsetTop
      }
      const canvas = canvasRef.current
      const parent = canvas?.parentElement
      const w = parent?.clientWidth || 0
      const h = parent?.clientHeight || 0
      if (canvas && w > 0 && h > 0) {
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
          try {
            renderHalfFull(ctx, s, viewOf(w, h, now / 1000))
          } catch (err) {
            if (!complained) console.error('Half Full: a frame failed to draw', err)
            complained = true
          }
        }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [settle, viewOf])

  // Keys: up and down pour (Shift for a hair), left and right share, Enter or Space locks and goes on.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // A browser's shortcuts stay the browser's.
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('.game-card, [role="dialog"], input, select, textarea')) return
      // A focused button or link answers Enter and Space itself (the lock and Next included).
      if (isGoKey(e) && target?.closest('button, a')) return
      const s = stateRef.current
      if (s.phase === 'pour') {
        const split = isSplitRound(s.round)
        const step = e.shiftKey ? 1 : 5
        const leftToA = s.plan.looks.tallLeft ? 1 : -1
        let steps = 0
        if (!split && (e.code === 'ArrowUp' || e.code === 'KeyW')) steps = step
        else if (!split && (e.code === 'ArrowDown' || e.code === 'KeyS')) steps = -step
        else if (split && (e.code === 'ArrowLeft' || e.code === 'KeyA')) steps = step * leftToA
        else if (split && (e.code === 'ArrowRight' || e.code === 'KeyD')) steps = -step * leftToA
        if (steps) {
          e.preventDefault()
          stepLevel(s, steps)
          movedRef.current = true
          refresh()
          return
        }
        if (isGoKey(e)) {
          e.preventDefault()
          if (!e.repeat) doLock()
        }
        return
      }
      if (!isGoKey(e) || e.repeat) return
      if (s.phase === 'tip') {
        e.preventDefault()
        skip()
      } else if (s.phase === 'shown') {
        e.preventDefault()
        doNext()
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [doLock, doNext, refresh, skip])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = stateRef.current
    if (e.target !== canvasRef.current) return
    // A right or middle click isn't a pour.
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (s.phase === 'tip') {
      skip()
      return
    }
    if (s.phase !== 'pour' || drag.current) return
    e.preventDefault()
    let glass: 'a' | 'b' = 'a'
    const play = playRef.current
    if (isSplitRound(s.round) && play) {
      const rect = play.getBoundingClientRect()
      glass = splitGlassAt(s, viewOf(rect.width, rect.height, 0), e.clientX - rect.left)
    }
    drag.current = { id: e.pointerId, round: s.round, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, glass, axis: null }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* a pointer already gone: the drag ends with it */
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const s = stateRef.current
    if (!d || d.id !== e.pointerId) return
    // A finger still down from an earlier glass doesn't pour into this one.
    if (d.round !== s.round) {
      drag.current = null
      return
    }
    // A mouse that lost its button-up (a context menu took it) is only hovering.
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      drag.current = null
      return
    }
    if (s.phase !== 'pour') return
    const play = playRef.current
    if (!play) return
    const rect = play.getBoundingClientRect()
    const view = viewOf(rect.width, rect.height, 0)
    const span = dragSpan(s, view)
    if (isSplitRound(s.round)) {
      const sp = s.plan.split
      // Up and down or sideways, whichever the drag set out as: a wobble the other way pours nothing.
      if (!d.axis) {
        const tx = e.clientX - d.sx
        const ty = e.clientY - d.sy
        if (tx * tx + ty * ty < 64) return
        d.axis = Math.abs(tx) > Math.abs(ty) ? 'x' : 'y'
      }
      const range = sp.hi - sp.lo
      if (d.axis === 'y') {
        // Up on a glass pours into it, as on the others, and down takes from it: that glass's drink
        // follows the finger evenly, and the other glass gives or takes what it gains or loses. It moves on
        // from where the level is now, so a nudge or a key while the finger's down stays.
        const [lo, hi] = splitLevels(s, d.glass)
        const from = d.glass === 'a' ? s.levelF : splitLevelB(sp, s.levelF)
        const to = Math.min(hi, Math.max(lo, from + ((d.y - e.clientY) / splitDragSpan(s, view, d.glass)) * (hi - lo)))
        const target = d.glass === 'a' ? to : levelForAbsVol(sp.A, sp.sizeA, sp.J - absVolume(sp.B, sp.sizeB, to))
        moveLevel(s, target - s.levelF)
      } else {
        // Sideways pours toward the glass the drag goes toward.
        const toRightIsA = s.plan.looks.tallLeft ? -1 : 1
        moveLevel(s, ((e.clientX - d.x) / span) * range * toRightIsA)
      }
    } else {
      moveLevel(s, ((d.y - e.clientY) / span) * 1000)
    }
    d.x = e.clientX
    d.y = e.clientY
    movedRef.current = true
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null
      refresh()
    }
  }

  const split = isSplitRound(ui.round)
  const result = ui.phase === 'shown' || ui.phase === 'tip' ? ui.results[ui.round] : undefined

  return (
    <section className="halffull halffull--fullscreen" style={gameAccentStyle(SLUG)}>
      <div className="game-play">
        <GameStage aspectWidth={1} aspectHeight={1.6} fill>
          <div
            ref={playRef}
            className="halffull__play"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onContextMenu={(e) => e.preventDefault()}
          >
            <canvas ref={canvasRef} className="halffull__canvas" />
            <div ref={safeRef} className="halffull__safe" aria-hidden="true" />
            <GamePlayChrome
              slug={SLUG}
              inRun={() => {
                const phase = stateRef.current.phase
                return phase === 'pour' || phase === 'tip' || phase === 'shown'
              }}
            />

            {ui.phase === 'pour' || ui.phase === 'tip' || ui.phase === 'shown' ? (
              <Prompt plan={plan} ui={ui} result={ui.phase === 'shown' ? result : undefined} />
            ) : null}

            {ui.phase === 'pour' && !ui.moved ? (
              <p className={`halffull__hint${split ? ' halffull__hint--split' : ''}`} aria-hidden="true">
                {split ? 'Drag up on a glass to pour into it' : ui.round === 0 ? 'Drag up to pour' : 'Drag up to pour · down to take back'}
              </p>
            ) : null}

            {ui.phase === 'pour' ? (
              <Controls
                split={split}
                tallLeft={plan.looks.tallLeft}
                armed={ui.armed}
                ring={ui.ring}
                onNudge={nudge}
                onLock={doLock}
              />
            ) : null}
            {ui.phase === 'tip' ? <p className="halffull__skip">Tap to skip</p> : null}
            {ui.phase === 'shown' ? (
              <div className="halffull__controls" onPointerDown={(e) => e.stopPropagation()}>
                <button type="button" className="halffull__lock halffull__lock--go" onClick={doNext} aria-describedby={RESULT_ID} autoFocus>
                  {ui.round >= ROUNDS - 1 ? 'See your day' : ui.round === ROUNDS - 2 ? 'Last glass' : 'Next glass'}
                </button>
              </div>
            ) : null}

            <div className="halffull__overlay">
              {ui.phase === 'menu' ? (
                <StartCard
                  plan={plan}
                  run={run}
                  kept={kept}
                  pastDay={pastDay}
                  board={board}
                  saves={saves}
                  onStart={() => begin(pastDay || dayDone(run))}
                  onPractice={() => begin(true)}
                  onSave={saveLate}
                />
              ) : null}
              {ui.phase === 'done' && !ui.practice && !pastDay && saves ? (
                <DaySave plan={plan} results={ui.results} previousBest={apiBest} onDone={toMenu} onSettled={noteSaved} />
              ) : null}
              {lateSave && ui.phase === 'menu' && run && run.levels.length >= ROUNDS ? (
                <DaySave plan={plan} results={kept} previousBest={apiBest} onDone={() => setLateSave(false)} onSettled={noteSaved} />
              ) : null}
              {ui.phase === 'done' && (ui.practice || pastDay || !saves) ? (
                <DayCard
                  plan={plan}
                  results={ui.results}
                  practice={ui.practice}
                  pastDay={pastDay}
                  standing={ui.practice && !pastDay && kept.length >= ROUNDS ? kept : null}
                  onAgain={() => begin(true)}
                  onDone={toMenu}
                />
              ) : null}
            </div>
          </div>
        </GameStage>
      </div>
    </section>
  )
}

/* ---------- the words over the counter ---------- */

function offWords(percent: number, exact: string, under: string, over: string): string {
  const off = formatOff(percent)
  if (off === '0.0') return exact
  return `${off} ${percent < 50 ? under : over}`
}

function Prompt({ plan, ui, result }: { plan: DayPlan; ui: Snap; result?: PourResult }) {
  const split = isSplitRound(ui.round)
  const kicker = split ? `Last glass · ${weekdayShort(plan.day)} · ${plan.label}` : `Glass ${ui.round + 1} of ${ROUNDS} · ${weekdayShort(plan.day)} · ${plan.label}`
  let main: ReactNode
  let sub: ReactNode = null
  if (split) {
    const a = guestName(guestFor(plan, 4))
    const b = guestName(guestFor(plan, 5))
    main = (
      <>
        Share it <em>fairly</em> between {a} and {b}
      </>
    )
    if (result) {
      const pa = result.percent
      const more = pa >= 50 ? a : b
      const big = Math.max(pa, 100 - pa)
      const small = Math.max(0.01, Math.min(pa, 100 - pa))
      main = (
        <>
          {a} {formatPercent(pa)} · {b} {formatPercent(100 - pa)}
        </>
      )
      const morePct = Math.round(100 * (big / small - 1))
      const gotMore = `${more} got ${big / small >= 1.5 ? `${(Math.round((10 * big) / small) / 10).toString()}× as much` : morePct < 1 ? 'a drop more' : `${morePct}% more`}`
      sub = (
        <>
          {formatOff(pa) === '0.0' ? 'Dead even' : gotMore} · <Score result={result} />
        </>
      )
    }
  } else {
    const glass = plan.pours[ui.round]!
    main = (
      <>
        Fill {glassOwner(guestFor(plan, ui.round), glass.name)} <em>half</em> full
      </>
    )
    if (result) {
      main = <>{formatPercent(result.percent)} full</>
      sub = (
        <>
          {offWords(result.percent, 'Exactly half', 'short of half', 'past half')} · <Score result={result} />
        </>
      )
    }
  }
  return (
    <div id={RESULT_ID} className={`halffull__prompt${result ? ' halffull__prompt--result' : ''}`} aria-live="polite">
      <span className="halffull__kicker">{kicker}</span>
      <p className="halffull__main">{main}</p>
      {sub ? <p className="halffull__sub">{sub}</p> : null}
    </div>
  )
}

function Score({ result }: { result: PourResult }) {
  return (
    <strong className={`halffull__score halffull__score--${markClass(result.score)}`}>
      {markFor(result.score)} {formatPoints(result.score)} points{result.auto ? ' (time ran out)' : ''}
    </strong>
  )
}

function markClass(score: number) {
  return score >= 96 ? 'bull' : score >= 90 ? 'green' : score >= 80 ? 'yellow' : score >= 60 ? 'orange' : 'red'
}

/* ---------- the controls ---------- */

/** A button that nudges once when pressed and keeps nudging, twelve a second, while held. */
function Nudge({ label, steps, onNudge, children }: { label: string; steps: number; onNudge: (n: number) => void; children: ReactNode }) {
  const timer = useRef<number | null>(null)
  const stop = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      className="halffull__nudge"
      aria-label={label}
      // A mouse press doesn't take the focus, so Enter afterwards still locks the pour.
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onNudge(steps)
        stop()
        const repeat = () => {
          onNudge(steps)
          timer.current = window.setTimeout(repeat, 1000 / 12)
        }
        timer.current = window.setTimeout(repeat, 380)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={(e) => {
        // A keyboard's press (no pointer): one nudge.
        if (e.detail === 0) onNudge(steps)
      }}
    >
      {children}
    </button>
  )
}

function Controls({
  split,
  tallLeft,
  armed,
  ring,
  onNudge,
  onLock,
}: {
  split: boolean
  tallLeft: boolean
  armed: boolean
  ring: number
  onNudge: (steps: number) => void
  onLock: () => void
}) {
  // The split's level is the tall glass's: the arrow toward it pours into it.
  const toLeft = tallLeft ? 2 : -2
  const words = split ? 'That’s fair' : 'That’s half'
  const left = Math.ceil((AUTO_LOCK - RING_AT) * (1 - ring))
  return (
    <div className="halffull__controls" onPointerDown={(e) => e.stopPropagation()}>
      {split ? (
        <Nudge label="Pour toward the left glass" steps={toLeft} onNudge={onNudge}>
          ◀
        </Nudge>
      ) : (
        <Nudge label="Take a little back" steps={-2} onNudge={onNudge}>
          ▼
        </Nudge>
      )}
      <button
        type="button"
        className={`halffull__lock${armed ? '' : ' halffull__lock--wait'}${ring > 0 ? ' halffull__lock--ring' : ''}`}
        style={ring > 0 ? { ['--ring' as string]: `${Math.round(ring * 360)}deg` } : undefined}
        aria-disabled={!armed}
        aria-label={ring > 0 ? `${words}: it pours itself in ${left} seconds` : undefined}
        onClick={() => armed && onLock()}
      >
        {words}
      </button>
      {split ? (
        <Nudge label="Pour toward the right glass" steps={-toLeft} onNudge={onNudge}>
          ▶
        </Nudge>
      ) : (
        <Nudge label="Pour a little more" steps={2} onNudge={onNudge}>
          ▲
        </Nudge>
      )}
    </div>
  )
}

/* ---------- the cards ---------- */

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div ref={fitCardToSpace} className="game-card halffull-card" style={gameAccentStyle(SLUG)} role="dialog" aria-label={label} onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  )
}

function untilNext(ms: number): string {
  const mins = Math.max(1, Math.floor(ms / 60_000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`
}

function SoundRow() {
  return (
    <div className="game-pause-actions">
      <div className="game-sound-row">
        <SoundToggle className="game-sound--bare" />
        <MusicToggle className="game-sound--bare" />
        <SoundPackSelect />
        <HapticsToggle />
      </div>
      <ScoreGuide slug={SLUG} game="Half Full" style={gameAccentStyle(SLUG)} />
    </div>
  )
}

/** The day's five as squares, each with how full it was. */
function Marks({ results }: { results: readonly PourResult[] }) {
  return (
    <ol className="halffull-card__marks" aria-label="Your five pours">
      {results.map((r, i) => (
        <li key={i} className={`halffull-card__mark halffull-card__mark--${markClass(r.score)}`}>
          <span aria-hidden="true">{markFor(r.score)}</span>
          <small>{r.kind === 'split' ? `${Math.round(r.percent)}:${Math.round(100 - r.percent)}` : formatPercent(r.percent)}</small>
        </li>
      ))}
    </ol>
  )
}

/** Where today stands for everyone, and for you once you're on it. */
function todayWords(board: TodayBoard | null): string | null {
  if (!board) return null
  if (board.you) return `You’re ${ordinal(board.you.place)} of ${board.count}`
  if (!board.leader) return 'Nobody’s poured yet'
  return `${board.leader.name} leads with ${formatBoard(board.leader.score)}`
}

function StartCard({
  plan,
  run,
  kept,
  pastDay,
  board,
  saves,
  onStart,
  onPractice,
  onSave,
}: {
  plan: DayPlan
  run: DayRun | null
  kept: readonly PourResult[]
  pastDay: boolean
  board: TodayBoard | null
  /** Whether a day goes on a board (not while the game is on deck). */
  saves: boolean
  onStart: () => void
  onPractice: () => void
  onSave: () => void
}) {
  const done = !pastDay && dayDone(run)
  const started = !pastDay && kept.length > 0 && !done
  const sum = done && kept.length >= ROUNDS ? summarize(kept) : null
  // Poured on another device: the board has the figure, this device never saw the pours.
  const elsewhere = done && !sum && run?.board != null ? run.board : null
  // A finished first pour the board hasn't got (played signed out, or its save never landed).
  const offBoard = saves && sum != null && board != null && !board.you
  const standing = pastDay ? null : todayWords(board)
  return (
    <Card label="Half Full">
      <div className="game-card__head">
        <span className="game-card__kicker">
          {pastDay ? `Half Full ${dayTag(plan.day)}` : `Today’s Pour ${dayTag(plan.day)}`} · {weekdayShort(plan.day)} · {plan.label}
          {pastDay ? ' · a past day' : ''}
        </span>
        <h2 className="game-card__title game-card__title--big">Half Full</h2>
        {/* The rules, which a short screen mustn't drop the way it drops a blurb. */}
        <p className="halffull-card__rules">
          {done
            ? 'That’s your pour for today. New glasses at midnight; pour these again as much as you like, for practice.'
            : started
              ? `Your pour today is waiting at glass ${kept.length + 1} of ${ROUNDS}. The ones you locked are kept.`
              : pastDay
                ? 'A past day’s five glasses, to pour again. Nothing here counts.'
                : 'Fill four glasses half full: by what they hold, not how tall they are. Then share one jug fairly between two friends. Your first pour of the day is your result.'}
        </p>
      </div>
      {sum ? (
        <div className="halffull-card__result">
          <strong>{sum.scoreText}</strong>
          <span>{sum.tier}</span>
        </div>
      ) : elsewhere != null ? (
        <div className="halffull-card__result">
          <strong>{formatBoard(elsewhere)}</strong>
          <span>{tierFor(elsewhere / 100)} · poured on another device</span>
        </div>
      ) : null}
      {sum ? <Marks results={kept} /> : null}
      {standing ? <p className="halffull-card__standing">{standing}</p> : null}
      <SoundRow />
      <div className="game-card__actions">
        {done ? (
          <>
            {offBoard ? (
              <button type="button" className="panel__btn" onClick={onSave}>
                Put it on today’s board
              </button>
            ) : null}
            {sum ? <ShareButton plan={plan} results={kept} autoFocus={!offBoard} ghost={offBoard} /> : null}
            <button type="button" className="panel__btn panel__btn--ghost" onClick={onPractice} autoFocus={!sum}>
              Pour again · doesn’t count
            </button>
          </>
        ) : (
          <button type="button" className="panel__btn" onClick={onStart} autoFocus>
            {started ? 'Carry on' : pastDay ? 'Pour' : 'Start'}
          </button>
        )}
      </div>
      {!pastDay ? <p className="halffull-card__note">New glasses in {untilNext(msUntilNextDay())}</p> : null}
      {saves ? (
        <a className="halffull-card__archive" href={gameArchiveHref(SLUG)}>
          Past days ›
        </a>
      ) : (
        <p className="halffull-card__note">A preview: nothing goes on a board yet.</p>
      )}
    </Card>
  )
}

/**
 * Today's pour on the boards: the site's own run report (place, tickets, the day's record), with the pours
 * sent along for the API to score the day from.
 */
function DaySave({
  plan: planNow,
  results: resultsNow,
  previousBest,
  onDone,
  onSettled,
}: {
  plan: DayPlan
  results: readonly PourResult[]
  previousBest: number
  onDone: () => void
  onSettled: () => void
}) {
  // The day it was poured on, kept: midnight moving the page on mustn't re-score it against the new glasses.
  const [{ plan, results }] = useState(() => ({ plan: planNow, results: resultsNow }))
  const sum = summarize(results)
  const levels = results.map((r) => r.level)
  const pours = { day: plan.day, levels, auto: results.map((r) => r.auto) }
  return (
    <ScoreSaveCard
      gameSlug={SLUG}
      score={judgeLevels(plan, levels).board}
      title={sum.tier}
      subtitle={`Today’s Pour ${dayTag(plan.day)} · ${sum.marks.join('')} · Team Half-${sum.team}`}
      previousBest={previousBest}
      pours={pours}
      shareLine={shareText(plan, results, window.location.origin)}
      onDone={onDone}
      onSettled={onSettled}
    />
  )
}

/** The run's report. Like every game's, its buttons want a fresh press (the run's last tap can't land on them). */
function DayCard({
  plan,
  results,
  practice,
  pastDay,
  standing,
  onAgain,
  onDone,
}: {
  plan: DayPlan
  results: readonly PourResult[]
  practice: boolean
  pastDay: boolean
  standing: readonly PourResult[] | null
  onAgain: () => void
  onDone: () => void
}) {
  const allow = useDeliberatePress()
  const sum = summarize(results)
  const kept = standing ? summarize(standing) : null
  return (
    <Card label={`Half Full: ${sum.scoreText}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          Half Full {dayTag(plan.day)} · {weekdayShort(plan.day)} · {plan.label}
          {practice ? ' · practice' : ''}
        </span>
        <div className="halffull-card__result halffull-card__result--big">
          <strong>{sum.scoreText}</strong>
          <span>{sum.tier}</span>
        </div>
      </div>
      <Marks results={results} />
      <p className="halffull-card__team">
        <strong>Team Half-{sum.team}</strong>
        <span>{sum.team === 'Full' ? 'You poured over half, on the whole.' : 'You stopped short of half, on the whole.'}</span>
      </p>
      <p className="halffull-card__story">{sum.story}</p>
      {practice ? (
        <p className="halffull-card__note">
          {pastDay ? 'A past day: nothing here counts.' : kept ? `Practice: your pour today stands at ${kept.scoreText}.` : 'Practice: it doesn’t count.'}
        </p>
      ) : null}
      <div className="game-card__actions">
        {!practice ? <ShareButton plan={plan} results={results} allow={allow} autoFocus /> : null}
        <button
          type="button"
          className={practice ? 'panel__btn' : 'panel__btn panel__btn--ghost'}
          onClick={(e) => allow(e) && onAgain()}
          autoFocus={practice}
        >
          Pour again · doesn’t count
        </button>
        <button type="button" className="panel__btn panel__btn--ghost" onClick={(e) => allow(e) && onDone()}>
          Done
        </button>
      </div>
    </Card>
  )
}

/** Send the day on: the phone's share sheet, or copied to paste anywhere. */
function ShareButton({
  plan,
  results,
  allow,
  autoFocus = false,
  ghost = false,
}: {
  plan: DayPlan
  results: readonly PourResult[]
  allow?: (e: ReactMouseEvent) => boolean
  autoFocus?: boolean
  /** The quieter button, beside a bigger one. */
  ghost?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const share = (e: ReactMouseEvent) => {
    if (allow && !allow(e)) return
    const text = shareText(plan, results, window.location.origin)
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    if (touch && typeof navigator.share === 'function') {
      navigator.share({ text }).catch(() => {})
      return
    }
    const done = () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => copyText(text) && done())
    else if (copyText(text)) done()
  }
  return (
    <button type="button" className={ghost ? 'panel__btn panel__btn--ghost' : 'panel__btn'} onClick={share} autoFocus={autoFocus}>
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}
