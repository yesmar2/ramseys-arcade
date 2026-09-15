import { useEffect, useState, type CSSProperties } from 'react'
import { BoardSkeleton } from '../components/BoardChrome'
import { GameDeviceBadge } from '../components/GameDeviceBadge'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { TrophyCase } from '../components/TrophyCase'
import { getGame, gamePlayableOn } from '../data/games'
import { gameBoardHref, gamePlayHref, globalRankingsHref, rankHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { gapToNextLabel } from '../lib/boardGap'
import { useDeviceType } from '../lib/device'
import { usePlayerName } from '../hooks/usePlayerName'
import { useActiveGroup } from '../lib/groups'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { APP_NAME } from '../lib/brand'
import { resolveGameAccent } from '../lib/theme'
import { sendFriendRequest } from '../lib/friends'
import {
  ApiError,
  fetchGlobalRank,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_GAMES,
  VISIBLE_LEADERBOARD_PERIODS,
  normalizePlayerName,
  type GlobalRankResult,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

function AddFriendButton({ name }: { name: string }) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    if (status === 'busy' || status === 'sent') return
    setStatus('busy')
    setError(null)
    try {
      const result = await sendFriendRequest(name)
      setStatus('sent')
      if (result.status === 'accepted') setError(null)
    } catch (err) {
      setStatus('error')
      if (err instanceof ApiError && (err.code === 'NOT_A_PLAYER' || /hasn't signed in yet/i.test(err.message))) {
        setError(`Huh — ${name} doesn’t exist in this arcade`)
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not send request')
      }
    }
  }

  return (
    <span className="rank-page__add-friend">
      <button
        type="button"
        className="lb-share rank-page__add-friend-btn"
        disabled={status === 'busy' || status === 'sent'}
        onClick={() => void send()}
        aria-label={status === 'sent' ? `Friend request sent to ${name}` : `Add ${name} as a friend`}
        title={status === 'sent' ? 'Request sent' : 'Add friend'}
      >
        {status === 'sent' ? 'Sent' : status === 'busy' ? '…' : 'Add friend'}
      </button>
      {error ? <span className="rank-page__add-friend-error">{error}</span> : null}
    </span>
  )
}

type PeriodRanks = Partial<Record<LeaderboardPeriod, GlobalRankResult>>

const empty: GlobalRankResult = {
  rank: null,
  score: 0,
  totalPlayers: 0,
  byGame: {},
  nearby: [],
}

export function RankPage({
  player,
  period: periodFromRoute,
}: {
  player?: string
  period?: LeaderboardPeriod
}) {
  const globalPeriod = useDefaultPeriod()
  const period = periodFromRoute ?? globalPeriod
  const device = useDeviceType()
  const { signedIn } = useAuth()
  const myName = normalizePlayerName(usePlayerName())
  const viewedName = normalizePlayerName(player ?? '') || myName
  const isSelf = !normalizePlayerName(player ?? '') || viewedName === myName
  const myRank = useGlobalRank()
  const myRankLoading = useGlobalRankLoading()
  const [ranks, setRanks] = useState<PeriodRanks>({})
  const groupId = useActiveGroup()

  // Every period is on screen at once, so fetch the lot rather than the one
  // the route happens to select.
  useEffect(() => {
    setRanks({})
    if (!viewedName) return
    let cancelled = false
    void Promise.all(
      VISIBLE_LEADERBOARD_PERIODS.map((p) =>
        fetchGlobalRank(viewedName, p)
          .then((data) => [p, data] as const)
          .catch(() => [p, empty] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setRanks(Object.fromEntries(pairs) as PeriodRanks)
    })
    return () => {
      cancelled = true
    }
  }, [viewedName, groupId])

  // The cached self-rank paints the common case immediately; the fetch above
  // then fills in the other two tiles.
  const cachedSelf = isSelf && period === globalPeriod && !myRankLoading ? myRank : null
  const data = ranks[period] ?? cachedSelf ?? empty
  const { rank, score, byGame, nearby = [] } = data
  const rankLoading = !ranks[period] && !cachedSelf
  const ranksLoading = VISIBLE_LEADERBOARD_PERIODS.some((p) => !ranks[p])

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
            {isSelf ? 'Your profile' : `${viewedName}'s Profile`}
          </h1>
          {viewedName ? (
            <div className="lb-game-board__trailing">
              {!isSelf && signedIn ? <AddFriendButton name={viewedName} /> : null}
              <ShareBoardButton
                label={
                  rank != null
                    ? `${viewedName} is #${rank} on ${APP_NAME}. Respect… or revenge?`
                    : `Stalk—er, scout—${viewedName} on ${APP_NAME}.`
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

      {viewedName ? (
        <section
          className="rank-page__ranks"
          aria-label={isSelf ? 'Your ranks' : `${viewedName}'s ranks`}
        >
          <div className="rank-page__tiles" role="tablist" aria-label="Period">
            {VISIBLE_LEADERBOARD_PERIODS.map((p) => {
              const row = ranks[p] ?? (p === period ? cachedSelf : null)
              const active = p === period
              const href = rankHref(isSelf ? undefined : viewedName, p)
              return (
                <a
                  key={p}
                  className={`rank-tile${active ? ' rank-tile--active' : ''}`}
                  href={href}
                  role="tab"
                  aria-selected={active}
                  onClick={(e) => {
                    e.preventDefault()
                    window.location.hash = href
                  }}
                >
                  <span className="rank-tile__label">{PERIOD_LABELS[p]}</span>
                  {row ? (
                    <>
                      <strong
                        className={`rank-tile__value${row.rank == null ? ' rank-tile__value--none' : ''}`}
                      >
                        {row.rank != null ? `#${row.rank}` : '—'}
                      </strong>
                      <span className="rank-tile__points">
                        {row.rank != null
                          ? `${row.score} pt${row.score === 1 ? '' : 's'}`
                          : 'Unranked'}
                      </span>
                    </>
                  ) : (
                    <span className="rank-tile__wait" aria-hidden="true" />
                  )}
                </a>
              )
            })}
          </div>

          {!ranksLoading && gap ? (
            <p className="rank-page__gap">
              {gap.before}
              {gap.name ? (
                <a className="lb-scorecard__gap-link" href={rankHref(gap.name, period)}>
                  {gap.name}
                </a>
              ) : null}
            </p>
          ) : null}
        </section>
      ) : null}

      {viewedName ? <TrophyCase name={viewedName} /> : null}

      {viewedName ? (
        <section
          className="rank-page__standings"
          aria-label={isSelf ? 'Your standings' : `${viewedName}'s standings`}
        >
          <section className="rank-page__rank" aria-labelledby="rank-games-heading">
            {rankLoading ? (
              <BoardSkeleton rows={5} />
            ) : (
              <section className="rank-page__board" aria-labelledby="rank-games-heading">
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
                    const accent = resolveGameAccent(slug, game?.accent ?? '#4285f4')
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
                <p className="rank-page__total-points">
                  <span>Total points</span>
                  <strong>{score > 0 ? score : '–'}</strong>
                </p>
              </section>
            )}
          </section>
        </section>
      ) : null}

      {isSelf && viewedName ? (
        <details className="rank-page__how game-lobby__how-panel">
          <summary className="rank-page__how-summary">
            <span className="rank-page__h" id="rank-how-heading">
              How it works
            </span>
          </summary>
          <div className="rank-page__how-body">
            <p className="how-to-play__copy">
              Your global rank uses <strong>{PERIOD_LABELS[period].toLowerCase()}</strong>{' '}
              placements on each game’s leaderboard. Place higher on a board to earn more
              points:
            </p>
            <ul className="game-lobby__scoring">
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
            <p className="how-to-play__copy">
              Points from every game are added together. Climb any board to
              move up — playing more games helps too.
            </p>
          </div>
        </details>
      ) : null}
    </PageShell>
  )
}
