import { useMemo, useState } from 'react'
import { HillsDrawing } from '../games/swoop/HillsDrawing'
import { dayOfHills, hillsDay, PLANNED_HILLS } from '../games/swoop/daily'
import { DAILY_HILLS, type PlannedHills } from '../games/swoop/dailyPlan'
import { hillsRunHref } from '../games/swoop/links'
import { formatRun } from '../games/swoop/score'
import { hillsSpan, plannedHills, type Hills } from '../games/swoop/sim'
import { gamePlayHref } from '../hooks/useHashRoute'
import '../styles/adminBooks.css'
import '../styles/hillsBook.css'

/*
 * The admin's Hills Book: every day of Swoop's hills of the day that's planned (dailyPlan.ts), drawn from the
 * side, with its blue bird's run, its length, its tops and how far it rises and falls. Today's and any still to
 * come can be test flown ahead of their day (TestCards.tsx), past ones flown as practice; neither keeps a run.
 */

const SLUG = 'swoop'

type BookHills = {
  n: number
  day: string
  name: string
  /** The blue bird's run, in seconds. */
  pace: number
  hills: Hills
  /** From the start to the line, in metres. */
  metres: number
  tops: number
  /** From the lowest point to the highest, in metres. */
  rise: number
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const dateOf = (day: string) => new Date(`${day}T12:00:00Z`)
const dayWords = (day: string) => dayFormat.format(dateOf(day))

function bookHills(entry: PlannedHills, i: number): BookHills {
  const n = i + 1
  const hills = plannedHills(n, entry.a)
  const [lo, hi] = hillsSpan(hills)
  return {
    n,
    day: dayOfHills(n),
    name: entry.name,
    pace: entry.pace / 1000,
    hills,
    metres: Math.round(hills.finish),
    tops: hills.tops,
    rise: Math.round(hi - lo),
  }
}

export function AdminHillsBook() {
  const today = hillsDay()
  const days = useMemo(() => DAILY_HILLS.map(bookHills), [])
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState<string>('all')

  const todays = days.find((d) => d.day === today)
  // Before the first day, the first hills are the ones coming.
  const next = todays ? days[todays.n] : today < (days[0]?.day ?? '') ? days[0] : undefined
  const months = useMemo(() => [...new Set(days.map((d) => d.day.slice(0, 7)))], [days])
  const q = query.trim().toLowerCase().replace(/^#/, '')
  const shown = days.filter((d) => (month === 'all' || d.day.startsWith(month)) && (!q || d.name.toLowerCase().includes(q) || String(d.n) === q))
  const groups = months.map((key) => ({ key, days: shown.filter((d) => d.day.startsWith(key)) })).filter((g) => g.days.length)
  const last = days[days.length - 1]

  return (
    <div className="tb hlb">
      <section className="adm-card" aria-labelledby="hlb-title">
        <h2 className="adm-card__title" id="hlb-title">
          Swoop · Today’s Hills
        </h2>
        <p className="adm-card__sub">
          Every day’s hills planned, new ones each day at midnight New York time, the same for everyone. Each was kept
          once the blue bird flew them in a fair time. Test fly today’s or any still to come, ahead of their day: a test
          run goes on no board. Past ones fly as practice.
          {last ? ` The plan runs to #${last.n} on ${dayWords(last.day)}, ${last.day.slice(0, 4)}; after that the days go round again from #1.` : ''}
        </p>
        {todays ? (
          <div className="tb-feature">
            <HillsDrawing hills={todays.hills} className="hlb-map" />
            <div className="tb-feature__text">
              <span className="hb-badge">Today · #{todays.n}</span>
              <h3 className="tb-feature__name">{todays.name}</h3>
              <p className="tb-feature__facts">
                {dayWords(todays.day)} · blue bird {formatRun(todays.pace)} · {todays.metres} m · {todays.tops} tops · {todays.rise} m from
                lowest to highest
              </p>
              <div className="tb-feature__acts">
                <a className="panel__btn adm-small" href={hillsRunHref(todays.day)}>
                  Test fly
                </a>
                <a className="panel__btn panel__btn--ghost adm-small" href={gamePlayHref(SLUG)}>
                  Fly them for real
                </a>
              </div>
              {next ? (
                <p className="tb-feature__next">
                  Tomorrow:{' '}
                  <a href={hillsRunHref(next.day)}>
                    #{next.n} {next.name}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        ) : next ? (
          <p className="adm-note">
            The first hills come {dayWords(next.day)}:{' '}
            <a href={hillsRunHref(next.day)}>
              #{next.n} {next.name}
            </a>
            .
          </p>
        ) : null}
      </section>

      <div className="hb-tools">
        <input
          className="panel__input adm-input tb-search"
          type="search"
          value={query}
          placeholder="Find hills by name or number"
          aria-label="Find hills"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="chips" role="group" aria-label="Month">
          {['all', ...months].map((key) => (
            <button
              key={key}
              type="button"
              className={`chips__item${month === key ? ' chips__item--active' : ''}`}
              aria-pressed={month === key}
              onClick={() => setMonth(key)}
            >
              {key === 'all' ? 'Every month' : `${monthShort.format(dateOf(`${key}-15`))} ’${key.slice(2, 4)}`}
            </button>
          ))}
        </div>
        <p className="hb-count" aria-live="polite">
          {shown.length} {shown.length === 1 ? 'day' : 'days'}
        </p>
      </div>

      {groups.length ? (
        groups.map((group) => (
          <section key={group.key} className="tb-month" aria-labelledby={`hlb-${group.key}`}>
            <h3 className="tb-month__name" id={`hlb-${group.key}`}>
              {monthFormat.format(dateOf(`${group.key}-15`))}
              <span>
                {group.days.length} {group.days.length === 1 ? 'day' : 'days'}
              </span>
            </h3>
            <div className="tb-grid">
              {group.days.map((day) => (
                <HillsTile key={day.n} day={day} today={today} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="adm-note">No hills in the plan go by that.</p>
      )}
      <p className="adm-note hlb-note">{PLANNED_HILLS} days planned.</p>
    </div>
  )
}

function HillsTile({ day, today }: { day: BookHills; today: string }) {
  const isToday = day.day === today
  const past = day.day < today
  return (
    <a
      className={`tb-tile${isToday ? ' tb-tile--today' : ''}${past ? ' tb-tile--past' : ''}`}
      href={hillsRunHref(day.day)}
      aria-label={`#${day.n} ${day.name}, ${dayWords(day.day)}: ${past ? 'fly them as practice' : 'test fly them'}`}
    >
      <div className="tb-tile__map">
        <HillsDrawing hills={day.hills} className="hlb-map" />
        <span className="tb-tag">{isToday ? `Today · #${day.n}` : `#${day.n}`}</span>
      </div>
      <div className="tb-tile__body">
        <span className="tb-tile__date">{dayWords(day.day)}</span>
        <h4 className="tb-tile__name">{day.name}</h4>
        <dl className="tb-figs">
          <div>
            <dt>Blue bird</dt>
            <dd>{formatRun(day.pace)}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>{day.metres} m</dd>
          </div>
          <div>
            <dt>Tops</dt>
            <dd>{day.tops}</dd>
          </div>
        </dl>
        <span className="tb-tile__go">{past ? 'Practice →' : 'Test fly →'}</span>
      </div>
    </a>
  )
}
