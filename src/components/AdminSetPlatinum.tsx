import { useEffect, useState } from 'react'
import { dailyCave, caveDay, caveNumber, dayOfCave, PLANNED_CAVES } from '../games/lander/daily'
import { caveRunHref } from '../games/lander/links'
import { formatRun as formatLanderRun } from '../games/lander/score'
import { dailyCourse, courseDay, courseNumber, dayOfCourse, PLANNED_COURSES } from '../games/marblerun/daily'
import { courseRunHref } from '../games/marblerun/links'
import { formatRun as formatMarbleRun } from '../games/marblerun/score'
import { dailyTower, towerDay, towerNumber, dayOfTower, PLANNED_TOWERS } from '../games/sling/daily'
import { towerRunHref } from '../games/sling/links'
import { formatRun as formatSlingRun } from '../games/sling/score'
import { dailyHills, hillsDay, hillsNumber, dayOfHills, PLANNED_HILLS } from '../games/swoop/daily'
import { hillsRunHref } from '../games/swoop/links'
import { formatRun as formatSwoopRun } from '../games/swoop/score'
import { dailyGauntlet, gauntletDay, gauntletNumber, dayOfGauntlet, PLANNED_GAUNTLETS } from '../games/wobblerun/daily'
import { gauntletDayHref } from '../games/wobblerun/links'
import { formatRun as formatWobbleRun } from '../games/wobblerun/score'
import { dailyTrack, trackDay, trackNumber, dayOfTrack, PLANNED_TRACKS } from '../games/hotlap/daily'
import { formatLap } from '../games/hotlap/score'
import { gamePlayHref } from '../hooks/useHashRoute'
import { medalTimes, paceMsOf, type RaceGame } from '../lib/raceMedals'
import { clearSetLap, loadSetPlatinums, setLapRows, useSetPlatinums } from '../lib/setPlatinum'

/*
 * Set platinum (Ramsey, 2026-10-29: "i drive upcoming days and my best + 0.5s becomes platinum"): each race's
 * course today and the six days after it, with its platinum now and where it comes from, a link to test-drive it,
 * and a way to clear a set lap. A test run's time goes in from its own card (SetPlatinumRow): this only lists them.
 */

type Day = { day: string; n: number; name: string; pace: number; planned: number | null }

type Race = {
  game: RaceGame
  name: string
  verb: string
  today: () => string
  number: (day: string) => number
  dayOf: (n: number) => string
  /** How many days its plan has laid. */
  planned: number
  daily: (day: string) => Day
  href: (day: string, n: number) => string
  format: (seconds: number) => string
}

const RACES: readonly Race[] = [
  {
    game: 'hotlap',
    name: 'Hot Lap',
    verb: 'Drive',
    today: () => trackDay(),
    number: trackNumber,
    dayOf: dayOfTrack,
    planned: PLANNED_TRACKS,
    daily: (day) => {
      const t = dailyTrack(day)
      return { day, n: t.n, name: t.name, pace: t.pace, planned: t.platinumMs }
    },
    href: (_day, n) => `${gamePlayHref('hotlap')}?track=${n}&test=1`,
    format: formatLap,
  },
  {
    game: 'swoop',
    name: 'Swoop',
    verb: 'Fly',
    today: () => hillsDay(),
    number: hillsNumber,
    dayOf: dayOfHills,
    planned: PLANNED_HILLS,
    daily: (day) => ({ ...dailyHills(day), planned: null }),
    href: (day) => `${hillsRunHref(day)}&test=1`,
    format: formatSwoopRun,
  },
  {
    game: 'lander',
    name: 'Lander',
    verb: 'Fly',
    today: () => caveDay(),
    number: caveNumber,
    dayOf: dayOfCave,
    planned: PLANNED_CAVES,
    daily: (day) => ({ ...dailyCave(day), planned: null }),
    href: (day) => `${caveRunHref(day)}&test=1`,
    format: formatLanderRun,
  },
  {
    game: 'sling',
    name: 'Sling',
    verb: 'Climb',
    today: () => towerDay(),
    number: towerNumber,
    dayOf: dayOfTower,
    planned: PLANNED_TOWERS,
    daily: (day) => ({ ...dailyTower(day), planned: null }),
    href: (day) => `${towerRunHref(day)}&test=1`,
    format: formatSlingRun,
  },
  {
    game: 'marblerun',
    name: 'Marble Run',
    verb: 'Roll',
    today: () => courseDay(),
    number: courseNumber,
    dayOf: dayOfCourse,
    planned: PLANNED_COURSES,
    daily: (day) => ({ ...dailyCourse(day), planned: null }),
    href: (day) => `${courseRunHref(day)}&test=1`,
    format: formatMarbleRun,
  },
  {
    game: 'wobblerun',
    name: 'Wobble Run (on deck)',
    verb: 'Run',
    today: () => gauntletDay(),
    number: gauntletNumber,
    dayOf: dayOfGauntlet,
    planned: PLANNED_GAUNTLETS,
    daily: (day) => ({ ...dailyGauntlet(day), planned: null }),
    href: (day) => `${gauntletDayHref(day)}&test=1`,
    format: formatWobbleRun,
  },
]

