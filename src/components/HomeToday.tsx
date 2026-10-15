import { Suspense, type CSSProperties, type ReactNode } from 'react'
import { isRankedGame } from '../data/games'
import { untilWords } from '../games/marblerun/daily'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { gameHref, gamePlayHref, todayHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { msUntilNextHole } from '../lib/dailyHole'
import { hasDayPreview, hasGamePreview } from '../lib/gamePreviews'
import { lazyPage } from '../lib/lazyPage'
import { normalizePlayerName } from '../lib/leaderboard'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { numberWord } from '../lib/numberWord'
import { ordinal } from '../lib/profileMath'
import { boardTime, isRaceGame, MEDAL_NAMES, nextMedal } from '../lib/raceMedals'
import { isSpotlight, liveSeason, useSeason } from '../lib/season'
import { todayFailed, type TodayKey } from '../lib/today'
import { useDayStandings, type DayStanding } from '../lib/todayDays'
import { GamePreview } from './GamePreview'
import { MedalIcon } from './RaceMedal'
import { PartErrorBoundary } from './SiteErrorBoundary'
import { openSiteMenu } from './siteNav'
import { StarIcon } from './TodayChip'
import { shortDate, streakLine, useTicket, type Punch, type Ticket } from './todayPunches'
import '../styles/homeToday.css'

/*
 * Today's ticket on the home page (lib/today.ts), D on the "Home page redesign" canvas (Ramsey, 2026-10-15: "ok,
 * let's impelment this"): a ticket with a stub torn along a dotted line. On the stub, the day and where it stands,
 * your streak big with what it needs next, a punch hole for each race, the time to the next races, and one button
 * straight into the first race still to run. Beside it, the day's races as cards, each with its own picture of the
 * day (todayPictures.tsx) and its name on it, the next medal to take and who leads (or how you did and your
 * place), and its own way straight in; the card itself opens the daily's page. It's drawn from the same punches as
 * the Dailies page's ticket (todayPunches.ts), for the same viewer, so the two always agree. On a phone the stub
 * goes on top and the races swipe under it; between a phone and a wide screen they swipe beside it.
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
  cave: '#a48af0',
  hills: '#f2706a',
  gauntlet: '#f27bb0',
  plates: '#4aa8e8',
}

/** The way in, short enough for a card. */
const GO: Record<TodayKey, string> = {
  hole: 'Play',
  track: 'Race',
  wanted: 'Find them',
  pour: 'Pour',
  course: 'Roll it',
  cave: 'Fly it',
  hills: 'Swoop it',
  gauntlet: 'Run it',
  plates: 'Balance',
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
)
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 4.5v15l12-7.5z" />
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
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
)
/** The streak's flame, solid, on its orange disc. */
const FlameIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5c.6 3.2 4.6 5.2 4.6 10a4.6 4.6 0 0 1-9.2 0c0-2.3 1.2-3.7 2.4-4.8.2 1.6 1 2.6 2 3-1-2.8-.6-5.6.2-8.2z" />
  </svg>
)

/**
 * The stub's streak: how long it is, big, and what the day needs next under it, in the Dailies page's words
 * (todayPunches streakLine). A streak is an account's, so signed out it says how one is kept, and signing in is a
 * tap on it: the menu, as on the Dailies page.
 */
function streakParts(ticket: Ticket, signedIn: boolean): { big: string; sub: ReactNode } {
  if (!signedIn) {
    return {
      big: 'Keep a streak',
      sub: (
        <>
          Race any {numberWord(ticket.rule.need)} a day, once you{' '}
          <button type="button" className="home-day__signin" onClick={openSiteMenu}>
            sign in
          </button>
        </>
      ),
    }
  }
  return { big: ticket.current > 0 ? `${ticket.current}-day streak` : 'No streak yet', sub: streakLine(ticket) }
}

/** A punch hole for each race: those run punched through, and the one that keeps the day ringed till it's punched. */
function Holes({ done, rule }: { done: number; rule: Ticket['rule'] }) {
  return (
    <span className="home-day__holes" aria-hidden="true">
      {Array.from({ length: rule.count }, (_, i) => (
        <span key={i} className={`home-day__hole${i < done ? ' home-day__hole--done' : i === rule.need - 1 ? ' home-day__hole--keep' : ''}`}>
          {i < done ? <CheckIcon /> : null}
        </span>
      ))}
    </span>
  )
}

/** Who leads the day: the leader's name, and their result. */
function leadOf(p: Punch, standing: DayStanding | null | undefined): string | null {
  if (standing === undefined) return null
  if (standing === null) return 'Nobody yet · be the first'
  return `${standing.top.name} leads · ${formatLeaderboardScore(p.slug, standing.top.score)}`
}

