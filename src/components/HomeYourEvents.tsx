import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { tournamentHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import type { TournamentSummary } from '../lib/tournaments'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'

function accentFor(t: TournamentSummary) {
  const slug = t.games[0]
  return resolveGameAccent(slug ?? '', getGame(slug ?? '')?.accent ?? 'var(--accent)')
}

function gameNames(t: TournamentSummary) {
  return t.games.map((slug) => getGame(slug)?.name ?? slug).join(' · ')
}

/**
 * Events you are actually in, below the grid.
 *
 * Unlike the daily line up top, these have something of yours at stake, so
 * each gets a row with its artwork, its clock and a way back in.
 */
export function HomeYourEvents() {
  const cleaned = normalizePlayerName(usePlayerName())
  const { mine, loading } = useLiveEvents(cleaned)

  if (loading || mine.length === 0) return null

  return (
    <section className="home-events" aria-labelledby="home-events-title">
      <h2 className="home-events__title" id="home-events-title">
        Your events
      </h2>
      {mine.map((t) => {
        const accent = accentFor(t)
        return (
          <a
            key={t.id}
            className="home-ev"
            href={tournamentHref(t.id)}
            style={{ '--ev-accent': accent, '--thumb-accent': accent } as CSSProperties}
          >
            <span className="home-ev__art" aria-hidden="true">
              <GameThumbArt slug={t.games[0] ?? ''} accent={accent} />
            </span>
            <span className="home-ev__body">
              <span className="home-ev__name">{t.title}</span>
              <span className="home-ev__games">
                {gameNames(t)} · {t.playerCount} {t.playerCount === 1 ? 'player' : 'players'}
              </span>
            </span>
            <span className="home-ev__side">
              <EventCountdown
                endsAt={t.endsAt}
                unlimitedDuration={Boolean(t.rules.unlimitedDuration)}
                className="home-ev__clock"
              />
              <span className="home-ev__go">Open</span>
            </span>
          </a>
        )
      })}
    </section>
  )
}
