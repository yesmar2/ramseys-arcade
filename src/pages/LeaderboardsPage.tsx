import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Footer } from '../components/Footer'
import { GameDeviceBadge } from '../components/GameDeviceBadge'
import { GlobalRankList } from '../components/GlobalRankList'
import { HomeBar } from '../components/HomeBar'
import { LeaderboardList } from '../components/LeaderboardList'
import { deviceRequirementLabel, getGame, gamePlayableOn } from '../data/games'
import { gamePlayHref, leaderboardHref, recordsHref } from '../hooks/useHashRoute'
import { useDeviceType } from '../lib/device'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  getLeaderboard,
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  normalizePlayerName,
  PERIOD_LABELS,
  type GlobalBoardEntry,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type YouEntry,
} from '../lib/leaderboard'

const INITIAL_ROWS = 10
const GLOBAL_ROWS = 100

type LeaderboardsPageProps = {
  game?: LeaderboardGame
  period?: LeaderboardPeriod
}

export function LeaderboardsPage({
  game: gameFromRoute,
  period: periodFromRoute,
}: LeaderboardsPageProps) {
  const isHub = !gameFromRoute

  if (isHub) return <GlobalLeaderboardsHub />

  return (
    <GameLeaderboard
      game={gameFromRoute}
      period={periodFromRoute ?? 'daily'}
    />
  )
}

function GlobalLeaderboardsHub() {
  const playerName = normalizePlayerName(usePlayerName())
  const [entries, setEntries] = useState<GlobalBoardEntry[]>([])
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [you, setYou] = useState<GlobalBoardEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(INITIAL_ROWS)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShown(INITIAL_ROWS)
    void (async () => {
      try {
        const board = await fetchGlobalBoard(GLOBAL_ROWS)
        if (cancelled) return
        setEntries(board.entries)
        setTotalPlayers(board.totalPlayers)
        if (!playerName) {
          setYou(null)
          return
        }
        const onBoard = board.entries.find(
          (e) => normalizePlayerName(e.name) === playerName,
        )
        if (onBoard) {
          setYou(onBoard)
          return
        }
        const mine = await fetchGlobalRank(playerName)
        if (cancelled) return
        if (mine.rank != null) {
          setYou({
            name: playerName,
            rank: mine.rank,
            score: mine.score,
            games: Object.keys(mine.byGame).length,
          })
        } else {
          setYou(null)
        }
      } catch (err) {
        if (cancelled) return
        setEntries([])
        setTotalPlayers(0)
        setYou(null)
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playerName])

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner">
          <header className="lb-page__header">
            <h1 className="lb-page__title">Leaderboards</h1>
            <p className="lb-page__blurb">
              All-time global points across every game board. Open a game below
              for its own daily and all-time scores.
            </p>
          </header>

          <section className="lb-board" aria-label="Global leaderboard">
            {loading ? (
              <p className="lb-empty">Loading ranks…</p>
            ) : error ? (
              <p className="lb-empty">
                Couldn’t load leaderboards. Is the API running?
              </p>
            ) : entries.length === 0 ? (
              <p className="lb-empty">
                No global ranks yet. Place on any game board to earn points.
              </p>
            ) : (
              <GlobalRankList
                entries={entries}
                you={you}
                playerName={playerName}
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

            {!loading && !error && totalPlayers > 0 ? (
              <p className="lb-device-note lb-device-note--footer">
                {totalPlayers} ranked {totalPlayers === 1 ? 'player' : 'players'}
                {entries.length < totalPlayers
                  ? ` · showing top ${entries.length}`
                  : ''}
              </p>
            ) : null}
          </section>

          <section className="lb-games" aria-labelledby="lb-games-heading">
            <h2 id="lb-games-heading" className="lb-games__title">
              Game boards
            </h2>
            <ul className="lb-games__list">
              {LEADERBOARD_GAMES.map((slug) => {
                const game = getGame(slug)
                return (
                  <li key={slug}>
                    <a
                      className="lb-games__link"
                      href={leaderboardHref(slug, 'all')}
                      style={
                        {
                          '--tab-accent': game?.accent ?? 'var(--accent)',
                        } as CSSProperties
                      }
                    >
                      <span className="lb-games__name">{game?.name ?? slug}</span>
                      {game ? <GameDeviceBadge game={game} /> : null}
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}

function GameLeaderboard({
  game: active,
  period,
}: {
  game: LeaderboardGame
  period: LeaderboardPeriod
}) {
  const device = useDeviceType()
  const playerName = usePlayerName().trim().toUpperCase()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(INITIAL_ROWS)

  const activeGame = getGame(active)
  const canPlay = activeGame ? gamePlayableOn(activeGame, device) : true
  const accent = activeGame?.accent ?? '#2eb8a0'

  const otherGames = useMemo(
    () => LEADERBOARD_GAMES.filter((slug) => slug !== active),
    [active],
  )

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

  const selectPeriod = (next: LeaderboardPeriod) => {
    window.location.hash = leaderboardHref(active, next)
  }

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner">
          <header className="lb-page__header">
            <a className="rank-page__back" href={leaderboardHref()}>
              ← Global ranks
            </a>
            <h1 className="lb-page__title">{activeGame?.name ?? active}</h1>
            <p className="lb-page__blurb">
              High scores for this game. Global points still come from all-time
              placements across every board.
            </p>
          </header>

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
            aria-label={`${activeGame?.name ?? active} ${PERIOD_LABELS[period]} leaderboard`}
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
                    <a href={gamePlayHref(active)}>Play {activeGame?.name}</a> to
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
                accent={accent}
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
                style={{ background: accent }}
              >
                Play {activeGame?.name ?? active}
              </a>
            ) : activeGame ? (
              <p className="lb-device-note lb-device-note--footer" role="note">
                {deviceRequirementLabel(activeGame)} Scores still count toward
                global rank.
              </p>
            ) : null}
          </section>

          {active === 'asteroids' ? (
            <section className="lb-games" aria-labelledby="lb-records-heading">
              <h2 id="lb-records-heading" className="lb-games__title">
                Records
              </h2>
              <p className="lb-page__blurb lb-page__blurb--inline">
                Fastest clear per wave — separate from high scores and global
                points.
              </p>
              <a
                className="lb-games__link"
                href={recordsHref('asteroids')}
                style={{ '--tab-accent': accent } as CSSProperties}
              >
                <span className="lb-games__name">Asteroids wave times</span>
              </a>
            </section>
          ) : null}

          {otherGames.length > 0 ? (
            <section className="lb-games" aria-labelledby="lb-other-games-heading">
              <h2 id="lb-other-games-heading" className="lb-games__title">
                Other games
              </h2>
              <ul className="lb-games__list">
                {otherGames.map((slug) => {
                  const game = getGame(slug)
                  return (
                    <li key={slug}>
                      <a
                        className="lb-games__link"
                        href={leaderboardHref(slug, period)}
                        style={
                          {
                            '--tab-accent': game?.accent ?? 'var(--accent)',
                          } as CSSProperties
                        }
                      >
                        <span className="lb-games__name">{game?.name ?? slug}</span>
                        {game ? <GameDeviceBadge game={game} /> : null}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  )
}
