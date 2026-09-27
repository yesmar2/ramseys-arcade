import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { bugDay, DAY_SCENES, dayNumber, dayRun, dayWanted, nextDayAt, subscribeBugDay, wantedNames, type DayRun } from '../games/findbug/daily'
import { ShareDay } from '../games/findbug/DailyCards'
import { BugPortrait } from '../games/findbug/Portrait'
import { formatFindbugBoardScore, formatFindbugMs } from '../games/findbug/score'
import { useTodayBoard, type TodayBoard } from '../games/findbug/todayBoard'
import type { WantedBug } from '../games/findbug/wanted'
import { gameArchiveHref, gamePlayHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { inkOn } from '../lib/color'
import { normalizePlayerName } from '../lib/leaderboard'
import { ordinal } from '../lib/profileMath'
import { resolveGameAccent } from '../lib/theme'
import { PlayIcon } from './chromeIcons'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'
import '../styles/evp.css'
import '../styles/todaysWanted.css'

/*
 * Today's Wanted, off the scenes: Find the Bug's five bugs wanted today, how the day's board stands, and
 * the way in. The card sits with the daily events on the Events page and on Find the Bug's own page; its
 * slimmer twin is on the home page's On now. Both come in a chunk of their own.
 */

const SLUG = 'findbug'

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

/** Today, who's wanted, what this device has done and the day's board, rolled over at midnight. */
function useTodaysWanted(): { day: string; wanted: WantedBug[]; run: DayRun | null; board: TodayBoard | null } {
  const [day, setDay] = useState(bugDay)
  const [run, setRun] = useState(() => dayRun(day))
  useEffect(() => {
    const read = () => setRun(dayRun(day))
    read()
    return subscribeBugDay(read)
  }, [day])
  useEffect(() => {
    const t = window.setInterval(() => setDay(bugDay()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const wanted = useMemo(() => dayWanted(day), [day])
  const me = normalizePlayerName(usePlayerName())
  const board = useTodayBoard(day, me, run?.result?.ms ?? null)
  return { day, wanted, run, board }
}

const time = (score: number) => formatFindbugBoardScore(score)

/** Where the day stands, and where you are in it. */
function standingWords(run: DayRun | null, board: TodayBoard | null): string {
  const result = run?.result
  if (result) {
    const place = board?.you ? `, ${ordinal(board.you.place)} of ${board.count} today` : ''
    // One the board had from another device knows only its time.
    if (result.found == null) return `Your run today: ${formatFindbugMs(result.ms)}${place}.`
    const found = result.found < DAY_SCENES ? `You found ${result.found} of ${DAY_SCENES}` : 'You found all five'
    return `${found} in ${formatFindbugMs(result.ms)}${place}.`
  }
  if (run?.at) return `Your run is waiting on scene ${Math.min(DAY_SCENES, run.at.index + 1)} of ${DAY_SCENES}.`
  if (!board) return ''
  if (board.leader) {
    return `${board.leader.name} leads with ${time(board.leader.score)}${board.count > 1 ? `, of ${board.count} so far` : ''}.`
  }
  return 'Nobody has played yet: the first run sets the bar.'
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

/** Today's Wanted as a card: the day's bugs, how it stands, the clock to the next, and Play or Share. */
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
        <p className="evp-card__copy">
          Find the Bug, with five new scenes every day and the same bugs wanted for everyone. Your first run is your result,
          and the quickest tops the day. {standingWords(run, board)}
        </p>
      </div>
      <div className="evp-daily__foot">
        <span className="evp-meta">
          <ClockIcon />
          <EventCountdown endsAt={nextDayAt()} />
        </span>
        <a className="evp-daily__archive" href={gameArchiveHref(SLUG)}>
          Past days
        </a>
        {result ? (
          <ShareDay day={day} result={result} className="evp-btn evp-btn--small" />
        ) : (
          <a className="evp-btn evp-btn--small" href={href}>
            {started ? 'Carry on' : 'Find them'}
          </a>
        )}
      </div>
    </section>
  )
}

/** Today's Wanted in the home page's On now: the day's number and bugs, the clock, how the day stands. */
export function TodaysWantedOnNow() {
  const { day, wanted, run, board } = useTodaysWanted()
  const accent = resolveGameAccent(SLUG, getGame(SLUG)?.accent ?? '#34aeb4')
  const result = run?.result
  return (
    <a className="onnow-card" href={gamePlayHref(SLUG)} style={{ '--ev-accent': accent } as CSSProperties}>
      <span className="onnow-card__head">
        <span className="onnow-card__art" aria-hidden="true">
          <GameThumbArt slug={SLUG} accent={accent} />
        </span>
        <span className="onnow-card__titles">
          <span className="onnow-card__title">Today&rsquo;s Wanted #{dayNumber(day)}</span>
          <span className="onnow-card__sub">Find the Bug · {wantedNames(wanted)}</span>
        </span>
        <EventCountdown endsAt={nextDayAt()} className="onnow-card__clock" />
      </span>
      <span className={`onnow-card__line${result ? ' onnow-card__line--you' : ''}`}>
        {standingWords(run, board) || 'Five new scenes every day, the same for everyone. Your first run is your result.'}
      </span>
      <span className="onnow-card__foot">
        <span className="onnow-card__go">{result ? 'Play again' : run ? 'Carry on' : 'Play'}</span>
      </span>
    </a>
  )
}
