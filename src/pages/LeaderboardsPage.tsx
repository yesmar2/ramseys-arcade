import { useEffect, useState } from 'react'
import { BoardEmpty, BoardSkeleton } from '../components/BoardChrome'
import {
  LeaderboardSummary,
} from '../components/LeaderboardSummary'
import { GlobalRankList } from '../components/GlobalRankList'
import { PageShell } from '../components/PageShell'
import { globalRankingsHref, leaderboardHref } from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  fetchLeaderboardsSummary,
  normalizePlayerName,
  type GamePeriodSummary,
  type GlobalBoardEntry,
} from '../lib/leaderboard'

const INITIAL_ROWS = 10
const GLOBAL_ROWS = 100
const SUMMARY_ROWS = 3

type LeaderboardsPageProps = {
  global?: boolean
}

function BoardsHubSwitcher({ global }: { global: boolean }) {
  return (
    <div className="lb-board-switcher" role="tablist" aria-label="Boards">
      <a
        role="tab"
        aria-selected={!global}
        className={`lb-board-switcher__item${!global ? ' lb-board-switcher__item--active' : ''}`}
        href={leaderboardHref()}
      >
        By game
      </a>
      <a
        role="tab"
        aria-selected={global}
        className={`lb-board-switcher__item${global ? ' lb-board-switcher__item--active' : ''}`}
        href={globalRankingsHref()}
      >
        Global
      </a>
    </div>
  )
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
        const rows = await fetchLeaderboardsSummary(SUMMARY_ROWS)
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
  }, [])

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--summary">
      <header className="lb-page__header lb-page__header--compact">
        <h1 className="lb-page__title">Boards</h1>
        <p className="lb-page__blurb lb-page__blurb--tight">
          Top {SUMMARY_ROWS} for every game and time frame. Open a game for
          the full board.
        </p>
        <BoardsHubSwitcher global={false} />
      </header>

      {error ? (
        <BoardEmpty
          title="Couldn’t load scores"
          detail="Check your connection and try again."
        />
      ) : loading ? (
        <LeaderboardSummary games={[]} loading />
      ) : (
        <LeaderboardSummary games={summaries} playerName={playerName} />
      )}
    </PageShell>
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
    <PageShell innerClassName="lb-page__inner">
      <header className="lb-page__header lb-page__header--compact">
        <h1 className="lb-page__title">Boards</h1>
        <p className="lb-page__blurb lb-page__blurb--tight">
          All-time points from every game board.
        </p>
        <BoardsHubSwitcher global />
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
                Browse boards
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
    </PageShell>
  )
}
