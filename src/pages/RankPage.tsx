import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { BoardSkeleton } from '../components/BoardChrome'
import { GameDeviceBadge } from '../components/GameDeviceBadge'
import { GameThumbArt } from '../components/GameThumbArt'
import { BackChevronIcon } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { PodiumMedal, medalKind } from '../components/PodiumMedal'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { TrophyCase } from '../components/TrophyCase'
import { getGame, gamePlayableOn } from '../data/games'
import { gameBoardHref, gamePlayHref, globalRankingsHref, rankHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { AVATARS_ENABLED } from '../lib/avatars'
import { gapToNextLabel } from '../lib/boardGap'
import { APP_NAME } from '../lib/brand'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { sendFriendRequest } from '../lib/friends'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { useActiveGroup } from '../lib/groups'
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
import { resolveGameAccent } from '../lib/theme'
import { fetchTrophies, type TrophyAward } from '../lib/trophies'

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
    <span className="pfh__friend">
      <button
        type="button"
        className="pfh__tool"
        disabled={status === 'busy' || status === 'sent'}
        onClick={() => void send()}
        aria-label={status === 'sent' ? `Friend request sent to ${name}` : `Add ${name} as a friend`}
        title={status === 'sent' ? 'Request sent' : 'Add friend'}
      >
        {status === 'sent' ? 'Sent' : status === 'busy' ? '…' : 'Add friend'}
      </button>
      {error ? <span className="pfh__friend-error">{error}</span> : null}
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

/** "this week" / "this month" / "all time", for mid-sentence use. */
function periodPhrase(period: LeaderboardPeriod) {
  return PERIOD_LABELS[period].toLowerCase()
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
  const [trophies, setTrophies] = useState<TrophyAward[] | null>(null)
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

  // Trophies are fetched here rather than in the case, so the hero can count
  // them in its caption.
  useEffect(() => {
    if (!viewedName) {
      setTrophies([])
      return
    }
    setTrophies(null)
    let cancelled = false
    void fetchTrophies(viewedName)
      .then((rows) => {
        if (!cancelled) setTrophies(rows)
      })
      .catch(() => {
        if (!cancelled) setTrophies([])
      })
    return () => {
      cancelled = true
    }
  }, [viewedName])

  // The cached self-rank paints the common case immediately; the fetch above
  // then fills in the other tiles.
  const cachedSelf = isSelf && period === globalPeriod && !myRankLoading ? myRank : null
  const data = ranks[period] ?? cachedSelf ?? empty
  const { rank, score, byGame, nearby = [] } = data
  const rankLoading = !ranks[period] && !cachedSelf

  const rankedCount = VISIBLE_LEADERBOARD_GAMES.filter((slug) => Boolean(byGame[slug])).length
  const totalGames = VISIBLE_LEADERBOARD_GAMES.length

  const gap =
    rank != null && rank > 0
      ? gapToNextLabel({
          youRank: rank,
          youScore: score,
          entries: nearby,
          formatDelta: (n) => `${n} pt${n === 1 ? '' : 's'}`,
        })
      : null

  const hrefFor = (p: LeaderboardPeriod) => rankHref(isSelf ? undefined : viewedName, p)
  const shareUrl = rankHref(viewedName || undefined, period)
  const shareLabel =
    rank != null
      ? `${viewedName} is #${rank} on ${APP_NAME}. Respect… or revenge?`
      : `Stalk—er, scout—${viewedName} on ${APP_NAME}.`

  /* ---------- hero caption ---------- */

  let standing: ReactNode = null
  if (!rankLoading) {
    if (rank == null) {
      standing = `Not ranked ${periodPhrase(period)} yet`
    } else if (gap) {
      standing = (
        <>
          {gap.before}
          {gap.name ? (
            <a className="pfh__sub-link" href={rankHref(gap.name, period)}>
              {gap.name}
            </a>
          ) : null}
          {` ${periodPhrase(period)}`}
        </>
      )
    } else {
      standing = `#${rank} ${periodPhrase(period)}`
    }
  }
  const games =
    rankLoading || !viewedName
      ? null
      : rankedCount === 0
        ? `No games ranked ${periodPhrase(period)}`
        : `Ranked on ${rankedCount} of ${totalGames} games`

  const trophyCount = trophies?.length ?? 0

  /* ---------- by-game rows: ranked first, best place at the top ---------- */

  const gameRows = VISIBLE_LEADERBOARD_GAMES.map((slug) => ({
    slug,
    game: getGame(slug),
    row: byGame[slug] ?? null,
  })).sort((a, b) => {
    if (a.row && b.row) return a.row.place - b.row.place || b.row.points - a.row.points
    if (a.row) return -1
    if (b.row) return 1
    return 0
  })

  // Share (and Add friend) share a bar with the back link on someone else's
  // profile. Your own has no back link, so the bar would be a row of nothing
  // with one icon in it — the tools sit in the hero's top corner instead.
  const tools = viewedName ? (
    <div className={`pfh__tools${isSelf ? ' pfh__tools--inline' : ''}`}>
      {!isSelf && signedIn ? <AddFriendButton name={viewedName} /> : null}
      <ShareBoardButton label={shareLabel} url={shareUrl} />
    </div>
  ) : null

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev pf">
        <section
          className="pfh"
          aria-label={isSelf ? 'Your profile' : `${viewedName}'s profile`}
        >
          {!isSelf ? (
            <div className="pfh__bar">
              <a className="pfh__back" href={globalRankingsHref(period)}>
                <BackChevronIcon size={18} />
                Rankings
              </a>
              {tools}
            </div>
          ) : null}

          {viewedName ? (
            <div className="pfh__main">
              {isSelf ? tools : null}
              <span className="pfh__mark" aria-hidden="true">
                {AVATARS_ENABLED ? (
                  <PlayerAvatar avatarId={data.avatarId} name={viewedName} size="lg" />
                ) : (
                  viewedName.charAt(0)
                )}
              </span>

              <div className="pfh__text">
                <p className="ev-kicker pfh__kicker">
                  <span className="ev-kicker__bit">{isSelf ? 'Your profile' : 'Player'}</span>
                  {trophies && trophyCount > 0 ? (
                    <span className="ev-kicker__bit">
                      {trophyCount} {trophyCount === 1 ? 'trophy' : 'trophies'}
                    </span>
                  ) : null}
                  {!rankLoading && data.totalPlayers > 0 ? (
                    <span className="ev-kicker__bit">
                      {data.totalPlayers} {data.totalPlayers === 1 ? 'player' : 'players'} ranked
                    </span>
                  ) : null}
                </p>
                <h1 className="pfh__title">{viewedName}</h1>
                <p className="pfh__sub">
                  {standing}
                  {standing && games ? ' · ' : null}
                  {games}
                </p>
              </div>

              <div className="pfh__ranks" role="tablist" aria-label="Period">
                {VISIBLE_LEADERBOARD_PERIODS.map((p) => {
                  const row = ranks[p] ?? (p === period ? cachedSelf : null)
                  const active = p === period
                  const unranked = Boolean(row) && row!.rank == null
                  return (
                    <a
                      key={p}
                      role="tab"
                      aria-selected={active}
                      className={`pfh__rank${active ? ' pfh__rank--on' : ''}${
                        unranked ? ' pfh__rank--none' : ''
                      }`}
                      href={hrefFor(p)}
                      onClick={(e) => {
                        e.preventDefault()
                        window.location.hash = hrefFor(p)
                      }}
                    >
                      <span className="pfh__rank-label">{PERIOD_LABELS[p]}</span>
                      <span className="pfh__rank-value">
                        {row ? (row.rank != null ? `#${row.rank}` : '—') : '…'}
                      </span>
                      <span className="pfh__rank-sub">
                        {row
                          ? row.rank != null
                            ? `${row.score} pt${row.score === 1 ? '' : 's'}`
                            : 'Unranked'
                          : ' '}
                      </span>
                    </a>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="pfh__main pfh__main--bare">
              <span className="pfh__mark pfh__mark--empty" aria-hidden="true">
                ?
              </span>
              <div className="pfh__text">
                <p className="ev-kicker pfh__kicker">
                  <span className="ev-kicker__bit">Your profile</span>
                </p>
                <h1 className="pfh__title">No gamer tag yet</h1>
                <p className="pfh__sub">
                  Set a gamer tag in the header to earn a global rank and start collecting
                  trophies.
                </p>
              </div>
            </div>
          )}
        </section>

        {viewedName ? <TrophyCase trophies={trophies} isSelf={isSelf} /> : null}

        {viewedName ? (
          <section
            className="ev-card pfg"
            aria-label={isSelf ? 'Your standings by game' : `${viewedName}'s standings by game`}
          >
            <div className="ev-card__head">
              <h2 className="ev-card__title">By game</h2>
              <p className="ev-card__note">
                {PERIOD_LABELS[period]}
                {!rankLoading ? ` · ${rankedCount} of ${totalGames} ranked` : ''}
              </p>
            </div>

            {rankLoading ? (
              <div className="pfg__skel">
                <BoardSkeleton rows={6} />
              </div>
            ) : (
              <>
                <ol className="pfg__list">
                  {gameRows.map(({ slug, game, row }) => {
                    const onDevice = game ? gamePlayableOn(game, device) : true
                    const accent = resolveGameAccent(slug, game?.accent ?? '#4285f4')
                    const name = game?.name ?? slug
                    const medal = row ? medalKind(row.place) : null
                    const href = row ? gameBoardHref(slug, period) : gamePlayHref(slug)
                    const rowClass = [
                      'pfg__row',
                      row ? '' : 'pfg__row--empty',
                      row && row.place <= 3 ? `pfg__row--${row.place}` : '',
                      onDevice ? '' : 'pfg__row--dim',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <li key={slug} className={rowClass}>
                        <a
                          className="pfg__link"
                          href={href}
                          style={{ '--row-accent': accent } as CSSProperties}
                          aria-label={
                            row
                              ? `${name}: place ${row.place}, ${row.points} points. Open ${periodPhrase(period)} board.`
                              : `${name}: unranked. Play now.`
                          }
                        >
                          <span className="pfg__place">
                            {row ? (
                              medal ? (
                                <PodiumMedal kind={medal} period={period} size="sm" />
                              ) : (
                                `#${row.place}`
                              )
                            ) : (
                              '—'
                            )}
                          </span>
                          <span className="pfg__art">
                            <GameThumbArt slug={slug} accent={accent} />
                          </span>
                          <span className="pfg__text">
                            <span className="pfg__name">{name}</span>
                            {game ? <GameDeviceBadge game={game} /> : null}
                          </span>
                          {row ? (
                            <span className="pfg__pts">
                              {row.points}
                              <span className="pfg__pts-unit">pts</span>
                            </span>
                          ) : (
                            <span className="pfg__go">Play</span>
                          )}
                        </a>
                      </li>
                    )
                  })}
                </ol>
                <p className="pfg__total">
                  <span>Total · {periodPhrase(period)}</span>
                  <strong>{score > 0 ? `${score} pts` : '–'}</strong>
                </p>
              </>
            )}
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
                Your global rank uses <strong>{periodPhrase(period)}</strong> placements on
                each game’s leaderboard. Place higher on a board to earn more points:
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
                Points from every game are added together. Climb any board to move up —
                playing more games helps too.
              </p>
            </div>
          </details>
        ) : null}
      </div>
    </PageShell>
  )
}
