import { useEffect, useReducer, useState } from 'react'
import { DayStrip } from '../components/DayStrip'
import { PageShell } from '../components/PageShell'
import { PastDayTicket } from '../components/PastDayTicket'
import { StreakFreezes } from '../components/StreakFreezes'
import { openSiteMenu } from '../components/siteNav'
import { CheckIcon, ShareDay, TodayCard } from '../components/TodayCard'
import { FlameIcon, FreezeIcon, StarIcon } from '../components/TodayChip'
import {
  addDays,
  capital,
  dayParts,
  fullDate,
  streakLine,
  todayShareUrl,
  useTicket,
  type Ticket,
} from '../components/todayPunches'
import { TodayRivals } from '../components/TodayRivals'
import { useAccountId } from '../hooks/useAccountId'
import { useAuth } from '../hooks/useAuth'
import { navigate, todayHref, useRoute } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import type { Viewer } from '../lib/deviceRuns'
import { normalizePlayerName } from '../lib/leaderboard'
import { numberWord } from '../lib/numberWord'
import { doneOf, markOf, monthOf, streakThrough, useAccountDays, type DayMark } from '../lib/pastDays'
import {
  daysToGo,
  fetchRivals,
  rivalsScope,
  setRivalsScope,
  subscribeToday,
  TODAY_KEEP,
  TODAY_MILESTONES,
  TODAY_SINCE_FALLBACK,
  type TodayRivals as Rivals,
  type TodayServerDay,
} from '../lib/today'
import '../styles/today.css'
import '../styles/todayPage.css'

/*
 * The Dailies page (/dailies, once /today), the Today set's home (lib/today.ts): the day up top with where
 * it stands (the streak, how many are done), today's ticket (TodayCard) with your friends' day under it,
 * and beside it on a wide screen (under it, narrower) your last five weeks, the streak's rewards, and the
 * day's share as it would be sent. Signed out, it's the ticket as this device has it and a word on what
 * signing in keeps. The header's chip is the way here, and the home page's Dailies row. A day's share link
 * opens it too.
 *
 * Under the head, a strip of the last week's days (DayStrip), and from it a calendar of every day there
 * have been Dailies, a month at a time (DayPicker): a past day picked, /dailies/YYYY-MM-DD, puts that day
 * in the head and its ticket (PastDayTicket) in place of today's, with how each daily went that day.
 */

const GiftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="9" width="16" height="11.5" rx="2" />
    <path d="M4 13h16M12 9v11.5" />
    <path d="M12 9c-1.5-3.5-5.5-4-5.5-1.5S10 9 12 9zM12 9c1.5-3.5 5.5-4 5.5-1.5S14 9 12 9z" />
  </svg>
)
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9.5" rx="2.2" />
    <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
  </svg>
)

/**
 * Friends', or a group's, day on the dailies: asked again when the player's own day moves, when the tab
 * comes back, when another account signs in, and every two minutes. The pick of friends or a group is
 * this device's.
 */
