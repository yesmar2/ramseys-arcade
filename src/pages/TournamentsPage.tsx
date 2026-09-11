import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { EventBracket } from '../components/EventBracket'
import { EventCard, EventTicker, eventAccent } from '../components/EventCard'
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
  formatEventCountdown,
  getTournament,
  getTournamentInvite,
  isPlayerInTournament,
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
    return <span className="tour-game-result tour-game-result--empty">—</span>
  }
  if (!usePoints) {
    return (
      <span className="tour-game-result">
        <span className="tour-game-result__score">{cell.score.toLocaleString()}</span>
      </span>
    )
  }
  if (cell.place == null) {
    return <span className="tour-game-result tour-game-result--empty">—</span>
  }
  return (
    <span className="tour-game-result">
      <span className="tour-game-result__place">{placeLabel(cell.place)}</span>
      <span className="tour-game-result__meta">
        <span className="tour-game-result__pts">+{cell.points}</span>
        {cell.score != null && (
          <span className="tour-game-result__score">{cell.score.toLocaleString()}</span>
        )}
      </span>
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
      <EventBracket detail={detail} displayName={displayName} className={className} />
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
  const title = detail.games.length === 1 ? 'Top scores' : 'Standings'
  return (
    <section className={className} aria-label={title}>
      <h2 className="event-detail__section-title">{title}</h2>
      {detail.standings.length === 0 ? (
        <p className="lb-empty">No players yet.</p>
      ) : (
        <StandingsList detail={detail} displayName={displayName} />
      )}
    </section>
  )
}

