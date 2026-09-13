import { useEffect, useState, type CSSProperties } from 'react'
import { usePlayerName } from '../hooks/usePlayerName'
import { tournamentHref, tournamentsHref } from '../hooks/useHashRoute'
import { getGame } from '../data/games'
import { normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { listTournaments, type TournamentSummary } from '../lib/tournaments'
import { EventCountdown } from './EventCountdown'
import { GameThumbArt } from './GameThumbArt'

function accentFor(t: TournamentSummary) {
  const slug = t.games[0]
  const game = slug ? getGame(slug) : null
  return resolveGameAccent(slug ?? '', game?.accent ?? 'var(--accent)')
}

function gameNames(t: TournamentSummary) {
  return t.games.map((slug) => getGame(slug)?.name ?? slug).join(' · ')
}

/** An event you are actually in, with the clock and the way back into it. */
function JoinedEvent({ t }: { t: TournamentSummary }) {
  const accent = accentFor(t)
  return (
    <a
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
}

/**
 * Live events, above the grid.
 *
 * The daily and weekly events are the only recurring reason to come back on a
 * particular day, so they are worth naming even though nobody has to act on
 * them. They get one line — a card with a Join button was spending the top of
 * the page on a countdown nobody had entered. An event you have actually
 * joined is different, and gets a row with its clock.
 */
export function HomeEventsStrip() {
  const name = usePlayerName()
  const cleaned = normalizePlayerName(name)
  const [official, setOfficial] = useState<TournamentSummary[]>([])
  const [mine, setMine] = useState<TournamentSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      listTournaments().catch(() => [] as TournamentSummary[]),
      cleaned
        ? listTournaments('joined', cleaned).catch(() => [] as TournamentSummary[])
        : Promise.resolve([] as TournamentSummary[]),
    ])
      .then(([all, joined]) => {
        if (cancelled) return
        const active = all.filter((t) => t.status === 'active')
        const joinedIds = new Set(joined.map((t) => t.id))
        setMine(active.filter((t) => joinedIds.has(t.id)).sort((a, b) => a.endsAt - b.endsAt))
        setOfficial(
          active
            .filter((t) => t.official && !joinedIds.has(t.id))
            // Daily first: it is the one that will be gone tomorrow.
            .sort((a, b) => {
              const rank = (t: TournamentSummary) => (t.cadence === 'daily' ? 0 : 1)
              return rank(a) - rank(b) || a.endsAt - b.endsAt
            }),
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cleaned])

  if (loading || (official.length === 0 && mine.length === 0)) return null

  return (
    <section className="home-events" aria-label="Live events">
      {mine.map((t) => (
        <JoinedEvent key={t.id} t={t} />
      ))}

      {official.length > 0 ? (
        <p className="home-evline">
          <span className="home-evline__pip" aria-hidden="true" />
          {official.map((t) => (
            <a
              key={t.id}
              className="home-evline__item"
              href={tournamentHref(t.id)}
              style={{ '--ev-accent': accentFor(t) } as CSSProperties}
            >
              <span className="home-evline__name">{t.title}</span>
              <EventCountdown
                endsAt={t.endsAt}
                unlimitedDuration={Boolean(t.rules.unlimitedDuration)}
                className="home-evline__clock"
              />
            </a>
          ))}
          <a className="home-evline__all" href={tournamentsHref()}>
            All events →
          </a>
        </p>
      ) : (
        <p className="home-events__all">
          <a href={tournamentsHref()}>All events →</a>
        </p>
      )}
    </section>
  )
}
