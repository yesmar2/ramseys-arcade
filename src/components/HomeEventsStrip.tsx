import { useEffect, useState, type CSSProperties } from 'react'
import { usePlayerName } from '../hooks/usePlayerName'
import { tournamentHref, tournamentsHref } from '../hooks/useHashRoute'
import { getGame } from '../data/games'
import { normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { listTournaments, type TournamentSummary } from '../lib/tournaments'
import { EventCountdown } from './EventCountdown'

function accentFor(t: TournamentSummary) {
  const slug = t.games[0]
  const game = slug ? getGame(slug) : null
  return resolveGameAccent(slug ?? '', game?.accent ?? 'var(--accent)')
}

function gameNames(t: TournamentSummary) {
  return t.games
    .map((slug) => getGame(slug)?.name ?? slug)
    .join(' · ')
}

/** Wide card for the event that most deserves the attention. */
function LeadEvent({ t, joined }: { t: TournamentSummary; joined: boolean }) {
  return (
    <a
      className="home-ev"
      href={tournamentHref(t.id)}
      style={{ '--ev-accent': accentFor(t) } as CSSProperties}
    >
      <div className="home-ev__body">
        <div className="home-ev__chips">
          <span className="home-ev__live">Live</span>
          {t.cadence ? <span className="home-ev__tag">{t.cadence}</span> : null}
          {joined ? <span className="home-ev__tag home-ev__tag--in">You’re in</span> : null}
        </div>
        <h3 className="home-ev__name">{t.title}</h3>
        <p className="home-ev__games">{gameNames(t)}</p>
      </div>
      <div className="home-ev__side">
        <div className="home-ev__clock">
          <EventCountdown
            endsAt={t.endsAt}
            unlimitedDuration={Boolean(t.rules.unlimitedDuration)}
            className="home-ev__clock-v"
          />
        </div>
        <span className="home-ev__joined">
          {t.playerCount} {t.playerCount === 1 ? 'player' : 'players'}
        </span>
        <span className="home-ev__go">{joined ? 'Open' : 'Join'}</span>
      </div>
    </a>
  )
}

/** Anything after the lead collapses to a single line. */
function EventRow({ t, joined }: { t: TournamentSummary; joined: boolean }) {
  return (
    <a
      className="home-evrow"
      href={tournamentHref(t.id)}
      style={{ '--ev-accent': accentFor(t) } as CSSProperties}
    >
      <span className="home-evrow__dot" aria-hidden="true" />
      <span className="home-evrow__name">{t.title}</span>
      <span className="home-evrow__games">{gameNames(t)}</span>
      {joined ? <span className="home-ev__tag home-ev__tag--in">You’re in</span> : null}
      <EventCountdown
        endsAt={t.endsAt}
        unlimitedDuration={Boolean(t.rules.unlimitedDuration)}
        className="home-evrow__clock"
      />
    </a>
  )
}

/**
 * Live events above the grid.
 *
 * The running clock is the reason to open the app, so one event leads at full
 * width and the rest collapse to rows rather than competing with it.
 */
export function HomeEventsStrip() {
  const name = usePlayerName()
  const cleaned = normalizePlayerName(name)
  const [events, setEvents] = useState<TournamentSummary[]>([])
  const [mine, setMine] = useState<Set<string>>(new Set())
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
        const joinedIds = new Set(joined.map((t) => t.id))
        const live = all.filter((t) => t.status === 'active')
        // Yours first, then the daily, then everything else: the card that
        // needs you beats the card that is merely running.
        const ranked = [...live].sort((a, b) => {
          const am = joinedIds.has(a.id) ? 0 : 1
          const bm = joinedIds.has(b.id) ? 0 : 1
          if (am !== bm) return am - bm
          const ac = a.cadence === 'daily' ? 0 : a.cadence === 'weekly' ? 1 : 2
          const bc = b.cadence === 'daily' ? 0 : b.cadence === 'weekly' ? 1 : 2
          if (ac !== bc) return ac - bc
          return a.endsAt - b.endsAt
        })
        setMine(joinedIds)
        setEvents(ranked.slice(0, 4))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cleaned])

  if (loading) {
    return (
      <section className="home-events" aria-label="Live events" aria-busy="true">
        <div className="home-ev home-ev--skeleton" aria-hidden="true" />
      </section>
    )
  }

  if (events.length === 0) return null

  const [lead, ...rest] = events

  return (
    <section className="home-events" aria-label="Live events">
      <LeadEvent t={lead} joined={mine.has(lead.id)} />
      {rest.length > 0 ? (
        <div className="home-events__rest">
          {rest.map((t) => (
            <EventRow key={t.id} t={t} joined={mine.has(t.id)} />
          ))}
        </div>
      ) : null}
      <p className="home-events__all">
        <a href={tournamentsHref()}>All events →</a>
      </p>
    </section>
  )
}
