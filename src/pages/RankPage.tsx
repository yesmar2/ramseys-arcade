import { useEffect, useState, type CSSProperties } from 'react'
import { BoardSkeleton } from '../components/BoardChrome'
import { GameDeviceBadge } from '../components/GameDeviceBadge'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { getGame, gamePlayableOn } from '../data/games'
import { gameBoardHref, gamePlayHref, globalRankingsHref, rankHref } from '../hooks/useHashRoute'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { gapToNextLabel } from '../lib/boardGap'
import { useDeviceType } from '../lib/device'
import { usePlayerName } from '../hooks/usePlayerName'
import { useGlobalRank } from '../lib/globalRank'
import { APP_NAME } from '../lib/brand'
import {
  fetchGlobalRank,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_GAMES,
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
  const period = useDefaultPeriod()
  const device = useDeviceType()
  const myName = normalizePlayerName(usePlayerName())
  const viewedName = normalizePlayerName(player ?? '') || myName
  const isSelf = !normalizePlayerName(player ?? '') || viewedName === myName
  const myRank = useGlobalRank()
  const [periodRank, setPeriodRank] = useState<GlobalRankResult | null>(null)
  const useCachedSelfRank = isSelf
  const [loading, setLoading] = useState(!useCachedSelfRank)

  useEffect(() => {
    if (useCachedSelfRank) {
      setPeriodRank(null)
      setLoading(false)
      return
    }
    if (!viewedName) {
      setPeriodRank(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchGlobalRank(viewedName, period)
      .then((data) => {
        if (!cancelled) {
          setPeriodRank(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPeriodRank(empty)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [viewedName, useCachedSelfRank, period])

  const data =
    useCachedSelfRank ? myRank : (periodRank ?? (isSelf ? myRank : empty))
  const { rank, score, totalPlayers, byGame, nearby = [] } = data

  const rankedCount = VISIBLE_LEADERBOARD_GAMES.filter((slug) => Boolean(byGame[slug])).length
  const totalGames = VISIBLE_LEADERBOARD_GAMES.length
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
            <div className="lb-page__heading-row">
              {!isSelf ? (
                <PageBackLink
                  href={globalRankingsHref(period)}
                  label="Back to Rankings"
                />
              ) : (
                <span className="lb-page__heading-slot" aria-hidden="true" />
              )}
              <h1 className="lb-page__title">
                {isSelf ? 'Your ranking' : `${viewedName}'s Ranking`}
              </h1>
              {viewedName ? (
                <div className="lb-game-board__trailing">
                  <ShareBoardButton
                    label={
                      rank != null
                        ? `${viewedName} · #${rank} global · ${APP_NAME}`
                        : `${viewedName}'s ranking · ${APP_NAME}`
                    }
                    url={rankHref(viewedName || undefined, period)}
                  />
                </div>
              ) : (
                <span className="lb-page__heading-slot" aria-hidden="true" />
              )}
            </div>
            {isSelf && !myName ? (
              <p className="lb-page__blurb lb-page__blurb--tight">
                Set a gamer tag to earn a global rank
              </p>
            ) : null}
          </header>

          {loading ? (
            <BoardSkeleton rows={5} />
          ) : (
            <>
              <section
                className="lb-scorecard lb-scorecard--static"
                aria-label={isSelf ? 'Your rank' : `${viewedName}'s rank`}
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
                {gap ? (
                  <p className="lb-scorecard__gap">
                    {gap.before}
                    {gap.name ? (
                      <a className="lb-scorecard__gap-link" href={rankHref(gap.name, period)}>
                        {gap.name}
                      </a>
                    ) : null}
                  </p>
                ) : null}
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
                        {VISIBLE_LEADERBOARD_GAMES.map((slug) => (
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
                  {VISIBLE_LEADERBOARD_GAMES.map((slug) => {
                    const game = getGame(slug)
                    const row = byGame[slug]
                    const onDevice = game ? gamePlayableOn(game, device) : true
                    const accent = game?.accent ?? 'var(--accent)'
                    const href = row
                      ? gameBoardHref(slug, period)
                      : gamePlayHref(slug)
                    return (
                      <li key={slug}>
                        <a
                          className={`rank-page__game-row${onDevice ? '' : ' rank-page__game-row--dim'}${row ? '' : ' rank-page__game-row--empty'}`}
                          href={href}
                          style={{ '--rank-game-accent': accent } as CSSProperties}
                          aria-label={
                            row
                              ? `${game?.name ?? slug}: place ${row.place}, ${row.points} points. Open ${PERIOD_LABELS[period].toLowerCase()} board.`
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
                  Your global rank uses <strong>{PERIOD_LABELS[period].toLowerCase()}</strong>{' '}
                  placements on each game’s leaderboard. Place higher on a board to earn more
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
