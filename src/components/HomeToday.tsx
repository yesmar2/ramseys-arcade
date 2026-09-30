import { Suspense, type CSSProperties } from 'react'
import { untilWords } from '../games/marblerun/daily'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { gameHref, todayHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { msUntilNextHole } from '../lib/dailyHole'
import { lazyPage } from '../lib/lazyPage'
import { normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { numberWord } from '../lib/numberWord'
import { ordinal } from '../lib/profileMath'
import type { TodayKey } from '../lib/today'
import { useDayStandings, type DayStanding } from '../lib/todayDays'
import { GameArt } from './GameArt'
import { FlameIcon, StarIcon } from './TodayChip'
import { capital, shortDate, useTicket, type Punch, type Ticket } from './todayPunches'
import '../styles/homeToday.css'

/*
 * Today on the home page (lib/today.ts): the day's dailies as cards, each with its own picture of the day
 * (the hole, the track, who's wanted, the glasses, the course: todayPictures.tsx), what it is today, and
 * either your result and your place on its board or the way in and who leads. Over them, where the day
 * stands: a pip for each daily, the one that keeps the streak marked, what the streak needs next, the time
 * to the next dailies, and the way to the Today page. It's drawn from the same punches as the Today page's
 * ticket (todayPunches.ts), for the same viewer, so the two always agree. Below 64rem the cards scroll
 * sideways.
 */

/** The pictures, in a chunk of their own with the plans they're drawn from; each game's own picture until then. */
const DayPicture = lazyPage(() => import('./todayPictures').then((m) => m.DayPicture))

/** Each daily's colour, as the day's share card has them (scripts/today-cards.mjs). */
const ACCENT: Record<TodayKey, string> = {
  hole: '#3ec8cf',
  track: '#f2813a',
  wanted: '#5fd3c4',
  pour: '#f5b942',
  course: '#d774f0',
}

/** The way in, short enough for a card. */
const GO: Record<TodayKey, string> = {
  hole: 'Play',
  track: 'Race',
  wanted: 'Find them',
  pour: 'Pour',
  course: 'Roll it',
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
)
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.5v13l10.5-6.5z" />
  </svg>
)
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)
const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
)

/**
 * What the day needs next, in words: how many more keep the streak (or start one), then a Full ticket.
 * A streak is an account's, so signed out it says so.
 */
function streakWords({ done, rule, marks, before, current }: Ticket, signedIn: boolean): string {
  if (!signedIn) return `Any ${numberWord(rule.need)} keep a streak, once you sign in`
  if (marks.full) return `A Full ticket, Day ${current}`
  if (marks.kept) {
    const more = rule.count - done
    return more > 0 ? `Day ${current} kept. ${capital(numberWord(more))} more for a Full ticket` : `Day ${current} kept`
  }
  const left = rule.need - done
  const count = capital(numberWord(left))
  if (before > 0) {
    if (done === 0) return `${count} keep your ${before}-day streak going`
    return left === 1 ? `One more keeps your ${before}-day streak going` : `${count} more keep your ${before}-day streak going`
  }
  if (done === 0) return `Play ${numberWord(left)} to start a streak`
  return left === 1 ? 'One more starts a streak' : `${count} more start a streak`
}

/** A pip for each daily: the punched ones filled, and the one that keeps the day ringed until it's kept. */
function Pips({ done, rule, full }: { done: number; rule: Ticket['rule']; full: boolean }) {
  return (
    <span className={`home-day__pips${full ? ' home-day__pips--full' : ''}`} aria-hidden="true">
      {Array.from({ length: rule.count }, (_, i) => (
        <span key={i} className={`home-day__pip${i < done ? ' home-day__pip--done' : i === rule.need - 1 ? ' home-day__pip--keep' : ''}`} />
      ))}
    </span>
  )
}

/** "Ace Chase · Hole #5": the game, and which of its days this is. */
const kickerOf = (p: Punch) => `${p.game} · ${p.kicker.replace(/^Today’s\s+/, '')}`

/** Who leads the day, for a daily still to play: the leader's name, and their result. */
function leadOf(p: Punch, standing: DayStanding | null | undefined): { who: string; what: string } | null {
  if (standing === undefined) return null
  if (standing === null) return { who: 'Nobody yet', what: 'be the first' }
  return { who: `${standing.top.name} leads`, what: formatLeaderboardScore(p.slug, standing.top.score) }
}