/** How many days each race lists first: today and the six after. The rest, before and after, fold away. */
const DAYS = 7

const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const dayWords = (day: string) => dayFormat.format(new Date(`${day}T12:00:00Z`))

function RaceDays({ race }: { race: Race }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = race.number(race.today())
  const range = (from: number, to: number) => {
    const out: number[] = []
    for (let n = Math.max(1, from); n <= Math.min(race.planned, to); n++) out.push(n)
    return out
  }
  const coming = range(today, today + DAYS - 1)
  const earlier = range(1, today - 1).reverse()
  const later = range(today + DAYS, race.planned)
  const rows = setLapRows()
  const setLap = (paceMs: number) => rows.find((r) => r.game === race.game && r.paceMs === paceMs) ?? null
  const setCount = (ns: number[]) => ns.filter((n) => setLap(paceMsOf(race.daily(race.dayOf(n)).pace))).length

  const onClear = async (d: Day, course: number) => {
    setBusy(d.day)
    setError(null)
    try {
      await clearSetLap(race.game, course)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t clear it')
    } finally {
      setBusy(null)
    }
  }

  const list = (ns: number[]) => (
    <ul className="adm-list">
      {ns.map((n) => {
        const d = race.daily(race.dayOf(n))
        const paceMs = paceMsOf(d.pace)
        const lap = setLap(paceMs)
        const platinum = medalTimes(race.game, paceMs, d.planned).platinum
        const under = Math.round((1 - platinum / paceMs) * 100)
        return (
          <li key={d.day} className="adm-row">
            <div className="adm-row__main">
              <b className="adm-row__title">
                {n === today ? 'Today' : dayWords(d.day)} · #{d.n} {d.name}
              </b>
              <span className="adm-row__sub">
                Platinum <strong>{race.format(platinum / 1000)}</strong> ({under}% under the blue’s {race.format(d.pace)}) ·{' '}
                {lap ? `set: your best ${race.format(lap.lapMs / 1000)} + 0.5s` : 'worked out'}
              </span>
            </div>
            <div className="adm-row__acts">
              <a className="panel__btn adm-small" href={race.href(d.day, d.n)}>
                {race.verb}
              </a>
              {lap ? (
                <button type="button" className="panel__btn panel__btn--ghost adm-small" disabled={busy != null} onClick={() => void onClear(d, lap.course)}>
                  {busy === d.day ? 'Clearing…' : 'Clear'}
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )

  return (
    <section className="adm-card" aria-label={race.name}>
      <h2 className="adm-card__title">{race.name}</h2>
      {error ? <p className="adm-note">{error}</p> : null}
      {list(coming)}
      {earlier.length ? (
        <details>
          <summary className="adm-note">
            Earlier days: #{earlier[earlier.length - 1]} to #{earlier[0]} ({setCount(earlier)} of {earlier.length} set)
          </summary>
          {list(earlier)}
        </details>
      ) : null}
      {later.length ? (
        <details>
          <summary className="adm-note">
            Later days: #{later[0]} to #{later[later.length - 1]} ({setCount(later)} of {later.length} set)
          </summary>
          {list(later)}
        </details>
      ) : null}
    </section>
  )
}

export function AdminSetPlatinum() {
  useSetPlatinums()
  const [loaded, setLoaded] = useState<'loading' | 'ok' | string>('loading')
  useEffect(() => {
    loadSetPlatinums().then(
      () => setLoaded('ok'),
      (err: unknown) => setLoaded(err instanceof Error ? err.message : 'Couldn’t load the set laps'),
    )
  }, [])
  return (
    <div>
      <section className="adm-card">
        <h2 className="adm-card__title">Set platinum by driving it</h2>
        <p className="adm-card__sub">
          Drive any day’s course, past or to come: every test run’s time is sent as you finish, your best there is kept,
          and that course’s platinum becomes it plus half a second, in every medal on the site and the tickets they pay. A
          day you don’t drive keeps its worked-out platinum. Test runs go on no board, even on a past day.
        </p>
        {loaded !== 'ok' && loaded !== 'loading' ? <p className="adm-note">{loaded}</p> : null}
      </section>
      {RACES.map((race) => (
        <RaceDays key={race.game} race={race} />
      ))}
    </div>
  )
}
