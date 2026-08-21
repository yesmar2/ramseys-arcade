import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import { Footer } from '../components/Footer'
import { HomeBar } from '../components/HomeBar'
import { LeaderboardList } from '../components/LeaderboardList'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { YouBoardStrip } from '../components/YouBoardStrip'
import { getGame } from '../data/games'
import {
  gamePlayHref,
  leaderboardHref,
  recordHref,
  recordsHref,
} from '../hooks/useHashRoute'
import { flashYouRow, gapToNextLabel } from '../lib/boardGap'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  PERIOD_LABELS,
  normalizePlayerName,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type YouEntry,
} from '../lib/leaderboard'
import {
  fetchGameRecords,
  fetchRecordBoard,
  formatRecordValue,
  formatRecordScore,
  type RecordDef,
  type RecordSummary,
} from '../lib/records'

const INITIAL_ROWS = 10

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
        setRecords(data.records.filter((row) => row.top != null))
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
      ? leaderboardHref(game as LeaderboardGame, 'all')
      : leaderboardHref()
  const accent = gameMeta?.accent ?? 'var(--accent)'

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div
          className="lb-page__inner"
          style={{ '--board-accent': accent } as CSSProperties}
        >
          <header className="lb-page__header lb-page__header--compact">
            <a className="rank-page__back" href={backHref}>
              ← {gameMeta?.name ?? game} scores
            </a>
            <h1 className="lb-page__title">Record books</h1>
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
                detail="Clear a wave in-game and the board will show up here."
                action={
                  <a
                    className="lb-empty-state__btn"
                    href={gamePlayHref(game)}
                    style={{ background: accent }}
                  >
                    Play {gameMeta?.name ?? game}
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
        setWaveRecords(list.records.filter((row) => row.top != null))
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
  const direction = record?.direction ?? 'lower'

  const waveIndex = useMemo(
    () => waveRecords.findIndex((row) => row.id === recordId),
    [waveRecords, recordId],
  )
  const prevWave = waveIndex > 0 ? waveRecords[waveIndex - 1] : null
  const nextWave =
    waveIndex >= 0 && waveIndex < waveRecords.length - 1
      ? waveRecords[waveIndex + 1]
      : null

  const gap = you
    ? gapToNextLabel({
        youRank: you.rank,
        youScore: you.score,
        entries: entries.map((e, i) => ({ rank: i + 1, score: e.score })),
        direction,
        formatDelta: (n) => formatRecordValue(n, unit),
      })
    : null

  const shareLabel = [
    record?.label ?? 'Record',
    you
      ? `#${you.rank} · ${formatRecordScore(you.score, unit)}`
      : PERIOD_LABELS[period],
    gameMeta?.name ?? game,
  ].join(' · ')

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div
          className="lb-page__inner"
          style={
            {
              '--period-accent': accent,
              '--board-accent': accent,
            } as CSSProperties
          }
        >
          <header className="lb-page__header lb-page__header--compact">
            <a className="rank-page__back" href={recordsHref(game)}>
              ← Record books
            </a>
            <h1 className="lb-page__title">{record?.label ?? 'Record'}</h1>
            {!loading && !error ? (
              <div className="lb-page__actions">
                <ShareBoardButton label={shareLabel} />
              </div>
            ) : null}
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
                  const short =
                    row.id === 'highest-combo'
                      ? 'Combo'
                      : row.label.replace(/^wave\s+/i, 'W') || row.label
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

          {!loading && !error && you ? (
            <YouBoardStrip
              rank={you.rank}
              value={formatRecordScore(you.score, unit)}
              valueLabel="Your best"
              gap={gap}
              accent={accent}
            />
          ) : null}

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
                detail={`Clear this wave in ${gameMeta?.name ?? game} to set the first record.`}
                action={
                  <a
                    className="lb-empty-state__btn"
                    href={gamePlayHref(game)}
                    style={{ background: accent }}
                  >
                    Play {gameMeta?.name ?? game}
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
                formatDelta={(n) => formatRecordValue(n, unit)}
                direction={direction}
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
                Play {gameMeta?.name ?? game}
              </a>
            ) : null}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
