import { useEffect, useState, type CSSProperties } from 'react'
import { BoardSkeleton } from '../components/BoardChrome'
import { PageTrail } from '../components/BoardTrail'
import { GameDeviceBadge } from '../components/GameDeviceBadge'
import { PageShell } from '../components/PageShell'
import { getGame, gamePlayableOn } from '../data/games'
import { gameBoardHref, gamePlayHref, globalRankingsHref } from '../hooks/useHashRoute'
import { gapToNextLabel } from '../lib/boardGap'
import { useDeviceType } from '../lib/device'
import { usePlayerName } from '../hooks/usePlayerName'
import { useGlobalRank } from '../lib/globalRank'
import {
  fetchGlobalRank,
  LEADERBOARD_GAMES,
  normalizePlayerName,
  type GlobalRankResult,
} from '../lib/leaderboard'

const empty: GlobalRankResult = {
  rank: null,
  score: 0,
  totalPlayers: 0,
  byGame: {},
  nearby: [],
}

export function RankPage({ player }: { player?: string }) {
  const device = useDeviceType()
  const myName = normalizePlayerName(usePlayerName())
  const viewedName = normalizePlayerName(player ?? '') || myName
  const isSelf = !viewedName || viewedName === myName
  const myRank = useGlobalRank()
  const [other, setOther] = useState<GlobalRankResult | null>(null)
  const [loading, setLoading] = useState(!isSelf)

  useEffect(() => {
    if (isSelf || !viewedName) {
      setOther(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchGlobalRank(viewedName)
      .then((data) => {
        if (!cancelled) {
          setOther(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOther(empty)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [viewedName, isSelf])

  const data = isSelf ? myRank : (other ?? empty)
  const { rank, score, totalPlayers, byGame, nearby = [] } = data

  const rankedCount = LEADERBOARD_GAMES.filter((slug) => Boolean(byGame[slug])).length
  const totalGames = LEADERBOARD_GAMES.length
  const unrankedCount = totalGames - rankedCount

  const gap =
    rank != null && rank > 0
      ? gapToNextLabel({
          youRank: rank,
          youScore: score,
          entries: nearby,
          formatDelta: (n) => `${n} pt${n === 1 ? '' : 's'}`,
        })
      : null

  return (
    <PageShell innerClassName="lb-page__inner rank-page">
      <header className="lb-page__header lb-page__header--compact">
            {isSelf ? (
              <>
                <h1 className="lb-page__title">Your profile</h1>
                <p className="lb-page__blurb lb-page__blurb--tight">
                  {myName
                    ? 'All-time standing across every board'
                    : 'Set a gamer tag to earn a global rank'}
                </p>
              </>
            ) : (
              <>
                <PageTrail
                  parentHref={globalRankingsHref()}
                  parentLabel="Rankings"
                  currentLabel={viewedName}
                  ariaLabel="Rankings"
                />
                <p className="lb-page__blurb lb-page__blurb--tight">
                  All-time standing for {viewedName}
                </p>
              </>
            )}
          </header>

          {loading ? (
            <BoardSkeleton rows={5} />
          ) : (
            <>
              <section
                className="lb-scorecard lb-scorecard--static"
                aria-label={isSelf ? 'Your rank' : `${viewedName} rank`}
              >
                <div className="lb-stat">
                  <span className="lb-stat__label">Rank</span>
                  <strong>{rank != null ? `#${rank}` : '—'}</strong>
                </div>
                <div className="lb-stat">
                  <span className="lb-stat__label">Points</span>
                  <strong>{score > 0 ? score : '—'}</strong>
                </div>
                <div className="lb-stat">
                  <span className="lb-stat__label">Field</span>
                  <strong>{totalPlayers > 0 ? totalPlayers : '—'}</strong>
                </div>
                {gap ? <p className="lb-scorecard__gap">{gap}</p> : null}
              </section>

              <section
                className="rank-page__board"
                aria-labelledby="rank-games-heading"
              >
                <div className="rank-page__board-head">
                  <h2 id="rank-games-heading" className="rank-page__h">
                    By game
                  </h2>
                  {totalGames > 0 ? (
                    <p className="rank-page__progress" aria-live="polite">
                      <span className="rank-page__dots" aria-hidden="true">
                        {LEADERBOARD_GAMES.map((slug) => (
                          <span
                            key={slug}
                            className={`rank-page__dot${byGame[slug] ? ' rank-page__dot--on' : ''}`}
                            title={getGame(slug)?.name ?? slug}
                          />
                        ))}
                      </span>
                      <span className="rank-page__progress-text">
                        {rankedCount === totalGames
                          ? `Ranked on all ${totalGames} games`
                          : unrankedCount === totalGames
                            ? `Unranked on all ${totalGames} games`
                            : unrankedCount === 1
                              ? 'Unranked on 1 game'
                              : `Unranked on ${unrankedCount} games`}
                      </span>
                    </p>
                  ) : null}
                </div>
                <ul className="rank-page__list">
                  {LEADERBOARD_GAMES.map((slug) => {
                    const game = getGame(slug)
                    const row = byGame[slug]
                    const onDevice = game ? gamePlayableOn(game, device) : true
                    const accent = game?.accent ?? 'var(--accent)'
                    const href = row
                      ? gameBoardHref(slug, 'all')
                      : gamePlayHref(slug)
                    return (
                      <li key={slug}>
                        <a
                          className={`rank-page__game-row${onDevice ? '' : ' rank-page__game-row--dim'}${row ? '' : ' rank-page__game-row--empty'}`}
                          href={href}
                          style={{ '--rank-game-accent': accent } as CSSProperties}
                          aria-label={
                            row
                              ? `${game?.name ?? slug}: place ${row.place}, ${row.points} points. Open all-time board.`
                              : `${game?.name ?? slug}: unranked. Play now.`
                          }
                        >
                          <span className="rank-page__game-rank">
                            {row ? `#${row.place}` : '—'}
                          </span>
                          <span className="rank-page__game-main">
                            <span className="rank-page__game-name">
                              {game?.name ?? slug}
                            </span>
                            {game ? <GameDeviceBadge game={game} /> : null}
                          </span>
                          {row ? (
                            <span className="rank-page__game-score">
                              <strong>{row.points}</strong>
                              <span>pts</span>
                            </span>
                          ) : (
                            <span className="rank-page__game-cta">Play</span>
                          )}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </>
          )}

          {isSelf ? (
            <details className="rank-page__how">
              <summary className="rank-page__how-summary">
                <span className="rank-page__h" id="rank-how-heading">
                  How it works
                </span>
              </summary>
              <div className="rank-page__how-body">
                <p>
                  Your global rank uses <strong>all-time</strong> placements on
                  each game’s leaderboard. Place higher on a board to earn more
                  points:
                </p>
                <ul className="rank-page__rules">
                  <li>
                    <span>1st place</span>
                    <strong>100 pts</strong>
                  </li>
                  <li>
                    <span>2nd place</span>
                    <strong>99 pts</strong>
                  </li>
                  <li>
                    <span>3rd place</span>
                    <strong>98 pts</strong>
                  </li>
                  <li>
                    <span>100th place</span>
                    <strong>1 pt</strong>
                  </li>
                </ul>
                <p>
                  Points from every game are added together. Climb any board to
                  move up — playing more games helps too.
                </p>
              </div>
            </details>
          ) : null}
    </PageShell>
  )
}
