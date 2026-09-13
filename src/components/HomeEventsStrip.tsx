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
 * Live events.
 *
 * An event you have joined earns a row of its own. Events merely running in the
 * background do not: with nothing of yours at stake they collapse to a single
 * line, rather than spending the top of the page on a countdown nobody entered.
 */
export function HomeEventsStrip() {
  const name = usePlayerName()
  const cleaned = normalizePlayerName(name)
  const [live, setLive] = useState<TournamentSummary[]>([])
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
        setLive(active)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cleaned])

  if (loading || live.length === 0) return null

  if (mine.length === 0) {
    return (
      <section className="home-evline" aria-label="Live events">
        <a href={tournamentsHref()}>
          <span className="home-evline__pip" aria-hidden="true" />
          <span className="home-evline__lead">
            {live.length} event{live.length === 1 ? '' : 's'} running
          </span>
          <span className="home-evline__names">{live.map((t) => t.title).join(', ')}</span>
          <span className="home-evline__go" aria-hidden="true">
            →
          </span>
        </a>
      </section>
    )
  }

  return (
    <section className="home-events" aria-labelledby="home-events-title">
      <h2 className="home-events__title" id="home-events-title">
        Your events
      </h2>
      {mine.map((t) => (
        <JoinedEvent key={t.id} t={t} />
      ))}
      <p className="home-events__all">
        <a href={tournamentsHref()}>All events →</a>
      </p>
    </section>
  )
}
