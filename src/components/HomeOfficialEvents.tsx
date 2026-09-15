import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { tournamentHref, tournamentsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'

/**
 * The daily and weekly events, beside the hero.
 *
 * Each carries its game's artwork rather than a coloured dot, and on a phone
 * becomes a full-width row with a way in. There is nearly always a daily and
 * a weekly running, so while they load two rows of their shape hold the
 * space instead of the block popping in.
 */
export function HomeOfficialEvents() {
  const cleaned = normalizePlayerName(usePlayerName())
  const { official, joinedIds, loading } = useLiveEvents(cleaned)

  if (loading) {
    return (
      <section className="home-evs" aria-label="Running events" aria-busy="true">
        {[0, 1].map((i) => (
          <span key={i} className="home-evs__row home-evs__row--skel" aria-hidden="true">
            <span className="home-evs__art home-evs__skel-art" />
            <span className="home-evs__body">
              <span className="skel-line" style={{ '--skel-w': '7rem' } as CSSProperties} />
              <span className="skel-line" style={{ '--skel-w': '4rem' } as CSSProperties} />
            </span>
          </span>
        ))}
      </section>
    )
  }

  if (official.length === 0) return null

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
            <span className="home-evs__art" aria-hidden="true">
              <GameThumbArt slug={slug ?? ''} accent={accent} />
            </span>
            <span className="home-evs__body">
              <span className="home-evs__title">
                <span className="home-evs__name">{t.title}</span>
                {joinedIds.has(t.id) ? <span className="home-evs__in">in</span> : null}
              </span>
              <EventCountdown
                endsAt={t.endsAt}
                unlimitedDuration={Boolean(t.rules.unlimitedDuration)}
                className="home-evs__clock"
              />
            </span>
            <span className="home-evs__go">
              {joinedIds.has(t.id) ? 'Open' : 'Join'}
            </span>
          </a>
        )
      })}
      <a className="chips__item home-evs__all" href={tournamentsHref()}>
        All events
      </a>
    </section>
  )
}
