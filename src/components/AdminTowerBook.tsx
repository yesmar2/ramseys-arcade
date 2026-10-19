import { useMemo, useState } from 'react'
import { TowerPostcard } from '../games/sling/TowerPostcard'
import { dayOfTower, towerDay, PLANNED_TOWERS } from '../games/sling/daily'
import { DAILY_TOWERS, type PlannedTower } from '../games/sling/dailyPlan'
import { towerRunHref } from '../games/sling/links'
import { formatRun } from '../games/sling/score'
import { plannedTower, SECTION_NAMES, type Tower } from '../games/sling/sim'
import { gamePlayHref } from '../hooks/useHashRoute'
import '../styles/adminBooks.css'
import '../styles/towerBook.css'

/*
 * The admin's Tower Book: every day of Sling's tower of the day that's planned (dailyPlan.ts), a stretch of it
 * drawn as its postcard, with its blue blip's climb, its pegs and its sections in order. Today's and any still to
 * come can be test climbed ahead of their day (TestCards.tsx), past ones climbed as practice; neither keeps a run.
 */

const SLUG = 'sling'

type BookTower = {
  n: number
  day: string
  name: string
  /** The blue blip's climb, in seconds. */
  pace: number
  tower: Tower
  pegs: number
  /** Its sections, bottom to top, past the first steps. */
  sections: string
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const dateOf = (day: string) => new Date(`${day}T12:00:00Z`)
const dayWords = (day: string) => dayFormat.format(dateOf(day))

function bookTower(entry: PlannedTower, i: number): BookTower {
  const n = i + 1
  const tower = plannedTower(n, entry.a)
  return {
    n,
    day: dayOfTower(n),
    name: entry.name,
    pace: entry.pace / 1000,
    tower,
    pegs: tower.pegs.length - 1,
    sections: tower.sections.slice(1, -1).map((sec) => SECTION_NAMES[sec.kind]).join(', '),
  }
}

export function AdminTowerBook() {
  const today = towerDay()
  const days = useMemo(() => DAILY_TOWERS.map(bookTower), [])
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState<string>('all')

  const todays = days.find((d) => d.day === today)
  // Before the first day, the first tower is the one coming.
  const next = todays ? days[todays.n] : today < (days[0]?.day ?? '') ? days[0] : undefined
  const months = useMemo(() => [...new Set(days.map((d) => d.day.slice(0, 7)))], [days])
  const q = query.trim().toLowerCase().replace(/^#/, '')
  const shown = days.filter((d) => (month === 'all' || d.day.startsWith(month)) && (!q || d.name.toLowerCase().includes(q) || String(d.n) === q))
  const groups = months.map((key) => ({ key, days: shown.filter((d) => d.day.startsWith(key)) })).filter((g) => g.days.length)
  const last = days[days.length - 1]

  return (
    <div className="tb twb">
      <section className="adm-card" aria-labelledby="twb-title">
        <h2 className="adm-card__title" id="twb-title">
          Sling · Today’s Tower
        </h2>
        <p className="adm-card__sub">
          Every day’s tower planned, a new one each day at midnight New York time, the same for everyone. Each was kept
          once the blue blip climbed it clean in a fair time. Test climb today’s or any still to come, ahead of its day: a
          test run goes on no board. Past ones climb as practice.
          {last ? ` The plan runs to #${last.n} on ${dayWords(last.day)}, ${last.day.slice(0, 4)}; after that the days go round again from #1.` : ''}
        </p>
        <div className="tb-feature__acts" style={{ marginTop: '0.8rem', alignItems: 'center' }}>
          <a className="panel__btn panel__btn--ghost adm-small" href={`${gamePlayHref(SLUG)}?lab=1`}>
            Test tower: every section →
          </a>
          <p className="tb-feature__next">
            Every section once, bottom to top: sliders, carousel, clay, brambles, bugs, updraft, boost, sweepers. A new one each load.
          </p>
        </div>
        {todays ? (
          <div className="tb-feature">
            <TowerPostcard tower={todays.tower} w={480} h={300} className="twb-map" />
            <div className="tb-feature__text">
              <span className="hb-badge">Today · #{todays.n}</span>
              <h3 className="tb-feature__name">{todays.name}</h3>
              <p className="tb-feature__facts">
                {dayWords(todays.day)} · blue blip {formatRun(todays.pace)} · {todays.pegs} pegs · {todays.sections}
              </p>
              <div className="tb-feature__acts">
                <a className="panel__btn adm-small" href={towerRunHref(todays.day)}>
                  Test climb
                </a>
                <a className="panel__btn panel__btn--ghost adm-small" href={gamePlayHref(SLUG)}>
                  Climb it for real
                </a>
              </div>
              {next ? (
                <p className="tb-feature__next">
                  Tomorrow:{' '}
                  <a href={towerRunHref(next.day)}>
                    #{next.n} {next.name}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        ) : next ? (
          <p className="adm-note">
            The first tower comes {dayWords(next.day)}:{' '}
            <a href={towerRunHref(next.day)}>
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
          placeholder="Find a tower by name or number"
          aria-label="Find a tower"
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
          <section key={group.key} className="tb-month" aria-labelledby={`twb-${group.key}`}>
            <h3 className="tb-month__name" id={`twb-${group.key}`}>
              {monthFormat.format(dateOf(`${group.key}-15`))}
              <span>
                {group.days.length} {group.days.length === 1 ? 'day' : 'days'}
              </span>
            </h3>
            <div className="tb-grid">
              {group.days.map((day) => (
                <TowerTile key={day.n} day={day} today={today} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="adm-note">No tower in the plan goes by that.</p>
      )}
      <p className="adm-note twb-note">{PLANNED_TOWERS} days planned.</p>
    </div>
  )
}

function TowerTile({ day, today }: { day: BookTower; today: string }) {
  const isToday = day.day === today
  const past = day.day < today
  return (
    <a
      className={`tb-tile${isToday ? ' tb-tile--today' : ''}${past ? ' tb-tile--past' : ''}`}
      href={towerRunHref(day.day)}
      aria-label={`#${day.n} ${day.name}, ${dayWords(day.day)}: ${past ? 'climb it as practice' : 'test climb it'}`}
    >
      <div className="tb-tile__map">
        <TowerPostcard tower={day.tower} w={480} h={300} className="twb-map" />
        <span className="tb-tag">{isToday ? `Today · #${day.n}` : `#${day.n}`}</span>
      </div>
      <div className="tb-tile__body">
        <span className="tb-tile__date">{dayWords(day.day)}</span>
        <h4 className="tb-tile__name">{day.name}</h4>
        <dl className="tb-figs">
          <div>
            <dt>Blue blip</dt>
            <dd>{formatRun(day.pace)}</dd>
          </div>
          <div>
            <dt>Pegs</dt>
            <dd>{day.pegs}</dd>
          </div>
        </dl>
        <p className="tb-tile__date">{day.sections}</p>
        <span className="tb-tile__go">{past ? 'Practice →' : 'Test climb →'}</span>
      </div>
    </a>
  )
}
