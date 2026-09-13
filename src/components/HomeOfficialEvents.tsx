import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { tournamentHref, tournamentsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { EventCountdown } from './EventCountdown'

/**
 * The daily and weekly events, named on one line under the hero.
 *
 * These are the only recurring reason to open the app on a particular day, so
 * they are worth saying out loud up top — but with nobody entered they are not
 * worth a card and a Join button.
 */
export function HomeOfficialEvents() {
  const cleaned = normalizePlayerName(usePlayerName())
  const { official, joinedIds, loading } = useLiveEvents(cleaned)

  if (loading || official.length === 0) return null

  return (
    <section className="home-evs" aria-label="Running events">
      {official.map((t) => {
        const slug = t.games[0]
        const accent = resolveGameAccent(slug ?? '', getGame(slug ?? '')?.accent ?? 'var(--accent)')
        return (
          <a
            key={t.id}
            className="home-evs__row"
            href={tournamentHref(t.id)}
            style={{ '--ev-accent': accent } as CSSProperties}
          >
            <span className="home-evs__pip" aria-hidden="true" />
            <span className="home-evs__name">{t.title}</span>
            {joinedIds.has(t.id) ? <span className="home-evs__in">in</span> : null}
            <EventCountdown
              endsAt={t.endsAt}
              unlimitedDuration={Boolean(t.rules.unlimitedDuration)}
              className="home-evs__clock"
            />
          </a>
        )
      })}
      <a className="home-evs__all" href={tournamentsHref()}>
        All events →
      </a>
    </section>
  )
}
