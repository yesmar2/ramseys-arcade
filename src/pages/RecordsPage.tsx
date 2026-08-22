import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { GameLobbyArt } from '../components/GameLobbyArt'
import {
  BoardEmpty,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import { Footer } from '../components/Footer'
import { HomeBar } from '../components/HomeBar'
import { LeaderboardList } from '../components/LeaderboardList'
import { getGame } from '../data/games'
import { gameHref, gamePlayHref, recordHref, recordsHref, leaderboardHref } from '../hooks/useHashRoute'
import { flashYouRow } from '../lib/boardGap'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type YouEntry,
} from '../lib/leaderboard'
import {
  fetchGameRecords,
  fetchRecordBoard,
  formatRecordScore,
  recordNavShortLabel,
  type RecordDef,
  type RecordSummary,
} from '../lib/records'

const INITIAL_ROWS = 10

function recordsIndexTitle(gameName: string) {
  return `${gameName} Record Books`
}

function recordsEmptyDetail(game: string, gameName: string) {
  if (game === 'snake') {
    return 'Reach length milestones in-game and times will show up here.'
  }
  if (game === 'asteroids') {
    return 'Clear a wave in-game and the board will show up here.'
  }
  return `Set a record in ${gameName} to populate this page.`
}

function recordBoardEmptyDetail(game: string, gameName: string, label: string) {
  if (game === 'snake') {
    const length = label.replace(/^Fastest to length /i, '')
    return `Grow to length ${length} in ${gameName} to set the first record.`
  }
  if (game === 'asteroids') {
    return `Clear this wave in ${gameName} to set the first record.`
  }
  return `Be the first to set this record in ${gameName}.`
}

type RecordsPageProps = {
  game: string
  recordId?: string
  period?: LeaderboardPeriod
}

export function RecordsPage({ game, recordId, period: periodFromRoute }: RecordsPageProps) {
  if (recordId) {
    return (
      <RecordBoardPage
        game={game}
        recordId={recordId}
        period={periodFromRoute ?? 'all'}
      />
    )
  }
  return <RecordsIndexPage game={game} />
}

