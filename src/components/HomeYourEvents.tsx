import { useEffect } from 'react'
import { tournamentHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { normalizePlayerName } from '../lib/leaderboard'
import { getTournamentInvite } from '../lib/tournaments'
import { EventLiveCard } from './EventCard'

const HINT_KEY = 'skermix-home-events-hint'

/** How many events this player was in last time, so the section can hold its space while loading. */
function readHint(name: string): number {
  try {
    const raw = localStorage.getItem(HINT_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { name?: string; count?: number }
    return parsed.name === name && typeof parsed.count === 'number' ? parsed.count : 0
  } catch {
    return 0
  }
}

function writeHint(name: string, count: number) {
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify({ name, count }))
  } catch {
    /* ignore */
  }
}

/**
 * Events you are actually in, below the grid.
 *
 * These are the same cards the events list uses for a running event — the
 * leaders, the clock, a way back in — so there is nothing new to learn here.
 * While they load, the section holds the space it took last time so the
 * page doesn't jump when they arrive.
 */
export function HomeYourEvents() {
  const cleaned = normalizePlayerName(usePlayerName())
  const { mine, loading } = useLiveEvents(cleaned)
  const hint = cleaned ? readHint(cleaned) : 0

  useEffect(() => {
    if (!loading && cleaned) writeHint(cleaned, mine.length)
  }, [loading, cleaned, mine.length])

  if (loading) {
    if (hint === 0) return null
    return (
      <section className="evl home-events" aria-label="Your events" aria-busy="true">
        <h2 className="evl__title">
          <span className="ev-live-dot" aria-hidden="true" />
          Your events
        </h2>
        <ul className="evl__grid" aria-hidden="true">
          {Array.from({ length: Math.min(hint, 4) }, (_, i) => (
            <li key={i}>
              <div className="evc evc--skel" />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (mine.length === 0) return null

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
