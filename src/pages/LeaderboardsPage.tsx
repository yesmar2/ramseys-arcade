import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import { Footer } from '../components/Footer'
import { GameDeviceBadge } from '../components/GameDeviceBadge'
import { GameTile } from '../components/GameTile'
import { GlobalRankList } from '../components/GlobalRankList'
import { HomeBar } from '../components/HomeBar'
import { LeaderboardList } from '../components/LeaderboardList'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { YouBoardStrip } from '../components/YouBoardStrip'
import { deviceRequirementLabel, getGame, gamePlayableOn } from '../data/games'
import { gamePlayHref, leaderboardHref, recordsHref } from '../hooks/useHashRoute'
import { useDeviceType } from '../lib/device'
import { findMeOnBoard, flashYouRow, gapToNextLabel } from '../lib/boardGap'
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
      period={periodFromRoute ?? 'all'}
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

  const youOnVisible = Boolean(
    you &&
      entries
        .slice(0, shown)
        .some((e) => normalizePlayerName(e.name) === playerName),
  )
  const showFindMe = Boolean(you && !youOnVisible)

  const gap = you
    ? gapToNextLabel({
        youRank: you.rank,
        youScore: you.score,
        entries,
        formatDelta: (n) => `${n} pt${n === 1 ? '' : 's'}`,
      })
    : null

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner">
          <header className="lb-page__header lb-page__header--compact">
            <p className="lb-page__eyebrow">All-time</p>
            <h1 className="lb-page__title">Global</h1>
            <p className="lb-page__blurb lb-page__blurb--tight">
              Points from every game board.
            </p>
            {!loading && !error && you ? (
              <div className="lb-page__actions">
                <ShareBoardButton
                  label={`#${you.rank} global · ${you.score} pts · Ramsey’s Arcade`}
                />
              </div>
            ) : null}
          </header>

          {!loading && !error && playerName ? (
            <section className="lb-scorecard" aria-label="Your global standing">
              <div className="lb-stat">
                <span className="lb-stat__label">Rank</span>
                <strong>{you ? `#${you.rank}` : '—'}</strong>
              </div>
              <div className="lb-stat">
                <span className="lb-stat__label">Points</span>
                <strong>{you && you.score > 0 ? you.score : '—'}</strong>
              </div>
              <div className="lb-stat">
                <span className="lb-stat__label">Games</span>
                <strong>{you ? you.games : '—'}</strong>
              </div>
              {gap ? <p className="lb-scorecard__gap">{gap}</p> : null}
              {showFindMe && you ? (
                <button
                  type="button"
                  className="lb-scorecard__find"
                  onClick={() => findMeOnBoard(you.rank, entries.length, setShown)}
                >
                  Find me on the board
                </button>
              ) : null}
            </section>
          ) : null}

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
                  <a className="lb-empty-state__btn" href={leaderboardHref('asteroids', 'all')}>
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
  const pulsed = useRef(false)

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

  const youOnVisible = Boolean(
    you && entries.slice(0, shown).some((entry) => entry.id === you.id),
  )
  const showFindMe = Boolean(you && !youOnVisible)

  const gap = you
    ? gapToNextLabel({
        youRank: you.rank,
        youScore: you.score,
        entries: entries.map((e, i) => ({ rank: i + 1, score: e.score })),
        formatDelta: (n) => String(n),
      })
    : null

  const shareLabel = you
    ? `#${you.rank} on ${activeGame?.name ?? active} · ${PERIOD_LABELS[period]} · ${you.score}`
    : `${activeGame?.name ?? active} · ${PERIOD_LABELS[period]} · Ramsey’s Arcade`

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div
          className="lb-page__inner"
          style={
            {
              '--period-accent': accent,
              '--board-accent': accent,
            } as CSSProperties
          }
        >
          <header className="lb-page__header lb-page__header--compact">
            <a className="rank-page__back" href={leaderboardHref()}>
              ← Global ranks
            </a>
            <h1 className="lb-page__title">{activeGame?.name ?? active}</h1>
            <p className="lb-page__blurb lb-page__blurb--tight">
              High scores · all-time places earn global points
            </p>
            {!loading && !error ? (
              <div className="lb-page__actions">
                <ShareBoardButton label={shareLabel} />
              </div>
            ) : null}
          </header>

          <PeriodSwitcher
            period={period}
            accent={accent}
            hrefFor={(p) => leaderboardHref(active, p)}
            onSelect={selectPeriod}
          />

          {!loading && !error && you ? (
            <YouBoardStrip
              rank={you.rank}
              value={you.score}
              valueLabel="Score"
              gap={gap}
              accent={accent}
              findMe={showFindMe}
              onFindMe={() => findMeOnBoard(you.rank, entries.length, setShown)}
            />
          ) : null}

          <section
            key={`${active}-${period}`}
            className="lb-board lb-board--accented lb-board--fade"
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

            {!loading && !error && you && showFindMe ? (
              <p className="lb-personal-best">
                Your best: {you.score} · #{you.rank}
              </p>
            ) : null}

            {!loading && !error && entries.length > shown ? (
              <button
                type="button"
                className="lb-more"
                onClick={() => setShown(entries.length)}
              >
                Show top {entries.length}
              </button>
            ) : null}

            {canPlay && !(entries.length === 0 && !you) ? (
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

          {active === 'asteroids' ? (
            <a
              className="lb-records-cta"
              href={recordsHref('asteroids')}
              style={{ '--board-accent': accent } as CSSProperties}
            >
              Wave &amp; combo
            </a>
          ) : null}

          {otherGames.length > 0 ? (
            <section className="lb-games" aria-labelledby="lb-other-games-heading">
              <h2 id="lb-other-games-heading" className="lb-games__title">
                Other games
              </h2>
              <ul className="game-grid game-grid--playable lb-other-grid">
                {otherGames.map((slug, index) => {
                  const game = getGame(slug)
                  if (!game) return null
                  return (
                    <GameTile
                      key={slug}
                      game={game}
                      index={index}
                      href={leaderboardHref(slug, period)}
                      showOnAllDevices
                    />
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
