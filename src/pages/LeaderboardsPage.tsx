import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import {
  GameBoardPicker,
  type GameBoardSummary,
} from '../components/GameBoardPicker'
import { Footer } from '../components/Footer'
import { GameThumbArt } from '../components/GameThumbArt'
import { GlobalRankList } from '../components/GlobalRankList'
import { HomeBar } from '../components/HomeBar'
import { LeaderboardList } from '../components/LeaderboardList'
import { deviceRequirementLabel, getGame, gamePlayableOn } from '../data/games'
import {
  gameHref,
  gamePlayHref,
  leaderboardHref,
  recordsHref,
} from '../hooks/useHashRoute'
import { useDeviceType } from '../lib/device'
import { flashYouRow } from '../lib/boardGap'
import { gameHasRecords } from '../lib/records'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  getLeaderboard,
  LEADERBOARD_GAMES,
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
  global?: boolean
}

export function LeaderboardsPage({
  game: activeGame,
  period: periodFromRoute,
  global: showGlobal,
}: LeaderboardsPageProps) {
  if (showGlobal) {
    return <GlobalRankingsView />
  }
  if (activeGame) {
    return (
      <GameBoardView game={activeGame} period={periodFromRoute ?? 'daily'} />
    )
  }
  return <LeaderboardsHub />
}

function LeaderboardsHub() {
  const playerName = normalizePlayerName(usePlayerName())
  const [summaries, setSummaries] = useState<GameBoardSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const rows = await Promise.all(
          LEADERBOARD_GAMES.map(async (slug) => {
            const board = await getLeaderboard(slug, 'daily', playerName || undefined)
            const top = board.entries[0]
            return {
              slug,
              top: top ? { name: top.name, score: top.score } : null,
              you: board.you
                ? { rank: board.you.rank, score: board.you.score }
                : null,
            }
          }),
        )
        if (!cancelled) setSummaries(rows)
      } catch {
        if (!cancelled) {
          setSummaries(
            LEADERBOARD_GAMES.map((slug) => ({
              slug,
              top: null,
              you: null,
            })),
          )
        }
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
          <header className="lb-page__header lb-page__header--compact">
            <h1 className="lb-page__title">Leaderboards</h1>
            <p className="lb-page__blurb lb-page__blurb--tight">
              Pick a game to browse scores.
            </p>
          </header>

          <GameBoardPicker summaries={summaries} loading={loading} />
        </div>
      </main>
      <Footer />
    </>
  )
}

