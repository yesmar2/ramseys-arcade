import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import {
  dayDone,
  dayRun,
  dayTag,
  keptResults,
  msUntilNextDay,
  pourDay,
  shareText,
  subscribePourDay,
  type DayRun,
} from '../games/halffull/daily'
import { dayPlan, ROUNDS, type DayPlan } from '../games/halffull/plan'
import { glassesWords, glassNames, pourPlan } from '../games/halffull/planSvg'
import { formatBoard, formatOff, judgeLevels, markFor, offHalf, tierFor, type JudgedDay, type Mark } from '../games/halffull/score'
import { useTodayBoard, type TodayBoard } from '../games/halffull/todayBoard'
import { useAccountId } from '../hooks/useAccountId'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { PlayIcon } from './chromeIcons'
import { EventCountdown } from './EventCountdown'
import { copyText } from './ShareBoardButton'
import { PastTabButton, TodayCounts } from './TodaysCardParts'
import { YourCard, YourRow } from './YourDays'
import '../styles/evp.css'
import '../styles/todaysPour.css'

/*
 * Today's Pour, off the counter: Half Full's five glasses of the day standing empty, your pour today, and the
 * way in. The card sits with the daily events on the Events page and on Half Full's own page, in a chunk of
 * its own, since it builds the day's glasses; with it, for Half Full's page, your pour glass by glass
 * (TodaysPourByGlass). Half Full is just for fun (data/games.ts Game.ranked): nobody's pour is weighed
 * against anyone else's.
 */

const SLUG = 'halffull'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** When the next glasses come, to the second: the same all day, for a countdown to hold on to. */
function nextPourAt(now = Date.now()) {
  return Math.round((now + msUntilNextDay(now)) / 1000) * 1000
}

/**
 * Today, its glasses, what you have poured of them on this device and the day's board, rolled over at
 * midnight. `judged` is your pour here once all five are in, worked out again from their levels. Only your
 * own run counts (lib/deviceRuns.ts): not one another account poured here, nor one poured signed out,
 * which only the game itself offers to take up.
 */
