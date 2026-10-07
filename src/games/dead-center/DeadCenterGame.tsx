import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import '../../styles/centroid.css'
import { GamePlayChrome, PlayReadout, PlayReadoutScore } from '../../components/GameHud'
import { GameStage } from '../../components/GameStage'
import { PlayReadoutStats, PlayStat } from '../../components/PlayStats'
import { RunLabel } from '../../components/RunLabel'
import { ScoreSaveCard } from '../../components/ScoreSaveCard'
import { copyText } from '../../components/ShareBoardButton'
import { useAccountId } from '../../hooks/useAccountId'
import { useDeliberatePress } from '../../hooks/useDeliberatePress'
import { usePersonalBest } from '../../hooks/usePersonalBest'
import { currentAccountId } from '../../lib/auth'
import { fitCardToSpace } from '../../lib/cardFit'
import { ownerAccount, ownerOf, SIGNED_OUT } from '../../lib/deviceRuns'
import { eggDone, reportEgg } from '../../lib/eggs'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { haptic } from '../../lib/haptics'
import { beginRun, resumeRun, runIdFor } from '../../lib/runSession'
import {
  claimDayRun,
  dayDone,
  dayTag,
  keepRunId,
  keptScores,
  plateDay,
  shareText,
  subscribePlateDay,
  summarize,
  updateDayRun,
  viewerRuns,
  weekdayShort,
  type DayRun,
} from './daily'
import { PIN_H, THICK, createInitialState, moveCursor, pinAtCursor, setPin, shatter, startDaily, tick, type GameState } from './game'
import { dayPlan, PLATES, type DayPlan } from './plan'
import { formatPoints, judgeTaps, markFor } from './score'
import { renderGame, tablePointAt } from './render'

/** The way on to the next of today's dailies, with the day's ticket it brings. */
const NextDaily = lazy(() => import('../../components/NextDaily'))

const SLUG = 'centroid'

type Arrow = 'left' | 'right' | 'up' | 'down'

const ARROWS: Record<string, Arrow> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
}

function isGoKey(e: KeyboardEvent) {
  return e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter'
}

/** How fast the keyboard's crosshair crosses the table, in table widths a second; Shift slows it for the last bit. */
const CURSOR_SPEED = 0.42
const CURSOR_FINE = 0.1

/** What the page shows over the canvas, a few times a second. */
type Ui = { phase: GameState['phase']; plateNo: number; scores: number[]; practice: boolean }

const uiOf = (s: GameState): Ui => ({ phase: s.phase, plateNo: s.plateNo, scores: s.day ? [...s.day.scores] : [], practice: s.day?.practice ?? false })

/** The counted run under way on this page: when it began, and whose it is (lib/deviceRuns.ts). */
type PageRun = { startedAt: number; owner: string }

/**
 * Centroid, the daily (Ramsey, 2026-10-06: "centroid should be a daily like the fill the cup game"): today's
 * six plates, the same for everyone; tap where each would balance. The day's first run is the result, saved
 * to its board, just for fun (it sits with the puzzles under the Dailies ticket); after it, the plates play
 * again as practice. With `pastDay`, a past day's plates from the game page's Past days, as practice.
 *
 * The run is the player's (lib/deviceRuns.ts): each tap is kept on the device as it lands, so a day left
 * halfway carries on from its plate.
 */