function GlobalRankingsView() {
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
          <header className="lb-page__header lb-page__header--compact">
            <a className="rank-page__back" href={leaderboardHref()}>
              ← Leaderboards
            </a>
            <p className="lb-page__eyebrow">All-time</p>
            <h1 className="lb-page__title">Global Rankings</h1>
            <p className="lb-page__blurb lb-page__blurb--tight">
              Points from every game board.
            </p>
          </header>

          <section className="lb-board" aria-label="Global leaderboard">
            {loading ? (
              <BoardSkeleton />
            ) : error ? (
              <BoardEmpty
                title="Couldn’t load ranks"
                detail="Check your connection and try again."
              />
            ) : entries.length === 0 ? (
              <BoardEmpty
                title="No ranks yet"
                detail="Place on any game board to earn global points."
                action={
                  <a className="lb-empty-state__btn" href={leaderboardHref()}>
                    Browse game boards
                  </a>
                }
              />
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
        </div>
      </main>
      <Footer />
    </>
  )
}

function GameBoardView({
  game: active,
  period,
}: {
  game: LeaderboardGame
  period: LeaderboardPeriod
}) {
  const device = useDeviceType()
  const playerName = normalizePlayerName(usePlayerName())
  const [summaries, setSummaries] = useState<GameBoardSummary[]>([])
  const [summariesLoading, setSummariesLoading] = useState(true)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(INITIAL_ROWS)
  const pulsed = useRef(false)

  const activeGame = getGame(active)
  const canPlay = activeGame ? gamePlayableOn(activeGame, device) : true
  const accent = activeGame?.accent ?? '#2eb8a0'

  useEffect(() => {
    const canonical = leaderboardHref(active, period)
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical)
    }
  }, [active, period])

  useEffect(() => {
    let cancelled = false
    setSummariesLoading(true)
    void (async () => {
      try {
        const rows = await Promise.all(
          LEADERBOARD_GAMES.map(async (slug) => {
            const board = await getLeaderboard(slug, 'daily', playerName || undefined)
            const top = board.entries[0]
            return {
              slug,
              top: top ? { name: top.name, score: top.score } : null,
              you: board.you
                ? { rank: board.you.rank, score: board.you.score }
                : null,
            }
          }),
        )
        if (!cancelled) setSummaries(rows)
      } catch {
        if (!cancelled) {
          setSummaries(
            LEADERBOARD_GAMES.map((slug) => ({
              slug,
              top: null,
              you: null,
            })),
          )
        }
      } finally {
        if (!cancelled) setSummariesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [playerName])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShown(INITIAL_ROWS)
    pulsed.current = false
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

  useEffect(() => {
    if (loading || !you || pulsed.current) return
    pulsed.current = true
    window.requestAnimationFrame(() => flashYouRow())
  }, [loading, you, active, period])

  const selectPeriod = (next: LeaderboardPeriod) => {
    window.location.hash = leaderboardHref(active, next)
  }

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div
          className="lb-page__inner lb-page__inner--boards"
          style={
            {
              '--period-accent': accent,
              '--board-accent': accent,
            } as CSSProperties
          }
        >
          <header className="lb-page__header lb-page__header--compact">
            <a className="rank-page__back" href={leaderboardHref()}>
              ← All boards
            </a>
            <h1 className="lb-page__title">Leaderboards</h1>
          </header>

          <GameBoardPicker
            summaries={summaries}
            loading={summariesLoading}
            activeSlug={active}
          />

          <section className="lb-board-section" aria-labelledby="lb-active-game-heading">
            <div className="lb-board-section__head">
              <GameThumbArt
                slug={active}
                accent={accent}
                className="lb-board-section__thumb"
              />
              <div className="lb-board-section__intro">
                <h2 id="lb-active-game-heading" className="lb-board-section__title">
                  {activeGame?.name ?? active}
                </h2>
                <a className="lb-board-section__hub" href={gameHref(active)}>
                  Game hub →
                </a>
              </div>
            </div>

            <PeriodSwitcher
              period={period}
              accent={accent}
              hrefFor={(p) => leaderboardHref(active, p)}
              onSelect={selectPeriod}
            />

            <section
              key={`${active}-${period}`}
              className="lb-board lb-board--fade"
              aria-label={`${activeGame?.name ?? active} ${PERIOD_LABELS[period]} leaderboard`}
            >
              {loading ? (
                <BoardSkeleton />
              ) : error ? (
                <BoardEmpty
                  title="Couldn’t load scores"
                  detail="Check your connection and try again."
                />
              ) : entries.length === 0 && !you ? (
                <BoardEmpty
                  title={`No ${PERIOD_LABELS[period].toLowerCase()} scores yet`}
                  detail={
                    canPlay
                      ? `Be the first on the ${activeGame?.name ?? active} board.`
                      : 'Open it on a supported device to post a score.'
                  }
                  action={
                    canPlay ? (
                      <a
                        className="lb-empty-state__btn"
                        href={gamePlayHref(active)}
                        style={{ background: accent }}
                      >
                        Play {activeGame?.name ?? active}
                      </a>
                    ) : null
                  }
                />
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

              {canPlay && !(loading || error) && (entries.length > 0 || you) ? (
                <a
                  className="lb-play"
                  href={gamePlayHref(active)}
                  style={{ background: accent }}
                >
                  Play {activeGame?.name ?? active}
                </a>
              ) : activeGame && !canPlay ? (
                <p className="lb-device-note lb-device-note--footer" role="note">
                  {deviceRequirementLabel(activeGame)} Scores still count toward
                  global rank.
                </p>
              ) : null}
            </section>

            {gameHasRecords(active) ? (
              <a
                className="lb-records-cta"
                href={recordsHref(active)}
                style={{ '--board-accent': accent } as CSSProperties}
              >
                {activeGame?.name ?? active} record books
              </a>
            ) : null}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
