import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { BracketWinCelebration } from '../components/BracketWinCelebration'
import { EventBracket } from '../components/EventBracket'
import { EventCard, EventStatusChips, EventSummary, eventAccent } from '../components/EventCard'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { PodiumMedal, medalKind } from '../components/PodiumMedal'
import { InviteByTagForm } from '../components/InviteByTagForm'
import { PendingInvitesStrip } from '../components/PendingInvitesStrip'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { tournamentCreateHref, tournamentHref, tournamentPlayHref, rankHref, useHashRoute } from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import {
  attemptsPerGameMax,
  eventKind,
  finalBracketMatch,
  formatEventCountdown,
  getTournament,
  getTournamentInvite,
  isPlayerInTournament,
  isRosterFull,
  joinTournament,
  listTournaments,
  matchOpponent,
  rememberTournamentInvite,
  seatsLeft,
  syncJoinedTournamentRosters,
  yourOpenMatch,
  type StandingRow,
  type TournamentDetail,
  type TournamentSummary,
} from '../lib/tournaments'

async function fetchTournamentDetail(
  id: string,
  opts: { playerName?: string; invite?: string } = {},
): Promise<TournamentDetail> {
  const base = await getTournament(id, {
    playerName: opts.playerName,
    invite: opts.invite,
  })
  const game = base.games[0]
  if (!opts.playerName || !game) return base
  return getTournament(id, {
    playerName: opts.playerName,
    game,
    invite: opts.invite,
  })
}

function placeLabel(place: number) {
  if (place === 1) return '1st'
  if (place === 2) return '2nd'
  if (place === 3) return '3rd'
  return `${place}th`
}

function GameResultCell({
  cell,
  usePoints,
}: {
  cell: { score: number | null; place: number | null; points: number } | undefined
  usePoints: boolean
}) {
  if (cell?.score == null) {
    return <span className="ev-row__game-result ev-row__game-score">—</span>
  }
  return (
    <span className="ev-row__game-result">
      {usePoints && cell.place != null ? (
        <span className="ev-row__game-place">
          {placeLabel(cell.place)} · +{cell.points}
        </span>
      ) : null}
      <span className="ev-row__game-score">{cell.score.toLocaleString()}</span>
    </span>
  )
}

function scoredStandings(
  detail: TournamentDetail,
): { row: StandingRow; score: number }[] {
  const gameSlug = detail.games[0]
  if (!gameSlug) return []
  return detail.standings
    .map((row) => ({
      row,
      score: row.byGame[gameSlug]?.score ?? null,
    }))
    .filter((entry): entry is { row: StandingRow; score: number } => entry.score != null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        normalizePlayerName(a.row.name).localeCompare(normalizePlayerName(b.row.name)),
    )
}

/** Rank of the current player in the same order the event standings show. */
function yourStandingPlace(detail: TournamentDetail, displayName: string): number | null {
  const youName = normalizePlayerName(displayName)
  if (!youName) return null

  if (detail.games.length === 1) {
    const idx = scoredStandings(detail).findIndex(
      ({ row }) => normalizePlayerName(row.name) === youName,
    )
    return idx >= 0 ? idx + 1 : null
  }

  const idx = detail.standings.findIndex((row) => normalizePlayerName(row.name) === youName)
  return idx >= 0 ? idx + 1 : null
}

function EventBoard({
  detail,
  displayName,
  className,
}: {
  detail: TournamentDetail
  displayName: string
  className?: string
}) {
  if (eventKind(detail) === 'bracket') {
    return (
      <>
        <EventBracket detail={detail} displayName={displayName} className={className} />
        <BracketWinCelebration detail={detail} displayName={displayName} />
      </>
    )
  }
  return (
    <EventStandings detail={detail} displayName={displayName} className={className} />
  )
}

