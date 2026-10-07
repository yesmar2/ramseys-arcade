import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { dayDone, dayRun, dayTag, keptScores, plateDay, shareText, subscribePlateDay, weekdayShort, type DayRun } from '../games/dead-center/daily'
import { dayPlan, PLATES, type DayPlan } from '../games/dead-center/plan'
import { box } from '../games/dead-center/plates'
import { formatBoard, formatPoints, judgeTaps, markFor, tierFor, type JudgedDay, type Mark } from '../games/dead-center/score'
import { useTodayBoard, type TodayBoard } from '../games/dead-center/todayBoard'
import { useAccountId } from '../hooks/useAccountId'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { PlayIcon } from './chromeIcons'
import { EventCountdown } from './EventCountdown'
import { useShare } from './SharePanel'
import { PastTabButton, TodayCounts } from './TodaysCardParts'
import { YourCard, YourRow } from './YourDays'
import '../styles/evp.css'
import '../styles/todaysPour.css'

/*
 * Today's Plates, Centroid's daily (Ramsey, 2026-10-06: "centroid should be a daily like the fill the cup
 * game"): the day's six plates laid out flat, your day so far, and the way in. On Centroid's own page, with
 * your day plate by plate beside your days (TodaysPlatesByPlate). Just for fun, like Today's Pour, whose card
 * (TodaysPourCard.tsx) this follows.
 */

const SLUG = 'centroid'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** Midnight on the boards' clock, when the next plates come. */
function nextPlatesAt(now = Date.now()) {
  const day = plateDay(now)
  let t = now
  // An hour at a time to the next day, then back to its first second (a day a clock changes on is 23 or 25 hours).
  while (plateDay(t) === day) t += 3_600_000
  while (plateDay(t - 1000) !== day) t -= 1000
  return Math.round(t / 1000) * 1000
}

