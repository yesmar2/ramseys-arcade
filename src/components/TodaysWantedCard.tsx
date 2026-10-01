import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { bugDay, DAY_SCENES, dayNumber, dayRun, dayWanted, nextDayAt, sceneMark, subscribeBugDay, wantedNames, type DayRun } from '../games/findbug/daily'
import { ShareDay } from '../games/findbug/DailyCards'
import { BugPortrait } from '../games/findbug/Portrait'
import { formatFindbugBoardScore, formatFindbugMs } from '../games/findbug/score'
import { useTodayBoard, type TodayBoard } from '../games/findbug/todayBoard'
import type { WantedBug } from '../games/findbug/wanted'
import { useAccountId } from '../hooks/useAccountId'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { PlayIcon } from './chromeIcons'
import { EventCountdown } from './EventCountdown'
import { PastTabButton, TodayCounts } from './TodaysCardParts'
import { YourCard, YourRow } from './YourDays'
import '../styles/evp.css'
import '../styles/todaysWanted.css'

/*
 * Today's Wanted, off the scenes: Find the Bug's five bugs wanted today, your run today, and the way in. The
 * card sits with the daily events on the Events page and on Find the Bug's own page, in a chunk of its own;
 * with it, for Find the Bug's page, your run scene by scene (TodaysWantedByScene). Find the Bug is just for
 * fun (data/games.ts Game.ranked): nobody's run is weighed against anyone else's.
 */

const SLUG = 'findbug'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/**
 * Today, who's wanted, what the player has done on this device (their own run, never another account's
 * or one played signed out while they're signed in) and the day's board, rolled over at midnight.
 */
