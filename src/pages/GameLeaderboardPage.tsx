import { useEffect, useRef, type CSSProperties } from 'react'
import { BoardEmpty, BoardMore, BoardSkeleton, PeriodSwitcher } from '../components/BoardChrome'
import { GamePageHeader } from '../components/GamePageHeader'
import { LeaderboardList } from '../components/LeaderboardList'
import { PageShell } from '../components/PageShell'
import { ShareBoardButton } from '../components/ShareBoardButton'
import { getGame, gamePlayableOn, deviceRequirementLabel } from '../data/games'
import {
  gameBoardHref,
  gamePlayHref,
  leaderboardHref,
  navigate,
} from '../hooks/useHashRoute'
import { usePagedBoard } from '../hooks/usePagedBoard'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType } from '../lib/device'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { flashYouRow } from '../lib/boardGap'
import { defaultPeriod } from '../lib/defaultPeriod'
import { APP_NAME } from '../lib/brand'
import { groupBoardEmptyTitle, useActiveGroup } from '../lib/groups'
import { resolveGameAccent } from '../lib/theme'
import {
  getLeaderboard,
  PERIOD_LABELS,
  normalizePlayerName,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type LeaderboardEntry,
} from '../lib/leaderboard'

const BOARD_ROWS = 10

type GameLeaderboardPageProps = {
  game: LeaderboardGame
  period?: LeaderboardPeriod
}

export function GameLeaderboardPage({
  game: gameSlug,
  period: periodFromRoute,
}: GameLeaderboardPageProps) {
  const period = periodFromRoute ?? defaultPeriod()
  const game = getGame(gameSlug)
  const device = useDeviceType()
  const playerName = normalizePlayerName(usePlayerName())
  const groupId = useActiveGroup()
  const board = usePagedBoard<LeaderboardEntry, Awaited<ReturnType<typeof getLeaderboard>>>(
    (offset, limit) =>
      getLeaderboard(gameSlug, period, playerName || undefined, { offset, limit }),
    [gameSlug, period, playerName, groupId],
    { initial: BOARD_ROWS },
  )
  const { entries, shown, total, loading, error } = board
  const you = board.first?.you ?? null
  const pulsed = useRef(false)

  const accent = resolveGameAccent(gameSlug, game?.accent ?? '#2eb8a0')
  const canPlay = game ? gamePlayableOn(game, device) : false
  const playHref = gamePlayHref(gameSlug)
  const deviceNote = game ? deviceRequirementLabel(game) : null

  useEffect(() => {
    pulsed.current = false
  }, [gameSlug, period, playerName, groupId])

  useEffect(() => {
    if (loading || !you || pulsed.current) return
    pulsed.current = true
    window.requestAnimationFrame(() => flashYouRow())
  }, [loading, you, period])

  const selectPeriod = (next: LeaderboardPeriod) => {
    navigate(gameBoardHref(gameSlug, next))
  }

  if (!game) {
    return (
      <PageShell>
        <p className="lb-empty">That game isn’t on the board.</p>
      </PageShell>
    )
  }

  return (
    <PageShell innerClassName="lb-page__inner lb-page__inner--game-board">
      <div
        style={
          {
            '--board-accent': accent,
            '--period-accent': accent,
          } as CSSProperties
        }
      >
        <GamePageHeader
          slug={gameSlug}
          accent={accent}
          title={`${game.name} Top Scores`}
          backHref={leaderboardHref()}
          backLabel="Back to Boards"
          playHref={canPlay ? playHref : undefined}
          action={
            <ShareBoardButton
              label={`${game.name} high scores on ${APP_NAME} (${PERIOD_LABELS[period]}). Your move.`}
              url={gameBoardHref(gameSlug, period)}
            />
          }
        />

        <section
          key={`${gameSlug}-${period}`}
          className="lst-block lb-board--fade"
          aria-label={`${game.name} leaderboard`}
        >
          <div className="lst-block__head">
            <h2 className="lst-block__title">Top scores</h2>
            {!loading && !error && total > 0 ? (
              /* Runs, not people: one player can hold several of these. */
              <p className="lst-block__note">
                {total.toLocaleString()} {total === 1 ? 'score' : 'scores'}
              </p>
            ) : null}
            <div className="lst-block__tools">
              <PeriodSwitcher
                period={period}
                accent={accent}
                hrefFor={(p) => gameBoardHref(gameSlug, p)}
                onSelect={selectPeriod}
              />
            </div>
          </div>
          {loading ? (
            <BoardSkeleton rows={BOARD_ROWS} />
          ) : error ? (
            <BoardEmpty
              title="Couldn’t load scores"
              detail="Check your connection and try again."
            />
          ) : entries.length === 0 && !you ? (
            <BoardEmpty
              title={groupBoardEmptyTitle('No scores yet')}
              detail={
                groupId
                  ? undefined
                  : canPlay
                    ? `Be the first on the ${game.name} board.`
                    : 'Open it on a supported device to post a score.'
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
              formatScore={(score) => formatLeaderboardScore(gameSlug, score)}
            />
          )}

          <BoardMore
            board={board}
            hidden={Boolean(loading || error || entries.length === 0)}
            unit="scores"
          />

          {!canPlay && !(loading || error) ? (
            <p className="lb-device-note lb-device-note--footer" role="note">
              {deviceNote} Scores still count toward global rank.
            </p>
          ) : null}
        </section>
      </div>
    </PageShell>
  )
}
