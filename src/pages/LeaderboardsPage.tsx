import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Footer } from '../components/Footer'
import { GameDeviceBadge } from '../components/GameDeviceBadge'
import { HomeBar } from '../components/HomeBar'
import { LeaderboardList } from '../components/LeaderboardList'
import { deviceRequirementLabel, getGame, gamePlayableOn } from '../data/games'
import { gamePlayHref, leaderboardHref } from '../hooks/useHashRoute'
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

type LeaderboardsPageProps = {
  game?: LeaderboardGame
  period?: LeaderboardPeriod
}

export function LeaderboardsPage({
  game: gameFromRoute,
  period: periodFromRoute,
}: LeaderboardsPageProps) {
  const device = useDeviceType()
  const tabs = useMemo(
    () =>
      LEADERBOARD_GAMES.map((slug) => {
        const game = getGame(slug)
        const playable = game ? gamePlayableOn(game, device) : false
        return {
          slug,
          name: game?.name ?? slug,
          accent: game?.accent ?? '#2eb8a0',
          playable,
          game: game ?? null,
        }
      }),
    [device],
  )

  const period: LeaderboardPeriod = periodFromRoute ?? 'daily'
  const active: LeaderboardGame =
    (gameFromRoute && tabs.some((t) => t.slug === gameFromRoute)
      ? gameFromRoute
      : tabs[0]?.slug) ?? LEADERBOARD_GAMES[0]
  const playerName = usePlayerName().trim().toUpperCase()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(INITIAL_ROWS)
  const activeMeta = tabs.find((t) => t.slug === active) ?? tabs[0]
  const activeGame = getGame(active)
  const canPlay = activeGame ? gamePlayableOn(activeGame, device) : true

  useEffect(() => {
    if (!tabs.length) return
    const canonical = leaderboardHref(active, period)
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical)
    }
  }, [active, period, tabs.length])

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

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner">
          <header className="lb-page__header">
            <h1 className="lb-page__title">Leaderboards</h1>
          </header>

          <div className="lb-tabs" role="tablist" aria-label="Games">
            {tabs.map((tab) => (
              <a
                key={tab.slug}
                href={leaderboardHref(tab.slug, period)}
                role="tab"
                aria-selected={tab.slug === active}
                className={`lb-tab${tab.slug === active ? ' lb-tab--active' : ''}${tab.playable ? '' : ' lb-tab--other-device'}`}
                style={{ '--tab-accent': tab.accent } as CSSProperties}
                onClick={(e) => {
                  e.preventDefault()
                  selectGame(tab.slug)
                }}
              >
                <span className="lb-tab__name">{tab.name}</span>
                {tab.game ? <GameDeviceBadge game={tab.game} /> : null}
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
                    <a href={gamePlayHref(active)}>Play {activeMeta.name}</a> to
                    claim the top spot.
                  </>
                ) : (
                  <>Open it on a supported device to post a score.</>
                )}
              </p>
            ) : (
              <LeaderboardList
                entries={entries}
                you={you}
                playerName={playerName}
                accent={activeMeta.accent}
                shown={shown}
              />
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
                href={gamePlayHref(active)}
                style={{ background: activeMeta.accent }}
              >
                Play {activeMeta.name}
              </a>
            ) : activeGame ? (
              <p className="lb-device-note lb-device-note--footer" role="note">
                {deviceRequirementLabel(activeGame)} Scores still count toward
                global rank.
              </p>
            ) : null}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