function useTodaysWanted(): { day: string; wanted: WantedBug[]; run: DayRun | null; board: TodayBoard | null } {
  const [day, setDay] = useState(bugDay)
  const viewer = useAccountId()
  const [held, setHeld] = useState(() => ({ for: viewer, run: dayRun(day, viewer) }))
  useEffect(() => {
    const read = () => setHeld({ for: viewer, run: dayRun(day, viewer) })
    read()
    return subscribeBugDay(read)
  }, [day, viewer])
  // Read at once for someone just signed in or out, before the effect above catches up.
  const run = held.for === viewer ? held.run : dayRun(day, viewer)
  useEffect(() => {
    const t = window.setInterval(() => setDay(bugDay()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const wanted = useMemo(() => dayWanted(day), [day])
  const me = normalizePlayerName(usePlayerName())
  const board = useTodayBoard(day, me, run?.result?.ms ?? null)
  return { day, wanted, run, board }
}

/** Your run today, as far as it's gone. */
function standingWords(run: DayRun | null, board: TodayBoard | null): string {
  const result = run?.result
  if (result) {
    // One the board had from another device knows only its time.
    if (result.found == null) return `Your run today: ${formatFindbugMs(result.ms)}.`
    const found = result.found < DAY_SCENES ? `You found ${result.found} of ${DAY_SCENES}` : 'You found all five'
    return `${found} in ${formatFindbugMs(result.ms)}.`
  }
  if (run?.at) return `Your run is waiting on scene ${Math.min(DAY_SCENES, run.at.index + 1)} of ${DAY_SCENES}.`
  if (board?.you) return `Your run today: ${formatFindbugBoardScore(board.you.score)}, on another device.`
  return ''
}

/** Who's wanted today, their faces side by side. */
function WantedFaces({ wanted }: { wanted: readonly WantedBug[] }) {
  return (
    <span className="twc-faces">
      {wanted.map((w, i) => (
        <BugPortrait key={`${w.id}-${i}`} look={w.look} size={88} crop="head" className="twc-faces__face" fluid />
      ))}
    </span>
  )
}

/** Today's Wanted as a card: the day's bugs, that it counts, how it stands, the clock to the next, Past days, and Play or Share. */
export function TodaysWantedCard() {
  const { day, wanted, run, board } = useTodaysWanted()
  const n = dayNumber(day)
  const href = gamePlayHref(SLUG)
  const result = run?.result
  const started = Boolean(run && !result)
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#34aeb4')
  const style = { '--e': accent, '--e-ink': inkOn(accent) } as CSSProperties
  return (
    <section className="evp-card evp-daily twc" style={style} aria-labelledby="twc-title">
      <div className="evp-daily__screen">
        <a className="evp-screen twc__screen" href={href} aria-label={`Play Today’s Wanted #${n}: ${wantedNames(wanted)}`}>
          <WantedFaces wanted={wanted} />
          <span className="evp-screen__play" aria-hidden="true">
            <PlayIcon />
            {result ? 'Play again' : started ? 'Carry on' : 'Play'}
          </span>
        </a>
        <span className="evp-tag evp-tag--today">
          <span className="evp-dot" aria-hidden="true" />
          Today&rsquo;s Wanted #{n}
        </span>
      </div>
      <div className="evp-daily__text">
        <h2 id="twc-title" className="evp-card__title">
          {wantedNames(wanted)}
        </h2>
        <TodayCounts slug={SLUG} />
        <p className="evp-card__copy">
          Find the Bug, with five new scenes every day and the same bugs wanted for everyone. Your first run is your result.{' '}
          {standingWords(run, board)}
        </p>
      </div>
      <div className="evp-daily__foot evp-daily__foot--wrap">
        <span className="evp-meta">
          <ClockIcon />
          <EventCountdown endsAt={nextDayAt()} />
        </span>
        <span className="evp-daily__go">
          <PastTabButton slug={SLUG} />
          {result ? (
            <ShareDay day={day} result={result} className="evp-btn evp-btn--small" />
          ) : (
            <a className="evp-btn evp-btn--small" href={href}>
              {started ? 'Carry on' : 'Find them'}
            </a>
          )}
        </span>
      </div>
    </section>
  )
}

/** A scene's square, in the colours of a day's marks. */
const MARK_COLOUR: Record<ReturnType<typeof sceneMark>, string> = {
  '🟩': '#3cb54a',
  '🟨': '#e9b21a',
  '🟧': '#ee7d22',
  '🟥': '#dd3b36',
}
/** A scene ends at a minute: one run out of is a bug not found. */
const SCENE_LIMIT_MS = 60_000

/**
 * Your run today scene by scene, for Find the Bug's Today tab beside your days (YourDays.tsx): each wanted
 * bug, its square, and how long it took to find. Only your own, from this device, which keeps the times; a
 * run from another device shows its time.
 */
export function TodaysWantedByScene() {
  const { wanted, run, board } = useTodaysWanted()
  const href = gamePlayHref(SLUG)
  const result = run?.result
  const times = result?.times
  let body
  if (times && times.length >= DAY_SCENES) {
    const quickest = times.reduce((best, ms, i) => (ms < times[best]! ? i : best), 0)
    body = (
      <>
        <ul className="yd-rows">
          {wanted.slice(0, DAY_SCENES).map((bug, i) => {
            const ms = times[i]!
            return (
              <YourRow
                key={`${bug.id}-${i}`}
                name={bug.name}
                color={MARK_COLOUR[sceneMark(ms)]}
                fill={100 * (1 - Math.min(ms, SCENE_LIMIT_MS) / SCENE_LIMIT_MS)}
                value={ms >= SCENE_LIMIT_MS ? 'not found' : formatFindbugMs(ms)}
              />
            )
          })}
        </ul>
        <p className="yd__foot">
          Your quickest find today: {wanted[quickest]?.name}, in {formatFindbugMs(times[quickest]!)}. New bugs are wanted at
          midnight.
        </p>
      </>
    )
  } else if (result || board?.you) {
    // A run from another device: its time is all that's known here.
    const ms = result?.ms
    body = (
      <p className="yd__note">
        Your run today: {ms != null ? formatFindbugMs(ms) : formatFindbugBoardScore(board!.you!.score)}, played on another
        device. Its scenes are there.
      </p>
    )
  } else {
    body = (
      <>
        <p className="yd__note">
          {run?.at
            ? `Your run is waiting on scene ${Math.min(DAY_SCENES, run.at.index + 1)} of ${DAY_SCENES}.`
            : 'Not hunted yet today. Five bugs are wanted: find each one in its scene, fast.'}
        </p>
        <a className="evp-btn evp-btn--small yd__go" href={href}>
          {run?.at ? 'Carry on' : 'Find them'}
        </a>
      </>
    )
  }
  return (
    <YourCard title="Today, scene by scene" labelledBy="yd-today-findbug" hunt={`g-stand-${SLUG}`}>
      {body}
    </YourCard>
  )
}
