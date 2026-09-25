import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react'
import { FriendsCard } from '../components/FriendsPanel'
import { PageBanner } from '../components/PageBanner'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { PlayerCard } from '../components/PlayerCard'
import { ProfileViews } from '../components/ProfileViews'
import { ProfileBestBoard } from '../components/ProfileBestBoard'
import { ProfileGames } from '../components/ProfileGames'
import { ProfileRival } from '../components/ProfileRival'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { TrophyShelf } from '../components/TrophyShelf'
import { focusFromUrl, rankHref, standingsHref, statsHref } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { useImpersonation } from '../hooks/useImpersonation'
import { refreshFriends } from '../hooks/useFriends'
import { useMyStats } from '../hooks/useMyStats'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  EMPTY_RANK,
  useGameBests,
  usePeriodRanks,
  useRankFor,
  useScoresAt,
} from '../hooks/useProfileBoards'
import { AVATARS_ENABLED, AVATAR_EVENT, avatarWashColor, getLocalAvatarId, resolveAvatar } from '../lib/avatars'
import { AvatarStudio } from '../components/AvatarStudio'
import { FlameIcon, StatsIcon } from '../components/chromeIcons'
import { APP_NAME } from '../lib/brand'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { sendFriendRequest } from '../lib/friends'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { cachedMyGroups, useActiveGroup } from '../lib/groups'
import {
  ApiError,
  VISIBLE_LEADERBOARD_GAMES,
  normalizePlayerName,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { nextLine, periodWord, pointsWord, shareLines, talksInPlaces, toPass } from '../lib/profileMath'
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
      void refreshFriends(true)
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
        className="home-banner__cta"
        disabled={status === 'busy' || status === 'sent'}
        onClick={() => void send()}
        aria-label={status === 'sent' ? `Friend request sent to ${name}` : `Add ${name} as a friend`}
      >
        {status === 'sent' ? 'Request sent' : status === 'busy' ? '…' : 'Add friend'}
      </button>
      {error ? <span className="pfh__friend-error">{error}</span> : null}
    </span>
  )
}

/** Down to a part of the page, gliding unless motion is turned down, without touching the address. */
function jumpTo(id: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: still ? 'instant' : 'smooth', block: 'start' })
  }
}

/**
 * A player's page: their card, their best board, their games, their trophies
 * and whoever they're up against. Your own, or anyone's by name. Every part
 * reads from the period picked on the card, and each works however high or
 * low the player stands and however many are playing: the top ten are told in
 * places, everyone else in points to the next share of the arcade.
 */