function useTodaysPour(): { day: string; plan: DayPlan; run: DayRun | null; judged: JudgedDay | null; board: TodayBoard | null } {
  const [day, setDay] = useState(pourDay)
  const viewer = useAccountId()
  const [held, setHeld] = useState(() => ({ day, viewer, run: dayRun(day, viewer) }))
  useEffect(() => {
    const read = () => setHeld({ day, viewer, run: dayRun(day, viewer) })
    read()
    return subscribePourDay(read)
  }, [day, viewer])
  // Read for another day or viewer, until it's read again: never shown for this one.
  const run = held.day === day && held.viewer === viewer ? held.run : dayRun(day, viewer)
  useEffect(() => {
    const t = window.setInterval(() => setDay(pourDay()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const plan = useMemo(() => dayPlan(day), [day])
  const judged = useMemo(
    () => (run && run.levels.length >= ROUNDS ? judgeLevels(plan, run.levels.slice(0, ROUNDS)) : null),
    [plan, run],
  )
  const me = normalizePlayerName(usePlayerName())
  const board = useTodayBoard(day, me, judged?.board ?? null)
  return { day, plan, run, judged, board }
}

/** Your pour today, as far as it's gone. */
function standingWords(judged: JudgedDay | null, run: DayRun | null, board: TodayBoard | null): string {
  if (judged) return `Your pour today: ${formatBoard(judged.board)}, ${tierFor(judged.day)}.`
  // One the board has from another device: only its figure is known here.
  if (board?.you) return `Your pour today: ${formatBoard(board.you.score)}.`
  if (run?.board != null) return `Your pour today: ${formatBoard(run.board)}.`
  const locked = run?.levels.length ?? 0
  if (locked > 0) return `Your pour today is waiting at glass ${locked + 1} of ${ROUNDS}.`
  return ''
}

/** The day's glasses on the shelf and the counter, empty (planSvg.ts): nothing in them gives half away. */
function PourGlasses({ plan }: { plan: DayPlan }) {
  const picture = useMemo(() => pourPlan(plan, 320, 188), [plan])
  return (
    <svg className="tpc-plan" viewBox={`0 0 ${picture.width} ${picture.height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {picture.layers.map((layer, i) => (
        <path key={i} className={`tpc-plan__${layer.part}`} d={layer.d} strokeWidth={layer.width} />
      ))}
    </svg>
  )
}

/** Send the day on, as the game's own Share does: the phone's share sheet, or copied to paste anywhere. */
function ShareDay({ plan, run, className }: { plan: DayPlan; run: DayRun; className: string }) {
  const [copied, setCopied] = useState(false)
  const share = () => {
    const text = shareText(plan, keptResults(plan, run), window.location.origin)
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
    <button type="button" className={className} onClick={share}>
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}

/** Today's Pour as a card: the day's glasses, that it counts, how it stands, the clock to the next, Past days, and Pour or Share. */
export function TodaysPourCard() {
  const { day, plan, run, judged, board } = useTodaysPour()
  const href = gamePlayHref(SLUG)
  // Poured here, or on another device the board knows of (or knew of, while it's loading): today's is done.
  const poured = Boolean(judged || board?.you || dayDone(run))
  const started = !poured && (run?.levels.length ?? 0) > 0
  const go = poured ? 'Pour again' : started ? 'Carry on' : 'Pour'
  const tag = `Today’s Pour ${dayTag(day)}`
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#f5b942')
  const style = { '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties
  return (
    <section className="evp-card evp-daily tpc" style={style} aria-labelledby="tpc-title">
      <div className="evp-daily__screen">
        <a className="evp-screen tpc__screen" href={href} aria-label={`Pour ${tag}: ${glassesWords(plan)}`}>
          <PourGlasses plan={plan} />
          <span className="evp-screen__play" aria-hidden="true">
            <PlayIcon />
            {go}
          </span>
        </a>
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          {tag}
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="tpc-title" className="evp-card__title">
          {glassNames(plan)}
        </h2>
        <TodayCounts slug={SLUG} />
        <p className="evp-card__copy">
          Half Full, with five new glasses every day, the same for everyone: easy on a Monday, brutal by Sunday. Your first
          pour is your result. {standingWords(judged, run, board)}
        </p>
        {/* The five squares the pour's share sends; the sentence above says the same in words. */}
        {judged ? (
          <p className="tpc-marks" aria-hidden="true">
            {judged.scores.map(markFor).join('')}
          </p>
        ) : null}
      </div>
      <div className="evp-daily__foot evp-daily__foot--wrap">
        <span className="evp-meta">
          <ClockIcon />
          <EventCountdown endsAt={nextPourAt()} />
        </span>
        <span className="evp-daily__go">
          <PastTabButton slug={SLUG} />
          {judged && run ? (
            <ShareDay plan={plan} run={run} className="evp-btn evp-btn--small" />
          ) : (
            <a className="evp-btn evp-btn--small" href={href}>
              {go}
            </a>
          )}
        </span>
      </div>
    </section>
  )
}

/** A pour's square, in the colours Half Full draws it (render.ts). */
const MARK_COLOUR: Record<Mark, string> = {
  '🎯': '#1fa463',
  '🟩': '#3cb54a',
  '🟨': '#e9b21a',
  '🟧': '#ee7d22',
  '🟥': '#dd3b36',
}

/**
 * Your pour today glass by glass, for Half Full's Today tab beside your days (YourDays.tsx): each glass's
 * square, how close it came, and the one you got closest. Only your own, and only from this device, which
 * keeps the levels; one poured on another device shows its figure.
 */
export function TodaysPourByGlass() {
  const { plan, run, judged, board } = useTodaysPour()
  const href = gamePlayHref(SLUG)
  const results = useMemo(() => (judged && run ? keptResults(plan, run) : []), [judged, plan, run])
  const names = [...plan.pours.map((g) => g.name), 'the split']
  const cap = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)
  let body
  if (results.length === ROUNDS) {
    const closest = results.reduce((best, r, i) => (offHalf(r.percent) < offHalf(results[best]!.percent) ? i : best), 0)
    body = (
      <>
        <ul className="yd-rows">
          {results.map((r, i) => (
            <YourRow
              key={i}
              name={cap(names[i]!)}
              color={MARK_COLOUR[markFor(r.score)]}
              fill={r.score}
              value={`${formatOff(r.percent)} off half`}
            />
          ))}
        </ul>
        <p className="yd__foot">
          Your closest today: {names[closest]}, {formatOff(results[closest]!.percent)} off half. New glasses come at midnight.
        </p>
      </>
    )
  } else if (board?.you || run?.board != null) {
    // Poured on another device: its figure is all that's known here.
    const figure = board?.you?.score ?? run?.board ?? 0
    body = <p className="yd__note">Your pour today: {formatBoard(figure)}, poured on another device. Its glasses are there.</p>
  } else {
    const locked = run?.levels.length ?? 0
    body = (
      <>
        <p className="yd__note">
          {locked > 0
            ? `Your pour is waiting at glass ${locked + 1} of ${ROUNDS}.`
            : 'Nothing poured yet today. Five glasses are waiting: get each one exactly half full.'}
        </p>
        <a className="evp-btn evp-btn--small yd__go" href={href}>
          {locked > 0 ? 'Carry on' : 'Pour'}
        </a>
      </>
    )
  }
  return (
    <YourCard title="Today, glass by glass" labelledBy="yd-today-halffull" hunt={`g-stand-${SLUG}`}>
      {body}
    </YourCard>
  )
}
