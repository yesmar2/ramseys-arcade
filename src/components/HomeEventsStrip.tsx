import { useEffect, useState } from 'react'
import { getGame } from '../data/games'
import {
  listTournaments,
  type TournamentSummary,
} from '../lib/tournaments'
import { EventCountdown } from './EventCountdown'

function kindLabel(t: TournamentSummary) {
  if (t.cadence === 'daily') return 'Today'
  if (t.cadence === 'weekly') return 'This week'
  return 'Event'
}

function gameLine(t: TournamentSummary) {
  return t.games.map((g) => getGame(g)?.name ?? g).join(' · ')
}

/** Compact live daily/weekly event links above the home game grid. */
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
            <a className="home-events__link" href={`#/tournaments/${t.id}`}>
              <span className="home-events__kind">{kindLabel(t)}</span>
              <span className="home-events__body">
                <span className="home-events__title">{t.title}</span>
                <span className="home-events__games">{gameLine(t)}</span>
              </span>
              <EventCountdown endsAt={t.endsAt} className="home-events__time" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
