import { useEffect, useState } from 'react'
import { aboutHref, gamePlayHref, rankHref, tournamentsHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useActiveGroup } from '../lib/groups'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  normalizePlayerName,
  PERIOD_LABELS,
  type GlobalBoardEntry,
} from '../lib/leaderboard'
import { listTournaments } from '../lib/tournaments'

type Snapshot = {
  rank: number | null
  score: number
  totalPlayers: number
  gamesRanked: number
  top: GlobalBoardEntry[]
  events: number
}

const EMPTY: Snapshot = {
  rank: null,
  score: 0,
  totalPlayers: 0,
  gamesRanked: 0,
  top: [],
  events: 0,
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="home-you__stat">
      <span className="home-you__v">{value}</span>
      <span className="home-you__k">{label}</span>
    </div>
  )
}

/**
 * The slot that used to hold the About wall.
 *
 * Someone who has played gets their own standing; a first visit gets the pitch
 * that block used to carry. Both read the header's period and group controls,
 * which previously changed nothing on this page.
 */
export function HomeYou() {
  const name = usePlayerName()
  const period = useDefaultPeriod()
  const group = useActiveGroup()
  const cleaned = normalizePlayerName(name)
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!cleaned) {
      setSnap(EMPTY)
      setLoaded(true)
      return
    }
    let cancelled = false
    setLoaded(false)
    Promise.all([
      fetchGlobalRank(cleaned, period).catch(() => null),
      fetchGlobalBoard(6, period).catch(() => null),
      listTournaments('joined', cleaned).catch(() => []),
    ])
      .then(([rank, board, events]) => {
        if (cancelled) return
        setSnap({
          rank: rank?.rank ?? null,
          score: rank?.score ?? 0,
          totalPlayers: rank?.totalPlayers ?? 0,
          gamesRanked: Object.keys(rank?.byGame ?? {}).length,
          top: board?.entries ?? [],
          events: events.filter((t) => t.status !== 'ended').length,
        })
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [cleaned, period, group])

  if (!cleaned) {
    return (
      <section className="home-intro" aria-labelledby="home-intro-heading">
        <h2 className="home-intro__title" id="home-intro-heading">
          A small browser arcade for quick sessions and high scores.
        </h2>
        <p className="home-intro__lead">
          Original games that load instantly on phone, tablet, and desktop. No ads, no install,
          no account needed — sign in only if you want your name to follow you between devices.
        </p>
        <p className="home-intro__more">
          <a href={aboutHref()}>More about {APP_NAME} →</a>
        </p>
      </section>
    )
  }

  const periodLabel = PERIOD_LABELS[period]
  /*
   * A rank is only worth showing once there is a field to be ranked against —
   * "#2 of 4" tells you less than your own score does, and reads worse. Below
   * that, the board stops being a leaderboard and becomes the whole roster.
   */
  const CROWD = 5
  const crowded = snap.totalPlayers >= CROWD
  const yourRow = crowded && snap.rank != null && !snap.top.some((e) => e.rank === snap.rank)
  const rows = crowded ? snap.top.slice(0, 3) : snap.top

  return (
    <section className="home-you" aria-labelledby="home-you-heading">
      <div className="home-you__head">
        <h2 className="home-you__title" id="home-you-heading">
          {cleaned}
        </h2>
        <a className="home-you__link" href={rankHref(cleaned, period)}>
          Full ranking →
        </a>
      </div>

      <div className="home-you__stats">
        {crowded ? (
          <Stat label={`of ${snap.totalPlayers}`} value={snap.rank != null ? `#${snap.rank}` : '—'} />
        ) : null}
        <Stat label={`points ${periodLabel.toLowerCase()}`} value={snap.score.toLocaleString()} />
        <Stat label="games played" value={String(snap.gamesRanked)} />
        <Stat label="events" value={String(snap.events)} />
      </div>

      {rows.length > 0 ? (
        <div className="home-you__board">
          <p className="home-you__board-title">
            {crowded ? `Top ${rows.length}` : 'Everyone'} · {periodLabel.toLowerCase()}
          </p>
          <ol className="home-you__rows">
            {rows.map((entry) => (
              <li
                key={entry.name}
                className={`home-you__row${
                  entry.name === cleaned ? ' home-you__row--me' : ''
                }`}
              >
                <span className="home-you__pos">{entry.rank}</span>
                <span className="home-you__name">{entry.name}</span>
                <span className="home-you__score">{entry.score.toLocaleString()}</span>
              </li>
            ))}
            {yourRow ? (
              <li className="home-you__row home-you__row--me">
                <span className="home-you__pos">{snap.rank}</span>
                <span className="home-you__name">{cleaned} — you</span>
                <span className="home-you__score">{snap.score.toLocaleString()}</span>
              </li>
            ) : null}
          </ol>
        </div>
      ) : loaded ? (
        <p className="home-you__empty">
          No scores on this board yet.{' '}
          <a href={gamePlayHref('snake')}>Post the first one →</a>
        </p>
      ) : null}

      {snap.events === 0 ? (
        <p className="home-you__foot">
          <a href={tournamentsHref()}>Join an event →</a>
        </p>
      ) : null}
    </section>
  )
}
