import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { InfoTip } from '../components/InfoTip'
import { getGame } from '../data/games'
import {
  getLeaderboard,
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  PERIOD_LABELS,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

function formatDate(at: number) {
  try {
    return new Date(at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

export function LeaderboardsPage() {
  const tabs = useMemo(
    () =>
      LEADERBOARD_GAMES.map((slug) => ({
        slug,
        name: getGame(slug)?.name ?? slug,
        accent: getGame(slug)?.accent ?? '#2eb8a0',
      })),
    [],
  )

  const [active, setActive] = useState<LeaderboardGame>('stacker')
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activeMeta = tabs.find((t) => t.slug === active) ?? tabs[0]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getLeaderboard(active, period)
      .then((board) => {
        if (cancelled) return
        setEntries(board)
      })
      .catch((err) => {
        if (cancelled) return
        setEntries([])
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [active, period])

  return (
    <>
      <Header />
      <main className="lb-page">
        <div className="lb-page__inner">
          <header className="lb-page__header">
            <h1 className="lb-page__title lb-page__title--with-tip">
              Leaderboards
              <InfoTip label="About leaderboards">
                Shared high scores by day, week, month, and all time. Periods use
                America/New_York time.
              </InfoTip>
            </h1>
          </header>

          <div className="lb-tabs" role="tablist" aria-label="Games">
            {tabs.map((tab) => (
              <button
                key={tab.slug}
                type="button"
                role="tab"
                aria-selected={tab.slug === active}
                className={`lb-tab${tab.slug === active ? ' lb-tab--active' : ''}`}
                style={{ '--tab-accent': tab.accent } as CSSProperties}
                onClick={() => setActive(tab.slug)}
              >
                {tab.name}
              </button>
            ))}
          </div>

          <div className="lb-periods" role="tablist" aria-label="Time period">
            {LEADERBOARD_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                className={`lb-period${period === p ? ' lb-period--active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <section
            className="lb-board"
            aria-label={`${activeMeta.name} ${PERIOD_LABELS[period]} leaderboard`}
          >
            <div className="lb-board__head">
              <div className="lb-stat">
                <span className="lb-stat__label">Game</span>
                <strong>{activeMeta.name}</strong>
              </div>
              <div className="lb-stat">
                <span className="lb-stat__label">Period</span>
                <strong>{PERIOD_LABELS[period]}</strong>
              </div>
              <div className="lb-stat">
                <span className="lb-stat__label">Entries</span>
                <strong>{loading ? '…' : entries.length}</strong>
              </div>
            </div>

            {loading ? (
              <p className="lb-empty">Loading scores…</p>
            ) : error ? (
              <p className="lb-empty">
                Couldn’t load leaderboards. Is the API running?
              </p>
            ) : entries.length === 0 ? (
              <p className="lb-empty">
                No scores for {PERIOD_LABELS[period].toLowerCase()} yet.{' '}
                <a href={`#/games/${active}`}>Play {activeMeta.name}</a> to
                claim the top spot.
              </p>
            ) : (
              <ol className="lb-list">
                {entries.map((entry, index) => (
                  <li key={entry.id} className="lb-row">
                    <span className="lb-row__rank">#{index + 1}</span>
                    <span className="lb-row__name">{entry.name}</span>
                    <span className="lb-row__score">{entry.score}</span>
                    <span className="lb-row__date">{formatDate(entry.at)}</span>
                  </li>
                ))}
              </ol>
            )}

            <a
              className="lb-play"
              href={`#/games/${active}`}
              style={{ background: activeMeta.accent }}
            >
              Play {activeMeta.name}
            </a>
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
