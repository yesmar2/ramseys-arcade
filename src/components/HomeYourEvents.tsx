import { tournamentHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { normalizePlayerName } from '../lib/leaderboard'
import { getTournamentInvite } from '../lib/tournaments'
import { EventLiveCard } from './EventCard'

/**
 * Events you are actually in, below the grid.
 *
 * These are the same cards the events list uses for a running event — the
 * leaders, the clock, a way back in — so there is nothing new to learn here.
 */
export function HomeYourEvents() {
  const cleaned = normalizePlayerName(usePlayerName())
  const { mine, loading } = useLiveEvents(cleaned)

  if (loading || mine.length === 0) return null

  return (
    <section className="evl home-events" aria-label="Your events">
      <h2 className="evl__title">
        <span className="ev-live-dot" aria-hidden="true" />
        Your events
      </h2>
      <ul className="evl__grid">
        {mine.map((t) => (
          <li key={t.id}>
            <EventLiveCard
              t={t}
              joined
              href={
                t.private ? tournamentHref(t.id, getTournamentInvite(t.id) ?? undefined) : undefined
              }
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