/**
 * A race's next medal (lib/raceMedals.ts) and the time it takes, to the thousandth as its boards say times: the
 * one held lit beside it once there is one, and once the top one's held, just that.
 */
function MedalLine({ p }: { p: Punch }) {
  if (!isRaceGame(p.slug) || p.paceMs == null) return null
  const held = p.medal ?? null
  const next = nextMedal(p.slug, p.paceMs, held)
  return (
    <span className="home-day__medal">
      {held ? <MedalIcon medal={held} size={16} /> : null}
      {held ? <span className="visually-hidden">{MEDAL_NAMES[held]} won. </span> : null}
      {next ? (
        <>
          <span className={`home-day__medal-next home-day__medal-next--${next.medal}`}>
            <MedalIcon medal={next.medal} size={16} dim />
          </span>
          <span className="visually-hidden">Next medal: </span>
          <span className="home-day__medal-name">{MEDAL_NAMES[next.medal]}</span>
          <b className="home-day__medal-time">{boardTime(p.slug, next.ms / 1000)}</b>
        </>
      ) : (
        <span className="home-day__medal-name">Top medal</span>
      )}
    </span>
  )
}

function RaceCard({
  p,
  day,
  standing,
  asking,
}: {
  p: Punch
  day: string
  standing: DayStanding | null | undefined
  /** The day's standings are still being asked for: the card's last line holds its place till they come. */
  asking: boolean
}) {
  const spotlight = isSpotlight(liveSeason(useSeason()), p.slug)
  // A daily just for fun places nobody (data/games.ts Game.ranked): no place for you and no leader.
  const ranked = isRankedGame(p.slug)
  // Your place, once you're on the day's board: never a place for a result the board doesn't have yet.
  const place = ranked && p.done && standing?.you ? `${ordinal(standing.you.place)} of ${standing.players} today` : null
  const lead = ranked ? leadOf(p, standing) : null
  // Halfway through: where you left it, instead of who leads.
  const carry = !p.done && p.carry ? p.carry.replace(/^Carry on,?\s*/, '') : null
  // The picture's badge, New in its first week or the season's Spotlight: one or the other.
  const fresh = !p.done && p.fresh
  const badge = fresh ? 'new' : spotlight ? 'spotlight' : null
  const verb = carry != null ? 'Carry on' : GO[p.key]
  const side = p.done ? (place ?? lead) : (carry ?? lead)
  return (
    <li className={`home-day__race${p.done ? ' home-day__race--done' : ''}`} style={{ '--day': ACCENT[p.key] } as CSSProperties}>
      {/* To the daily's page, its Today tab (Ramsey, 2026-09-30); the button under it goes straight into the race. */}
      <a className="home-day__card" href={gameHref(p.slug)}>
        <span className="home-day__pic">
          <span className="home-day__art" aria-hidden="true">
            {/* The day's own picture, on the tile's plain dark until it's drawn: never the game's other picture
                first. Pictures that fail to come leave the plain dark, and the card works as ever. */}
            <PartErrorBoundary fallback={null}>
              <Suspense fallback={<span className="home-day__pic-wait" />}>
                <DayPicture daily={p.key} day={day} />
              </Suspense>
            </PartErrorBoundary>
            {/* The game played over its picture, under a pointer or, on a phone, when the row rests on the card
                (Ramsey, 2026-10-04 and 05): the day's own where the game can draw it, else its own preview. */}
            {hasDayPreview(p.slug) ? (
              <GamePreview slug={p.slug} day={day} className="home-day__preview" rail />
            ) : hasGamePreview(p.slug) ? (
              <GamePreview slug={p.slug} className="home-day__preview" rail />
            ) : null}
          </span>
          <span className="home-day__game">{p.game}</span>
          {p.done ? (
            <span className="home-day__stamp" aria-hidden="true">
              <CheckIcon />
            </span>
          ) : badge === 'new' ? (
            <span className="home-day__new" aria-hidden="true">
              New
            </span>
          ) : badge === 'spotlight' ? (
            <span className="season-spot season-spot--day" aria-hidden="true">
              Spotlight
            </span>
          ) : null}
          {/* The day's name on its picture, and which of the game's days it is. */}
          <span className="home-day__on">
            <span className="home-day__name">
              {p.title}
              {badge ? <span className="visually-hidden"> ({badge})</span> : null}
            </span>
            <span className="home-day__course">{p.kicker.replace(/^Today’s\s+/, '')}</span>
          </span>
        </span>
        <span className="home-day__body">
          <MedalLine p={p} />
          <span className="home-day__side">
            {side ??
              (ranked && standing === undefined && asking ? (
                <span className="skel-line" style={{ '--skel-w': '7.5rem' } as CSSProperties} />
              ) : (
                ' '
              ))}
          </span>
        </span>
      </a>
      <span className="home-day__foot">
        {p.done ? (
          <span className="home-day__result">
            <CheckIcon />
            <span className="visually-hidden">Punched: </span>
            {p.short ?? 'Done'}
          </span>
        ) : (
          <a className="home-day__go" href={gamePlayHref(p.slug)} aria-label={`${verb}, ${p.game}: ${p.title}`}>
            <PlayIcon />
            {verb}
          </a>
        )}
      </span>
    </li>
  )
}

