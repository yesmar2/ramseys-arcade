import { useEffect, useState, type ReactNode } from 'react'
import { PastCourseResult, PastCourseStart, type PastWalkLink, type TodayCourse } from '../../components/PastCourseCards'
import { RunLabel } from '../../components/RunLabel'
import { useShare } from '../../components/SharePanel'
import { gameArchiveHref, gamePlayHref, todayShareHref } from '../../hooks/useHashRoute'
import { archiveDayWords, dayBefore } from '../../lib/archive'
import { fitCardToSpace } from '../../lib/cardFit'
import { gameAccentStyle } from '../../lib/gameAccentStyle'
import { onItsDayFact, type ItsDay } from '../../lib/onItsDay'
import {
  dayNumber,
  DAY_SCENES,
  FIRST_DAY,
  msUntilNextDay,
  sceneMark,
  shareText,
  type DayProgress,
  type DayResult,
  type DayRun,
  type RunHold,
} from './daily'
import { BugPortrait } from './Portrait'
import { findbugMsFromBoardScore, formatFindbugMs } from './score'
import type { TodayBoard } from './todayBoard'
import type { WantedBug } from './wanted'

/*
 * Today's Wanted's cards, in the panel kit like every game's start and score cards: the one the day
 * opens on (Start, Carry on, or how the day went), and the ones for playing a day again as practice,
 * today's or a past one's from the past days. Their buttons are the only way on; a tap elsewhere on them
 * does nothing, since there's more than one thing to do. The day's first run ends on the usual save card.
 * A past day's cards are the ones every daily's past course shares (components/PastCourseCards.tsx).
 */

const SLUG = 'findbug'