function useRivals(signedIn: boolean, viewer: Viewer): { data: Rivals | null; group: string | null; pick: (group: string | null) => void } {
  const [group, setGroup] = useState<string | null>(rivalsScope)
  // The table, with the account it was asked for: another account's is never shown, even while theirs is asked.
  const [held, setHeld] = useState<{ for: Viewer; data: Rivals | null }>({ for: null, data: null })
  const [tick, bump] = useReducer((n: number) => n + 1, 0)
  useEffect(() => subscribeToday(bump), [])
  useEffect(() => {
    const t = window.setInterval(bump, 120_000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (!signedIn) {
      setHeld({ for: viewer, data: null })
      return
    }
    let cancelled = false
    void fetchRivals(group, tick > 0).then((next) => {
      if (!cancelled) setHeld({ for: viewer, data: next })
    })
    return () => {
      cancelled = true
    }
  }, [signedIn, viewer, group, tick])
  const data = held.for === viewer ? held.data : null
  const pick = (next: string | null) => {
    setRivalsScope(next)
    setGroup(next)
  }
  return { data, group: data?.scope.kind === 'group' ? data.scope.id : null, pick }
}

/** "3, 7, 14, 30 and 100". */
function andList(items: readonly (string | number)[]): string {
  const words = items.map(String)
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : (words[0] ?? '')
}

/** The day, in the words the page opens with: how many dailies, how long, and what keeps the streak. */
function dayLine({ total, rule }: Ticket): string | null {
  if (!total) return null
  const dailies = total === 1 ? 'One daily, about a minute.' : `${capital(numberWord(total))} dailies, about a minute each.`
  return rule.count > TODAY_KEEP
    ? `${dailies} Any ${numberWord(rule.need)} keep your streak; all ${numberWord(total)} is a Full ticket.`
    : `${dailies} Finish all ${numberWord(total)} to keep your streak going.`
}

/** The page's head: the day, and where it stands, the streak with it once signed in. */
function TodayHead({ ticket, signedIn, loading }: { ticket: Ticket; signedIn: boolean; loading: boolean }) {
  const { day, done, total, marks, current, server } = ticket
  const line = dayLine(ticket)
  return (
    <section className="today-head" aria-labelledby="today-page-title">
      <div className="today-head__text">
        <span className="today-head__kicker">
          <i aria-hidden="true" />
          Dailies
        </span>
        <h1 id="today-page-title" className="today-head__title">
          {fullDate(day)}
        </h1>
        {line ? <p className="today-head__line">{line}</p> : null}
      </div>
      <div className="today-head__side">
        {/* The streak is the API's: until it answers, nothing rather than a streak of none. */}
        {signedIn ? (
          server ? (
            <div className="today-head__streak">
              <span className={`today-head__flame${marks.full ? ' today-head__flame--full' : ''}`}>{marks.full ? <StarIcon /> : <FlameIcon />}</span>
              <span className="today-head__streak-text">
                <b>{current > 0 ? `Day ${current}` : 'No streak yet'}</b>
                <span>{streakLine(ticket)}</span>
                {server.freezes ? <StreakFreezes freezes={server.freezes} className="sfz--head" /> : null}
              </span>
            </div>
          ) : null
        ) : loading ? null : (
          <button type="button" className="today-head__signin" onClick={openSiteMenu}>
            <FlameIcon />
            Sign in to keep a streak
          </button>
        )}
        {total ? (
          <div className="today-head__progress">
            <span className={`today-head__bar${marks.full ? ' today-head__bar--full' : ''}`} aria-hidden="true">
              {ticket.punches.map((p, i) => (
                <i key={p.key} className={`today-head__seg${i < done ? ' today-head__seg--on' : ''}`} />
              ))}
            </span>
            {done} of {total} done
          </div>
        ) : null}
      </div>
    </section>
  )
}

/** A past day's head: the day, and, signed in, whether it was kept and the streak with it then. */
function PastHead({ day, said, streak, signedIn }: { day: string; said: TodayServerDay | undefined; streak: number; signedIn: boolean }) {
  const mark = said ? markOf(said) : null
  const count = said ? doneOf(said) : null
  return (
    <section className="today-head" aria-labelledby="today-page-title">
      <div className="today-head__text">
        <span className="today-head__kicker">
          <i aria-hidden="true" />
          Dailies
        </span>
        <h1 id="today-page-title" className="today-head__title">
          {fullDate(day)}
        </h1>
        <p className="today-head__line">A past day, as it finished. Playing it again never changes what it counted.</p>
      </div>
      <div className="today-head__side">
        {signedIn && mark ? (
          <div className="today-head__streak">
            <span className={`today-head__flame${mark === 'full' ? ' today-head__flame--full' : mark === 'frozen' ? ' today-head__flame--frozen' : ''}`}>
              {mark === 'full' ? <StarIcon /> : mark === 'kept' ? <CheckIcon /> : mark === 'frozen' ? <FreezeIcon /> : <FlameIcon />}
            </span>
            <span className="today-head__streak-text">
              <b>{mark === 'full' ? 'Full ticket' : mark === 'kept' ? 'Kept' : mark === 'frozen' ? 'Frozen' : mark === 'played' ? 'Not kept' : 'Missed'}</b>
              <span>
                {(mark === 'kept' || mark === 'full') && streak > 0
                  ? `Day ${streak} of your streak`
                  : mark === 'frozen'
                    ? `A streak freeze covered it${streak > 0 ? `: your streak stayed at ${streak}` : ''}`
                    : 'It didn’t keep the streak'}
              </span>
            </span>
          </div>
        ) : null}
        {count?.of ? (
          <div className="today-head__progress">
            <span className={`today-head__bar${mark === 'full' ? ' today-head__bar--full' : ''}`} aria-hidden="true">
              {Array.from({ length: count.of }, (_, i) => (
                <i key={i} className={`today-head__seg${i < count.done ? ' today-head__seg--on' : ''}`} />
              ))}
            </span>
            {count.done} of {count.of} done
          </div>
        ) : null}
      </div>
    </section>
  )
}

/** The calendar's weeks: five, Monday first, the last the one that holds today. */
const CALENDAR_WEEKS = 5
const CALENDAR_HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * A day on the calendar: a Full ticket, kept, today and still open, missed, or blank: before the Today set
 * began, after today, or a day an older API didn't say.
 */
type CalendarState = 'full' | 'kept' | 'open' | 'frozen' | 'missed' | 'before' | 'after' | 'unknown'

function calendarDays({ day: today, server, marks }: Ticket): { day: string; state: CalendarState }[] {
  // The API's last five weeks, or an older API's last seven days. Today's punches count at once, as on the ticket.
  const known = new Map((server?.days ?? server?.week ?? []).map((d) => [d.day, d]))
  const since = server?.since ?? null
  const monday = addDays(today, -((dayParts(today).weekday + 6) % 7))
  const first = addDays(monday, -7 * (CALENDAR_WEEKS - 1))
  return Array.from({ length: CALENDAR_WEEKS * 7 }, (_, i): { day: string; state: CalendarState } => {
    const day = addDays(first, i)
    if (day > today) return { day, state: 'after' }
    if (since && day < since) return { day, state: 'before' }
    const said = known.get(day)
    if (day === today) {
      if (said?.full || marks.full) return { day, state: 'full' }
      return { day, state: said?.kept || marks.kept ? 'kept' : 'open' }
    }
    if (!said) return { day, state: 'unknown' }
    return { day, state: said.full ? 'full' : said.kept ? 'kept' : said.frozen ? 'frozen' : 'missed' }
  })
}

const monthDay = (day: string) =>
  dayParts(day).date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** Your last five weeks: the days you kept, your Full tickets, the ones missed, and today. Each opens its ticket. */
function YourDays({ ticket, picked }: { ticket: Ticket; picked: string }) {
  const days = calendarDays(ticket)
  const more = ticket.rule.count > TODAY_KEEP || days.some((d) => d.state === 'full')
  // Each day, said aloud: "Friday, September 25: kept".
  const words: Record<CalendarState, string> = {
    full: 'Full ticket',
    kept: 'kept',
    open: `today, ${ticket.left} to go`,
    frozen: 'missed, a streak freeze covered it',
    missed: 'missed',
    before: 'before the Dailies began',
    after: 'still to come',
    unknown: 'not known',
  }
  return (
    <section className="today-days" aria-labelledby="today-days-title">
      <div className="today-days__head">
        <h2 id="today-days-title">Your days</h2>
        <span className="today-days__range">
          {monthDay(days[0]!.day)} to {monthDay(days.at(-1)!.day)}
        </span>
      </div>
      <div className="today-days__names" aria-hidden="true">
        {CALENDAR_HEAD.map((name, i) => (
          <span key={i}>{name}</span>
        ))}
      </div>
      <ol className="today-days__grid">
        {days.map(({ day, state }) => {
          const n = dayParts(day).date.getUTCDate()
          const inner = (
            <>
              <span className="today-days__mark" aria-hidden="true">
                {state === 'full' ? (
                  <StarIcon />
                ) : state === 'kept' ? (
                  <CheckIcon />
                ) : state === 'frozen' ? (
                  <FreezeIcon />
                ) : state === 'open' ? (
                  ticket.left
                ) : null}
              </span>
              {/* The first of a month says which. */}
              <span className="today-days__n" aria-hidden="true">
                {n === 1 ? monthDay(day) : n}
              </span>
              <span className="visually-hidden">{`${fullDate(day)}: ${words[state]}`}</span>
            </>
          )
          const open = state !== 'before' && state !== 'after'
          return (
            <li key={day} className={`today-days__day today-days__day--${state}${day === picked ? ' today-days__day--picked' : ''}`}>
              {open ? (
                <a className="today-days__link" href={todayHref(day === ticket.day ? undefined : day)} aria-current={day === picked ? 'date' : undefined}>
                  {inner}
                </a>
              ) : (
                inner
              )}
            </li>
          )
        })}
      </ol>
      <p className="today-week__key today-days__key" aria-hidden="true">
        <span className="today-week__key-kept">Kept</span>
        {more ? <span className="today-week__key-full">Full ticket</span> : null}
        {days.some((d) => d.state === 'frozen') ? <span className="today-week__key-frozen">Frozen</span> : null}
      </p>
    </section>
  )
}

function Rewards({ current, best }: { current: number; best: number }) {
  const next = TODAY_MILESTONES.find((m) => m.day > best)
  return (
    <section className="today-rewards" aria-labelledby="today-rewards-title">
      <div className="today-rewards__head">
        <h2 id="today-rewards-title">Streak rewards</h2>
        <p>Looks for your badge, never score. Only a streak earns them.</p>
      </div>
      <ol className="today-rewards__list">
        {TODAY_MILESTONES.map((m) => {
          const got = best >= m.day
          const isNext = m === next
          return (
            <li key={m.day} className={`today-reward${got ? ' today-reward--got' : isNext ? ' today-reward--next' : ''}`}>
              <span className="today-reward__mark">{got ? <CheckIcon /> : isNext ? <GiftIcon /> : <LockIcon />}</span>
              <span className="visually-hidden">{got ? 'Earned: ' : isNext ? 'Next: ' : 'Not yet: '}</span>
              <b className="today-reward__day">Day {m.day}</b>
              <span className="today-reward__what">
                <span className="today-reward__prize">{m.prize}</span>
                {isNext ? <span className="today-reward__togo">{daysToGo(m.day - current)}</span> : null}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** The day's share, shown as the ticket's Share sends it, with the same Share. */
function SendDay({ ticket }: { ticket: Ticket }) {
  const { day, done, all, shareText } = ticket
  return (
    <section className="today-send" aria-labelledby="today-send-title">
      <h2 id="today-send-title">Your day, to send</h2>
      {done > 0 ? (
        <>
          <p className="today-send__text">{`${shareText}\n${todayShareUrl(day)}`}</p>
          <ShareDay text={shareText} day={day} all={all} className="today-send__share" />
        </>
      ) : (
        <p className="today-send__none">Punch one and it’s here to send: how each went, and nothing that gives the day away.</p>
      )}
    </section>
  )
}

/** Signed out: what an account keeps. */
function KeepAStreak() {
  return (
    <section className="today-invite" aria-labelledby="today-invite-title">
      <div className="today-invite__text">
        <h2 id="today-invite-title">Keep a streak</h2>
        <p>
          Sign in, and every day you keep adds to a streak, with tickets and looks for your badge at {andList(TODAY_MILESTONES.map((m) => m.day))} days.
          Every week in a row earns a freeze too, for a day you miss. Your last five weeks and your friends’ day are here too.
        </p>
      </div>
      <button type="button" className="today-invite__go" onClick={openSiteMenu}>
        Sign in
      </button>
    </section>
  )
}

export function TodayPage() {
  const { signedIn, loading } = useAuth()
  // Who's looking: the ticket is theirs, and never another account's that played on this device.
  const viewer = useAccountId()
  const ticket = useTicket(viewer)
  const rivals = useRivals(signedIn, viewer)
  const route = useRoute()
  const name = normalizePlayerName(usePlayerName())
  const today = ticket.day
  const since = ticket.server?.since ?? TODAY_SINCE_FALLBACK
  const asked = route.name === 'today' ? route.day : undefined
  // A day picked: today, or one still to come, is the page itself, and a day before the Dailies has no ticket.
  const day = asked && asked < today && asked >= since ? asked : null
  useEffect(() => {
    if (asked && !day) navigate(todayHref(), { replace: true })
  }, [asked, day])
  const known = useAccountDays(signedIn, day ? [monthOf(day)] : [])
  const said = day ? known.get(day) : undefined
  const streak = day ? streakThrough(day, known, (d) => addDays(d, -1)) : 0
  const todayMark: DayMark = ticket.marks.full ? 'full' : ticket.marks.kept ? 'kept' : ticket.done > 0 ? 'played' : 'none'
  return (
    <PageShell innerClassName="lb-page__inner today-page">
      {day ? (
        <PastHead day={day} said={said} streak={streak} signedIn={signedIn} />
      ) : (
        <TodayHead ticket={ticket} signedIn={signedIn} loading={loading} />
      )}
      <DayStrip
        today={today}
        picked={day ?? today}
        since={since}
        known={known}
        todayCount={{ done: ticket.done, of: ticket.total, mark: todayMark }}
        signedIn={signedIn}
      />
      <div className={`today-page__grid${signedIn ? ' today-page__grid--side' : ''}`}>
        <div className="today-page__main">
          {day ? (
            <PastDayTicket day={day} said={said} streak={streak} name={name} signedIn={signedIn} />
          ) : (
            <TodayCard ticket={ticket} signedIn={signedIn} />
          )}
          {signedIn ? (
            day ? null : (
              <TodayRivals data={rivals.data} dailies={ticket.live} group={rivals.group} onPick={rivals.pick} />
            )
          ) : loading ? null : (
            <KeepAStreak />
          )}
        </div>
        {signedIn ? (
          <div className="today-page__side">
            <YourDays ticket={ticket} picked={day ?? today} />
            <Rewards current={ticket.current} best={ticket.best} />
            {day ? null : <SendDay ticket={ticket} />}
          </div>
        ) : null}
      </div>
    </PageShell>
  )
}
