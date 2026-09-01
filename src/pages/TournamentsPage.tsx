import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { EventCard, EventStatusChips, eventAccent } from '../components/EventCard'
import { EventCountdown } from '../components/EventCountdown'
import { GameLobbyArt } from '../components/GameLobbyArt'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { PodiumMedal, medalKind } from '../components/PodiumMedal'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { getGame } from '../data/games'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { tournamentCreateHref, tournamentHref, tournamentPlayHref } from '../hooks/useHashRoute'
import { APP_NAME } from '../lib/brand'
import { ApiError, getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import {
  formatRulesSummary,
  eventDurationLabel,
  getTournament,
  getTournamentInvite,
  isPlayerInTournament,
  isUnlimitedDuration,
  joinTournament,
  listTournaments,
  playerCountLabel,
  rememberTournamentInvite,
  syncJoinedTournamentRosters,
  type StandingRow,
  type TournamentDetail,
  type TournamentSummary,
} from '../lib/tournaments'

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
    <ul className="tour-standings">
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
  const accent = game?.accent ?? '#2eb8a0'
  const youName = normalizePlayerName(displayName)

  const rows = useMemo(() => {
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
  }, [detail.standings, gameSlug])

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
            <span className="lb-row__rank">
              <span className="lb-row__rank-num">#{rank}</span>
              {medal ? <PodiumMedal kind={medal} /> : null}
            </span>
            <span className="lb-row__name">
              <PlayerAvatar avatarId={row.avatarId} name={name} size="sm" />
              <span className="lb-row__name-text" title={name}>
                {name}
              </span>
              {isYou ? <span className="lb-row__you-tag">You</span> : null}
            </span>
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
            <span className="tour-standing__name" title={name}>
              {name}
            </span>
            {mine ? <span className="tour-you-tag">you</span> : null}
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
            const accent = getGame(game)?.accent
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
          <h1 className="lb-page__title">Events</h1>
          {account ? (
            <a className="event-list__create" href={tournamentCreateHref()}>
              Create event
            </a>
          ) : null}
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
    const data = await getTournament(id, {
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
  }, [id, invite])

  useEffect(() => {
    if (!detail || !displayName || detail.games.length !== 1) return
    let cancelled = false
    void getTournament(id, {
      playerName: displayName,
      game: detail.games[0],
      invite: playInvite,
    })
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id, displayName, detail?.games[0], playInvite])

  useEffect(() => {
    if (!detail) return
    const mine = normalizePlayerName(playerName)
    if (mine && isPlayerInTournament(detail, mine, id)) {
      if (!detail.players.some((p) => normalizePlayerName(p.name) === mine)) {
        void joinTournament(id, mine)
          .then((result) => {
            setDetail(result.tournament)
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
      const result = await joinTournament(id, displayName)
      setDetail(result.tournament)
      setJoined(true)
      setJoinNote(null)
    } catch (err) {
      setJoinNote(err instanceof Error ? err.message : 'Could not join')
    } finally {
      setBusy(false)
    }
  }

  const accent = detail ? eventAccent(detail.games) : '#2eb8a0'
  const featured = detail?.games[0] ? getGame(detail.games[0]) : null
  const scoredCount =
    detail && detail.games.length === 1
      ? detail.standings.filter((row) => row.byGame[detail.games[0]!]?.score != null).length
      : (detail?.standings.length ?? 0)

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
          className="event-detail"
          style={{ '--event-accent': accent, '--board-accent': accent } as CSSProperties}
        >
          <header className="lb-page__header lb-page__header--compact lb-game-board__head">
            <div className="lb-page__heading-row">
              <PageBackLink href="#/tournaments" label="Back to Events" />
              <h1 className="lb-page__title">{detail.title}</h1>
              <div className="lb-game-board__trailing">
                <ShareBoardButton
                  label={`${detail.title} on ${APP_NAME}`}
                  url={inviteLink ?? tournamentHref(detail.id)}
                />
              </div>
            </div>
          </header>

          {detail.games.length === 1 && featured ? (
            <GameLobbyArt slug={featured.slug} accent={featured.accent} />
          ) : (
            <div className="event-detail__thumbs" aria-hidden="true">
              {detail.games.map((slug) => {
                const g = getGame(slug)
                return (
                  <span
                    key={slug}
                    className="event-detail__thumb"
                    style={{ '--thumb-accent': g?.accent ?? accent } as CSSProperties}
                  >
                    <GameThumbArt slug={slug} accent={g?.accent} />
                  </span>
                )
              })}
            </div>
          )}

          <div className="event-detail__meta">
            <EventStatusChips
              t={detail}
              joined={joined && detail.status !== 'ended'}
            />
            <p className="event-detail__rules">{formatRulesSummary(detail)}</p>
            {!detail.private && detail.blurb ? (
              <p className="event-detail__blurb">{detail.blurb}</p>
            ) : null}
            {detail.private ? (
              <p className="event-detail__rules">Private · invite only</p>
            ) : null}
            {detail.isHost && detail.inviteCode ? (
              <div className="event-invite-panel">
                <button
                  type="button"
                  className="score-save__btn event-invite-panel__btn"
                  onClick={() => void copyInviteLink()}
                >
                  {copiedInvite ? 'Copied!' : 'Copy invite link'}
                </button>
              </div>
            ) : null}
            <p className="event-detail__facts">
              {detail.status === 'active' ? (
                <strong>
                  <EventCountdown
                    endsAt={detail.endsAt}
                    unlimitedDuration={isUnlimitedDuration(detail.rules)}
                  />
                </strong>
              ) : (
                <span>{eventDurationLabel(detail)}</span>
              )}
              <span className="event-detail__facts-sep" aria-hidden="true">
                ·
              </span>
              <span>
                {playerCountLabel(detail.playerCount, detail.rules)}
              </span>
            </p>
          </div>

          {detail.status !== 'ended' && !joined ? (
            <div className="event-detail__join">
              {eventFull ? (
                <p className="tour-note tour-note--compact">This event is full.</p>
              ) : displayName ? (
                <button
                  type="button"
                  className="lb-play event-detail__join-btn"
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

          <section className="event-detail__play" aria-label="Play">
            <h2 className="event-detail__section-title">Play</h2>
            <ul className="event-play-grid">
              {detail.games.map((slug) => {
                const g = getGame(slug)
                const gameAccent = g?.accent ?? accent
                const status = detail.playerStatus && detail.games.length === 1 ? detail.playerStatus : null
                const exhausted = status && !status.canPlay && joined
                return (
                  <li key={slug}>
                    {exhausted ? (
                      <div
                        className="event-play-tile event-play-tile--disabled"
                        style={{ '--event-accent': gameAccent } as CSSProperties}
                      >
                        <span className="event-play-tile__art">
                          <GameThumbArt slug={slug} accent={gameAccent} />
                        </span>
                        <span className="event-play-tile__name">{g?.name ?? slug}</span>
                        <span className="event-play-tile__go">No attempts left</span>
                      </div>
                    ) : (
                      <a
                        className="event-play-tile"
                        href={tournamentPlayHref(detail.id, slug, playInvite)}
                        style={{ '--event-accent': gameAccent } as CSSProperties}
                      >
                        <span className="event-play-tile__art">
                          <GameThumbArt slug={slug} accent={gameAccent} />
                        </span>
                        <span className="event-play-tile__name">{g?.name ?? slug}</span>
                        <span className="event-play-tile__go">Play</span>
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
            {detail.playerStatus?.maxAttempts != null && joined ? (
              <p className="tour-note tour-note--compact">
                {detail.playerStatus.attemptsRemaining === 0
                  ? 'You have used all your attempts.'
                  : `${detail.playerStatus.attemptsRemaining} of ${detail.playerStatus.maxAttempts} attempts remaining.`}
              </p>
            ) : null}
          </section>

          <section className="lb-board event-detail__board" aria-label="Standings">
            <div className="lb-board__head">
              <div className="lb-stat">
                <span className="lb-stat__label">
                  {detail.games.length === 1 ? 'Top scores' : 'Standings'}
                </span>
                <strong>{scoredCount}</strong>
              </div>
            </div>

            {detail.standings.length === 0 ? (
              <p className="lb-empty">No players yet.</p>
            ) : (
              <StandingsList detail={detail} displayName={displayName} />
            )}
          </section>
        </div>
      )}
    </PageShell>
  )
}
