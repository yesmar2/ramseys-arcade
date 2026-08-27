import { useEffect, useState } from 'react'
import { listTournaments, type TournamentSummary } from '../lib/tournaments'
import { EventCard } from './EventCard'

function EventCardSkeleton() {
  return (
    <div className="event-card event-card--compact event-card--skeleton" aria-hidden="true">
      <span className="event-card__skel-thumb" />
      <div className="event-card__skel-body">
        <span className="event-card__skel-line event-card__skel-line--chips" />
        <span className="event-card__skel-line event-card__skel-line--title" />
        <span className="event-card__skel-line event-card__skel-line--meta" />
      </div>
    </div>
  )
}

/** Live daily/weekly event cards above the home game grid. */
export function HomeEventsStrip() {
  const [events, setEvents] = useState<TournamentSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
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
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section className="home-events" aria-label="Live events" aria-busy="true">
        <ul className="home-events__list">
          <li>
            <EventCardSkeleton />
          </li>
          <li>
            <EventCardSkeleton />
          </li>
        </ul>
      </section>
    )
  }

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
