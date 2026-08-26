import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { EventCard, EventStatusChips, EventThumbs, eventAccent } from '../components/EventCard'
import { EventCountdown } from '../components/EventCountdown'
import { GameLobbyArt } from '../components/GameLobbyArt'
import { GameThumbArt } from '../components/GameThumbArt'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { PlayerAvatar } from '../components/PlayerAvatar'
import { PodiumMedal, medalKind } from '../components/PodiumMedal'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { getGame } from '../data/games'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import {
  getTournament,
  isPlayerInTournament,
  joinTournament,
  listTournaments,
  syncJoinedTournamentRosters,
  type StandingRow,
  type TournamentDetail,
  type TournamentStatus,
  type TournamentSummary,
} from '../lib/tournaments'

function statusLabel(status: TournamentStatus) {
  if (status === 'active') return 'Live'
  if (status === 'upcoming') return 'Soon'
  return 'Ended'
}

function placeLabel(place: number) {
  if (place === 1) return '1st'
  if (place === 2) return '2nd'
  if (place === 3) return '3rd'
  return `${place}th`
}

function formatWindow(startsAt: number, endsAt: number) {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
  try {
    return `${new Date(startsAt).toLocaleString(undefined, opts)} → ${new Date(endsAt).toLocaleString(undefined, opts)}`
  } catch {
    return ''
  }
}

function GameResultCell({
  cell,
}: {
  cell: { score: number | null; place: number | null; points: number } | undefined
}) {
  if (cell?.place == null) {
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
  if (detail.games.length === 1) {
    return <SingleGameStandings detail={detail} displayName={displayName} />
  }

  return (
    <>
      <ul className="tour-standings">
        {detail.standings.map((row, index) => (
          <StandingCard
            key={row.playerId}
            row={row}
            rank={index + 1}
            games={detail.games}
            mine={normalizePlayerName(row.name) === displayName}
          />
        ))}
      </ul>

      <div className="tour-table-wrap">
        <table className="tour-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Player</th>
              <th scope="col">Total</th>
              {detail.games.map((game) => (
                <th key={game} scope="col">
                  {getGame(game)?.name ?? game}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.standings.map((row, index) => {
              const mine = normalizePlayerName(row.name) === displayName
              return (
                <tr key={row.playerId} className={mine ? 'tour-table__row--you' : undefined}>
                  <td className="tour-table__rank">{index + 1}</td>
                  <td>
                    <div className="tour-table__name">
                      <PlayerAvatar
                        avatarId={row.avatarId}
                        name={normalizePlayerName(row.name)}
                        size="sm"
                      />
                      <span
                        className="tour-table__name-text"
                        title={normalizePlayerName(row.name)}
                      >
                        {normalizePlayerName(row.name)}
                      </span>
                      {mine ? <span className="tour-you-tag">you</span> : null}
                    </div>
                  </td>
                  <td className="tour-table__total">{row.totalPoints}</td>
                  {detail.games.map((game) => (
                    <td key={game} className="tour-table__game">
                      <GameResultCell cell={row.byGame[game]} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
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
}: {
  row: StandingRow
  rank: number
  games: string[]
  mine: boolean
}) {
  const name = normalizePlayerName(row.name)
  return (
    <li className={`tour-standing${mine ? ' tour-standing--you' : ''}`}>
      <div className="tour-standing__top">
        <span className="tour-standing__rank">{rank}</span>
        <div className="tour-standing__who">
          <PlayerAvatar avatarId={row.avatarId} name={name} size="sm" />
          <span className="tour-standing__name" title={name}>
            {name}
          </span>
          {mine ? <span className="tour-you-tag">you</span> : null}
        </div>
        <span className="tour-standing__total">
          {row.totalPoints}
          <span className="tour-standing__total-label">pts</span>
        </span>
      </div>
      <ul className="tour-standing__games">
        {games.map((game) => {
          const cell = row.byGame[game]
          const label = getGame(game)?.name ?? game
          return (
            <li key={game} className="tour-standing__game">
              <span className="tour-standing__game-name">{label}</span>
              <GameResultCell cell={cell} />
            </li>
          )
        })}
      </ul>
    </li>
  )
}

export function TournamentsPage() {
  const [items, setItems] = useState<TournamentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listTournaments()
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
  }, [])

  const live = items.filter((t) => t.status !== 'ended')
  const ended = items.filter((t) => t.status === 'ended')

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      <header className="lb-page__header lb-page__header--compact">
        <h1 className="lb-page__title">Events</h1>
      </header>

      {loading ? (
        <p className="lb-empty">Loading…</p>
      ) : error ? (
        <p className="lb-empty">Couldn’t load events.</p>
      ) : items.length === 0 ? (
        <p className="lb-empty">No events yet.</p>
      ) : (
        <div className="event-list">
          {live.length > 0 ? (
            <ul className="event-list__grid">
              {live.map((t) => (
                <li key={t.id}>
                  <EventCard t={t} />
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
                    <EventCard t={t} />
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

export function TournamentDetailPage({ id }: { id: string }) {
  const playerName = usePlayerName()
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joinNote, setJoinNote] = useState<string | null>(null)

  const displayName = normalizePlayerName(playerName)

  const syncJoined = (data: TournamentDetail, who: string) => {
    setJoined(isPlayerInTournament(data, who, id))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        await syncJoinedTournamentRosters()
        const data = await getTournament(id)
        if (cancelled) return
        setDetail(data)
        syncJoined(data, getLastPlayerName())
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

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

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--events">
      {loading ? (
        <p className="lb-empty">Loading…</p>
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
                  url={`#/tournaments/${detail.id}`}
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
            <EventStatusChips t={detail} />
            <div className="event-detail__stats">
              {detail.status === 'active' ? (
                <div className="lb-stat">
                  <span className="lb-stat__label">Time left</span>
                  <strong>
                    <EventCountdown endsAt={detail.endsAt} />
                  </strong>
                </div>
              ) : (
                <div className="lb-stat">
                  <span className="lb-stat__label">Window</span>
                  <strong className="event-detail__window-stat">
                    {formatWindow(detail.startsAt, detail.endsAt)}
                  </strong>
                </div>
              )}
              <div className="lb-stat">
                <span className="lb-stat__label">Joined</span>
                <strong>{detail.playerCount}</strong>
              </div>
            </div>
          </div>

          {detail.status !== 'ended' ? (
            <div className="event-detail__join">
              {joined ? (
                <p className="event-detail__joined">
                  In as <strong>{displayName}</strong>
                </p>
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
          ) : null}

          <section className="event-detail__play" aria-label="Play">
            <h2 className="event-detail__section-title">Play</h2>
            <ul className="event-play-grid">
              {detail.games.map((slug) => {
                const g = getGame(slug)
                const gameAccent = g?.accent ?? accent
                return (
                  <li key={slug}>
                    <a
                      className="event-play-tile"
                      href={`#/tournaments/${detail.id}/play/${slug}`}
                      style={{ '--event-accent': gameAccent } as CSSProperties}
                    >
                      <span className="event-play-tile__art">
                        <GameThumbArt slug={slug} accent={gameAccent} />
                      </span>
                      <span className="event-play-tile__name">{g?.name ?? slug}</span>
                      <span className="event-play-tile__go">Play</span>
                    </a>
                  </li>
                )
              })}
            </ul>
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
