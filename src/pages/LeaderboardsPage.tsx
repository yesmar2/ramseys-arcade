import { useEffect, useState } from 'react'
import { BoardEmpty, BoardSkeleton, PeriodSwitcher } from '../components/BoardChrome'
import { BoardsGameIndex } from '../components/BoardsGameIndex'
import { EventArt } from '../components/EventCard'
import { GlobalRankList } from '../components/GlobalRankList'
import { PageShell } from '../components/PageShell'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { globalRankingsHref, leaderboardHref } from '../hooks/useHashRoute'
import { defaultPeriod } from '../lib/defaultPeriod'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import { getGlobalRankSnapshot } from '../lib/globalRank'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import {
  fetchGlobalBoard,
  fetchGlobalRank,
  fetchLeaderboardsSummary,
  getLastPlayerName,
  normalizePlayerName,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_GAMES,
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

/** The page opens the way events, profiles and record books do. */
function BoardsHero({
  global,
  period,
  players,
}: {
  global: boolean
  period: LeaderboardPeriod
  players: number | null
}) {
  const games = VISIBLE_LEADERBOARD_GAMES.length
  return (
    <section className="hero bx-hero" aria-label="Boards">
      {global ? (
        <div className="hero__corner">
          <ShareBoardButton
            label={`The ${APP_NAME} board doesn’t lie (${PERIOD_LABELS[period]}). Peek if you dare.`}
            url={globalRankingsHref(period)}
          />
        </div>
      ) : null}
      <div className="hero__main hero__main--bare">
        <EventArt games={VISIBLE_LEADERBOARD_GAMES.slice(0, 4)} className="hero__art" />
        <div className="hero__text">
          <p className="ev-kicker hero__kicker">
            <span className="ev-kicker__bit">Boards</span>
            <span className="ev-kicker__bit">{PERIOD_LABELS[period]}</span>
            {global && players ? (
              <span className="ev-kicker__bit">
                {players} {players === 1 ? 'player' : 'players'} ranked
              </span>
            ) : (
              <span className="ev-kicker__bit">{games} games</span>
            )}
          </p>
          <h1 className="hero__title">{global ? 'Rankings' : 'Top scores'}</h1>
          <p className="hero__sub">
            {global
              ? 'Every board added up. First on a board is worth 100 points, hundredth is worth 1, and the total is your rank.'
              : 'The best runs on every game. Open a game for its full board, and pick a period to see who is on top right now.'}
          </p>
        </div>
      </div>
    </section>
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
  const groupId = useActiveGroup()
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
  }, [period, groupId])

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev bx">
        <BoardsHero global={false} period={period} players={null} />
        <div className="bx__controls">
          <BoardsHubSwitcher global={false} period={period} />
          <PeriodSwitcher
            period={period}
            hrefFor={leaderboardHref}
            onSelect={(p) => {
              window.location.hash = leaderboardHref(p)
            }}
          />
        </div>

        {error ? (
          <BoardEmpty title="Couldn’t load scores" detail="Check your connection and try again." />
        ) : (
          <section
            key={period}
            className="evl"
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
      </div>
    </PageShell>
  )
}

function GlobalRankingsView({ period }: { period: LeaderboardPeriod }) {
  const playerName = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
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
          } else if (period === defaultPeriod()) {
            const cached = getGlobalRankSnapshot()
            if (
              normalizePlayerName(getLastPlayerName()) === playerName &&
              cached.rank != null
            ) {
              setYou({
                name: playerName,
                rank: cached.rank,
                score: cached.score,
                games: Object.keys(cached.byGame).length,
              })
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
            ...board.entries.slice(0, INITIAL_ROWS).map((e) => e.name),
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
  }, [playerName, period, groupId])

  useEffect(() => {
    if (entries.length === 0 || shown <= INITIAL_ROWS) return
    let cancelled = false
    const names = entries.slice(0, shown).map((e) => e.name)
    void fetchTrophyCounts(names).then((counts) => {
      if (!cancelled) {
        setTrophyCounts((prev) => ({ ...prev, ...counts }))
      }
    })
    return () => {
      cancelled = true
    }
  }, [entries, shown])

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev bx">
        <BoardsHero global period={period} players={loading ? null : totalPlayers} />
        <div className="bx__controls">
          <BoardsHubSwitcher global period={period} />
          <PeriodSwitcher
            period={period}
            hrefFor={globalRankingsHref}
            onSelect={(p) => {
              window.location.hash = globalRankingsHref(p)
            }}
          />
        </div>

        <section
          key={period}
          className="lst-block"
          aria-label={`${PERIOD_LABELS[period]} global rankings`}
        >
          <div className="lst-block__head">
            <h2 className="lst-block__title">Rankings</h2>
            {!loading && !error && totalPlayers > 0 ? (
              <p className="lst-block__note">
                {PERIOD_LABELS[period]} · {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'}
                {entries.length < totalPlayers ? ` · top ${entries.length}` : ''}
              </p>
            ) : null}
          </div>
          {loading ? (
            <BoardSkeleton />
          ) : error ? (
            <BoardEmpty title="Couldn’t load ranks" detail="Check your connection and try again." />
          ) : entries.length === 0 ? (
            <BoardEmpty
              title={groupBoardEmptyTitle('No ranks yet')}
              detail={groupId ? undefined : 'Place on any game board to earn global points.'}
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
            <button type="button" className="lst__more" onClick={() => setShown(entries.length)}>
              Show top {entries.length}
            </button>
          ) : null}
        </section>
      </div>
    </PageShell>
  )
}