export function DeadCenterGame({ pastDay = null }: { pastDay?: string | null }) {
  const apiBest = usePersonalBest(SLUG)
  const viewer = useAccountId()
  // The day this visit plays: today as the page opened (a visit past midnight keeps its day), or a past one.
  const [day] = useState(() => pastDay ?? plateDay())
  const plan = useMemo(() => dayPlan(day), [day])
  const [, refreshDevice] = useState(0)
  useEffect(() => subscribePlateDay(() => refreshDevice((n) => n + 1)), [])
  const { own: run } = viewerRuns(day, viewer)
  const kept = useMemo(() => keptScores(plan, run), [plan, run])

  const stateRef = useRef<GameState>(createInitialState())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ui, setUi] = useState<Ui>(() => uiOf(stateRef.current))
  const pageRun = useRef<PageRun | null>(null)
  const startGrace = useRef(0)
  const heldRef = useRef<Set<Arrow>>(new Set())
  const fineRef = useRef(false)
  const doneRef = useRef(false)

  /** Each tap of the counted run, kept on the device as it lands. */
  const keepTap = useCallback(() => {
    const s = stateRef.current
    const counted = pageRun.current
    if (!s.day || s.day.practice || !counted) return
    const taps = [...s.day.taps]
    updateDayRun(day, counted.owner, (r) => (r && r.startedAt === counted.startedAt ? { ...r, taps } : r))
  }, [day])

  /** Play the day's plates: as practice, or as the day's first run, the one that counts (carried on if begun). */
  const begin = useCallback(
    (practice: boolean) => {
      const viewerNow = currentAccountId()
      const owner = ownerOf(viewerNow)
      doneRef.current = false
      startGrace.current = performance.now() + 220
      heldRef.current.clear()
      let done: DayRun | null = null
      if (!practice && !pastDay) {
        // A counted run is its player's, so none starts until the account signed in is known.
        if (owner === undefined) return
        const mine = viewerRuns(day, viewerNow).own
        if (mine && dayDone(mine)) {
          practice = true
        } else if (mine) {
          done = mine
          pageRun.current = { startedAt: mine.startedAt, owner }
          if (mine.runId) resumeRun(SLUG, mine.runId)
          else {
            beginRun(SLUG)
            void runIdFor(SLUG).then((id) => id && keepRunId(day, mine.startedAt, id))
          }
        } else {
          const startedAt = Date.now()
          updateDayRun(day, owner, () => ({ startedAt, taps: [] }))
          pageRun.current = { startedAt, owner }
          beginRun(SLUG)
          void runIdFor(SLUG).then((id) => id && keepRunId(day, startedAt, id))
        }
      }
      if (practice || pastDay) pageRun.current = null
      const taps = done?.taps ?? []
      const scores = taps.length ? judgeTaps({ ...plan, plates: plan.plates.slice(0, taps.length) }, taps).scores : []
      stateRef.current = startDaily(stateRef.current, plan, practice || !!pastDay, taps, scores)
      // The egg's clue, the crack round a balanced plate's pin, till this device has broken one.
      stateRef.current.crackHint = !eggDone('shatter')
      setUi(uiOf(stateRef.current))
    },
    [day, pastDay, plan],
  )

  const toMenu = useCallback(() => {
    pageRun.current = null
    doneRef.current = false
    stateRef.current = createInitialState()
    startGrace.current = performance.now() + 300
    setUi(uiOf(stateRef.current))
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let uiAcc = 0
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const held = heldRef.current
      if (held.size > 0) {
        const speed = (fineRef.current ? CURSOR_FINE : CURSOR_SPEED) * dt
        const dx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0)
        const dy = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0)
        if (dx || dy) moveCursor(stateRef.current, dx * speed, dy * speed)
      }
      stateRef.current = tick(stateRef.current, dt)
      const s = stateRef.current
      if (s.phase === 'gameover' && !doneRef.current) {
        doneRef.current = true
        heldRef.current.clear()
        startGrace.current = performance.now() + 400
        setUi(uiOf(s))
      }
      uiAcc += dt
      if (uiAcc > 0.08) {
        uiAcc = 0
        setUi(uiOf(s))
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
          renderGame(ctx, s, w, h)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const drop = () => heldRef.current.clear()
    window.addEventListener('blur', drop)
    return () => window.removeEventListener('blur', drop)
  }, [])

  /** A pin set: kept at once if it's the counted run's. */
  const pinned = useCallback(
    (s: GameState) => {
      if (s.outcome) {
        haptic('hit')
        keepTap()
      }
      setUi(uiOf(s))
    },
    [keepTap],
  )

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = stateRef.current
      if (s.phase === 'menu' || s.phase === 'gameover') return
      if (e.key === 'Shift') fineRef.current = true
      if (isGoKey(e)) {
        e.preventDefault()
        if (e.repeat || s.phase !== 'aiming') return
        pinAtCursor(s)
        pinned(s)
        return
      }
      const arrow = ARROWS[e.code]
      if (!arrow) return
      e.preventDefault()
      heldRef.current.add(arrow)
      if (!e.repeat) {
        const step = fineRef.current ? 0.004 : 0.012
        moveCursor(s, arrow === 'left' ? -step : arrow === 'right' ? step : 0, arrow === 'up' ? -step : arrow === 'down' ? step : 0)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') fineRef.current = false
      const arrow = ARROWS[e.code]
      if (arrow) heldRef.current.delete(arrow)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [pinned])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = stateRef.current
    if (s.phase === 'menu' || s.phase === 'gameover') return
    const canvas = canvasRef.current
    if (!canvas || e.target !== canvas) return
    const rect = canvas.getBoundingClientRect()
    if (s.phase === 'settling') {
      // The easter egg: a balanced plate, tapped again on its pin, shatters.
      const on = tablePointAt(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height, PIN_H + THICK)
      if (shatter(s, on)) {
        e.preventDefault()
        haptic('crash')
        void reportEgg('shatter')
      }
      return
    }
    if (s.phase !== 'aiming') return
    e.preventDefault()
    const at = tablePointAt(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height, s.pose.at.z + THICK)
    s.cursor = null
    const before = s.outcome
    setPin(s, at)
    if (s.outcome !== before) pinned(s)
  }

  const inPlay = ui.phase === 'aiming' || ui.phase === 'settling'
  const sumSoFar = ui.scores.length ? summarize(ui.scores) : null
  const finished = ui.phase === 'gameover'
  const counted = finished && !ui.practice && pageRun.current
  const today = plateDay()

  return (
    <section className="centroid centroid--fullscreen" style={gameAccentStyle(SLUG)}>
      <div className="game-play">
        <GameStage aspectWidth={1} aspectHeight={1.12} fill>
          <div className="centroid__play" onPointerDown={onPointerDown}>
            <canvas ref={canvasRef} className="centroid__viewport" />

            <GamePlayChrome
              slug={SLUG}
              inRun={() => stateRef.current.phase === 'aiming' || stateRef.current.phase === 'settling'}
              leaveNote={ui.practice ? 'It’s practice: nothing is saved.' : 'Your plates so far are kept: you carry on from here when you come back.'}
            />
            {ui.practice && inPlay ? (
              <div className="play-past">
                <RunLabel kind="practice" slug={SLUG} short className="run-label--hud" />
              </div>
            ) : null}

            <PlayReadout>
              <PlayReadoutScore>{sumSoFar ? sumSoFar.scoreText : '—'}</PlayReadoutScore>
              {inPlay ? (
                <PlayReadoutStats>
                  <PlayStat label={pastDay ? 'Day' : 'Today'} value={dayTag(day)} />
                  <PlayStat label="Plate" value={`${Math.min(ui.plateNo, PLATES)}/${PLATES}`} />
                </PlayReadoutStats>
              ) : null}
            </PlayReadout>

            <div className="centroid__overlay">
              {ui.phase === 'menu' ? (
                <StartCard
                  plan={plan}
                  pastDay={pastDay}
                  run={run}
                  kept={kept}
                  waiting={viewer === undefined}
                  onStart={() => begin(dayDone(run))}
                  onPractice={() => begin(true)}
                />
              ) : null}
              {counted ? (
                <DaySave
                  plan={plan}
                  scores={ui.scores}
                  taps={stateRef.current.day?.taps ?? []}
                  counted={counted}
                  previousBest={apiBest}
                  onDone={toMenu}
                />
              ) : finished ? (
                <DayCard
                  plan={plan}
                  scores={ui.scores}
                  practice={ui.practice}
                  past={pastDay != null && pastDay !== today}
                  standing={ui.practice && !pastDay && kept.length >= PLATES ? kept : null}
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

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div ref={fitCardToSpace} className="game-card centroid-card" style={gameAccentStyle(SLUG)} role="dialog" aria-label={label} onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  )
}

const markClass = (score: number) => (score >= 97 ? 'bull' : score >= 91 ? 'green' : score >= 82 ? 'yellow' : score >= 70 ? 'orange' : 'red')

/** The day's plates as squares, each with its points. */
function Marks({ scores, label = 'Your six plates' }: { scores: readonly number[]; label?: string }) {
  return (
    <ol className="centroid-card__marks" aria-label={label}>
      {scores.map((score, i) => (
        <li key={i} className={`centroid-card__mark centroid-card__mark--${markClass(score)}`}>
          <span aria-hidden="true">{markFor(score)}</span>
          <small>{formatPoints(score)}</small>
        </li>
      ))}
    </ol>
  )
}

function dayLine(plan: DayPlan) {
  return `${dayTag(plan.day)} · ${weekdayShort(plan.day)} · ${plan.label}`
}

/** Today's start card: the day, Start or Carry on, or how the day went. A past day's says it's practice. */
function StartCard({
  plan,
  pastDay,
  run,
  kept,
  waiting,
  onStart,
  onPractice,
}: {
  plan: DayPlan
  pastDay: string | null
  run: DayRun | null
  kept: readonly number[]
  waiting: boolean
  onStart: () => void
  onPractice: () => void
}) {
  const allow = useDeliberatePress()
  const done = !pastDay && dayDone(run)
  const sum = done && kept.length >= PLATES ? summarize(kept) : null
  const carry = !pastDay && run && !done && run.taps.length > 0
  const go = (f: () => void) => (e: ReactMouseEvent) => {
    if (allow(e)) f()
  }
  return (
    <Card label="Centroid">
      <div className="game-card__head">
        <span className="game-card__kicker">{pastDay ? `Past plates ${dayLine(plan)}` : `Today’s Plates ${dayLine(plan)}`}</span>
        <h2 className="game-card__title">Centroid</h2>
      </div>
      <p className="centroid-card__lede">
        {pastDay
          ? 'A past day’s six plates, to play again. It’s practice: nothing is kept.'
          : done
            ? 'That’s your day. New plates at midnight; play these again as much as you like: it’s practice, and your result stands.'
            : 'Six plates, the same for everyone today. Tap where each one would balance: the closer to its true center, the more it scores. No clock. Your first go is your result.'}
      </p>
      {!pastDay ? <RunLabel kind={done ? 'practice' : 'fun'} slug={SLUG} /> : null}
      {sum ? (
        <div className="centroid-card__result">
          <strong>{sum.scoreText}</strong>
          <span>{sum.tier}</span>
        </div>
      ) : run?.board != null && done ? (
        <div className="centroid-card__result">
          <strong>{(Math.floor(run.board / 10) / 10).toFixed(1)}%</strong>
          <span>played on another device</span>
        </div>
      ) : null}
      {sum ? <Marks scores={kept} /> : carry ? <Marks scores={kept} label="Plates played so far" /> : null}
      <div className="game-card__actions">
        {done ? (
          <>
            {sum ? <ShareButton plan={plan} scores={kept} allow={allow} ghost /> : null}
            <button type="button" className="panel__btn" onClick={go(onPractice)} autoFocus>
              Play again (practice)
            </button>
          </>
        ) : (
          <button type="button" className="panel__btn" disabled={waiting && !pastDay} onClick={go(onStart)} autoFocus>
            {pastDay ? 'Play' : carry ? `Carry on (plate ${run!.taps.length + 1} of ${PLATES})` : 'Play today’s plates'}
          </button>
        )}
      </div>
    </Card>
  )
}

/** The day's first run, saved to its board (the API works the score out from the taps). */
function DaySave({
  plan,
  scores,
  taps,
  counted,
  previousBest,
  onDone,
}: {
  plan: DayPlan
  scores: readonly number[]
  taps: readonly { x: number; y: number }[]
  counted: PageRun
  previousBest: number
  onDone: () => void
}) {
  // The day it was played on, kept: midnight moving the page on mustn't re-score it against new plates.
  const [{ fixedPlan, fixedScores, fixedTaps, fixedCounted }] = useState(() => ({ fixedPlan: plan, fixedScores: [...scores], fixedTaps: taps.map((t) => ({ ...t })), fixedCounted: counted }))
  const sum = summarize(fixedScores)
  const onSaved = () => {
    const account = currentAccountId()
    if (fixedCounted.owner === SIGNED_OUT && typeof account === 'string') claimDayRun(fixedPlan.day, fixedCounted.startedAt, account)
  }
  return (
    <ScoreSaveCard
      gameSlug={SLUG}
      score={judgeTaps(fixedPlan, fixedTaps).board}
      title={sum.tier}
      subtitle={`Today’s Plates ${dayTag(fixedPlan.day)} · ${sum.marks.join('')}`}
      previousBest={previousBest}
      plates={{ day: fixedPlan.day, taps: fixedTaps }}
      shareLine={shareText(fixedPlan, fixedScores, window.location.origin)}
      owner={ownerAccount(fixedCounted.owner)}
      onDone={onDone}
      onSaved={onSaved}
    />
  )
}

/** A practice run's report, or a past day's. */
function DayCard({
  plan,
  scores,
  practice,
  past,
  standing,
  onAgain,
  onDone,
}: {
  plan: DayPlan
  scores: readonly number[]
  practice: boolean
  past: boolean
  standing: readonly number[] | null
  onAgain: () => void
  onDone: () => void
}) {
  const allow = useDeliberatePress()
  const sum = summarize(scores)
  const kept = standing ? summarize(standing) : null
  return (
    <Card label={`Centroid: ${sum.scoreText}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">
          {past ? 'Past plates' : 'Today’s Plates'} {dayLine(plan)}
          {practice ? ' · practice' : ''}
        </span>
        <div className="centroid-card__result centroid-card__result--big">
          <strong>{sum.scoreText}</strong>
          <span>{sum.tier}</span>
        </div>
      </div>
      {practice ? <RunLabel kind="practice" slug={SLUG} /> : null}
      <Marks scores={scores} />
      {kept ? <p className="centroid-card__standing">Your result today stands: {kept.scoreText} {kept.tier}.</p> : null}
      {!practice && !past ? (
        <Suspense fallback={null}>
          <NextDaily slug={SLUG} className="next-daily--in-card" />
        </Suspense>
      ) : null}
      <div className="game-card__actions">
        {!practice && !past ? <ShareButton plan={plan} scores={scores} allow={allow} /> : null}
        <button type="button" className="panel__btn panel__btn--ghost" onClick={(e) => allow(e) && onDone()}>
          Done
        </button>
        <button type="button" className="panel__btn" onClick={(e) => allow(e) && onAgain()} autoFocus>
          Play again
        </button>
      </div>
    </Card>
  )
}

function ShareButton({ plan, scores, allow, ghost = false }: { plan: DayPlan; scores: readonly number[]; allow?: (e: ReactMouseEvent) => boolean; ghost?: boolean }) {
  const [copied, setCopied] = useState(false)
  const share = (e: ReactMouseEvent) => {
    if (allow && !allow(e)) return
    const text = shareText(plan, scores, window.location.origin)
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
    <button type="button" className={`panel__btn${ghost ? ' panel__btn--ghost' : ''}`} onClick={share}>
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}