function untilNext(ms: number): string {
  const mins = Math.max(1, Math.floor(ms / 60_000))
  const h = Math.floor(mins / 60)
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`
}

/** When the next day's scenes come, kept fresh. */
function NextDay() {
  const [ms, setMs] = useState(() => msUntilNextDay())
  useEffect(() => {
    const t = window.setInterval(() => setMs(msUntilNextDay()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  return <p className="game-card__hint findbug-daily__next">New scenes in {untilNext(ms)}</p>
}

/** Each square as the share line has it: its look here, and what it says. */
const MARKS: Record<ReturnType<typeof sceneMark>, { kind: string; words: string }> = {
  '🟩': { kind: 'clean', words: 'found before any hint' },
  '🟨': { kind: 'wide', words: 'found with the wide hint' },
  '🟧': { kind: 'tight', words: 'found with the tight hint' },
  '🟥': { kind: 'miss', words: 'not found' },
}

/** A square a scene, with its time: found before any hint, with the wide one, with the tight one, or not at all. */
export function SceneSquares({ times }: { times: readonly number[] }) {
  if (!times.length) return null
  return (
    <div
      className="findbug-daily__squares"
      role="img"
      aria-label={times.map((ms, i) => `Scene ${i + 1}: ${MARKS[sceneMark(ms)].words}`).join(', ')}
    >
      {times.map((ms, i) => (
        <span key={i} className={`findbug-daily__square findbug-daily__square--${MARKS[sceneMark(ms)].kind}`}>
          {ms >= 60_000 ? '–' : formatFindbugMs(ms)}
        </span>
      ))}
    </div>
  )
}

/** Who's wanted on the day: five faces, each with its name. */
export function WantedLineup({ wanted, size = 44 }: { wanted: readonly WantedBug[]; size?: number }) {
  return (
    <ul className="findbug-daily__lineup" aria-label={`Wanted: ${wanted.map((w) => w.name).join(', ')}`}>
      {wanted.map((w, i) => (
        <li key={`${w.id}-${i}`}>
          <BugPortrait look={w.look} size={size} crop="head" className="findbug-daily__face" />
          <span>{w.name.replace(/^the /, '')}</span>
        </li>
      ))}
    </ul>
  )
}

/** Send the day on: the phone's own share sheet, or copied to paste anywhere (useShare). */
export function ShareDay({ day, result, className = 'panel__btn' }: { day: string; result: DayResult; className?: string }) {
  const { share, copied, panel } = useShare()
  // The day's own link, which unfurls into the day's card and opens the Today page.
  const send = () => share({ text: `${shareText(day, result)}\n${window.location.origin}${todayShareHref(day)}` })
  return (
    <>
      <button type="button" className={className} onClick={send}>
        {copied ? 'Copied' : 'Share'}
      </button>
      {panel}
    </>
  )
}

function Card({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      ref={fitCardToSpace}
      className="game-card findbug-daily"
      style={gameAccentStyle(SLUG)}
      role="dialog"
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="game-pause-meta__row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

function resultWords(result: DayResult): string {
  const found = result.found != null ? ` · found ${result.found} of ${DAY_SCENES}` : ''
  return `${formatFindbugMs(result.ms)}${found}`
}

/** How far a run left halfway had got. */
function soFarWords(at: DayProgress): string {
  return `Scene ${Math.min(DAY_SCENES, at.index + 1)} of ${DAY_SCENES} · ${formatFindbugMs(at.bankedMs + at.sceneMs)} so far`
}

/**
 * The card the day opens on: who's wanted and Start; Carry on for a run left halfway; how the day went
 * once it's done. Signed in beside a run played signed out on this device, that run is offered to take up
 * (Carry on, or put it on the board) if it was theirs, and their own first run if it wasn't.
 */
export function TodayCard({
  day,
  wanted,
  run,
  hold,
  waiting,
  board,
  onStart,
  onStartOwn,
  onPractice,
  onSave,
}: {
  day: string
  wanted: readonly WantedBug[]
  run: DayRun | null
  /** Whose `run` is (daily.ts's offeredRun). */
  hold: RunHold
  /** Who's signed in isn't known yet: nothing starts until it is. */
  waiting: boolean
  board: TodayBoard | null
  onStart: () => void
  /** Their own first run, beside one played signed out here that wasn't theirs. */
  onStartOwn: () => void
  onPractice: () => void
  /** Put a finished first run on the board, when it isn't: it was played signed out, or its save didn't land. */
  onSave: () => void
}) {
  const n = dayNumber(day)
  const result = run?.result
  const at = !result ? run?.at : undefined
  const started = Boolean(run && !result)
  const claimable = Boolean(run) && hold === 'claimable'
  const offBoard = result && board && !board.you && result.found != null
  const head = (
    <div className="game-card__head">
      <span className="game-card__kicker">
        Today&rsquo;s Wanted #{n} · {archiveDayWords(day)}
      </span>
      <h2 className="game-card__title game-card__title--big">Find the Bug</h2>
    </div>
  )
  const foot = (
    <>
      <NextDay />
      <a className="findbug-daily__archive" href={gameArchiveHref(SLUG)}>
        Past days ›
      </a>
    </>
  )
  if (claimable) {
    // Played here signed out: not shown as theirs, nor shared, until they take it up.
    return (
      <Card label={`Today's Wanted #${n}`}>
        {head}
        <WantedLineup wanted={wanted} />
        <p className="findbug-daily__rules">
          {result
            ? 'Today’s first run was played on this device while signed out. If it was you, save it as today’s result. If not, your own first run is still to play.'
            : 'A first run was begun on this device while signed out and left halfway. If it was you, carry it on. If not, your own first run is still to play.'}
        </p>
        <div className="game-pause-meta">
          <Row label="Signed out">{result ? resultWords(result) : at ? soFarWords(at) : 'Started'}</Row>
        </div>
        {result?.times ? <SceneSquares times={result.times} /> : null}
        <div className="game-card__actions">
          {result ? (
            offBoard ? (
              <button type="button" className="panel__btn" onClick={onSave}>
                Save it as today&rsquo;s result
              </button>
            ) : null
          ) : (
            // Never focused first: the day's usual Enter mustn't take up someone else's run.
            <button type="button" className="panel__btn" onClick={onStart}>
              Carry on
            </button>
          )}
          <button type="button" className={result && !offBoard ? 'panel__btn' : 'panel__btn panel__btn--ghost'} onClick={onStartOwn}>
            Start your own
          </button>
        </div>
        {foot}
      </Card>
    )
  }
  return (
    <Card label={`Today's Wanted #${n}`}>
      {head}
      <WantedLineup wanted={wanted} />
      <p className="findbug-daily__rules">
        {started
          ? 'Your run today is waiting where you left it. The clock picks up where it stopped.'
          : result
            ? 'That’s your result for today. Play the day again as much as you like: it’s practice, and your result stands.'
            : 'Five scenes and a bug wanted in each, the same for everyone today. Your first run is your result, and the clock waits if you leave.'}
      </p>
      {/* What a run from here does: the day's first is your result (just for fun); once it's done, the rest are practice. */}
      <RunLabel kind={result ? 'practice' : 'fun'} slug={SLUG} className="findbug-daily__label" />
      <div className="game-pause-meta">
        <Row label="You">
          {waiting ? 'Checking who’s signed in…' : result ? resultWords(result) : at ? soFarWords(at) : started ? 'Started' : 'Not played yet'}
        </Row>
      </div>
      {result?.times ? <SceneSquares times={result.times} /> : null}
      <div className="game-card__actions">
        {result ? (
          <>
            {offBoard ? (
              <button type="button" className="panel__btn" onClick={onSave}>
                Save it as today&rsquo;s result
              </button>
            ) : null}
            <ShareDay day={day} result={result} className={offBoard ? 'panel__btn panel__btn--ghost' : 'panel__btn'} />
            <button type="button" className="panel__btn panel__btn--ghost" onClick={onPractice}>
              Play it again · doesn&rsquo;t count
            </button>
          </>
        ) : (
          // Nothing starts until it's known whose run it'll be.
          <button type="button" className="panel__btn" onClick={onStart} disabled={waiting} autoFocus>
            {started ? 'Carry on' : 'Start'}
          </button>
        )}
      </div>
      {foot}
    </Card>
  )
}