function EventStandings({
  detail,
  displayName,
  className,
}: {
  detail: TournamentDetail
  displayName: string
  className?: string
}) {
  const single = detail.games.length === 1
  const title = single ? 'Top scores' : 'Standings'
  const rows = single ? scoredStandings(detail).length : detail.standings.length
  return (
    <section className={`ev-card${className ? ` ${className}` : ''}`} aria-label={title}>
      <div className="ev-card__head">
        <h2 className="ev-card__title">{title}</h2>
        {rows > 0 ? (
          <p className="ev-card__note">
            {rows} {rows === 1 ? 'player' : 'players'}
          </p>
        ) : null}
      </div>
      {rows === 0 ? (
        <p className="ev-empty">
          {detail.status === 'ended'
            ? 'No scores were posted.'
            : single
              ? 'No scores yet — be the first on the board.'
              : 'No players yet.'}
        </p>
      ) : (
        <StandingsList detail={detail} displayName={displayName} />
      )}
    </section>
  )
}

function bracketPlayLabel(detail: TournamentDetail, joined: boolean, displayName: string) {
  if (!detail.bracket?.lockedAt) {
    // The summary card already counts the empty seats — don't repeat it here.
    return 'Locked until the bracket draws'
  }
  if (!joined) return 'Join to play'
  const match = yourOpenMatch(detail, displayName)
  if (match) {
    const opp = matchOpponent(match, displayName)
    const max = attemptsPerGameMax(detail) ?? 1
    const you = normalizePlayerName(displayName)
    const me = match.players.find((p) => p && normalizePlayerName(p.name) === you)
    const used = me?.attemptsUsed ?? 0
    const remaining = Math.max(0, max - used)
    const roundLeft =
      match.playEndsAt != null && match.playEndsAt > Date.now()
        ? formatEventCountdown(match.playEndsAt)
        : null
    if (!opp) return 'Waiting on your match'
    if (remaining === 0) {
      return roundLeft ? `Waiting on ${opp.name} · ${roundLeft}` : `Waiting on ${opp.name}`
    }
    const tries =
      remaining === 1 ? `vs ${opp.name} · 1 try` : `vs ${opp.name} · ${remaining} left`
    return roundLeft ? `${tries} · ${roundLeft}` : tries
  }
  const you = normalizePlayerName(displayName)
  const final = finalBracketMatch(detail.bracket.matches)
  if (final?.winnerId && final.players.some((p) => p && normalizePlayerName(p.name) === you && p.id === final.winnerId)) {
    return 'Champion'
  }
  if (
    detail.bracket.matches.some(
      (m) =>
        m.winnerId &&
        m.players.some((p) => p && normalizePlayerName(p.name) === you && p.id !== m.winnerId),
    )
  ) {
    return 'Eliminated'
  }
  return 'Waiting on your match'
}

function playAttemptsLabel(
  detail: TournamentDetail,
  slug: string,
  joined: boolean,
  displayName: string,
): string {
  if (eventKind(detail) === 'bracket') {
    return bracketPlayLabel(detail, joined, displayName)
  }
  const max = attemptsPerGameMax(detail)
  if (max == null) return 'Unlimited tries'
  if (!joined) return max === 1 ? '1 try' : `${max} tries`
  const youName = normalizePlayerName(displayName)
  const you = youName
    ? detail.standings.find((row) => normalizePlayerName(row.name) === youName)
    : undefined
  const used = you?.byGame[slug]?.attemptsUsed ?? 0
  const left = Math.max(0, max - used)
  if (left === 0) return 'No tries left'
  return `${left} of ${max} left`
}

function bracketMatchLine(detail: TournamentDetail, displayName: string): string | null {
  if (eventKind(detail) !== 'bracket') return null
  const left = seatsLeft(detail)
  if (!detail.bracket?.lockedAt) {
    return left != null && left > 0 ? `Waiting for ${left} more` : 'Drawing'
  }
  const match = yourOpenMatch(detail, displayName)
  if (match) {
    const opp = matchOpponent(match, displayName)
    return opp ? `You vs ${opp.name}` : 'Waiting on your match'
  }
  return bracketPlayLabel(detail, true, displayName)
}