function bracketPlayLabel(detail: TournamentDetail, joined: boolean, displayName: string) {
  const left = seatsLeft(detail)
  if (!detail.bracket) {
    if (left != null && left > 0) {
      return `Waiting for ${left} more`
    }
    return 'Drawing bracket'
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
  const final = detail.bracket.matches.reduce(
    (best, m) => (m.round > best.round ? m : best),
    detail.bracket.matches[0]!,
  )
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
  if (!detail.bracket) {
    return left != null && left > 0 ? `Waiting for ${left} more` : 'Drawing'
  }
  const match = yourOpenMatch(detail, displayName)
  if (match) {
    const opp = matchOpponent(match, displayName)
    return opp ? `You vs ${opp.name}` : 'Waiting on your match'
  }
  return bracketPlayLabel(detail, true, displayName)
}

function EventPlayCards({
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
  return (
    <section className="event-detail__play" aria-label="Play">
      <ul
        className={`event-play-grid event-play-grid--count-${Math.min(detail.games.length, 3)}`}
      >
        {detail.games.map((slug, index) => {
          const g = getGame(slug)
          const gameAccent = resolveGameAccent(
            slug,
            g?.accent ?? eventAccent(detail.games),
          )
          const status =
            detail.playerStatus && detail.games.length === 1 ? detail.playerStatus : null
          const attemptLabel = playAttemptsLabel(detail, slug, joined, displayName)
          const bracket = eventKind(detail) === 'bracket'
          const exhausted = bracket
            ? !(status?.canPlay || /^vs /i.test(attemptLabel))
            : Boolean(status && !status.canPlay && joined) ||
              (joined && attemptLabel === 'No tries left')
          const name = g?.name ?? slug
          const style = {
            '--tile-accent': gameAccent,
            '--thumb-accent': gameAccent,
            '--event-accent': gameAccent,
            animationDelay: `${0.05 + index * 0.05}s`,
          } as CSSProperties

          const inner = (
            <>
              <GameThumbArt slug={slug} accent={gameAccent} />
              <span className="game-tile__title">{name}</span>
              <span className="game-tile__status">{attemptLabel}</span>
            </>
          )

          if (exhausted) {
            return (
              <li key={slug}>
                <div
                  className="game-tile game-tile--thumb event-play-card event-play-card--disabled"
                  style={style}
                  aria-label={`${name}, ${attemptLabel}`}
                >
                  {inner}
                </div>
              </li>
            )
          }

          return (
            <li key={slug}>
              <a
                className="game-tile game-tile--thumb event-play-card"
                href={tournamentPlayHref(detail.id, slug, playInvite)}
                style={style}
                aria-label={`Play ${name}, ${attemptLabel}`}
              >
                {inner}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
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
  if (detail.games.length === 1) {
    return <SingleGameStandings detail={detail} displayName={displayName} />
  }

  return (
    <ul
      className="tour-standings"
      style={{ '--lb-you-accent': eventAccent(detail.games) } as CSSProperties}
    >
      {detail.standings.map((row, index) => (
        <StandingCard
          key={row.playerId}
          row={row}
          rank={index + 1}
          games={detail.games}
          mine={normalizePlayerName(row.name) === displayName}
          usePoints={usePoints}
        />
      ))}
    </ul>
  )
}

function SingleGameStandings({
  detail,
  displayName,
}: {
  detail: TournamentDetail
  displayName: string
}) {
  const gameSlug = detail.games[0]!
  const game = getGame(gameSlug)
  const accent = resolveGameAccent(gameSlug, game?.accent ?? '#2eb8a0')
  const youName = normalizePlayerName(displayName)

  const rows = useMemo(() => scoredStandings(detail), [detail])

  if (rows.length === 0) {
    return <p className="lb-empty">No scores yet. Join and play to post one.</p>
  }

  return (
    <ol
      className="lb-list tour-score-list"
      style={{ '--board-accent': accent, '--lb-you-accent': accent } as CSSProperties}
    >
      {rows.map(({ row, score }, index) => {
        const rank = index + 1
        const medal = medalKind(rank)
        const name = normalizePlayerName(row.name)
        const isYou = Boolean(youName) && name === youName
        return (
          <li
            key={row.playerId}
            className={`lb-row lb-row--score-only${isYou ? ' lb-row--you' : ''}${medal ? ' lb-row--medal' : ''}`}
            aria-current={isYou ? 'true' : undefined}
          >
            <span className="lb-row__rank" aria-label={`#${rank}`}>
              {medal ? (
                <PodiumMedal kind={medal} />
              ) : (
                <span className="lb-row__rank-num">#{rank}</span>
              )}
            </span>
            <a className="lb-row__name lb-row__name--link" href={rankHref(name)}>
              <PlayerAvatar avatarId={row.avatarId} name={name} size="sm" />
              <span className="lb-row__name-text" title={name}>
                {name}
              </span>
              {isYou ? <span className="lb-row__you-tag">You</span> : null}
            </a>
            <span className="lb-row__score">{score.toLocaleString()}</span>
          </li>
        )
      })}
    </ol>
  )
}

function StandingCard({
  row,
  rank,
  games,
  mine,
  usePoints,
}: {
  row: StandingRow
  rank: number
  games: string[]
  mine: boolean
  usePoints: boolean
}) {
  const name = normalizePlayerName(row.name)
  const totalScore = games.reduce((sum, game) => sum + (row.byGame[game]?.score ?? 0), 0)
  return (
    <li className={`tour-standing${mine ? ' tour-standing--you' : ''}`}>
      <details className="tour-standing__details">
        <summary className="tour-standing__summary">
          <span className="tour-standing__rank">{rank}</span>
          <div className="tour-standing__who">
            <PlayerAvatar avatarId={row.avatarId} name={name} size="sm" />
            <a className="tour-standing__name tour-standing__name--link" href={rankHref(name)} title={name}>
              {name}
            </a>
            {mine ? <span className="tour-you-tag">You</span> : null}
          </div>
          <span className="tour-standing__total">
            {usePoints ? row.totalPoints : totalScore.toLocaleString()}
            <span className="tour-standing__total-label">{usePoints ? 'pts' : 'total'}</span>
          </span>
        </summary>
        <ul className="tour-standing__games">
          {games.map((game) => {
            const cell = row.byGame[game]
            const label = getGame(game)?.name ?? game
            const accent = resolveGameAccent(game, getGame(game)?.accent ?? '#2eb8a0')
            return (
              <li key={game} className="tour-standing__game">
                <span className="tour-standing__game-label">
                  <GameThumbArt slug={game} accent={accent} />
                  <span className="tour-standing__game-name">{label}</span>
                </span>
                <GameResultCell cell={cell} usePoints={usePoints} />
              </li>
            )
          })}
        </ul>
      </details>
    </li>
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
    listTournaments(filter, filter === 'joined' ? name || undefined : undefined)
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
        <div className="event-list__filters" role="tablist" aria-label="Event filters">
          {(['all', 'official', 'joined', ...(account ? (['mine'] as const) : [])] as const).map(
            (key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`event-list__filter${filter === key ? ' event-list__filter--active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {key === 'all'
                ? 'All'
                : key === 'official'
                  ? 'Official'
                  : key === 'joined'
                    ? 'Joined'
                    : 'Hosted'}
            </button>
          ),
          )}
        </div>
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
        <div className="event-list">
          {live.length > 0 ? (
            <ul className="event-list__grid">
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
          ) : null}

          {ended.length > 0 ? (
            <section className="event-list__ended" aria-label="Ended events">
              <h2 className="event-list__section-title">Ended</h2>
              <ul className="event-list__grid">
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
          className={`event-detail game-lobby${eventKind(detail) === 'bracket' ? '' : ' game-lobby--split'}`}
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
                  url={inviteLink ?? tournamentHref(detail.id)}
                />
                {detail.isHost && detail.inviteCode && detail.status !== 'ended' ? (
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
          </header>

          {detail.isHost && detail.inviteCode && detail.status !== 'ended' ? (
            <section className="group-panel event-detail__invite-tag" aria-label="Invite by tag">
              <InviteByTagForm kind="tournament" targetId={id} disabled={busy} />
            </section>
          ) : null}

          <div className="game-lobby__layout">
            <div className="game-lobby__main">
              <EventPlayCards
                detail={detail}
                joined={joined}
                playInvite={playInvite}
                displayName={displayName}
              />

              {detail.status !== 'ended' && !joined ? (
                <div className="event-detail__join">
                  {eventFull ? (
                    <p className="tour-note tour-note--compact">This event is full.</p>
                  ) : displayName ? (
                    <button
                      type="button"
                      className="lb-play game-lobby__play game-lobby__play--wide event-detail__join-btn"
                      style={{ background: accent }}
                      disabled={busy}
                      onClick={() => void onJoin()}
                    >
                      {busy ? 'Joining…' : `Join as ${displayName}`}
                    </button>
                  ) : (
                    <p className="tour-note tour-note--compact">
                      Set your gamer tag in the header first.
                    </p>
                  )}
                  {joinNote ? <p className="tour-note tour-note--error">{joinNote}</p> : null}
                </div>
              ) : joinNote ? (
                <p className="tour-note tour-note--error">{joinNote}</p>
              ) : null}

              <EventTicker
                t={detail}
                joined={joined && detail.status !== 'ended'}
                yourPlace={
                  eventKind(detail) === 'bracket'
                    ? null
                    : yourStandingPlace(detail, displayName)
                }
                matchLine={bracketMatchLine(detail, displayName)}
              />

              <EventBoard
                detail={detail}
                displayName={displayName}
                className={
                  eventKind(detail) === 'bracket'
                    ? 'event-detail__board event-detail__board--bracket'
                    : 'lb-board event-detail__board game-lobby__tops game-lobby__tops--mobile'
                }
              />
            </div>

            {eventKind(detail) === 'bracket' ? null : (
              <EventBoard
                detail={detail}
                displayName={displayName}
                className="game-lobby__aside event-detail__aside"
              />
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}