function RecordsIndexPage({ game }: { game: string }) {
  const gameMeta = getGame(game)
  const playerName = normalizePlayerName(usePlayerName())
  const [records, setRecords] = useState<RecordSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchGameRecords(game)
      .then((data) => {
        if (cancelled) return
        setRecords(data.records)
      })
      .catch((err) => {
        if (cancelled) return
        setRecords([])
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [game])

  const backHref =
    gameMeta && (game as LeaderboardGame)
      ? gameHref(game as LeaderboardGame)
      : leaderboardHref()
  const accent = gameMeta?.accent ?? 'var(--accent)'

  const gameTitle = gameMeta?.name ?? game
  const pageTitle = recordsIndexTitle(gameTitle)

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div
          className="lb-page__inner game-lobby"
          style={{ '--board-accent': accent } as CSSProperties}
        >
            <a className="rank-page__back" href={backHref}>
              ← {gameTitle} hub
            </a>
          {gameMeta ? (
            <GameLobbyArt slug={game} accent={accent} />
          ) : null}
          <header className="game-lobby__header">
            <h1 className="game-lobby__title">{pageTitle}</h1>
          </header>

          <section className="lb-board" aria-label="Game records">
            {loading ? (
              <BoardSkeleton rows={5} />
            ) : error ? (
              <BoardEmpty
                title="Couldn’t load records"
                detail="Check your connection and try again."
              />
            ) : records.length === 0 ? (
              <BoardEmpty
                title="No records yet"
                detail={recordsEmptyDetail(game, gameTitle)}
                action={
                  <a
                    className="lb-empty-state__btn"
                    href={gamePlayHref(game)}
                    style={{ background: accent }}
                  >
                    Play {gameTitle}
                  </a>
                }
              />
            ) : (
              <ol className="records-leaders">
                {records.map((row) => {
                  const holder = row.top
                    ? normalizePlayerName(row.top.name)
                    : ''
                  const isYou = Boolean(playerName && holder === playerName)
                  return (
                    <li key={row.id}>
                      <a
                        className={`records-leaders__row${isYou ? ' records-leaders__row--you' : ''}`}
                        href={recordHref(game, row.id)}
                        style={{ '--tab-accent': accent } as CSSProperties}
                      >
                        <span className="records-leaders__label">{row.label}</span>
                        <span className="records-leaders__holder" title={holder}>
                          <span className="records-leaders__name">
                            {holder || '—'}
                          </span>
                          {isYou ? (
                            <span className="lb-row__you-tag">You</span>
                          ) : null}
                        </span>
                        <span className="records-leaders__time">
                          {row.top
                            ? formatRecordScore(row.top.score, row.unit)
                            : '—'}
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}

function RecordBoardPage({
  game,
  recordId,
  period,
}: {
  game: string
  recordId: string
  period: LeaderboardPeriod
}) {
  const gameMeta = getGame(game)
  const playerName = normalizePlayerName(usePlayerName())
  const [record, setRecord] = useState<RecordDef | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
  const [waveRecords, setWaveRecords] = useState<RecordSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(INITIAL_ROWS)
  const pulsed = useRef(false)

  useEffect(() => {
    const canonical = recordHref(game, recordId, period)
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical)
    }
  }, [game, recordId, period])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShown(INITIAL_ROWS)
    pulsed.current = false
    Promise.all([
      fetchRecordBoard(game, recordId, period, playerName || undefined),
      fetchGameRecords(game),
    ])
      .then(([board, list]) => {
        if (cancelled) return
        setRecord(board.record)
        setEntries(board.entries)
        setYou(board.you)
        setWaveRecords(list.records)
      })
      .catch((err) => {
        if (cancelled) return
        setRecord(null)
        setEntries([])
        setYou(null)
        setWaveRecords([])
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [game, recordId, period, playerName])

  useEffect(() => {
    if (loading || !you || pulsed.current) return
    pulsed.current = true
    window.requestAnimationFrame(() => flashYouRow())
  }, [loading, you, recordId, period])

  const selectPeriod = (next: LeaderboardPeriod) => {
    window.location.hash = recordHref(game, recordId, next)
  }

  const accent = gameMeta?.accent ?? '#2eb8a0'
  const unit = record?.unit ?? 'ms'
  const gameTitle = gameMeta?.name ?? game
  const indexTitle = recordsIndexTitle(gameTitle)

  const waveIndex = useMemo(
    () => waveRecords.findIndex((row) => row.id === recordId),
    [waveRecords, recordId],
  )
  const prevWave = waveIndex > 0 ? waveRecords[waveIndex - 1] : null
  const nextWave =
    waveIndex >= 0 && waveIndex < waveRecords.length - 1
      ? waveRecords[waveIndex + 1]
      : null

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div
          className="lb-page__inner game-lobby"
          style={
            {
              '--period-accent': accent,
              '--board-accent': accent,
            } as CSSProperties
          }
        >
          <a className="rank-page__back" href={recordsHref(game)}>
            ← {indexTitle}
          </a>
          {gameMeta ? (
            <GameLobbyArt slug={game} accent={accent} />
          ) : null}
          <header className="game-lobby__header">
            <h1 className="game-lobby__title">{record?.label ?? 'Record'}</h1>
          </header>

          {waveRecords.length > 1 ? (
            <nav className="records-wave-nav" aria-label="Record boards">
              {prevWave ? (
                <a
                  className="records-wave-nav__btn"
                  href={recordHref(game, prevWave.id, period)}
                >
                  ← Prev
                </a>
              ) : (
                <span className="records-wave-nav__btn records-wave-nav__btn--disabled">
                  ← Prev
                </span>
              )}
              <div className="records-wave-nav__strip" role="list">
                {waveRecords.map((row) => {
                  const short = recordNavShortLabel(row)
                  const active = row.id === recordId
                  return (
                    <a
                      key={row.id}
                      role="listitem"
                      className={`records-wave-nav__chip${active ? ' records-wave-nav__chip--active' : ''}`}
                      href={recordHref(game, row.id, period)}
                      aria-current={active ? 'page' : undefined}
                      title={row.label}
                    >
                      {short}
                    </a>
                  )
                })}
              </div>
              {nextWave ? (
                <a
                  className="records-wave-nav__btn"
                  href={recordHref(game, nextWave.id, period)}
                >
                  Next →
                </a>
              ) : (
                <span className="records-wave-nav__btn records-wave-nav__btn--disabled">
                  Next →
                </span>
              )}
            </nav>
          ) : null}

          <PeriodSwitcher
            period={period}
            accent={accent}
            hrefFor={(p) => recordHref(game, recordId, p)}
            onSelect={selectPeriod}
          />

          <section
            key={`${recordId}-${period}`}
            className="lb-board lb-board--fade"
            aria-label={record?.label ?? 'Record board'}
          >
            {loading ? (
              <BoardSkeleton />
            ) : error ? (
              <BoardEmpty
                title="Couldn’t load this board"
                detail="Check your connection and try again."
              />
            ) : entries.length === 0 && !you ? (
              <BoardEmpty
                title="No times yet"
                detail={recordBoardEmptyDetail(
                  game,
                  gameTitle,
                  record?.label ?? 'this milestone',
                )}
                action={
                  <a
                    className="lb-empty-state__btn"
                    href={gamePlayHref(game)}
                    style={{ background: accent }}
                  >
                    Play {gameTitle}
                  </a>
                }
              />
            ) : (
              <LeaderboardList
                entries={entries}
                you={you}
                playerName={playerName}
                accent={accent}
                shown={shown}
                formatScore={(score) => formatRecordScore(score, unit)}
              />
            )}

            {!loading && !error && entries.length > shown ? (
              <button
                type="button"
                className="lb-more"
                onClick={() => setShown(entries.length)}
              >
                Show top {entries.length}
              </button>
            ) : null}

            {!(loading || error) && (entries.length > 0 || you) ? (
              <a
                className="lb-play"
                href={gamePlayHref(game)}
                style={{ background: accent }}
              >
                Play {gameTitle}
              </a>
            ) : null}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
