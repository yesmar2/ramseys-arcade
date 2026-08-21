import { useEffect, useState, type CSSProperties } from 'react'
import { Footer } from '../components/Footer'
import { HomeBar } from '../components/HomeBar'
import { LeaderboardList } from '../components/LeaderboardList'
import { YouBoardStrip } from '../components/YouBoardStrip'
import { getGame } from '../data/games'
import {
  gamePlayHref,
  leaderboardHref,
  recordHref,
  recordsHref,
} from '../hooks/useHashRoute'
import { findMeOnBoard, gapToNextLabel } from '../lib/boardGap'
import { usePlayerName } from '../hooks/usePlayerName'
import {
  LEADERBOARD_PERIODS,
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

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner">
          <header className="lb-page__header">
            <a className="rank-page__back" href={backHref}>
              ← {gameMeta?.name ?? game} scores
            </a>
            <h1 className="lb-page__title">Records</h1>
            <p className="lb-page__blurb">
              Fastest clears — separate from high scores and global points.
              Boards appear once someone sets a time.
            </p>
          </header>

          <section className="lb-board" aria-label="Game records">
            {loading ? (
              <p className="lb-empty">Loading records…</p>
            ) : error ? (
              <p className="lb-empty">
                Couldn’t load records. Is the API running?
              </p>
            ) : records.length === 0 ? (
              <p className="lb-empty">No records for this game yet.</p>
            ) : (
              <ul className="lb-games__list records-index">
                {records.map((row) => {
                  const holder = row.top
                    ? normalizePlayerName(row.top.name)
                    : ''
                  const isYou = Boolean(playerName && holder === playerName)
                  return (
                    <li key={row.id}>
                      <a
                        className={`lb-games__link records-index__link${isYou ? ' records-index__link--you' : ''}`}
                        href={recordHref(game, row.id)}
                        style={
                          {
                            '--tab-accent': gameMeta?.accent ?? 'var(--accent)',
                          } as CSSProperties
                        }
                      >
                        <span className="records-index__main">
                          <span className="lb-games__name">{row.label}</span>
                          {holder ? (
                            <span className="records-index__holder">
                              {isYou ? 'You' : holder}
                              {isYou ? (
                                <em className="records-index__you-tag">hold</em>
                              ) : null}
                            </span>
                          ) : null}
                        </span>
                        <span className="records-top">
                          {row.top
                            ? formatRecordValue(row.top.score, row.unit)
                            : '—'}
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>
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
  const [siblingRecords, setSiblingRecords] = useState<RecordSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(INITIAL_ROWS)

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
    Promise.all([
      fetchRecordBoard(game, recordId, period, playerName || undefined),
      fetchGameRecords(game),
    ])
      .then(([board, list]) => {
        if (cancelled) return
        setRecord(board.record)
        setEntries(board.entries)
        setYou(board.you)
        setSiblingRecords(
          list.records.filter((row) => row.top != null && row.id !== recordId),
        )
      })
      .catch((err) => {
        if (cancelled) return
        setRecord(null)
        setEntries([])
        setYou(null)
        setSiblingRecords([])
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [game, recordId, period, playerName])

  const selectPeriod = (next: LeaderboardPeriod) => {
    window.location.hash = recordHref(game, recordId, next)
  }

  const accent = gameMeta?.accent ?? '#2eb8a0'
  const unit = record?.unit ?? 'ms'
  const direction = record?.direction ?? 'lower'

  const youOnVisible = Boolean(
    you && entries.slice(0, shown).some((entry) => entry.id === you.id),
  )
  const showFindMe = Boolean(you && !youOnVisible)

  const gap = you
    ? gapToNextLabel({
        youRank: you.rank,
        youScore: you.score,
        entries: entries.map((e, i) => ({ rank: i + 1, score: e.score })),
        direction,
        formatDelta: (n) => formatRecordValue(n, unit),
      })
    : null

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner">
          <header className="lb-page__header">
            <a className="rank-page__back" href={recordsHref(game)}>
              ← All records
            </a>
            <h1 className="lb-page__title">{record?.label ?? 'Record'}</h1>
            <p className="lb-page__blurb">
              {direction === 'lower'
                ? 'Lower is better · fastest clear wins. Does not count toward global points.'
                : 'Does not count toward global points.'}
            </p>
          </header>

          <div className="lb-periods" role="tablist" aria-label="Time period">
            {LEADERBOARD_PERIODS.map((p) => (
              <a
                key={p}
                href={recordHref(game, recordId, p)}
                role="tab"
                aria-selected={period === p}
                className={`lb-period${period === p ? ' lb-period--active' : ''}`}
                onClick={(e) => {
                  e.preventDefault()
                  selectPeriod(p)
                }}
              >
                {PERIOD_LABELS[p]}
              </a>
            ))}
          </div>

          {!loading && !error && you ? (
            <YouBoardStrip
              rank={you.rank}
              value={formatRecordValue(you.score, unit)}
              valueLabel="Best"
              gap={gap}
              accent={accent}
              findMe={showFindMe}
              onFindMe={() => findMeOnBoard(you.rank, entries.length, setShown)}
            />
          ) : null}

          <section className="lb-board" aria-label={record?.label ?? 'Record board'}>
            {loading ? (
              <p className="lb-empty">Loading…</p>
            ) : error ? (
              <p className="lb-empty">
                Couldn’t load this record board. Is the API running?
              </p>
            ) : entries.length === 0 && !you ? (
              <p className="lb-empty">
                No times yet.{' '}
                <a href={gamePlayHref(game)}>Play {gameMeta?.name ?? game}</a> and
                clear the wave.
              </p>
            ) : (
              <LeaderboardList
                entries={entries}
                you={you}
                playerName={playerName}
                accent={accent}
                shown={shown}
                formatScore={(score) => formatRecordValue(score, unit)}
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

            <a
              className="lb-play"
              href={gamePlayHref(game)}
              style={{ background: accent }}
            >
              Play {gameMeta?.name ?? game}
            </a>
          </section>

          {siblingRecords.length > 0 ? (
            <section className="lb-games" aria-labelledby="records-waves-heading">
              <h2 id="records-waves-heading" className="lb-games__title">
                Other records
              </h2>
              <ul className="lb-games__list lb-games__list--compact">
                {siblingRecords.map((row) => (
                  <li key={row.id}>
                    <a
                      className="lb-games__link"
                      href={recordHref(game, row.id, period)}
                    >
                      <span className="lb-games__name">{row.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  )
}
