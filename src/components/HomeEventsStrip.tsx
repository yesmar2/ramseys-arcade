import { useEffect, useState } from 'react'
import { listTournaments, type TournamentSummary } from '../lib/tournaments'
import { EventCard } from './EventCard'

/** Live daily/weekly event cards above the home game grid. */
export function HomeEventsStrip() {
  const [events, setEvents] = useState<TournamentSummary[]>([])

  useEffect(() => {
    let cancelled = false
    listTournaments()
      .then((list) => {
        if (cancelled) return
        const live = list
          .filter(
            (t) =>
              t.status === 'active' &&
              (t.cadence === 'daily' || t.cadence === 'weekly'),
          )
          .sort((a, b) => (a.cadence === 'daily' ? 0 : 1) - (b.cadence === 'daily' ? 0 : 1))
        setEvents(live)
      })
      .catch(() => {
        if (!cancelled) setEvents([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (events.length === 0) return null

  return (
    <section className="home-events" aria-label="Live events">
      <ul className="home-events__list">
        {events.map((t) => (
          <li key={t.id}>
            <EventCard t={t} compact />
          </li>
        ))}
      </ul>
    </section>
  )
}
