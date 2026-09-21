import { useEffect, useRef, type CSSProperties } from 'react'
import {
  BoardEmpty,
  BoardMore,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import { BoardSideRail } from '../components/BoardSideRail'
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
  navigate,
  recordHref,
  recordsHref,
  recordsIndexHref,
} from '../hooks/useHashRoute'
import { flashYouRow } from '../lib/boardGap'
import { useDeviceType } from '../lib/device'
import { usePagedBoard } from '../hooks/usePagedBoard'
import { usePlayerName } from '../hooks/usePlayerName'
import { APP_NAME } from '../lib/brand'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import { resolveGameAccent } from '../lib/theme'
import {
  normalizePlayerName,
  PERIOD_LABELS,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import {
  fetchRecordBoard,
  formatRecordScore,
  type RecordBoardResult,
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
  period?: LeaderboardPeriod
}

/** Game record book (`/records/{game}`) or one record board (`…/{id}/{period}`). */
export function RecordsPage({
  game,
  recordId,
  period: periodFromRoute,
}: RecordsPageProps) {
  if (!recordId) {
    return (
      <GameRecordBookPage
        game={game}
        period={periodFromRoute ?? 'all'}
      />
    )
  }

  return (
    <RecordBoardPage
      game={game}
      recordId={recordId}
      period={periodFromRoute ?? 'all'}
    />
  )
}

function GameRecordBookPage({
  game,
  period,
}: {
  game: string
  period: LeaderboardPeriod
}) {
  const gameMeta = getGame(game)
  const device = useDeviceType()
  const accent = resolveGameAccent(game, gameMeta?.accent ?? '#2eb8a0')
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
              label={`${title} record books on ${APP_NAME} (${PERIOD_LABELS[period]}). Somebody's name is in ink.`}
              url={recordsHref(game, period)}
            />
          }
        />
        <div className="split">
          <div className="split__main">
            <GameRecordsPanel
              game={game}
              accent={accent}
              period={period}
              tools={
                <PeriodSwitcher
                  period={period}
                  accent={accent}
                  hrefFor={(p) => recordsHref(game, p)}
                  onSelect={(p) => {
                    navigate(recordsHref(game, p))
                  }}
                />
              }
            />
            {!canPlay ? (
              <p className="lb-device-note lb-device-note--footer" role="note">
                {deviceNote}
              </p>
            ) : null}
          </div>
          <aside className="split__side" aria-label="More">
            <BoardSideRail slug={game} accent={accent} period={period} canPlay={canPlay} mode="records" />
          </aside>
        </div>
      </div>
    </PageShell>
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
  const groupId = useActiveGroup()
  const board = usePagedBoard<LeaderboardEntry, RecordBoardResult>(
    (offset, limit) =>
      fetchRecordBoard(game, recordId, period, playerName || undefined, { offset, limit }),
    [game, recordId, period, playerName, groupId],
    { initial: INITIAL_ROWS },
  )
  const { entries, shown, loading, error } = board
  const record = board.first?.record ?? null
  const you = board.first?.you ?? null
  const pulsed = useRef(false)

  useEffect(() => {
    pulsed.current = false
  }, [game, recordId, period, playerName, groupId])

  useEffect(() => {
    if (loading || !you || pulsed.current) return
    pulsed.current = true
    window.requestAnimationFrame(() => flashYouRow())
  }, [loading, you, recordId, period])

  const accent = resolveGameAccent(game, gameMeta?.accent ?? '#2eb8a0')
  const unit = record?.unit ?? 'ms'
  const gameTitle = gameMeta?.name ?? game
  const device = useDeviceType()
  const canPlay = gameMeta ? gamePlayableOn(gameMeta, device) : false
  const deviceNote = gameMeta ? deviceRequirementLabel(gameMeta) : null

  const selectPeriod = (next: LeaderboardPeriod) => {
    navigate(recordHref(game, recordId, next))
  }

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
                  label={`${record?.label ?? 'Record'} on ${APP_NAME} (${PERIOD_LABELS[period]}). History doesn't forget.`}
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
                    label={`${record?.label ?? 'Record'} on ${APP_NAME} (${PERIOD_LABELS[period]}). History doesn't forget.`}
                    url={recordHref(game, recordId, period)}
                  />
                </div>
              </div>
            </header>
          )}

          <div className="split">
            <div className="split__main">
          <section
            key={`${recordId}-${period}`}
            className="lst-block lb-board--fade"
            aria-label={record?.label ?? 'Record board'}
          >
            <div className="lst-block__head">
              <h2 className="lst-block__title">{unit === 'ms' ? 'Fastest' : 'Best'}</h2>
              {!loading && !error && entries.length > 0 ? (
                <p className="lst-block__note">
                  {entries.length} {entries.length === 1 ? 'player' : 'players'}
                </p>
              ) : null}
              <div className="lst-block__tools">
                <PeriodSwitcher
                  period={period}
                  accent={accent}
                  hrefFor={(p) => recordHref(game, recordId, p)}
                  onSelect={selectPeriod}
                />
              </div>
            </div>
            {loading ? (
              <BoardSkeleton />
            ) : error ? (
              <BoardEmpty
                title="Couldn’t load this board"
                detail="Check your connection and try again."
              />
            ) : entries.length === 0 && !you ? (
              <BoardEmpty
                title={groupBoardEmptyTitle('No times yet')}
                detail={
                  groupId
                    ? undefined
                    : recordBoardEmptyDetail(
                        game,
                        gameTitle,
                        record?.label ?? 'this milestone',
                      )
                }
              />
            ) : (
              <LeaderboardList
                entries={entries}
                you={you}
                playerName={playerName}
                accent={accent}
                shown={shown}
                period={period}
                formatScore={(score) => formatRecordScore(score, unit, recordId)}
              />
            )}

            <BoardMore
              board={board}
              hidden={Boolean(loading || error || entries.length === 0)}
              unit="players"
            />

            {!canPlay && !(loading || error) ? (
              <p className="lb-device-note lb-device-note--footer" role="note">
                {deviceNote}
              </p>
            ) : null}
          </section>
            </div>
            <aside className="split__side" aria-label="More">
              <BoardSideRail slug={game} accent={accent} period={period} canPlay={canPlay} mode="records" />
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