/** The end of today's scenes played again, after the day's first run: practice, and today's result stands. */
export function PracticeCard({
  day,
  run,
  standing,
  onAgain,
  onLeave,
}: {
  day: string
  run: DayResult
  /** Today's result, which this one doesn't change. */
  standing: DayResult | null
  onAgain: () => void
  onLeave: () => void
}) {
  const n = dayNumber(day)
  return (
    <Card label={`Today’s Wanted #${n}: ${foundWords(run)}`}>
      <div className="game-card__head">
        <span className="game-card__kicker">Today&rsquo;s Wanted #{n} · practice</span>
        <h2 className="game-card__title game-card__title--big">{foundWords(run)}</h2>
        <p className="game-card__blurb">
          {formatFindbugMs(run.ms)} this time.{' '}
          {standing ? `Your result today stands: ${formatFindbugMs(standing.ms)}.` : 'Your first run today is the one that counts.'}
        </p>
      </div>
      <RunLabel kind="practice" slug={SLUG} className="findbug-daily__label" />
      {run.times ? <SceneSquares times={run.times} /> : null}
      <div className="game-card__actions">
        <button type="button" className="panel__btn" onClick={onAgain} autoFocus>
          Play again
        </button>
        <button type="button" className="panel__btn panel__btn--ghost" onClick={onLeave}>
          Back to today&rsquo;s
        </button>
      </div>
    </Card>
  )
}

/* ---------- a past day, played again from the past days ---------- */

/** "Found every one", "Found 3 of 5". */
function foundWords(run: DayResult): string {
  const found = run.found ?? 0
  return found === DAY_SCENES ? 'Found every one' : `Found ${found} of ${DAY_SCENES}`
}

/** "Wanted #2 · Mon, Sep 28 · Past day": which day it is, and that it's past. */
function pastKicker(day: string): string {
  return `Wanted #${dayNumber(day)} · ${archiveDayWords(day)} · Past day`
}

const weekdayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })

/** "Monday’s five scenes": by its weekday while that's plain, within the week; "That day’s" before it. */
function dayScenesWords(day: string, today: string): string {
  let within = false
  for (let d = dayBefore(today), i = 0; i < 6 && !within; i += 1, d = dayBefore(d)) within = d === day
  const whose = within ? `${weekdayFormat.format(new Date(`${day}T12:00:00Z`))}’s` : 'That day’s'
  return `${whose} five scenes, as often as you like. It’s practice: nothing is saved.`
}

