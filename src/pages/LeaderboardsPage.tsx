import { useEffect, useRef, useState } from 'react'
import { BoardEmpty, BoardMore, BoardSkeleton, PeriodSwitcher } from '../components/BoardChrome'
import { BoardsGameIndex } from '../components/BoardsGameIndex'
import { EventArt } from '../components/EventCard'
import { GlobalRankList } from '../components/GlobalRankList'
import { PageShell } from '../components/PageShell'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { globalRankingsHref, leaderboardHref, navigate } from '../hooks/useHashRoute'
import { defaultPeriod } from '../lib/defaultPeriod'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import { getGlobalRankSnapshot } from '../lib/globalRank'
import { usePagedBoard } from '../hooks/usePagedBoard'
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
  type GlobalBoardResult,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { fetchTrophyCounts, type TrophyCount } from '../lib/trophies'

const INITIAL_ROWS = 10
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
    <div className="seg" role="tablist" aria-label="Boards">
      <a
        role="tab"
        aria-selected={!global}
        className={`seg__item${!global ? ' seg__item--active' : ''}`}
        href={leaderboardHref(period)}
      >
        Top Scores
      </a>
      <a
        role="tab"
        aria-selected={global}
        className={`seg__item${global ? ' seg__item--active' : ''}`}
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
        </div>

        {error ? (
          <BoardEmpty title="Couldn’t load scores" detail="Check your connection and try again." />
        ) : (
          <section
            key={period}
            className="evl"
            aria-label={`${PERIOD_LABELS[period]} top scores`}
          >
            <div className="lst-block__head">
              <h2 className="lst-block__title">Games</h2>
              <p className="lst-block__note">{VISIBLE_LEADERBOARD_GAMES.length} boards</p>
              <div className="lst-block__tools">
                <PeriodSwitcher
                  period={period}
                  hrefFor={leaderboardHref}
                  onSelect={(p) => {
                    navigate(leaderboardHref(p))
                  }}
                />
              </div>
            </div>
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
  const board = usePagedBoard<GlobalBoardEntry, GlobalBoardResult & { total: number }>(
    async (offset, limit) => {
      const page = await fetchGlobalBoard(limit, period, offset)
      return { ...page, total: page.totalPlayers }
    },
    [playerName, period, groupId],
    { initial: INITIAL_ROWS },
  )
  const { entries, shown, loading, error } = board
  const totalPlayers = board.total
  const [you, setYou] = useState<GlobalBoardEntry | null>(null)
  const [trophyCounts, setTrophyCounts] = useState<Record<string, TrophyCount>>({})

  /*
   * Your own row, which may be nowhere near the page you are looking at: a
   * rank of 5,321 is still yours to see. The first page answers when you are
   * on it, and a rank lookup answers when you are not.
   */
  useEffect(() => {
    const first = board.first
    if (!first) return
    if (!playerName) {
      setYou(null)
      return
    }
    const onBoard = first.entries.find((e) => normalizePlayerName(e.name) === playerName)
    if (onBoard) {
      setYou(onBoard)
      return
    }
    const cached = getGlobalRankSnapshot()
    if (
      period === defaultPeriod() &&
      normalizePlayerName(getLastPlayerName()) === playerName &&
      cached.rank != null
    ) {
      setYou({
        name: playerName,
        rank: cached.rank,
        score: cached.score,
        games: Object.keys(cached.byGame).length,
      })
      return
    }
    let cancelled = false
    void fetchGlobalRank(playerName, period).then((mine) => {
      if (cancelled) return
      setYou(
        mine.rank == null
          ? null
          : {
              name: playerName,
              rank: mine.rank,
              score: mine.score,
              games: Object.keys(mine.byGame).length,
            },
      )
    })
    return () => {
      cancelled = true
    }
  }, [board.first, playerName, period])

  /*
   * Trophies for whoever is on screen, plus you wherever you are. Scrolling
   * a long board asks repeatedly, so it only ever asks about names it has
   * not already looked up.
   */
  const trophiesAsked = useRef<Set<string>>(new Set())
  useEffect(() => {
    trophiesAsked.current = new Set()
    setTrophyCounts({})
  }, [period, groupId])

  useEffect(() => {
    if (entries.length === 0) return
    const names = [
      ...new Set([
        ...entries.slice(0, shown).map((e) => e.name),
        ...(playerName ? [playerName] : []),
      ]),
    ].filter((name) => !trophiesAsked.current.has(name))
    if (names.length === 0) return
    for (const name of names) trophiesAsked.current.add(name)
    let cancelled = false
    void fetchTrophyCounts(names).then((counts) => {
      if (!cancelled) setTrophyCounts((prev) => ({ ...prev, ...counts }))
    })
    return () => {
      cancelled = true
    }
  }, [entries, shown, playerName, period, groupId])

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev bx">
        <BoardsHero global period={period} players={loading ? null : totalPlayers} />
        <div className="bx__controls">
          <BoardsHubSwitcher global period={period} />
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
                {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'}
              </p>
            ) : null}
            <div className="lst-block__tools">
              <PeriodSwitcher
                period={period}
                hrefFor={globalRankingsHref}
                onSelect={(p) => {
                  navigate(globalRankingsHref(p))
                }}
              />
            </div>
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

          <BoardMore
            board={board}
            hidden={Boolean(loading || error || entries.length === 0)}
            unit="players"
          />
        </section>
      </div>
    </PageShell>
  )
}
