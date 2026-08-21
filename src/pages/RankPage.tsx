import { useEffect, useState } from 'react'
import { Footer } from '../components/Footer'
import { GameDeviceBadge } from '../components/GameDeviceBadge'
import { HomeBar } from '../components/HomeBar'
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

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner rank-page">
          <header className="lb-page__header">
            {!isSelf ? (
              <a className="rank-page__back" href={rankHref()}>
                ← Your rank
              </a>
            ) : null}
            <h1 className="lb-page__title">
              {isSelf ? 'Global rank' : viewedName}
            </h1>
            <p className="lb-page__blurb">
              {isSelf
                ? myName
                  ? 'Your all-time standing across every game board.'
                  : 'Set a gamer tag to earn a global rank.'
                : `All-time standing for ${viewedName}.`}
            </p>
          </header>

          {loading ? (
            <p className="lb-empty">Loading…</p>
          ) : (
            <>
              <section
                className="rank-page__summary"
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
                  <span className="lb-stat__label">Players</span>
                  <strong>{totalPlayers > 0 ? totalPlayers : '—'}</strong>
                </div>
              </section>

              {nearby.length > 0 ? (
                <section className="rank-page__near" aria-labelledby="rank-near-heading">
                  <h2 id="rank-near-heading" className="rank-page__h">
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
                            {row.name}
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
                        <li key={`${row.rank}-${row.name}`} className="rank-page__near-row">
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

              <section className="rank-page__board" aria-labelledby="rank-games-heading">
                <h2 id="rank-games-heading" className="rank-page__h">
                  By game
                </h2>
                <ul className="rank-page__list">
                  {LEADERBOARD_GAMES.map((slug) => {
                    const game = getGame(slug)
                    const row = byGame[slug]
                    const onDevice = game ? gamePlayableOn(game, device) : true
                    return (
                      <li
                        key={slug}
                        className={`rank-page__row${onDevice ? '' : ' rank-page__row--other-device'}`}
                      >
                        <a className="rank-page__game" href={leaderboardHref(slug, 'all')}>
                          <span className="rank-page__game-name">
                            {game?.name ?? slug}
                          </span>
                          {game ? <GameDeviceBadge game={game} /> : null}
                        </a>
                        {row ? (
                          <>
                            <span className="rank-page__place">#{row.place}</span>
                            <span className="rank-page__pts">+{row.points}</span>
                          </>
                        ) : (
                          <>
                            <span className="rank-page__place rank-page__place--empty">—</span>
                            <span className="rank-page__pts rank-page__pts--empty">0</span>
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            </>
          )}

          {isSelf ? (
            <section className="rank-page__how" aria-labelledby="rank-how-heading">
              <h2 id="rank-how-heading" className="rank-page__h">
                How it works
              </h2>
              <p>
                Your global rank uses <strong>all-time</strong> placements on each
                game’s leaderboard. Place higher on a board to earn more points:
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
                Points from every game are added together. Climb any board to move
                up — playing more games helps too.
              </p>
            </section>
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
