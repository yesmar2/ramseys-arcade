import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import { BoardTrail } from '../components/BoardTrail'
import { GamePageHeader } from '../components/GamePageHeader'
import { LeaderboardList } from '../components/LeaderboardList'
import { PageShell } from '../components/PageShell'
import { getGame, gamePlayableOn, deviceRequirementLabel } from '../data/games'
import {
  gameBoardHref,
  gameHref,
  gamePlayHref,
} from '../hooks/useHashRoute'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType } from '../lib/device'
import { flashYouRow } from '../lib/boardGap'
import {
  getLeaderboard,
  normalizePlayerName,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type LeaderboardEntry,
  type YouEntry,
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
  const period = periodFromRoute ?? 'daily'
  const game = getGame(gameSlug)
  const device = useDeviceType()
  const playerName = normalizePlayerName(usePlayerName())
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(BOARD_ROWS)
  const pulsed = useRef(false)

  const accent = game?.accent ?? '#2eb8a0'
  const canPlay = game ? gamePlayableOn(game, device) : false
  const playHref = gamePlayHref(gameSlug)
  const deviceNote = game ? deviceRequirementLabel(game) : null

  useEffect(() => {
    const canonical = gameBoardHref(gameSlug, period)
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical)
    }
  }, [gameSlug, period])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShown(BOARD_ROWS)
    pulsed.current = false
    getLeaderboard(gameSlug, period, playerName || undefined)
      .then((board) => {
        if (cancelled) return
        setEntries(board.entries)
        setYou(board.you)
      })
      .catch((err) => {
        if (cancelled) return
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
  }, [gameSlug, period, playerName])

  useEffect(() => {
    if (loading || !you || pulsed.current) return
    pulsed.current = true
    window.requestAnimationFrame(() => flashYouRow())
  }, [loading, you, period])

  const selectPeriod = (next: LeaderboardPeriod) => {
    window.location.hash = gameBoardHref(gameSlug, next)
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
        <BoardTrail game={gameSlug} period={period} />

        <GamePageHeader
          slug={gameSlug}
          accent={accent}
          title={game.name}
          href={gameHref(gameSlug)}
        />

        <PeriodSwitcher
          period={period}
          accent={accent}
          hrefFor={(p) => gameBoardHref(gameSlug, p)}
          onSelect={selectPeriod}
        />

        <section
          key={`${gameSlug}-${period}`}
          className="lb-board lb-board--fade"
          aria-label={`${game.name} leaderboard`}
        >
          {loading ? (
            <BoardSkeleton rows={BOARD_ROWS} />
          ) : error ? (
            <BoardEmpty
              title="Couldn’t load scores"
              detail="Check your connection and try again."
            />
          ) : entries.length === 0 && !you ? (
            <BoardEmpty
              title="No scores yet"
              detail={
                canPlay
                  ? `Be the first on the ${game.name} board.`
                  : 'Open it on a supported device to post a score.'
              }
              action={
                canPlay ? (
                  <a
                    className="lb-empty-state__btn"
                    href={playHref}
                    style={{ background: accent }}
                  >
                    Play {game.name}
                  </a>
                ) : null
              }
            />
          ) : (
            <LeaderboardList
              entries={entries}
              you={you}
              playerName={playerName}
              accent={accent}
              shown={shown}
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

          {canPlay && !(loading || error) && (entries.length > 0 || you) ? (
            <a className="lb-play" href={playHref} style={{ background: accent }}>
              Play {game.name}
            </a>
          ) : !canPlay && !(loading || error) ? (
            <p className="lb-device-note lb-device-note--footer" role="note">
              {deviceNote} Scores still count toward global rank.
            </p>
          ) : null}
        </section>
      </div>
    </PageShell>
  )
}