export function HomeToday() {
  const { signedIn, signedOut } = useAuth()
  // Who's looking: each punch is theirs, and never another account's that played on this device.
  const viewer = useAccountId()
  const ticket = useTicket(viewer)
  const { day, punches, done, total, rule, marks } = ticket
  const me = normalizePlayerName(usePlayerName())
  // Only the ranked dailies have a day's standing to ask for.
  const standings = useDayStandings(
    punches.map((p) => p.slug).filter((slug) => isRankedGame(slug)),
    day,
    signedIn ? me : '',
    done,
  )
  if (!total) return null
  // The streak is the API's, once it has answered; before then it isn't said, as on the chip. Nor is signing in,
  // to a session whose account isn't known yet. If the API couldn't say, it isn't coming: nothing then.
  const streak = signedOut || (signedIn && ticket.server) ? streakParts(ticket, signedIn) : null
  const waiting = !streak && !todayFailed()
  const count = marks.full
    ? `All ${numberWord(total)} raced: a Full ticket`
    : `${done} of ${total} raced${rule.count > rule.need ? ` · all ${numberWord(rule.count)} make a Full ticket` : ''}`
  // Straight into the first race still to run; once they're all run, how the day went.
  const up = punches.find((p) => !p.done) ?? null
  const start = (under: boolean) => (
    <a className={`home-day__start${under ? ' home-day__start--under' : ''}`} href={up ? gamePlayHref(up.slug) : todayHref()}>
      {up ? (done === 0 ? `Start with ${up.game}` : `Next up: ${up.game}`) : 'See how you did'}
      <ArrowIcon />
    </a>
  )
  return (
    // The top of the page for anyone who has played, and on every home page: one of the bug hunt's hiding places.
    <section className={`home-day${marks.full ? ' home-day--full' : ''}`} aria-labelledby="home-day-title" data-hunt="home-hero">
      <div className="home-day__stub">
        <div className="home-day__when">
          <h2 id="home-day-title" className="home-day__title">
            Today’s ticket
          </h2>
          <span className="home-day__date">{shortDate(day)}</span>
        </div>
        {streak || waiting ? (
          <div className="home-day__streak">
            <span className="home-day__flame">{marks.full ? <StarIcon /> : <FlameIcon />}</span>
            {streak ? (
              <span className="home-day__streak-words">
                <b className="home-day__streak-big">{streak.big}</b>
                {/* One run of words, so a sign-in button in them wraps with them. */}
                <span className="home-day__streak-sub">{streak.sub}</span>
              </span>
            ) : (
              // Not known yet: its lines shimmer as the skeleton's do, so nothing under them moves when they come.
              <span className="home-day__streak-words" aria-hidden="true">
                <b className="home-day__streak-big">
                  <span className="skel-line" style={{ '--skel-w': '8rem' } as CSSProperties} />
                </b>
                <span className="home-day__streak-sub">
                  <span className="skel-line" style={{ '--skel-w': '10rem' } as CSSProperties} />
                </span>
              </span>
            )}
          </div>
        ) : null}
        <div className="home-day__punch">
          <Holes done={done} rule={rule} />
          <span className="home-day__count">{count}</span>
        </div>
        <span className="home-day__next">
          <ClockIcon />
          <span>
            New<span className="home-day__next-word"> races</span> in {untilWords(msUntilNextHole())}
          </span>
        </span>
        {start(false)}
      </div>
      <div className="home-day__races">
        <div className="home-day__head">
          <h3 className="home-day__races-title">Today’s races</h3>
          <span className="home-day__races-sub">New every day, the same for everyone</span>
          <a className="home-day__open" href={todayHref()}>
            Open Dailies
            <ChevronIcon />
          </a>
        </div>
        <ul className="home-day__cards" style={{ '--n': total } as CSSProperties}>
          {punches.map((p) => (
            <RaceCard key={p.key} p={p} day={day} standing={standings ? standings.get(p.slug) : undefined} asking={standings === null} />
          ))}
        </ul>
        {/* On a phone the way in comes under the races, where a thumb is after looking at them. */}
        {start(true)}
      </div>
    </section>
  )
}
