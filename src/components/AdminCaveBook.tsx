import { useMemo, useState } from 'react'
import { CaveDrawing } from '../games/lander/CaveDrawing'
import { caveDay, dayOfCave, PLANNED_CAVES } from '../games/lander/daily'
import { DAILY_CAVES, type PlannedCave } from '../games/lander/dailyPlan'
import { caveRunHref } from '../games/lander/links'
import { formatRun } from '../games/lander/score'
import { caveDepth, caveThings, plannedCave, type Cave, type Stretch } from '../games/lander/sim'
import { gamePlayHref } from '../hooks/useHashRoute'
import '../styles/adminBooks.css'
import '../styles/caveBook.css'

/*
 * The admin's Cave Book: every day of Lander's cave of the day that's planned (dailyPlan.ts), drawn from the
 * side, with its blue ship's run, its length, its depth, its gates and its stretches. Today's and any still to
 * come can be test flown ahead of its day (TestCards.tsx), a past one flown as practice; neither keeps a run.
 */

const SLUG = 'lander'

type BookCave = {
  n: number
  day: string
  name: string
  /** The blue ship's run, in seconds. */
  pace: number
  cave: Cave
  metres: number
  /** From the start pad down to the landing pad, in metres. */
  depth: number
  gates: number
}

const STRETCH_WORDS: Record<Stretch, string> = {
  shaft: 'shaft',
  corridor: 'corridor',
  climb: 'climb',
  zigzag: 'zigzag',
  squeeze: 'squeeze',
  chamber: 'chamber',
  hairpin: 'hairpin',
  slant: 'slant',
  sump: 'flooded dip',
  fork: 'fork',
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const dateOf = (day: string) => new Date(`${day}T12:00:00Z`)
const dayWords = (day: string) => dayFormat.format(dateOf(day))

function bookCave(entry: PlannedCave, i: number): BookCave {
  const n = i + 1
  const cave = plannedCave(n, entry.a, entry.t)
  return {
    n,
    day: dayOfCave(n),
    name: entry.name,
    pace: entry.pace / 1000,
    cave,
    metres: Math.round(cave.length),
    depth: Math.round(caveDepth(cave)),
    gates: cave.gates.length - 1,
  }
}

export function AdminCaveBook() {
  const today = caveDay()
  const caves = useMemo(() => DAILY_CAVES.map(bookCave), [])
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState<string>('all')

  const todays = caves.find((c) => c.day === today)
  // Before the first day, the first cave is the one coming.
  const next = todays ? caves[todays.n] : today < (caves[0]?.day ?? '') ? caves[0] : undefined
  const months = useMemo(() => [...new Set(caves.map((c) => c.day.slice(0, 7)))], [caves])
  const q = query.trim().toLowerCase().replace(/^#/, '')
  const shown = caves.filter((c) => (month === 'all' || c.day.startsWith(month)) && (!q || c.name.toLowerCase().includes(q) || String(c.n) === q))
  const groups = months.map((key) => ({ key, caves: shown.filter((c) => c.day.startsWith(key)) })).filter((g) => g.caves.length)
  const last = caves[caves.length - 1]

  return (
    <div className="tb vb">
      <section className="adm-card" aria-labelledby="vb-title">
        <h2 className="adm-card__title" id="vb-title">
          Lander · Today’s Cave
        </h2>
        <p className="adm-card__sub">
          Every cave planned, a new one each day at midnight New York time, the same for everyone. Each was kept only
          once the blue ship flew it and landed without touching the rock, in a fair time. Test fly today’s or any
          still to come, ahead of its day: a test flight’s runs go on no board. A past one flies as practice.
          {last ? ` The plan runs to #${last.n} on ${dayWords(last.day)}, ${last.day.slice(0, 4)}; after that the days go round again from #1.` : ''}
        </p>
        <p className="vb-lab">
          <a className="panel__btn adm-small" href={`${gamePlayHref(SLUG)}?lab=1`}>
            Test cave: new obstacles →
          </a>
          <span>Steam vents, crushers, a turning bar, water, low gravity, lava, a shortcut and a pad on a lift, all in one cave. Not in any day’s cave yet.</span>
        </p>
        {todays ? (
          <div className="tb-feature">
            <CaveDrawing cave={todays.cave} className="vb-map" aspect={1} />
            <div className="tb-feature__text">
              <span className="hb-badge">Today · #{todays.n}</span>
              <h3 className="tb-feature__name">{todays.name}</h3>
              <p className="tb-feature__facts">
                {dayWords(todays.day)} · blue ship {formatRun(todays.pace)} · {todays.metres} m · {todays.depth} m down · {todays.gates}{' '}
                {todays.gates === 1 ? 'gate' : 'gates'}
              </p>
              <p className="vb-stretches">{todays.cave.kinds.map((k) => STRETCH_WORDS[k]).join(' → ')}</p>
              {caveThings(todays.cave).length ? <p className="vb-things">With {caveThings(todays.cave).join(', ')}</p> : null}
              <div className="tb-feature__acts">
                <a className="panel__btn adm-small" href={caveRunHref(todays.day)}>
                  Test fly
                </a>
                <a className="panel__btn panel__btn--ghost adm-small" href={gamePlayHref(SLUG)}>
                  Fly it for real
                </a>
              </div>
              {next ? (
                <p className="tb-feature__next">
                  Tomorrow:{' '}
                  <a href={caveRunHref(next.day)}>
                    #{next.n} {next.name}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        ) : next ? (
          <p className="adm-note">
            The first cave comes {dayWords(next.day)}:{' '}
            <a href={caveRunHref(next.day)}>
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
          placeholder="Find a cave by name or number"
          aria-label="Find a cave"
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
          {shown.length} {shown.length === 1 ? 'cave' : 'caves'}
        </p>
      </div>

      {groups.length ? (
        groups.map((group) => (
          <section key={group.key} className="tb-month" aria-labelledby={`vb-${group.key}`}>
            <h3 className="tb-month__name" id={`vb-${group.key}`}>
              {monthFormat.format(dateOf(`${group.key}-15`))}
              <span>
                {group.caves.length} {group.caves.length === 1 ? 'cave' : 'caves'}
              </span>
            </h3>
            <div className="tb-grid">
              {group.caves.map((cave) => (
                <CaveTile key={cave.n} cave={cave} today={today} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="adm-note">No cave in the plan goes by that.</p>
      )}
      <p className="adm-note vb-note">{PLANNED_CAVES} caves planned.</p>
    </div>
  )
}

function CaveTile({ cave, today }: { cave: BookCave; today: string }) {
  const isToday = cave.day === today
  const past = cave.day < today
  return (
    <a
      className={`tb-tile${isToday ? ' tb-tile--today' : ''}${past ? ' tb-tile--past' : ''}`}
      href={caveRunHref(cave.day)}
      aria-label={`#${cave.n} ${cave.name}, ${dayWords(cave.day)}: ${past ? 'fly it as practice' : 'test fly it'}`}
    >
      <div className="tb-tile__map">
        <CaveDrawing cave={cave.cave} className="vb-map" aspect={1} />
        <span className="tb-tag">{isToday ? `Today · #${cave.n}` : `#${cave.n}`}</span>
      </div>
      <div className="tb-tile__body">
        <span className="tb-tile__date">{dayWords(cave.day)}</span>
        <h4 className="tb-tile__name">{cave.name}</h4>
        {caveThings(cave.cave).length ? <p className="vb-things vb-things--tile">{caveThings(cave.cave).join(' · ')}</p> : null}
        <dl className="tb-figs">
          <div>
            <dt>Blue ship</dt>
            <dd>{formatRun(cave.pace)}</dd>
          </div>
          <div>
            <dt>Depth</dt>
            <dd>{cave.depth} m</dd>
          </div>
          <div>
            <dt>Gates</dt>
            <dd>{cave.gates}</dd>
          </div>
        </dl>
        <span className="tb-tile__go">{past ? 'Practice →' : 'Test fly →'}</span>
      </div>
    </a>
  )
}