export function RankPage({
  player,
  period: periodFromRoute,
}: {
  player?: string
  period?: LeaderboardPeriod
}) {
  const globalPeriod = useDefaultPeriod()
  const period = periodFromRoute ?? globalPeriod
  const { signedIn } = useAuth()
  const impersonation = useImpersonation()
  // Editing the avatar needs a session, or the dev impersonation which carries a claim token.
  const canEditAvatar = signedIn || Boolean(impersonation)
  const myName = normalizePlayerName(usePlayerName())
  const viewedName = normalizePlayerName(player ?? '') || myName
  const isSelf = !normalizePlayerName(player ?? '') || viewedName === myName
  const myRank = useGlobalRank()
  const myRankLoading = useGlobalRankLoading()
  const [trophies, setTrophies] = useState<TrophyAward[] | null>(null)
  const [studioOpen, setStudioOpen] = useState(false)
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null)

  /*
   * Arriving from the drawer's Friends row or a trophy in the inbox, which ask
   * for a section rather than the top of a long page. It waits for the section
   * to exist — the profile fills in over a few requests.
   */
  const focus = focusFromUrl()
  useEffect(() => {
    if (focus !== 'friends' && focus !== 'trophies') return
    let tries = 0
    const id = window.setInterval(() => {
      const card = document.getElementById(focus)
      if (card) {
        window.clearInterval(id)
        card.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (++tries > 40) {
        window.clearInterval(id)
      }
    }, 80)
    return () => window.clearInterval(id)
  }, [focus, viewedName])

  // A freshly saved avatar paints at once; the API's copy catches up on the next load.
  useEffect(() => {
    setAvatarOverride(viewedName ? getLocalAvatarId(viewedName) : null)
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; avatarId?: string }>).detail
      if (detail?.name === viewedName && detail.avatarId) setAvatarOverride(detail.avatarId)
    }
    window.addEventListener(AVATAR_EVENT, onChange)
    return () => window.removeEventListener(AVATAR_EVENT, onChange)
  }, [viewedName])
  const groupId = useActiveGroup()

  const ranks = usePeriodRanks(viewedName, groupId)

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

  // The cached self-rank paints the common case immediately; the fetches then fill in the rest.
  const cachedSelf = isSelf && period === globalPeriod && !myRankLoading ? myRank : null
  const data = ranks[period] ?? cachedSelf ?? EMPTY_RANK
  const loading = !ranks[period] && !cachedSelf
  const rank = data.rank
  const field = data.totalPlayers

  // Below the top ten the card talks in points to the next share line, so it needs the points sitting on each.
  const inShares = !loading && rank != null && !talksInPlaces(rank, field)
  const linePlaces = inShares ? [1, ...shareLines(field).filter((l) => l.rank < rank!).map((l) => l.rank)] : []
  const lineScores = useScoresAt(period, linePlaces, groupId)

  // Every game ever placed on comes from the all-time rank; the best run on each, from its board.
  const allTime = ranks.all ?? null
  const everPlayed = allTime ? new Set(Object.keys(allTime.byGame)) : null
  const bestSlugs = allTime
    ? Object.keys(allTime.byGame).filter((slug) => (VISIBLE_LEADERBOARD_GAMES as readonly string[]).includes(slug))
    : []
  const loadedBests = useGameBests(viewedName, bestSlugs, groupId)
  const bests = allTime ? loadedBests : null

  // Someone else's page measures the viewer against them.
  const viewerData = useRankFor(!isSelf ? myName : '', period, groupId)

  // Your own card leads to your stats with your streak, when you have one.
  const mine = useMyStats(period, isSelf && signedIn)
  const streak = mine.data?.stats?.streak.current ?? 0
  const statsLink =
    isSelf && signedIn ? (
      <a className="pcard__fact pcard__stats" href={statsHref()}>
        {streak > 0 ? <FlameIcon /> : <StatsIcon />}
        {streak > 0 ? `${streak}-day streak` : 'Your stats'}
        <span aria-hidden="true">›</span>
      </a>
    ) : null

  const groupName = groupId ? cachedMyGroups().find((g) => g.id === groupId)?.name : undefined
  const where = groupName ? `in ${groupName}` : 'in the arcade'

  const shareUrl = rankHref(viewedName || undefined, period)
  const shareLabel =
    rank != null
      ? `${viewedName} is #${rank} on ${APP_NAME}. Respect… or revenge?`
      : `Stalk—er, scout—${viewedName} on ${APP_NAME}.`

  // The character's colour washes the card, the way a game's page takes the game's.
  const avatarId = avatarOverride ?? data.avatarId
  const accent = AVATARS_ENABLED && viewedName ? avatarWashColor(resolveAvatar(avatarId, viewedName)) : undefined
  const editable = isSelf && canEditAvatar && AVATARS_ENABLED

  const unplayed = everPlayed ? VISIBLE_LEADERBOARD_GAMES.some((slug) => !everPlayed.has(slug) && !data.byGame[slug]) : false
  let primary: { label: string; target: string } | null = null
  if (isSelf && !loading) {
    if (rank == null) {
      primary = { label: 'Pick a game', target: unplayed ? 'quick' : 'games' }
    } else if (inShares) {
      const line = nextLine(rank, field)
      const lineScore = line ? lineScores.scores[line.rank] : undefined
      primary = {
        label: lineScore != null ? `Find ${pointsWord(toPass(lineScore, data.score))}` : 'Find more points',
        target: unplayed ? 'quick' : 'rival',
      }
    } else if (rank === 1) {
      primary = { label: 'Stay on top', target: 'rival' }
    } else {
      primary = { label: 'Close the gap', target: 'rival' }
    }
  }

  const actions = isSelf ? (
    <>
      {primary ? (
        <a className="home-banner__cta" href={`#${primary.target}`} onClick={jumpTo(primary.target)}>
          {primary.label}
          <svg className="pcard__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </a>
      ) : null}
      <ShareBoardButton className="home-banner__ghost" text="Share profile" label={shareLabel} url={shareUrl} />
    </>
  ) : (
    <>
      {signedIn && myName ? <AddFriendButton name={viewedName} /> : null}
      <ShareBoardButton className="home-banner__ghost" text="Share" label={shareLabel} url={shareUrl} />
    </>
  )

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <div className="ev pf" style={accent ? ({ '--pf-accent': accent } as CSSProperties) : undefined}>
        {studioOpen && viewedName ? (
          <AvatarStudio
            name={viewedName}
            current={avatarOverride ?? data.avatarId}
            onSaved={(id) => {
              setAvatarOverride(id)
              setStudioOpen(false)
            }}
            onClose={() => setStudioOpen(false)}
          />
        ) : null}
        {viewedName ? (
          <>
            {isSelf ? <ProfileViews on="card" /> : null}
            <PlayerCard
              name={viewedName}
              isSelf={isSelf}
              period={period}
              ranks={ranks}
              data={data}
              loading={loading}
              where={where}
              accent={accent}
              art={
                AVATARS_ENABLED ? (
                  <PlayerAvatar avatarId={avatarId} name={viewedName} size="xl" />
                ) : (
                  <span className="home-banner__glyph">{viewedName.charAt(0).toUpperCase()}</span>
                )
              }
              onArtClick={editable ? () => setStudioOpen(true) : undefined}
              scores={lineScores}
              trophies={trophies}
              actions={actions}
              backHref={isSelf ? undefined : standingsHref(period)}
              howHref={rankHref(isSelf ? undefined : viewedName, period)}
              extra={statsLink}
            />

            <ProfileBestBoard name={viewedName} isSelf={isSelf} viewer={isSelf ? '' : myName} bests={bests} groupId={groupId} />

            {!loading ? (
              <ProfileGames
                name={viewedName}
                isSelf={isSelf}
                period={period}
                byGame={data.byGame}
                everPlayed={everPlayed}
                bests={bests}
                quickest={isSelf && (rank == null || !talksInPlaces(rank, field))}
                progressHref={isSelf && signedIn ? `${statsHref()}#stats-games` : undefined}
              />
            ) : null}

            <div className="pf-pair">
              <TrophyShelf trophies={trophies} isSelf={isSelf} name={viewedName} />
              {!loading ? (
                <ProfileRival
                  name={viewedName}
                  isSelf={isSelf}
                  period={period}
                  data={data}
                  viewer={isSelf ? '' : myName}
                  viewerData={viewerData}
                />
              ) : null}
            </div>

            {isSelf && signedIn ? <FriendsCard /> : null}

            <details className="rank-page__how game-lobby__how-panel" id="rank-how">
              <summary className="rank-page__how-summary">
                <span className="rank-page__h" id="rank-how-heading">
                  How ranks work
                </span>
              </summary>
              <div className="rank-page__how-body">
                <p className="how-to-play__copy">
                  A rank adds up a player’s places on every game they{' '}
                  {period === 'all' ? 'ever played' : `played ${periodWord(period)}`}. Each game pays by the share of
                  its players they beat:
                </p>
                <ul className="game-lobby__scoring">
                  <li>
                    <span>1st of the field</span>
                    <strong>~100 pts</strong>
                  </li>
                  <li>
                    <span>Middle of the pack</span>
                    <strong>~50 pts</strong>
                  </li>
                  <li>
                    <span>Last of the field</span>
                    <strong>~1 pt</strong>
                  </li>
                </ul>
                <p className="how-to-play__copy">
                  So points mean the same however many are playing, and every game played adds some. Climb any board
                  to move up; a game not played yet is the quickest way. Every score is kept, so the boards run all
                  the way down.
                </p>
              </div>
            </details>
          </>
        ) : (
          <PageBanner
            ariaLabel="Your profile"
            kicker={<span className="ev-kicker__bit">Your profile</span>}
            title="No gamer tag yet"
            blurb="Set a gamer tag in the header to earn a global rank and start collecting trophies."
            art={<span className="home-banner__glyph home-banner__glyph--faint">?</span>}
          />
        )}
      </div>
    </PageShell>
  )
}
