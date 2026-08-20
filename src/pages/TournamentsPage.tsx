import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Footer } from '../components/Footer'
import { HomeBar } from '../components/HomeBar'
import { InfoTip } from '../components/InfoTip'
import { getGame } from '../data/games'
import { usePlayerName } from '../hooks/usePlayerName'
import { getLastPlayerName, normalizePlayerName } from '../lib/leaderboard'
import {
  getTournament,
  joinTournament,
  listTournaments,
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

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner">
          <header className="lb-page__header">
            <h1 className="lb-page__title lb-page__title--with-tip">
              Tournaments
              <InfoTip label="About tournaments">
                Multi-game events. Finish higher in each game for place points —
                highest total wins.
              </InfoTip>
            </h1>
          </header>

          {loading ? (
            <p className="lb-empty">Loading…</p>
          ) : error ? (
            <p className="lb-empty">Couldn’t load tournaments.</p>
          ) : items.length === 0 ? (
            <p className="lb-empty">No events yet.</p>
          ) : (
            <ul className="tour-list">
              {items.map((t) => (
                <li key={t.id}>
                  <a className="tour-card" href={`#/tournaments/${t.id}`}>
                    <div className="tour-card__top">
                      <span className={`tour-pill tour-pill--${t.status}`}>
                        {statusLabel(t.status)}
                      </span>
                      {t.official && (
                        <span className="tour-pill tour-pill--official">Official</span>
                      )}
                    </div>
                    <h2 className="tour-card__title">{t.title}</h2>
                    <div className="tour-card__meta">
                      <span>{t.games.map((g) => getGame(g)?.name ?? g).join(' · ')}</span>
                      <span>{t.playerCount} joined</span>
                    </div>
                    <p className="tour-card__window">{formatWindow(t.startsAt, t.endsAt)}</p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </>
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
    const mine = normalizePlayerName(who)
    if (!mine) {
      setJoined(false)
      return
    }
    setJoined(data.players.some((p) => normalizePlayerName(p.name) === mine))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getTournament(id)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
        syncJoined(data, getLastPlayerName())
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
  }, [id])

  useEffect(() => {
    if (detail) syncJoined(detail, playerName)
  }, [playerName, detail])

  const placeTable = useMemo(() => {
    if (!detail?.placePoints) return []
    return Object.entries(detail.placePoints)
      .map(([place, pts]) => ({ place: Number(place), pts: Number(pts) }))
      .sort((a, b) => a.place - b.place)
  }, [detail])

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

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner">
          <a className="game-page__back" href="#/tournaments">
            ← Tournaments
          </a>

          {loading ? (
            <p className="lb-empty">Loading…</p>
          ) : error || !detail ? (
            <p className="lb-empty">{error ?? 'Tournament not found'}</p>
          ) : (
            <>
              <header className="lb-page__header" style={{ marginTop: '1rem' }}>
                <div
                  className="tour-card__top"
                  style={{ justifyContent: 'center', marginBottom: '0.5rem' }}
                >
                  <span className={`tour-pill tour-pill--${detail.status}`}>
                    {statusLabel(detail.status)}
                  </span>
                  {detail.official && (
                    <span className="tour-pill tour-pill--official">Official</span>
                  )}
                </div>
                <h1 className="lb-page__title lb-page__title--with-tip">
                  {detail.title}
                  {(detail.blurb || placeTable.length > 0) && (
                    <InfoTip label="Event details">
                      {detail.blurb && <p>{detail.blurb}</p>}
                      {placeTable.length > 0 && (
                        <>
                          <p>Place points per game — totals decide the winner.</p>
                          <div className="info-tip__points">
                            {placeTable.map((row) => (
                              <span key={row.place}>
                                {placeLabel(row.place)} · {row.pts}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </InfoTip>
                  )}
                </h1>
                <p className="tour-card__window">{formatWindow(detail.startsAt, detail.endsAt)}</p>
              </header>

              <section className="lb-board tour-panel">
                {detail.status !== 'ended' && (
                  <div className="tour-join">
                    <div className="tour-section-head">
                      <h2 className="tour-section-title">Join</h2>
                      <InfoTip label="How joining works">
                        Join once, then play each game from this page. Only your best score
                        per game counts. Free play from home does not.
                      </InfoTip>
                    </div>
                    {joined ? (
                      <p className="tour-joined">
                        In as <strong>{displayName}</strong>
                      </p>
                    ) : displayName ? (
                      <button
                        type="button"
                        className="score-save__btn"
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
                    {joinNote && (
                      <p className="tour-note tour-note--error">{joinNote}</p>
                    )}
                  </div>
                )}

                <div className="tour-section-head">
                  <h2 className="tour-section-title">Play</h2>
                  <InfoTip label="Tournament play">
                    These links count for the event. Home-page free play does not.
                  </InfoTip>
                </div>
                <ul className="tour-games">
                  {detail.games.map((slug) => {
                    const g = getGame(slug)
                    return (
                      <li key={slug}>
                        <a
                          href={`#/tournaments/${detail.id}/play/${slug}`}
                          style={{ '--tab-accent': g?.accent ?? '#2eb8a0' } as CSSProperties}
                        >
                          {g?.name ?? slug}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section className="lb-board" style={{ marginTop: '1rem' }}>
                <div className="lb-board__head">
                  <div className="lb-stat">
                    <span className="lb-stat__label lb-stat__label--with-tip">
                      Standings
                      <InfoTip label="How standings work">
                        Ranked by total place points across games. Missing a game scores 0
                        for that game.
                      </InfoTip>
                    </span>
                    <strong>{detail.standings.length}</strong>
                  </div>
                </div>

                {detail.standings.length === 0 ? (
                  <p className="lb-empty">No players yet.</p>
                ) : (
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
                            <tr
                              key={row.playerId}
                              className={mine ? 'tour-table__row--you' : undefined}
                            >
                              <td className="tour-table__rank">{index + 1}</td>
                              <td className="tour-table__name">
                                <span className="tour-table__name-text" title={normalizePlayerName(row.name)}>
                                  {normalizePlayerName(row.name)}
                                </span>
                                {mine ? <span className="tour-you-tag">you</span> : null}
                              </td>
                              <td className="tour-table__total">{row.totalPoints}</td>
                              {detail.games.map((game) => {
                                const cell = row.byGame[game]
                                if (cell?.place == null) {
                                  return (
                                    <td key={game} className="tour-table__game tour-table__game--empty">
                                      —
                                    </td>
                                  )
                                }
                                return (
                                  <td key={game} className="tour-table__game">
                                    <span className="tour-table__place">
                                      {placeLabel(cell.place)}
                                    </span>
                                    <span className="tour-table__pts">+{cell.points}</span>
                                    {cell.score != null && (
                                      <span className="tour-table__score">{cell.score}</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
