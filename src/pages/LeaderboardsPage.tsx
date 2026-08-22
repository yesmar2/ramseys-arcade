import { useEffect, useState } from 'react'
import { BoardEmpty, BoardSkeleton } from '../components/BoardChrome'
import { Footer } from '../components/Footer'
import {
  LeaderboardSummary,
  type GamePeriodSummary,
} from '../components/LeaderboardSummary'
import { GlobalRankList } from '../components/GlobalRankList'
import { HomeBar } from '../components/HomeBar'
import { leaderboardHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  getLeaderboard,
  LEADERBOARD_GAMES,
  LEADERBOARD_PERIODS,
  normalizePlayerName,
  type GlobalBoardEntry,
} from '../lib/leaderboard'

const INITIAL_ROWS = 10
const GLOBAL_ROWS = 100
const SUMMARY_ROWS = 3

type LeaderboardsPageProps = {
  global?: boolean
}

export function LeaderboardsPage({ global: showGlobal }: LeaderboardsPageProps) {
  if (showGlobal) {
    return <GlobalRankingsView />
  }
  return <LeaderboardsOverview />
}

function LeaderboardsOverview() {
  const playerName = normalizePlayerName(usePlayerName())
  const [summaries, setSummaries] = useState<GamePeriodSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const rows = await Promise.all(
          LEADERBOARD_GAMES.map(async (slug) => {
            const boards = await Promise.all(
              LEADERBOARD_PERIODS.map((period) =>
                getLeaderboard(slug, period, playerName || undefined),
              ),
            )
            const byPeriod = {} as GamePeriodSummary['byPeriod']
            LEADERBOARD_PERIODS.forEach((period, i) => {
              byPeriod[period] = {
                entries: boards[i].entries.slice(0, SUMMARY_ROWS),
              }
            })
            return { slug, byPeriod }
          }),
        )
        if (!cancelled) setSummaries(rows)
      } catch (err) {
        if (!cancelled) {
          setSummaries([])
          setError(err instanceof Error ? err.message : 'Failed to load')
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
              Top {SUMMARY_ROWS} for every game and time frame. Open a game for
              the full board.
            </p>
          </header>

          {error ? (
            <BoardEmpty
              title="Couldn’t load scores"
              detail="Check your connection and try again."
            />
          ) : loading ? (
            <LeaderboardSummary games={[]} loading />
          ) : (
            <LeaderboardSummary games={summaries} />
          )}
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
                    Browse leaderboards
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