function DayCard({ p, day, standing }: { p: Punch; day: string; standing: DayStanding | null | undefined }) {
  // Your place, once you're on the day's board: never a place for a result the board doesn't have yet.
  const place = p.done && standing?.you ? `${ordinal(standing.you.place)} of ${standing.players} today` : null
  const lead = p.done ? null : leadOf(p, standing)
  // Halfway through: where you left it, instead of who leads.
  const carry = !p.done && p.carry ? p.carry.replace(/^Carry on,?\s*/, '') : null
  return (
    <a
      className={`home-day__card${p.done ? ' home-day__card--done' : ''}`}
      // To the daily's page, its Today tab, rather than straight into the game (Ramsey, 2026-09-30).
      href={gameHref(p.slug)}
      style={{ '--day': ACCENT[p.key] } as CSSProperties}
    >
      <span className="home-day__pic">
        <Suspense fallback={<GameArt slug={p.slug} shape="card" className="home-day__art" />}>
          <DayPicture daily={p.key} day={day} />
        </Suspense>
        {p.done ? (
          <span className="home-day__stamp">
            <CheckIcon />
          </span>
        ) : p.fresh ? (
          <span className="home-day__new">New</span>
        ) : null}
      </span>
      <span className="home-day__body">
        <span className="home-day__kicker">{kickerOf(p)}</span>
        <span className="home-day__name">{p.title}</span>
        <span className="home-day__foot">
          {p.done ? (
            <>
              <span className="home-day__result">
                <CheckIcon />
                <span className="visually-hidden">Punched: </span>
                {p.short ?? 'Done'}
              </span>
              {place ? <span className="home-day__side">{place}</span> : null}
            </>
          ) : (
            <>
              <span className="home-day__go">
                <PlayIcon />
                {carry != null ? 'Carry on' : GO[p.key]}
              </span>
              {carry ? (
                <span className="home-day__side">{carry}</span>
              ) : lead ? (
                <span className="home-day__side">
                  {lead.who}
                  <span className="home-day__sep"> · </span>
                  <br />
                  {lead.what}
                </span>
              ) : null}
            </>
          )}
        </span>
      </span>
    </a>
  )
}

export function HomeToday() {
  const { signedIn } = useAuth()
  // Who's looking: each punch is theirs, and never another account's that played on this device.
  const viewer = useAccountId()
  const ticket = useTicket(viewer)
  const { day, punches, done, total, rule, marks } = ticket
  const me = normalizePlayerName(usePlayerName())
  const standings = useDayStandings(
    punches.map((p) => p.slug),
    day,
    signedIn ? me : '',
    done,
  )
  if (!total) return null
  // The streak is the API's, once it has answered; before then it isn't said, as on the chip.
  const said = signedIn && !ticket.server ? null : streakWords(ticket, signedIn)
  const next = (
    <>
      <ClockIcon />
      New dailies in {untilWords(msUntilNextHole())}
    </>
  )
  return (
    <section className="home-day" aria-labelledby="home-day-title">
      <div className="home-day__head">
        <div className="home-day__when">
          <h2 id="home-day-title" className="home-day__title">
            Today
          </h2>
          <span className="home-day__date">{shortDate(day)}</span>
        </div>
        <div className="home-day__stand">
          <Pips done={done} rule={rule} full={marks.full} />
          <span className="home-day__count">
            {done} of {total}
            <span className="visually-hidden"> done</span>
          </span>
          {said ? (
            <span className={`home-day__streak${marks.full ? ' home-day__streak--full' : ''}`}>
              {marks.full ? <StarIcon /> : <FlameIcon />}
              {said}
            </span>
          ) : null}
        </div>
        <span className="home-day__next">{next}</span>
        <a className="home-day__open" href={todayHref()}>
          Open today
          <ChevronIcon />
        </a>
      </div>
      <ul className="home-day__cards" style={{ '--n': total } as CSSProperties}>
        {punches.map((p) => (
          <li key={p.key}>
            <DayCard p={p} day={day} standing={standings ? standings.get(p.slug) : undefined} />
          </li>
        ))}
      </ul>
      {/* On a phone the time to the next dailies comes under the cards (homeToday.css), and the one over them goes. */}
      <p className="home-day__next home-day__next--under">{next}</p>
    </section>
  )
}
