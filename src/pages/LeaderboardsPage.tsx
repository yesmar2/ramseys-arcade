import { useEffect, useState } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import { BoardsGameIndex } from '../components/BoardsGameIndex'
import { GlobalRankList } from '../components/GlobalRankList'
import { PageShell } from '../components/PageShell'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { globalRankingsHref, leaderboardHref } from '../hooks/useHashRoute'
import { defaultPeriod } from '../lib/defaultPeriod'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  fetchLeaderboardsSummary,
  normalizePlayerName,
  PERIOD_LABELS,
  type GameBoardPreview,
  type GlobalBoardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { fetchTrophyCounts, type TrophyCount } from '../lib/trophies'

const INITIAL_ROWS = 10
const GLOBAL_ROWS = 100
const SUMMARY_ROWS = 3

type LeaderboardsPageProps = {
  global?: boolean
  period?: LeaderboardPeriod
}

function BoardsHubSwitcher({
  global,
  period,
}: {
  global: boolean
  period: LeaderboardPeriod
}) {
  return (
    <div className="lb-board-switcher" role="tablist" aria-label="Boards">
      <a
        role="tab"
        aria-selected={!global}
        className={`lb-board-switcher__item${!global ? ' lb-board-switcher__item--active' : ''}`}
        href={leaderboardHref(period)}
      >
        Top Scores
      </a>
      <a
        role="tab"
        aria-selected={global}
        className={`lb-board-switcher__item${global ? ' lb-board-switcher__item--active' : ''}`}
        href={globalRankingsHref(period)}
      >
        Rankings
      </a>
    </div>
  )
}

export function LeaderboardsPage({
  global: showGlobal,
  period: periodFromRoute,
}: LeaderboardsPageProps) {
  const period = periodFromRoute ?? defaultPeriod()
  if (showGlobal) {
    return <GlobalRankingsView period={period} />
  }
  return <LeaderboardsOverview period={period} />
}

function LeaderboardsOverview({ period }: { period: LeaderboardPeriod }) {
  const playerName = normalizePlayerName(usePlayerName())
  const [summaries, setSummaries] = useState<GameBoardPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const rows = await fetchLeaderboardsSummary(period, SUMMARY_ROWS)
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
  }, [period])

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--summary">
      <header className="lb-page__header lb-page__header--compact">
        <h1 className="lb-page__title">Boards</h1>
        <BoardsHubSwitcher global={false} period={period} />
      </header>

      <PeriodSwitcher
        period={period}
        hrefFor={leaderboardHref}
        onSelect={(p) => {
          window.location.hash = leaderboardHref(p)
        }}
      />

      {error ? (
        <BoardEmpty
          title="Couldn’t load scores"
          detail="Check your connection and try again."
        />
      ) : (
        <section
          key={period}
          className="lb-board lb-board--fade"
          aria-label={`${PERIOD_LABELS[period]} top scores`}
        >
          <BoardsGameIndex
            games={summaries}
            loading={loading}
            playerName={playerName}
            period={period}
          />
        </section>
      )}
    </PageShell>
  )
}

function GlobalRankingsView({ period }: { period: LeaderboardPeriod }) {
  const playerName = normalizePlayerName(usePlayerName())
  const [entries, setEntries] = useState<GlobalBoardEntry[]>([])
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [you, setYou] = useState<GlobalBoardEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(INITIAL_ROWS)
  const [trophyCounts, setTrophyCounts] = useState<Record<string, TrophyCount>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShown(INITIAL_ROWS)
    setTrophyCounts({})
    void (async () => {
      try {
        const board = await fetchGlobalBoard(GLOBAL_ROWS, period)
        if (cancelled) return
        setEntries(board.entries)
        setTotalPlayers(board.totalPlayers)
        if (!playerName) {
          setYou(null)
        } else {
          const onBoard = board.entries.find(
            (e) => normalizePlayerName(e.name) === playerName,
          )
          if (onBoard) {
            setYou(onBoard)
          } else {
            const mine = await fetchGlobalRank(playerName, period)
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
          }
        }
        const names = [
          ...new Set([
            ...board.entries.map((e) => e.name),
            ...(playerName ? [playerName] : []),
          ]),
        ]
        const counts = await fetchTrophyCounts(names)
        if (!cancelled) setTrophyCounts(counts)
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
  }, [playerName, period])

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--summary">
      <header className="lb-page__header lb-page__header--compact">
        <div className="lb-page__heading-row">
          <span className="lb-page__heading-slot" aria-hidden="true" />
          <h1 className="lb-page__title">Boards</h1>
          <div className="lb-game-board__trailing">
            <ShareBoardButton
              label={`Global rankings · ${PERIOD_LABELS[period]} · ${APP_NAME}`}
              url={globalRankingsHref(period)}
            />
          </div>
        </div>
        <BoardsHubSwitcher global period={period} />
      </header>

      <PeriodSwitcher
        period={period}
        hrefFor={globalRankingsHref}
        onSelect={(p) => {
          window.location.hash = globalRankingsHref(p)
        }}
      />

      <section
        key={period}
        className="lb-board lb-board--fade"
        aria-label={`${PERIOD_LABELS[period]} global rankings`}
      >
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
              <a className="lb-empty-state__btn" href={leaderboardHref(period)}>
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
            period={period}
            trophyCounts={trophyCounts}
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
