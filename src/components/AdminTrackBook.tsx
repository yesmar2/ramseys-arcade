import { useMemo, useState } from 'react'
import { decodeCourse } from '../games/hotlap/courses'
import { dayOfTrack, dayWords, shapeOf, trackDay } from '../games/hotlap/daily'
import { DAILY_TRACKS, type PlannedTrack } from '../games/hotlap/dailyPlan'
import { LANDMARKS } from '../games/hotlap/landmarks'
import { buildTrack } from '../games/hotlap/sim'
import { trackPlan, type TrackPlanShape } from '../games/hotlap/trackPlan'
import { gamePlayHref } from '../hooks/useHashRoute'
import '../styles/adminBooks.css'

/*
 * The admin's Track Book: every day of Hot Lap's track of the day that's planned (dailyPlan.ts), drawn from
 * above, with its pace car's lap, its length and its corners. Any of them can be test-driven ahead of its
 * day: a test drive's laps go on no board.
 */

const SLUG = 'hotlap'

type BookTrack = {
  n: number
  day: string
  name: string
  /** The pace car's lap, in seconds. */
  pace: number
  km: number
  corners: number
  plan: TrackPlanShape
  /** A real circuit's layout (landmarks.ts). */
  landmark: boolean
  /** On a hilly track: how far it climbs from its lowest to its highest, in metres, and its heights round the lap. */
  hills: { climb: number; profile: string } | null
}

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const dateOf = (day: string) => new Date(`${day}T12:00:00Z`)