/** One play row per game — same shape whether the event has one game or five. */
function EventPlayList({
  detail,
  joined,
  playInvite,
  displayName,
}: {
  detail: TournamentDetail
  joined: boolean
  playInvite?: string
  displayName: string
}) {
  const solo = detail.games.length === 1
  const bracket = eventKind(detail) === 'bracket'
  const ended = detail.status === 'ended'

  return (
    <section className="ev-card" aria-label="Play">
      <div className="ev-card__head">
        <h2 className="ev-card__title">{solo ? 'Play' : `Play · ${detail.games.length} games`}</h2>
      </div>
      <ul className={`ev-play${solo ? ' ev-play--solo' : ''}`}>
        {detail.games.map((slug) => {
          const g = getGame(slug)
          const name = g?.name ?? slug
          const gameAccent = resolveGameAccent(slug, g?.accent ?? eventAccent(detail.games))
          const attemptLabel = playAttemptsLabel(detail, slug, joined, displayName)
          const status = solo ? detail.playerStatus : null
          const locked =
            ended ||
            (bracket
              ? !(status?.canPlay || /^vs /i.test(attemptLabel))
              : Boolean(status && !status.canPlay && joined) ||
                (joined && attemptLabel === 'No tries left'))
          const style = { '--row-accent': gameAccent } as CSSProperties

          const inner = (
            <>
              <span className="ev-play__art">
                <GameThumbArt slug={slug} accent={gameAccent} />
              </span>
              <span className="ev-play__text">
                <span className="ev-play__name">{name}</span>
                <span className="ev-play__status">
                  {ended ? 'Event ended' : attemptLabel}
                </span>
              </span>
              {!locked ? <span className="ev-play__go">Play</span> : null}
            </>
          )

          return (
            <li key={slug} className="ev-play__row">
              {locked ? (
                <div
                  className="ev-play__link ev-play__link--locked"
                  style={style}
                  aria-label={`${name}, ${ended ? 'event ended' : attemptLabel}`}
                >
                  {inner}
                </div>
              ) : (
                <a
                  className="ev-play__link"
                  href={tournamentPlayHref(detail.id, slug, playInvite)}
                  style={style}
                  aria-label={`Play ${name}, ${attemptLabel}`}
                >
                  {inner}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** One standings row. Single- and multi-game events share this so the two
 *  boards look identical; multi-game rows add a per-game breakdown. */
function StandingRow({
  rank,
  name,
  avatarId,
  score,
  unit,
  mine,
  breakdown,
}: {
  rank: number
  name: string
  avatarId?: string
  score: string
  unit?: string
  mine: boolean
  breakdown?: ReactNode
}) {
  const medal = medalKind(rank)
  const rowClass = `ev-row${rank <= 3 ? ` ev-row--${rank}` : ''}${mine ? ' ev-row--you' : ''}`

  const cells = (
    <>
      <span className="ev-row__rank" aria-label={`Place ${rank}`}>
        {medal ? <PodiumMedal kind={medal} size="sm" /> : rank}
      </span>
      <a className="ev-row__who" href={rankHref(name)} title={name}>
        <PlayerAvatar avatarId={avatarId} name={name} size="sm" />
        <span className="ev-row__name">{name}</span>
        {mine ? <span className="ev-row__you-tag">You</span> : null}
      </a>
      <span className="ev-row__score">
        {score}
        {unit ? <span className="ev-row__score-unit">{unit}</span> : null}
      </span>
    </>
  )

  if (!breakdown) {
    return (
      <li className={rowClass} aria-current={mine ? 'true' : undefined}>
        <div className="ev-row__main">{cells}</div>
      </li>
    )
  }

  return (
    <li className={rowClass} aria-current={mine ? 'true' : undefined}>
      <details className="ev-row__details">
        <summary className="ev-row__main ev-row__main--expandable ev-row__toggle">
          {cells}
          <span className="ev-row__chev" aria-hidden="true" />
        </summary>
        {breakdown}
      </details>
    </li>
  )
}

function StandingsList({
  detail,
  displayName,
}: {
  detail: TournamentDetail
  displayName: string
}) {
  const usePoints = detail.format === 'place-points'
  const youName = normalizePlayerName(displayName)
  const single = detail.games.length === 1

  const singleRows = useMemo(
    () => (single ? scoredStandings(detail) : []),
    [detail, single],
  )

  if (single) {
    return (
      <ol className="ev-board">
        {singleRows.map(({ row, score }, index) => {
          const name = normalizePlayerName(row.name)
          return (
            <StandingRow
              key={row.playerId}
              rank={index + 1}
              name={name}
              avatarId={row.avatarId}
              score={score.toLocaleString()}
              mine={Boolean(youName) && name === youName}
            />
          )
        })}
      </ol>
    )
  }

  return (
    <ol className="ev-board">
      {detail.standings.map((row, index) => {
        const name = normalizePlayerName(row.name)
        const totalScore = detail.games.reduce(
          (sum, game) => sum + (row.byGame[game]?.score ?? 0),
          0,
        )
        return (
          <StandingRow
            key={row.playerId}
            rank={index + 1}
            name={name}
            avatarId={row.avatarId}
            score={usePoints ? String(row.totalPoints) : totalScore.toLocaleString()}
            unit={usePoints ? 'pts' : 'total'}
            mine={Boolean(youName) && name === youName}
            breakdown={
              <ul className="ev-row__games">
                {detail.games.map((game) => {
                  const label = getGame(game)?.name ?? game
                  const accent = resolveGameAccent(game, getGame(game)?.accent ?? '#2eb8a0')
                  return (
                    <li key={game} className="ev-row__game">
                      <GameThumbArt slug={game} accent={accent} />
                      <span className="ev-row__game-name">{label}</span>
                      <GameResultCell cell={row.byGame[game]} usePoints={usePoints} />
                    </li>
                  )
                })}
              </ul>
            }
          />
        )
      })}
    </ol>
  )
}

export function TournamentsPage() {
  const { account } = useAuth()
  const playerName = usePlayerName()
  const [items, setItems] = useState<TournamentSummary[]>([])
  const [filter, setFilter] = useState<'all' | 'official' | 'joined' | 'mine'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const name = normalizePlayerName(playerName || getLastPlayerName())
    listTournaments(filter, name || undefined)
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filter, playerName])

  const live = items.filter((t) => t.status !== 'ended')
  const ended = items.filter((t) => t.status === 'ended')

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <header className="lb-page__header lb-page__header--compact">
        <div className="lb-page__heading-row">
          <span className="lb-page__heading-slot" aria-hidden="true" />
          <h1 className="lb-page__title">Events</h1>
          <div className="lb-game-board__trailing">
            {account ? (
              <a className="event-list__create" href={tournamentCreateHref()}>
                Create event
              </a>
            ) : null}
          </div>
        </div>
        {(() => {
          // Same segmented control the boards use for periods.
          const keys = [
            'all',
            'official',
            'joined',
            ...(account ? (['mine'] as const) : []),
          ] as const
          const labels = {
            all: 'All',
            official: 'Official',
            joined: 'Joined',
            mine: 'Hosted',
          } as const
          return (
            <div
              className="lb-periods lb-periods--segment"
              role="tablist"
              aria-label="Event filters"
              style={{ '--period-count': keys.length } as CSSProperties}
            >
              {keys.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  className={`lb-period${filter === key ? ' lb-period--active' : ''}`}
                  onClick={() => setFilter(key)}
                >
                  {labels[key]}
                </button>
              ))}
            </div>
          )
        })()}
      </header>

      <PendingInvitesStrip kind="tournament" />

      {loading ? (
        <p className="lb-empty">Loading…</p>
      ) : error ? (
        <p className="lb-empty">Couldn’t load events.</p>
      ) : items.length === 0 ? (
        <p className="lb-empty">
          {filter === 'mine'
            ? 'You have no hosted events yet.'
            : filter === 'joined'
              ? 'You have not joined any private events yet.'
              : 'No events yet.'}
        </p>
      ) : (
        <div className="ev-list">
          {live.length > 0 ? (
            <section className="ev-list__group" aria-label="Open events">
              {ended.length > 0 ? (
                <h2 className="ev-list__group-title">Open now</h2>
              ) : null}
              <ul className="ev-list__grid">
                {live.map((t) => (
                  <li key={t.id}>
                    <EventCard
                      t={t}
                      href={
                        t.private
                          ? tournamentHref(t.id, getTournamentInvite(t.id) ?? undefined)
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {ended.length > 0 ? (
            <section className="ev-list__group" aria-label="Ended events">
              <h2 className="ev-list__group-title">Ended</h2>
              <ul className="ev-list__grid">
                {ended.map((t) => (
                  <li key={t.id}>
                    <EventCard
                      t={t}
                      href={
                        t.private
                          ? tournamentHref(t.id, getTournamentInvite(t.id) ?? undefined)
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </PageShell>
  )
}

export function TournamentDetailPage({ id, invite }: { id: string; invite?: string }) {
  const route = useHashRoute()
  const playerName = usePlayerName()
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsInvite, setNeedsInvite] = useState(false)
  const [inviteDraft, setInviteDraft] = useState(invite ?? '')
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joinNote, setJoinNote] = useState<string | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)

  const displayName = normalizePlayerName(playerName)
  const storedInvite = invite ?? getTournamentInvite(id) ?? undefined
  const playInvite = detail?.inviteCode ?? storedInvite
  const rosterCap = detail?.rules.maxPlayers ?? 0
  const eventFull =
    detail != null && rosterCap > 0 && detail.playerCount >= rosterCap && !joined
  const invitesOpen =
    detail != null &&
    detail.status !== 'ended' &&
    !isRosterFull(detail) &&
    Boolean(detail.inviteCode)

  const syncJoined = (data: TournamentDetail, who: string) => {
    setJoined(isPlayerInTournament(data, who, id))
  }

  const loadDetail = async (inviteCode?: string) => {
    await syncJoinedTournamentRosters()
    const name = getLastPlayerName()
    const data = await fetchTournamentDetail(id, {
      playerName: name || undefined,
      invite: inviteCode ?? storedInvite,
    })
    setDetail(data)
    syncJoined(data, name)
    setNeedsInvite(false)
    setError(null)
    if (data.inviteCode) rememberTournamentInvite(id, data.inviteCode)
  }

  useEffect(() => {
    if (route.name !== 'tournament') return
    if (route.id !== id) return
    if (invite) rememberTournamentInvite(id, invite)
    let cancelled = false
    setLoading(true)
    setError(null)
    setNeedsInvite(false)
    ;(async () => {
      try {
        await loadDetail(invite ?? storedInvite)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'INVITE_REQUIRED') {
          setNeedsInvite(true)
          setError(null)
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, invite, route])

  useEffect(() => {
    if (!detail) return
    const mine = normalizePlayerName(playerName)
    if (mine && isPlayerInTournament(detail, mine, id)) {
      if (!detail.players.some((p) => normalizePlayerName(p.name) === mine)) {
        void joinTournament(id, mine)
          .then(async () => {
            const data = await fetchTournamentDetail(id, {
              playerName: mine,
              invite: playInvite,
            })
            setDetail(data)
            setJoined(true)
          })
          .catch(() => setJoined(true))
        return
      }
      setJoined(true)
      return
    }
    syncJoined(detail, playerName)
  }, [playerName, detail, id])

  const onJoin = async () => {
    if (busy || !displayName) return
    setBusy(true)
    setJoinNote(null)
    try {
      await joinTournament(id, displayName)
      const data = await fetchTournamentDetail(id, {
        playerName: displayName,
        invite: playInvite,
      })
      setDetail(data)
      setJoined(true)
      setJoinNote(null)
    } catch (err) {
      setJoinNote(err instanceof Error ? err.message : 'Could not join')
    } finally {
      setBusy(false)
    }
  }

  const accent = detail ? eventAccent(detail.games) : '#2eb8a0'

  const inviteLink =
    detail?.inviteCode != null
      ? `${window.location.origin}${window.location.pathname}${tournamentHref(id, detail.inviteCode)}`
      : playInvite
        ? `${window.location.origin}${window.location.pathname}${tournamentHref(id, playInvite)}`
        : null

  const copyInviteLink = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopiedInvite(true)
      window.setTimeout(() => setCopiedInvite(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const submitInvite = async () => {
    const code = inviteDraft.trim().toUpperCase()
    if (!code) return
    rememberTournamentInvite(id, code)
    setBusy(true)
    setJoinNote(null)
    try {
      await loadDetail(code)
      window.history.replaceState(null, '', tournamentHref(id, code))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVITE_REQUIRED') {
        setJoinNote('That invite code is not valid.')
      } else {
        setJoinNote(err instanceof Error ? err.message : 'Could not open event')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      {loading ? (
        <p className="lb-empty">Loading…</p>
      ) : needsInvite ? (
        <>
          <header className="lb-page__header lb-page__header--compact lb-game-board__head">
            <div className="lb-page__heading-row">
              <PageBackLink href="#/tournaments" label="Back to Events" />
              <h1 className="lb-page__title">Private event</h1>
              <span className="lb-page__heading-slot" aria-hidden="true" />
            </div>
          </header>
          <div className="event-invite-gate">
            <p className="event-invite-gate__lead">
              This event is invite-only. Enter the code from your host to join.
            </p>
            <label className="event-create__field">
              <span className="event-create__label">Invite code</span>
              <input
                className="event-create__input"
                value={inviteDraft}
                maxLength={16}
                placeholder="ABCD1234"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setInviteDraft(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void submitInvite()
                  }
                }}
              />
            </label>
            {joinNote ? <p className="event-create__error">{joinNote}</p> : null}
            <button
              type="button"
              className="lb-play event-create__submit"
              disabled={busy || !inviteDraft.trim()}
              onClick={() => void submitInvite()}
            >
              {busy ? 'Checking…' : 'Open event'}
            </button>
          </div>
        </>
      ) : error || !detail ? (
        <>
          <header className="lb-page__header lb-page__header--compact lb-game-board__head">
            <div className="lb-page__heading-row">
              <PageBackLink href="#/tournaments" label="Back to Events" />
              <h1 className="lb-page__title">Event</h1>
              <span className="lb-page__heading-slot" aria-hidden="true" />
            </div>
          </header>
          <p className="lb-empty">{error ?? 'Event not found'}</p>
        </>
      ) : (
        <div
          className="ev"
          style={
            {
              '--event-accent': accent,
              '--board-accent': accent,
              '--tile-accent': accent,
              '--thumb-accent': accent,
            } as CSSProperties
          }
        >
          <header className="lb-page__header lb-page__header--compact lb-game-board__head">
            <div className="lb-page__heading-row">
              <PageBackLink href="#/tournaments" label="Back to Events" />
              <h1 className="lb-page__title">{detail.title}</h1>
              <div className="lb-game-board__trailing">
                <ShareBoardButton
                  label={`You're invited: ${detail.title} on ${APP_NAME}. Don't ghost the lobby.`}
                  url={
                    invitesOpen && inviteLink
                      ? inviteLink
                      : `${window.location.origin}${window.location.pathname}${tournamentHref(detail.id)}`
                  }
                />
                {detail.isHost && invitesOpen ? (
                  <button
                    type="button"
                    className="game-lobby__board-link"
                    onClick={() => void copyInviteLink()}
                  >
                    {copiedInvite ? 'Copied!' : 'Copy invite'}
                  </button>
                ) : null}
              </div>
            </div>
            <EventStatusChips t={detail} joined={joined} className="ev-chips" />
          </header>

          <EventSummary
            t={detail}
            joined={joined && detail.status !== 'ended'}
            yourPlace={
              eventKind(detail) === 'bracket' ? null : yourStandingPlace(detail, displayName)
            }
            matchLine={bracketMatchLine(detail, displayName)}
          />

          {detail.status !== 'ended' && !joined ? (
            <div className="ev-join">
              {eventFull ? (
                <p className="ev-note">This event is full.</p>
              ) : displayName ? (
                <button
                  type="button"
                  className="ev-join__btn"
                  disabled={busy}
                  onClick={() => void onJoin()}
                >
                  {busy ? 'Joining…' : `Join as ${displayName}`}
                </button>
              ) : (
                <p className="ev-note">Set your gamer tag in the header first.</p>
              )}
              {joinNote ? <p className="ev-note ev-note--error">{joinNote}</p> : null}
            </div>
          ) : joinNote ? (
            <p className="ev-note ev-note--error">{joinNote}</p>
          ) : null}

          {detail.isHost && invitesOpen ? (
            <section className="ev-card" aria-label="Invite by tag">
              <div className="ev-card__body">
                <InviteByTagForm kind="tournament" targetId={id} disabled={busy} />
              </div>
            </section>
          ) : null}

          <div className={`ev-grid${eventKind(detail) === 'bracket' ? '' : ' ev-grid--split'}`}>
            <EventPlayList
              detail={detail}
              joined={joined}
              playInvite={playInvite}
              displayName={displayName}
            />

            <EventBoard
              detail={detail}
              displayName={displayName}
              className={
                eventKind(detail) === 'bracket' ? 'ev-card ev-card--bracket' : undefined
              }
            />
          </div>
        </div>
      )}
    </PageShell>
  )
}