/** A past day's page on the play screen. */
const pastPlayHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`

/** The day after a day, both as YYYY-MM-DD. */
function dayAfter(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10)
}

/** "‹ Wanted #1" and "Wanted #3 ›": the days either side, while they're past ones. */
function walkFor(day: string, today: string): { prev: PastWalkLink | null; next: PastWalkLink | null } {
  const link = (other: string) => ({ label: `Wanted #${dayNumber(other)}`, href: pastPlayHref(other) })
  const before = dayBefore(day)
  const after = dayAfter(day)
  return { prev: before >= FIRST_DAY ? link(before) : null, next: after < today ? link(after) : null }
}

/** Today's Wanted, which counts: "Today's Wanted is the one that counts: Wanted #3 ›". */
const todayWanted = (today: string): TodayCourse => ({ name: `Wanted #${dayNumber(today)}` })

/**
 * A past day's start card: who was wanted, that it's practice, how its Ranked board went, Start, and the
 * way back to its row on the past days.
 */
export function PastDayStart({
  day,
  today,
  wanted,
  itsDay,
  onStart,
}: {
  day: string
  /** Today's day, whose Wanted counts. */
  today: string
  wanted: readonly WantedBug[]
  itsDay: ItsDay
  onStart: () => void
}) {
  return (
    <PastCourseStart
      slug={SLUG}
      course={day}
      day={day}
      kind="practice"
      title="Find the Bug"
      kicker={pastKicker(day)}
      art={<WantedLineup wanted={wanted} />}
      labelSub={dayScenesWords(day, today)}
      facts={[onItsDayFact(SLUG, itsDay)]}
      startLabel="Start"
      onStart={onStart}
      today={todayWanted(today)}
      walk={walkFor(day, today)}
    />
  )
}

/** One time against another, in tenths as the clock shows them: tied, or quicker or slower by "3.9s". */
function gapWords(ms: number, other: number): { tie: boolean; quicker: boolean; gap: string } {
  const tenths = Math.round((other - ms) / 100)
  return { tie: tenths === 0, quicker: tenths > 0, gap: formatFindbugMs(Math.abs(tenths) * 100) }
}

/**
 * The run against your own that day: "That's 3.9s quicker than your 49.1s that day." Find the Bug is just
 * for fun (data/games.ts Game.ranked), so no one else's run is measured against it.
 */
function againstItsDay(ms: number, itsDay: ItsDay): string | null {
  const you = itsDay.signedIn ? (itsDay.entry?.you ?? null) : null
  if (!you) return null
  const yours = findbugMsFromBoardScore(you.score)
  const g = gapWords(ms, yours)
  const at = formatFindbugMs(yours)
  return g.tie ? `That ties your ${at} that day.` : `That’s ${g.gap} ${g.quicker ? 'quicker' : 'slower'} than your ${at} that day.`
}

/**
 * After a past day's run: its time, that nothing was saved, the scenes, the run against its day, that your
 * week and rank are as they were, and again, back to its row, or today's Wanted.
 */
export function PastDayResult({
  day,
  today,
  run,
  itsDay,
  onAgain,
}: {
  day: string
  today: string
  run: DayResult
  itsDay: ItsDay
  onAgain: () => void
}) {
  const misses = run.misses ?? 0
  const against = againstItsDay(run.ms, itsDay)
  return (
    <PastCourseResult
      slug={SLUG}
      course={day}
      day={day}
      kind="practice"
      kicker={pastKicker(day)}
      figure={formatFindbugMs(run.ms)}
      line={`${foundWords(run)}, with ${misses === 0 ? 'no wrong taps' : misses === 1 ? '1 wrong tap' : `${misses} wrong taps`}.`}
      today={todayWanted(today)}
      againLabel="Play again"
      onAgain={onAgain}
    >
      {run.times ? <SceneSquares times={run.times} /> : null}
      {against ? <p className="past-card__note">{against}</p> : null}
    </PastCourseResult>
  )
}