/** "53.36s", or "1:29.78" for a lap of a minute and more. */
function lapWords(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(2)}s`
  const m = Math.floor(seconds / 60)
  return `${m}:${(seconds - m * 60).toFixed(2).padStart(5, '0')}`
}

/** A hilly track's heights round the lap, as an area in a 100 × 20 box, from the start line. */
function profileOf(z: Float64Array): { climb: number; profile: string } {
  let low = Infinity
  let high = -Infinity
  for (const v of z) {
    low = Math.min(low, v)
    high = Math.max(high, v)
  }
  const rise = Math.max(0.01, high - low)
  const points: string[] = []
  const steps = 120
  for (let i = 0; i <= steps; i++) {
    const v = z[Math.min(z.length - 1, Math.round((i / steps) * (z.length - 1)))]!
    points.push(`${((i / steps) * 100).toFixed(1)} ${(19 - ((v - low) / rise) * 17).toFixed(2)}`)
  }
  return { climb: Math.round(rise), profile: `M0 20L${points.join('L')}L100 20Z` }
}

function bookTrack(entry: PlannedTrack, i: number): BookTrack {
  const n = i + 1
  const shape = shapeOf(entry)
  const track = buildTrack(decodeCourse(entry.course), shape)
  return {
    n,
    day: dayOfTrack(n),
    name: entry.name,
    pace: entry.pace,
    km: track.length / 1000,
    corners: track.corners.length,
    plan: trackPlan(track),
    landmark: Object.values(LANDMARKS).some((l) => l.course === entry.course),
    hills: track.z ? profileOf(track.z) : null,
  }
}

const driveHref = (n: number) => `${gamePlayHref(SLUG)}?track=${n}`

export function AdminTrackBook() {
  const today = trackDay()
  const tracks = useMemo(() => DAILY_TRACKS.map(bookTrack), [])
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState<string>('all')

  const todays = tracks.find((t) => t.day === today)
  const next = todays ? tracks[todays.n] : undefined
  const months = useMemo(() => [...new Set(tracks.map((t) => t.day.slice(0, 7)))], [tracks])
  const q = query.trim().toLowerCase().replace(/^#/, '')
  const shown = tracks.filter(
    (t) => (month === 'all' || t.day.startsWith(month)) && (!q || t.name.toLowerCase().includes(q) || String(t.n) === q),
  )
  const groups = months
    .map((key) => ({ key, tracks: shown.filter((t) => t.day.startsWith(key)) }))
    .filter((g) => g.tracks.length)
  const last = tracks[tracks.length - 1]

  return (
    <div className="tb">
      <section className="adm-card" aria-labelledby="tb-title">
        <h2 className="adm-card__title" id="tb-title">
          Hot Lap · Today’s Track
        </h2>
        <p className="adm-card__sub">
          Every track planned, a new one each day at midnight New York time, the same for everyone. Each was checked
          before it went in: the pace car and a faster driver both lap it cleanly, the roads never come too close, and
          the grandstand has room. Test drive any of them ahead of its day: a test drive’s laps go on no board.
          {last ? ` The plan runs to #${last.n} on ${dayWords(last.day)}, ${last.day.slice(0, 4)}; after that the days go round again from #1.` : ''}
        </p>
        {todays ? (
          <div className="tb-feature">
            <TrackMap track={todays} />
            <div className="tb-feature__text">
              <span className="hb-badge">Today · #{todays.n}</span>
              <h3 className="tb-feature__name">{todays.name}</h3>
              <p className="tb-feature__facts">
                {dayWords(todays.day)} · pace car {lapWords(todays.pace)} · {todays.km.toFixed(2)} km · {todays.corners} corners
                {todays.hills ? ` · climbs ${todays.hills.climb} m` : ''}
              </p>
              <div className="tb-feature__acts">
                <a className="panel__btn adm-small" href={driveHref(todays.n)}>
                  Test drive
                </a>
                <a className="panel__btn panel__btn--ghost adm-small" href={gamePlayHref(SLUG)}>
                  Race it for real
                </a>
              </div>
              {next ? (
                <p className="tb-feature__next">
                  Tomorrow:{' '}
                  <a href={driveHref(next.n)}>
                    #{next.n} {next.name}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <div className="hb-tools">
        <input
          className="panel__input adm-input tb-search"
          type="search"
          value={query}
          placeholder="Find a track by name or number"
          aria-label="Find a track"
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
          {shown.length} {shown.length === 1 ? 'track' : 'tracks'}
        </p>
      </div>

      {groups.length ? (
        groups.map((group) => (
          <section key={group.key} className="tb-month" aria-labelledby={`tb-${group.key}`}>
            <h3 className="tb-month__name" id={`tb-${group.key}`}>
              {monthFormat.format(dateOf(`${group.key}-15`))}
              <span>
                {group.tracks.length} {group.tracks.length === 1 ? 'track' : 'tracks'}
              </span>
            </h3>
            <div className="tb-grid">
              {group.tracks.map((track) => (
                <TrackTile key={track.n} track={track} today={today} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="adm-note">No track in the plan goes by that.</p>
      )}
    </div>
  )
}

/** A track from above, on grass: the road with its white edges, the start line and the car on the grid. */
function TrackMap({ track }: { track: BookTrack }) {
  const { plan } = track
  return (
    <svg className="tb-map" viewBox={plan.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${track.name} from above`}>
      <path className="tb-map__edge" d={plan.d} strokeWidth={plan.road * 1.3} />
      <path className="tb-map__road" d={plan.d} strokeWidth={plan.road} />
      <line className="tb-map__start" {...plan.start} strokeWidth={plan.road * 0.4} />
      <circle className="tb-map__car" cx={plan.car.x} cy={plan.car.y} r={plan.car.r} />
    </svg>
  )
}

function TrackTile({ track, today }: { track: BookTrack; today: string }) {
  const isToday = track.day === today
  return (
    <a
      className={`tb-tile${isToday ? ' tb-tile--today' : ''}${track.day < today ? ' tb-tile--past' : ''}${track.landmark ? ' tb-tile--landmark' : ''}`}
      href={driveHref(track.n)}
      aria-label={`#${track.n} ${track.name}, ${dayWords(track.day)}: test drive it`}
    >
      <div className="tb-tile__map">
        <TrackMap track={track} />
        <span className="tb-tag">{isToday ? `Today · #${track.n}` : `#${track.n}`}</span>
        {track.landmark || track.hills ? (
          <span className="tb-tag tb-tag--hills">{track.landmark ? 'Landmark' : 'Hills'}</span>
        ) : null}
      </div>
      {track.hills ? (
        <svg className="tb-profile" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
          <path d={track.hills.profile} />
        </svg>
      ) : null}
      <div className="tb-tile__body">
        <span className="tb-tile__date">{dayWords(track.day)}</span>
        <h4 className="tb-tile__name">{track.name}</h4>
        <dl className="tb-figs">
          <div>
            <dt>Pace</dt>
            <dd>{lapWords(track.pace)}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>{track.km.toFixed(2)} km</dd>
          </div>
          <div>
            <dt>{track.hills ? 'Climb' : 'Corners'}</dt>
            <dd>{track.hills ? `${track.hills.climb} m` : track.corners}</dd>
          </div>
        </dl>
        <span className="tb-tile__go">Test drive →</span>
      </div>
    </a>
  )
}
