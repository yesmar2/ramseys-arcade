import { useMemo, useState } from 'react'
import { GauntletDrawing, RoundIcon } from '../games/wobblerun/GauntletDrawing'
import { dayOfGauntlet, gauntletDay, PLANNED_GAUNTLETS } from '../games/wobblerun/daily'
import { DAILY_GAUNTLETS, type PlannedGauntlet } from '../games/wobblerun/dailyPlan'
import { gauntletRounds, roundsWords, type GauntletRound } from '../games/wobblerun/gauntletPicture'
import { gamePlayHref } from '../hooks/useHashRoute'
import '../styles/adminBooks.css'
import '../styles/gauntletBook.css'

/*
 * The admin's Gauntlet Book: every day of Wobble Run's gauntlet of the day that's planned (dailyPlan.ts), its
 * rounds to the crown as the players' cards draw them, with each round's tier and the blue bean's run. Today's
 * and any still to come can be test run ahead of their day (?track=<n>, TestCards.tsx), past ones run as
 * practice; neither keeps a run. The test course (?lab=1) has every round at every tier in a row.
 */

const SLUG = 'wobblerun'

type BookGauntlet = {
  n: number
  day: string
  name: string
  /** The blue bean's run, in seconds. */
  pace: number
  k: string
  rounds: GauntletRound[]
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const dateOf = (day: string) => new Date(`${day}T12:00:00Z`)
const dayWords = (day: string) => dayFormat.format(dateOf(day))

/** Gauntlet `n` on the play page: a test run from today on, practice before (WobbleRunPage.tsx reads ?track=). */
const runHref = (n: number) => `${gamePlayHref(SLUG)}?track=${n}`

/** 86.0s, or 1:26.0 past a minute: the blue bean's run, to the tenth. */
function paceWords(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return m > 0 ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)}s`
}

const TIER_WORDS = ['', 'gentle', 'usual', 'spicy']

function bookGauntlet(entry: PlannedGauntlet, i: number): BookGauntlet {
  const n = i + 1
  return { n, day: dayOfGauntlet(n), name: entry.name, pace: entry.pace / 1000, k: entry.k, rounds: gauntletRounds(entry.k) }
}

/** The day's rounds in order as chips: each round's drawing, its name and its tier. */
function RoundChips({ rounds }: { rounds: GauntletRound[] }) {
  return (
    <ol className="gtb-rounds" aria-label="Rounds">
      {rounds.map((round) => (
        <li key={round.letter} className={`gtb-round gtb-round--t${round.tier}`}>
          <RoundIcon letter={round.letter} size={22} className="gtb-round__icon" />
          <span className="gtb-round__name">{round.name}</span>
          <span className="gtb-round__tier" title={`Tier ${round.tier}: ${TIER_WORDS[round.tier] ?? ''}`}>
            T{round.tier}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function AdminGauntletBook() {
  const today = gauntletDay()
  const days = useMemo(() => DAILY_GAUNTLETS.map(bookGauntlet), [])
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState<string>('all')

  const todays = days.find((d) => d.day === today)
  // Before the first day, the first gauntlet is the one coming.
  const next = todays ? days[todays.n] : today < (days[0]?.day ?? '') ? days[0] : undefined
  const months = useMemo(() => [...new Set(days.map((d) => d.day.slice(0, 7)))], [days])
  const q = query.trim().toLowerCase().replace(/^#/, '')
  const shown = days.filter(
    (d) => (month === 'all' || d.day.startsWith(month)) && (!q || d.name.toLowerCase().includes(q) || String(d.n) === q || d.rounds.some((r) => r.name.toLowerCase().includes(q))),
  )
  const groups = months.map((key) => ({ key, days: shown.filter((d) => d.day.startsWith(key)) })).filter((g) => g.days.length)
  const last = days[days.length - 1]

  return (
    <div className="tb gtb">
      <section className="adm-card" aria-labelledby="gtb-title">
        <h2 className="adm-card__title" id="gtb-title">
          Wobble Run · Today’s Gauntlet
        </h2>
        <p className="adm-card__sub">
          Every day’s gauntlet planned, a new one each day at midnight New York time, the same for everyone: four rounds
          and a finale to the crown. Each was kept once the blue bean ran it clean in a fair time. Test run today’s or
          any still to come, ahead of their day: a test run goes on no board. Past ones run as practice.
          {last ? ` The plan runs to #${last.n} on ${dayWords(last.day)}, ${last.day.slice(0, 4)}; after that the days go round again from #1.` : ''}
        </p>
        <div className="tb-feature__acts" style={{ marginTop: '0.8rem', alignItems: 'center' }}>
          <a className="panel__btn panel__btn--ghost adm-small" href={`${gamePlayHref(SLUG)}?lab=1`}>
            Test course: every round →
          </a>
          <p className="tb-feature__next">Every round at every tier in a row, a checkpoint before each. Nothing in it is saved.</p>
        </div>
        {todays ? (
          <div className="tb-feature">
            <GauntletDrawing gauntlet={todays} name={todays.name} w={480} h={300} className="gtb-map" />
            <div className="tb-feature__text">
              <span className="hb-badge">Today · #{todays.n}</span>
              <h3 className="tb-feature__name">{todays.name}</h3>
              <p className="tb-feature__facts">
                {dayWords(todays.day)} · blue bean {paceWords(todays.pace)} · code {todays.k}
              </p>
              <RoundChips rounds={todays.rounds} />
              <div className="tb-feature__acts">
                <a className="panel__btn adm-small" href={runHref(todays.n)}>
                  Test run
                </a>
                <a className="panel__btn panel__btn--ghost adm-small" href={gamePlayHref(SLUG)}>
                  Run it for real
                </a>
              </div>
              {next ? (
                <p className="tb-feature__next">
                  Tomorrow:{' '}
                  <a href={runHref(next.n)}>
                    #{next.n} {next.name}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        ) : next ? (
          <p className="adm-note">
            The first gauntlet comes {dayWords(next.day)}:{' '}
            <a href={runHref(next.n)}>
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
          placeholder="Find a gauntlet by name, number or round"
          aria-label="Find a gauntlet"
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
          <section key={group.key} className="tb-month" aria-labelledby={`gtb-${group.key}`}>
            <h3 className="tb-month__name" id={`gtb-${group.key}`}>
              {monthFormat.format(dateOf(`${group.key}-15`))}
              <span>
                {group.days.length} {group.days.length === 1 ? 'day' : 'days'}
              </span>
            </h3>
            <div className="tb-grid">
              {group.days.map((day) => (
                <GauntletTile key={day.n} day={day} today={today} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="adm-note">No gauntlet in the plan goes by that.</p>
      )}
      <p className="adm-note gtb-note">{PLANNED_GAUNTLETS} days planned.</p>
    </div>
  )
}

function GauntletTile({ day, today }: { day: BookGauntlet; today: string }) {
  const isToday = day.day === today
  const past = day.day < today
  const spicy = day.rounds.filter((r) => r.tier === 3).length
  return (
    <a
      className={`tb-tile${isToday ? ' tb-tile--today' : ''}${past ? ' tb-tile--past' : ''}`}
      href={runHref(day.n)}
      aria-label={`#${day.n} ${day.name}, ${dayWords(day.day)}: ${past ? 'run it as practice' : 'test run it'}`}
    >
      <div className="tb-tile__map">
        <GauntletDrawing gauntlet={day} name={day.name} w={480} h={300} className="gtb-map" />
        <span className="tb-tag">{isToday ? `Today · #${day.n}` : `#${day.n}`}</span>
      </div>
      <div className="tb-tile__body">
        <span className="tb-tile__date">{dayWords(day.day)}</span>
        <h4 className="tb-tile__name">{day.name}</h4>
        <p className="gtb-tile__rounds">{roundsWords(day.k)}</p>
        <dl className="tb-figs">
          <div>
            <dt>Blue bean</dt>
            <dd>{paceWords(day.pace)}</dd>
          </div>
          <div>
            <dt>Tiers</dt>
            <dd>{day.rounds.map((r) => r.tier).join(' ')}</dd>
          </div>
          <div>
            <dt>Spicy</dt>
            <dd>{spicy}</dd>
          </div>
        </dl>
        <span className="tb-tile__go">{past ? 'Practice →' : 'Test run →'}</span>
      </div>
    </a>
  )
}
