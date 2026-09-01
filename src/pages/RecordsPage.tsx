import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
} from '../components/BoardChrome'
import { Footer } from '../components/Footer'
import { GamePageHeader } from '../components/GamePageHeader'
import { GameRecordsPanel } from '../components/GameRecordsPanel'
import { PageBackLink } from '../components/PageBackLink'
import { PageShell } from '../components/PageShell'
import { SiteHeader } from '../components/SiteHeader'
import { LeaderboardList } from '../components/LeaderboardList'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { getGame, gamePlayableOn, deviceRequirementLabel } from '../data/games'
import {
  gamePlayHref,
  recordHref,
  recordsHref,
  recordsIndexHref,
} from '../hooks/useHashRoute'
import { flashYouRow } from '../lib/boardGap'
import { useDeviceType } from '../lib/device'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import {
  normalizePlayerName,
  PERIOD_LABELS,
  type LeaderboardEntry,
  type YouEntry,
} from '../lib/leaderboard'
import {
  fetchRecordBoard,
  formatRecordScore,
  type RecordDef,
} from '../lib/records'

const INITIAL_ROWS = 10

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
}

/** Game record book (`#/records/{game}`) or one record board (`…/{id}/{period}`). */
export function RecordsPage({ game, recordId }: RecordsPageProps) {
  if (!recordId) {
    return <GameRecordBookPage game={game} />
  }

  return <RecordBoardPage game={game} recordId={recordId} />
}

function GameRecordBookPage({ game }: { game: string }) {
  const gameMeta = getGame(game)
  const device = useDeviceType()
  const accent = gameMeta?.accent ?? '#2eb8a0'
  const title = gameMeta?.name ?? game
  const canPlay = gameMeta ? gamePlayableOn(gameMeta, device) : false
  const deviceNote = gameMeta ? deviceRequirementLabel(gameMeta) : null

  if (!gameMeta) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }

  return (
    <PageShell
      innerClassName="lb-page__inner lb-page__inner--game-board"
    >
      <div style={{ '--board-accent': accent } as CSSProperties}>
        <GamePageHeader
          slug={game}
          accent={accent}
          title={`${title} record books`}
          backHref={recordsIndexHref()}
          backLabel="Back to Record books"
          playHref={canPlay ? gamePlayHref(game) : undefined}
          action={
            <ShareBoardButton
              label={`${title} record books · ${APP_NAME}`}
              url={recordsHref(game)}
            />
          }
        />
        <GameRecordsPanel game={game} accent={accent} />
        {!canPlay ? (
          <p className="lb-device-note lb-device-note--footer" role="note">
            {deviceNote}
          </p>
        ) : null}
      </div>
    </PageShell>
  )
}

function RecordBoardPage({
  game,
  recordId,
}: {
  game: string
  recordId: string
}) {
  const period = useDefaultPeriod()
  const gameMeta = getGame(game)
  const playerName = normalizePlayerName(usePlayerName())
  const [record, setRecord] = useState<RecordDef | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(INITIAL_ROWS)
  const pulsed = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShown(INITIAL_ROWS)
    pulsed.current = false
    void fetchRecordBoard(game, recordId, period, playerName || undefined)
      .then((board) => {
        if (cancelled) return
        setRecord(board.record)
        setEntries(board.entries)
        setYou(board.you)
      })
      .catch((err) => {
        if (cancelled) return
        setRecord(null)
        setEntries([])
        setYou(null)
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

  const accent = gameMeta?.accent ?? '#2eb8a0'
  const unit = record?.unit ?? 'ms'
  const gameTitle = gameMeta?.name ?? game
  const device = useDeviceType()
  const canPlay = gameMeta ? gamePlayableOn(gameMeta, device) : false
  const deviceNote = gameMeta ? deviceRequirementLabel(gameMeta) : null

  return (
    <>
      <main className="lb-page">
        <SiteHeader />
        <div
          className="lb-page__inner lb-page__inner--game-board"
          style={
            {
              '--period-accent': accent,
              '--board-accent': accent,
            } as CSSProperties
          }
        >
          {gameMeta ? (
            <GamePageHeader
              slug={game}
              accent={accent}
              title={record?.label ?? 'Record'}
              backHref={recordsHref(game)}
              backLabel={`Back to ${gameTitle} records`}
              playHref={canPlay ? gamePlayHref(game) : undefined}
              action={
                <ShareBoardButton
                  label={`${record?.label ?? 'Record'} · ${PERIOD_LABELS[period]} · ${APP_NAME}`}
                  url={recordHref(game, recordId, period)}
                />
              }
            />
          ) : (
            <header className="lb-page__header lb-page__header--compact">
              <div className="lb-page__heading-row">
                <PageBackLink
                  href={recordsHref(game)}
                  label={`Back to ${gameTitle} records`}
                />
                <h1 className="lb-page__title">{record?.label ?? 'Record'}</h1>
                <div className="lb-game-board__trailing">
                  <ShareBoardButton
                    label={`${record?.label ?? 'Record'} · ${PERIOD_LABELS[period]} · ${APP_NAME}`}
                    url={recordHref(game, recordId, period)}
                  />
                </div>
              </div>
            </header>
          )}

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

            {!canPlay && !(loading || error) ? (
              <p className="lb-device-note lb-device-note--footer" role="note">
                {deviceNote}
              </p>
            ) : null}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