/** Today, its plates, your run of them on this device, and the day's board, rolled over at midnight. */
function useTodaysPlates(): { day: string; plan: DayPlan; run: DayRun | null; judged: JudgedDay | null; board: TodayBoard | null } {
  const [day, setDay] = useState(plateDay)
  const viewer = useAccountId()
  const [held, setHeld] = useState(() => ({ day, viewer, run: dayRun(day, viewer) }))
  useEffect(() => {
    const read = () => setHeld({ day, viewer, run: dayRun(day, viewer) })
    read()
    return subscribePlateDay(read)
  }, [day, viewer])
  const run = held.day === day && held.viewer === viewer ? held.run : dayRun(day, viewer)
  useEffect(() => {
    const t = window.setInterval(() => setDay(plateDay()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const plan = useMemo(() => dayPlan(day), [day])
  const judged = useMemo(() => (run && run.taps.length >= PLATES ? judgeTaps(plan, run.taps.slice(0, PLATES)) : null), [plan, run])
  const me = normalizePlayerName(usePlayerName())
  const board = useTodayBoard(day, me, judged?.board ?? null)
  return { day, plan, run, judged, board }
}

/**
 * A day's six plates laid flat, three by two, each in its own colour and nothing marked: where each
 * balances isn't given away.
 */
export function PlatesPicture({ plan, width = 320, height = 188, className = 'tpc-plan' }: { plan: DayPlan; width?: number; height?: number; className?: string }) {
  const cells = useMemo(() => {
    const cw = width / 3
    const ch = height / 2
    return plan.plates.map((plate, i) => {
      const b = box(plate.points)
      const k = Math.min((cw * 0.78) / Math.max(1e-6, b.x1 - b.x0), (ch * 0.78) / Math.max(1e-6, b.y1 - b.y0))
      const ox = (i % 3) * cw + cw / 2 - ((b.x0 + b.x1) / 2) * k
      const oy = Math.floor(i / 3) * ch + ch / 2 - ((b.y0 + b.y1) / 2) * k
      const d = plate.points.map((p, j) => `${j ? 'L' : 'M'}${(ox + p.x * k).toFixed(1)} ${(oy + p.y * k).toFixed(1)}`).join(' ') + ' Z'
      return { d, hue: plate.hue }
    })
  }, [plan, width, height])
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {cells.map((c, i) => (
        <path key={i} d={c.d} fill={`hsla(${c.hue}, 70%, 60%, 0.3)`} stroke={`hsl(${c.hue}, 60%, 46%)`} strokeWidth={2} strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/** Your day, as far as it's gone. */
function standingWords(judged: JudgedDay | null, run: DayRun | null, board: TodayBoard | null): string {
  if (judged) return `Your day: ${formatBoard(judged.board)}, ${tierFor(judged.day)}.`
  if (board?.you) return `Your day: ${formatBoard(board.you.score)}.`
  if (run?.board != null) return `Your day: ${formatBoard(run.board)}.`
  const played = run?.taps.length ?? 0
  if (played > 0) return `Your day is waiting at plate ${played + 1} of ${PLATES}.`
  return ''
}

function ShareDay({ plan, run, className }: { plan: DayPlan; run: DayRun; className: string }) {
  const { share, copied, panel } = useShare()
  const send = () => share({ text: shareText(plan, keptScores(plan, run), window.location.origin) })
  return (
    <>
      <button type="button" className={className} onClick={send}>
        {copied ? 'Copied' : 'Share'}
      </button>
      {panel}
    </>
  )
}

/** Today's Plates as a card: the day's plates, that it counts, how it stands, the clock to the next, Past days, and Play or Share. */
export function TodaysPlatesCard() {
  const { day, plan, run, judged, board } = useTodaysPlates()
  const href = gamePlayHref(SLUG)
  const played = Boolean(judged || board?.you || dayDone(run))
  const started = !played && (run?.taps.length ?? 0) > 0
  const go = played ? 'Play again' : started ? 'Carry on' : 'Play'
  const tag = `Today’s Plates ${dayTag(day)}`
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#4aa8e8')
  const style = { '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties
  return (
    <section className="evp-card evp-daily tpc" style={style} aria-labelledby="tplc-title">
      <div className="evp-daily__screen">
        <a className="evp-screen tpc__screen" href={href} aria-label={`Play ${tag}: six plates, ${plan.label}`}>
          <PlatesPicture plan={plan} />
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
        <h2 id="tplc-title" className="evp-card__title">
          Six plates · {weekdayShort(day)} · {plan.label}
        </h2>
        <TodayCounts slug={SLUG} />
        <p className="evp-card__copy">
          Centroid, with six new plates every day, the same for everyone: easy on a Monday, brutal by Sunday. Tap where each
          would balance; your first go is your result. {standingWords(judged, run, board)}
        </p>
        {judged ? (
          <p className="tpc-marks" aria-hidden="true">
            {judged.scores.map(markFor).join('')}
          </p>
        ) : null}
      </div>
      <div className="evp-daily__foot evp-daily__foot--wrap">
        <span className="evp-meta">
          <ClockIcon />
          <EventCountdown endsAt={nextPlatesAt()} />
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

const MARK_COLOUR: Record<Mark, string> = {
  '🎯': '#1fa463',
  '🟩': '#3cb54a',
  '🟨': '#e9b21a',
  '🟧': '#ee7d22',
  '🟥': '#dd3b36',
}

/** Your day plate by plate, for Centroid's Today tab beside your days: each plate's square and points. */
export function TodaysPlatesByPlate() {
  const { plan, run, judged, board } = useTodaysPlates()
  const href = gamePlayHref(SLUG)
  let body
  if (judged) {
    const best = judged.scores.reduce((b, s, i) => (s > judged.scores[b]! ? i : b), 0)
    body = (
      <>
        <ul className="yd-rows">
          {judged.scores.map((score, i) => (
            <YourRow key={i} name={`Plate ${i + 1}`} color={MARK_COLOUR[markFor(score)]} fill={score} value={`${formatPoints(score)} · ${(judged.offs[i]! * 100).toFixed(1)}% off`} />
          ))}
        </ul>
        <p className="yd__foot">
          Your closest today: plate {best + 1}, {formatPoints(judged.scores[best]!)}. New plates come at midnight.
        </p>
      </>
    )
  } else if (board?.you || run?.board != null) {
    const figure = board?.you?.score ?? run?.board ?? 0
    body = <p className="yd__note">Your day: {formatBoard(figure)}, played on another device. Its plates are there.</p>
  } else {
    const played = run?.taps.length ?? 0
    body = (
      <>
        <p className="yd__note">
          {played > 0 ? `Your day is waiting at plate ${played + 1} of ${PLATES}.` : `Nothing played yet today. Six plates are waiting (${plan.label}): pin each one where it balances.`}
        </p>
        <a className="evp-btn evp-btn--small yd__go" href={href}>
          {played > 0 ? 'Carry on' : 'Play'}
        </a>
      </>
    )
  }
  return (
    <YourCard title="Today, plate by plate" labelledBy="yd-today-centroid" hunt={`g-stand-${SLUG}`}>
      {body}
    </YourCard>
  )
}
