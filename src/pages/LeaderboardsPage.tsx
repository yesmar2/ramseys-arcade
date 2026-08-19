import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { DeviceIcon } from '../components/DeviceIcon'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { getGame, gamePlayableOn } from '../data/games'
import { leaderboardHref } from '../hooks/useHashRoute'
import { useDeviceType } from '../lib/device'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  getLeaderboard,
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  PERIOD_LABELS,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type YouEntry,
} from '../lib/leaderboard'

const INITIAL_ROWS = 10

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

type LeaderboardsPageProps = {
  game?: LeaderboardGame
  period?: LeaderboardPeriod
}

export function LeaderboardsPage({
  game: gameFromRoute,
  period: periodFromRoute,
}: LeaderboardsPageProps) {
  const tabs = useMemo(
    () =>
      LEADERBOARD_GAMES.map((slug) => ({
        slug,
        name: getGame(slug)?.name ?? slug,
        accent: getGame(slug)?.accent ?? '#2eb8a0',
      })),
    [],
  )

  const active: LeaderboardGame = gameFromRoute ?? 'stacker'
  const period: LeaderboardPeriod = periodFromRoute ?? 'daily'
  const playerName = usePlayerName().trim().toUpperCase()
  const device = useDeviceType()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(INITIAL_ROWS)
  const activeMeta = tabs.find((t) => t.slug === active) ?? tabs[0]
  const activeGame = getGame(active)
  const canPlay = activeGame ? gamePlayableOn(activeGame, device) : true

  useEffect(() => {
    const canonical = leaderboardHref(active, period)
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical)
    }
  }, [active, period])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShown(INITIAL_ROWS)
    getLeaderboard(active, period, playerName || undefined)
      .then((board) => {
        if (cancelled) return
        setEntries(board.entries)
        setYou(board.you)
      })
      .catch((err) => {
        if (cancelled) return
        setEntries([])
        setYou(null)
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [active, period, playerName])

  const selectGame = (slug: LeaderboardGame) => {
    window.location.hash = leaderboardHref(slug, period)
  }

  const selectPeriod = (next: LeaderboardPeriod) => {
    window.location.hash = leaderboardHref(active, next)
  }

  const visible = entries.slice(0, shown)
  const youOnVisible = Boolean(you && visible.some((entry) => entry.id === you.id))
  const youOffVisible = Boolean(you && !youOnVisible)
  const youStyle = {
    '--lb-you-accent': activeMeta.accent,
  } as CSSProperties

  const renderRow = (entry: LeaderboardEntry, rank: number, isYou: boolean) => (
    <li
      key={entry.id}
      className={`lb-row${isYou ? ' lb-row--you' : ''}`}
      style={isYou ? youStyle : undefined}
      aria-current={isYou ? 'true' : undefined}
    >
      <span className="lb-row__rank">#{rank}</span>
      <span className="lb-row__name">
        <DeviceIcon device={entry.device} />
        {entry.name}
        {isYou ? <span className="lb-row__you-tag">You</span> : null}
      </span>
      <span className="lb-row__score">{entry.score}</span>
      <span className="lb-row__date">{formatDate(entry.at)}</span>
    </li>
  )

  return (
    <>
      <Header />
      <main className="lb-page">
        <div className="lb-page__inner">
          <header className="lb-page__header">
            <h1 className="lb-page__title">Leaderboards</h1>
          </header>

          <label className="lb-game-pick">
            <span className="visually-hidden">Game</span>
            <select
              value={active}
              onChange={(e) => selectGame(e.target.value as LeaderboardGame)}
            >
              {tabs.map((tab) => (
                <option key={tab.slug} value={tab.slug}>
                  {tab.name}
                </option>
              ))}
            </select>
          </label>

          <div className="lb-tabs" role="tablist" aria-label="Games">
            {tabs.map((tab) => (
              <a
                key={tab.slug}
                href={leaderboardHref(tab.slug, period)}
                role="tab"
                aria-selected={tab.slug === active}
                className={`lb-tab${tab.slug === active ? ' lb-tab--active' : ''}`}
                style={{ '--tab-accent': tab.accent } as CSSProperties}
                onClick={(e) => {
                  e.preventDefault()
                  selectGame(tab.slug)
                }}
              >
                {tab.name}
              </a>
            ))}
          </div>

          <div className="lb-periods" role="tablist" aria-label="Time period">
            {LEADERBOARD_PERIODS.map((p) => (
              <a
                key={p}
                href={leaderboardHref(active, p)}
                role="tab"
                aria-selected={period === p}
                className={`lb-period${period === p ? ' lb-period--active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  selectPeriod(p)
                }}
              >
                {PERIOD_LABELS[p]}
              </a>
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
            </div>

            {loading ? (
              <p className="lb-empty">Loading scores…</p>
            ) : error ? (
              <p className="lb-empty">
                Couldn’t load leaderboards. Is the API running?
              </p>
            ) : entries.length === 0 && !you ? (
              <p className="lb-empty">
                No scores for {PERIOD_LABELS[period].toLowerCase()} yet.{' '}
                {canPlay ? (
                  <>
                    <a href={`#/games/${active}`}>Play {activeMeta.name}</a> to
                    claim the top spot.
                  </>
                ) : (
                  'Play it on a supported device to claim the top spot.'
                )}
              </p>
            ) : (
              <ol className="lb-list">
                {youOffVisible && you ? (
                  <>
                    {renderRow(you, you.rank, true)}
                    {visible.length > 0 ? (
                      <li className="lb-you-split">Top {shown}</li>
                    ) : null}
                  </>
                ) : null}
                {visible.map((entry, index) =>
                  renderRow(
                    entry,
                    index + 1,
                    Boolean(playerName) &&
                      (entry.name ?? '').toUpperCase() === playerName,
                  ),
                )}
              </ol>
            )}

            {!loading && !error && entries.length > shown ? (
              <button
                type="button"
                className="lb-more"
                onClick={() => setShown(entries.length)}
              >
                Show top {entries.length}
              </button>
            ) : null}

            {canPlay ? (
              <a
                className="lb-play"
                href={`#/games/${active}`}
                style={{ background: activeMeta.accent }}
              >
                Play {activeMeta.name}
              </a>
            ) : null}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
