import { useEffect, useState, type CSSProperties } from 'react'
import { BoardSkeleton } from '../components/BoardChrome'
import { Footer } from '../components/Footer'
import { GameDeviceBadge } from '../components/GameDeviceBadge'
import { HomeBar } from '../components/HomeBar'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { getGame, gamePlayableOn } from '../data/games'
import { leaderboardHref, rankHref } from '../hooks/useHashRoute'
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

  const rankedGames = LEADERBOARD_GAMES.filter((slug) => Boolean(byGame[slug]))
  const rankedCount = rankedGames.length
  const totalGames = LEADERBOARD_GAMES.length
  const unrankedCount = totalGames - rankedCount

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner rank-page">
          <header className="lb-page__header lb-page__header--compact">
            {!isSelf ? (
              <a className="rank-page__back" href={rankHref()}>
                ← Your rank
              </a>
            ) : null}
            <h1 className="lb-page__title">
              {isSelf ? 'Global rank' : viewedName}
            </h1>
            <p className="lb-page__blurb lb-page__blurb--tight">
              {isSelf
                ? myName
                  ? 'All-time standing across every board'
                  : 'Set a gamer tag to earn a global rank'
                : `All-time standing for ${viewedName}`}
            </p>
          </header>

          {loading ? (
            <BoardSkeleton rows={5} />
          ) : (
            <>
              <section
                className="rank-page__summary rank-page__summary--bar"
                aria-label={isSelf ? 'Your rank' : `${viewedName} rank`}
              >
                <div className="rank-page__bar-stat">
                  <span className="rank-page__bar-label">Rank</span>
                  <strong>{rank != null ? `#${rank}` : '—'}</strong>
                </div>
                <div className="rank-page__bar-stat">
                  <span className="rank-page__bar-label">Points</span>
                  <strong>{score > 0 ? score : '—'}</strong>
                </div>
                <div className="rank-page__bar-stat">
                  <span className="rank-page__bar-label">Field</span>
                  <strong>{totalPlayers > 0 ? totalPlayers : '—'}</strong>
                </div>
              </section>

              {nearby.length > 0 ? (
                <section
                  className="rank-page__near rank-page__near--hero"
                  aria-labelledby="rank-near-heading"
                >
                  <h2 id="rank-near-heading" className="rank-page__hero-title">
                    {isSelf ? 'Near you' : `Near ${viewedName}`}
                  </h2>
                  <ul className="rank-page__near-list">
                    {nearby.map((row) => {
                      const isYou = row.name === myName
                      const isViewed = row.name === viewedName
                      const body = (
                        <>
                          <span className="rank-page__near-rank">#{row.rank}</span>
                          <span className="rank-page__near-name" title={row.name}>
                            <PlayerAvatar
                              avatarId={row.avatarId}
                              name={row.name}
                              size="sm"
                            />
                            <span className="rank-page__near-name-text">
                              {row.name}
                            </span>
                            {isYou ? <em>you</em> : null}
                          </span>
                          <span className="rank-page__near-pts">{row.score}</span>
                        </>
                      )
                      if (isViewed) {
                        return (
                          <li
                            key={`${row.rank}-${row.name}`}
                            className="rank-page__near-row rank-page__near-row--you"
                          >
                            {body}
                          </li>
                        )
                      }
                      return (
                        <li
                          key={`${row.rank}-${row.name}`}
                          className="rank-page__near-row"
                        >
                          <a
                            className="rank-page__near-link"
                            href={isYou ? rankHref() : rankHref(row.name)}
                          >
                            {body}
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}

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
                    return (
                      <li key={slug}>
                        <a
                          className={`rank-page__row-link${onDevice ? '' : ' rank-page__row-link--other-device'}${row ? '' : ' rank-page__row-link--empty'}`}
                          href={leaderboardHref(slug, 'all')}
                          style={{ '--rank-game-accent': accent } as CSSProperties}
                          aria-label={
                            row
                              ? `${game?.name ?? slug}: place ${row.place}, ${row.points} points. Open all-time board.`
                              : `${game?.name ?? slug}: unranked. Open all-time board.`
                          }
                        >
                          <span className="rank-page__game">
                            <span className="rank-page__game-name">
                              {game?.name ?? slug}
                            </span>
                            {game ? <GameDeviceBadge game={game} /> : null}
                          </span>
                          {row ? (
                            <>
                              <span className="rank-page__place">#{row.place}</span>
                              <span className="rank-page__pts">+{row.points}</span>
                            </>
                          ) : (
                            <>
                              <span className="rank-page__place rank-page__place--empty">
                                —
                              </span>
                              <span className="rank-page__pts rank-page__pts--empty">
                                Play
                              </span>
                            </>
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

          <a className="rank-page__boards" href={leaderboardHref()}>
            Open leaderboards
          </a>
        </div>
      </main>
      <Footer />
    </>
  )
}
