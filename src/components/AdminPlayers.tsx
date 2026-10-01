import { useCallback, useEffect, useState } from 'react'
import { fetchPlayerStats, type PlayerStats } from '../lib/admin'
import '../styles/adminPlayers.css'

/*
 * The admin page's Players card (AdminPage.tsx, Overview): who's playing, from what the API already keeps
 * (its playerStats.ts). Ramsey asked for return rates and "number of active players too" (2026-10-01).
 * Played means saved a run, which needs an account; signed-out play shows only as runs started. The seeded
 * world is left out unless the box is ticked: it still fills the live boards.
 */

const pct = (back: number, players: number) => (players ? `${Math.round((back / players) * 100)}%` : '–')

/** "Mon 28" from YYYY-MM-DD. */
function shortDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  return `${d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`
}

function Tile({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="adp-tile">
      <span className="adp-tile__label">{label}</span>
      <b className="adp-tile__value">{value}</b>
      {note ? <span className="adp-tile__note">{note}</span> : null}
    </div>
  )
}

/** Players each day: one bar a day, today's lighter as it isn't over; each says its day in a tip. */
function DaysChart({ days }: { days: PlayerStats['days'] }) {
  const max = Math.max(1, ...days.map((d) => d.active))
  return (
    <figure className="adp-chart">
      <figcaption className="adp-chart__title">
        Players each day <span>the last {days.length} days</span>
      </figcaption>
      <div className="adp-chart__plot">
        <span className="adp-chart__max" aria-hidden="true">
          {max}
        </span>
        <ol className="adp-chart__bars">
          {days.map((d, i) => {
            const today = i === days.length - 1
            const words = `${shortDay(d.day)}${today ? ', today so far' : ''}: ${d.active} played, ${d.joined} new ${d.joined === 1 ? 'account' : 'accounts'}`
            return (
              <li key={d.day} className={`adp-bar${today ? ' adp-bar--today' : ''}`} tabIndex={0} aria-label={words}>
                <span className="adp-bar__fill" style={{ height: `${(d.active / max) * 100}%` }} />
                <span className="adp-bar__tip" aria-hidden="true">
                  <b>{shortDay(d.day)}</b>
                  {today ? ' · so far' : ''}
                  <br />
                  {d.active} played · {d.joined} new
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      <ol className="adp-chart__days" aria-hidden="true">
        {days.map((d, i) => (
          // Every other day's date, counting back from Today, so no two crowd.
          <li key={d.day}>{i === days.length - 1 ? 'Today' : (days.length - 1 - i) % 2 === 0 ? shortDay(d.day).split(' ')[1] : ''}</li>
        ))}
      </ol>
      <details className="adp-table">
        <summary>Show as a table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Played</th>
              <th scope="col">New accounts</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.day}>
                <th scope="row">{shortDay(d.day)}</th>
                <td>{d.active}</td>
                <td>{d.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

export function AdminPlayers() {
  const [seeded, setSeeded] = useState(false)
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setError(null)
    fetchPlayerStats(seeded)
      .then(setStats)
      .catch(() => setError('Couldn’t load the players.'))
  }, [seeded])
  useEffect(() => {
    load()
  }, [load])

  const s = stats?.includeSeeded === seeded ? stats : null
  return (
    <section className="adm-card adp" aria-labelledby="adm-players">
      <div className="adm-card__head">
        <h2 className="adm-card__title" id="adm-players">
          Players
        </h2>
        <div className="adp-head__tools">
          <label className="adp-seeded">
            <input type="checkbox" checked={seeded} onChange={(e) => setSeeded(e.target.checked)} />
            Count the seeded players
          </label>
          <button type="button" className="panel__btn panel__btn--ghost adm-small" onClick={load}>
            Refresh
          </button>
        </div>
      </div>
      <p className="adm-card__sub">
        Played means saved a run, so signed in. Days are the boards’ days, New York time.
      </p>
      {error ? <p className="adm-fail">{error}</p> : null}
      {!s ? (
        error ? null : <p className="adm-note">Counting…</p>
      ) : (
        <>
          <div className="adp-grid">
            <span className="adp-row-label">Played</span>
            <Tile label="Today" value={s.active.day} />
            <Tile label="This week" value={s.active.week} note="last 7 days" />
            <Tile label="This month" value={s.active.month} note="last 30 days" />
            <span className="adp-row-label">New accounts</span>
            <Tile label="Today" value={s.joined.day} />
            <Tile label="This week" value={s.joined.week} />
            <Tile label="This month" value={s.joined.month} />
          </div>
          <div className="adp-returns">
            <Tile
              label="Came back the next day"
              value={pct(s.returned.nextDay.back, s.returned.nextDay.players)}
              note={`${s.returned.nextDay.back} of ${s.returned.nextDay.players} who signed up in the 30 days to the day before yesterday`}
            />
            <Tile
              label="Came back within a week"
              value={pct(s.returned.week.back, s.returned.week.players)}
              note={`${s.returned.week.back} of ${s.returned.week.players} who signed up in the 30 days to 8 days ago, back on any of the 7 days after`}
            />
          </div>
          <DaysChart days={s.days} />
          <p className="adp-foot">
            <b>{s.runs24h.total}</b> runs started in the last 24 hours, <b>{s.runs24h.signedOut}</b> of them signed out ·{' '}
            <b>{s.accounts.total}</b> accounts, <b>{s.accounts.saved}</b> of them have saved a run
          </p>
        </>
      )}
    </section>
  )
}
