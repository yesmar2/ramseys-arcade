import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  BoardEmpty,
  BoardSkeleton,
  PeriodSwitcher,
} from '../components/BoardChrome'
import { SiteHeader } from '../components/SiteHeader'
import { Footer } from '../components/Footer'
import { GameLobbyArt } from '../components/GameLobbyArt'
import {
  GameBoardSwitcher,
  type BoardTab,
} from '../components/GameBoardSwitcher'
import { GameRecordsPanel } from '../components/GameRecordsPanel'
import { LeaderboardList } from '../components/LeaderboardList'
import {
  deviceRequirementLabel,
  getGame,
  gamePlayableOn,
} from '../data/games'
import { scoringFor } from '../data/scoring'
import { useBoardRecord } from '../hooks/useBoardRecord'
import {
  gameHref,
  gamePlayHref,
} from '../hooks/useHashRoute'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType } from '../lib/device'
import { flashYouRow } from '../lib/boardGap'
import { gameHasRecords } from '../lib/records'
import { ScoreGuide } from '../components/ScoreGuide'
import {
  getLeaderboard,
  LEADERBOARD_GAMES,
  normalizePlayerName,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type LeaderboardEntry,
  type YouEntry,
} from '../lib/leaderboard'

const BOARD_ROWS = 10

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

type GameHubPageProps = {
  slug: string
  board?: BoardTab
}

export function GameHubPage({ slug, board: boardFromRoute }: GameHubPageProps) {
  const game = getGame(slug)
  const device = useDeviceType()
  const playerName = normalizePlayerName(usePlayerName())
  const personalBest = usePersonalBest(slug)
  const allTime = useBoardRecord(slug)
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily')
  const [boardTab, setBoardTab] = useState<BoardTab>(
    boardFromRoute === 'records' ? 'records' : 'scores',
  )
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState(BOARD_ROWS)
  const pulsed = useRef(false)

  const canPlay = game ? gamePlayableOn(game, device) : false
  const comingSoon = Boolean(game?.comingSoon)
  const inDevelopment = Boolean(game?.inDevelopment)
  const scoring = scoringFor(slug)
  const boardSlug: LeaderboardGame | null = isBoardGame(slug) ? slug : null
  const accent = game?.accent ?? '#2eb8a0'
  const playHref = gamePlayHref(slug)
  const deviceNote = game ? deviceRequirementLabel(game) : null
  const showRecords = Boolean(boardSlug && gameHasRecords(boardSlug))
  const activeTab: BoardTab =
    showRecords && boardTab === 'records' ? 'records' : 'scores'

  useEffect(() => {
    setBoardTab(boardFromRoute === 'records' ? 'records' : 'scores')
  }, [boardFromRoute, slug])

  useEffect(() => {
    if (!boardSlug || !showRecords) return
    const canonical = gameHref(boardSlug, activeTab)
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical)
    }
  }, [boardSlug, showRecords, activeTab])

  useEffect(() => {
    if (!boardSlug || activeTab !== 'scores') {
      if (!boardSlug) {
        setEntries([])
        setYou(null)
        setLoading(false)
        setError(null)
      }
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setShown(BOARD_ROWS)
    pulsed.current = false
    getLeaderboard(boardSlug, period, playerName || undefined)
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
  }, [boardSlug, period, playerName, activeTab])

  useEffect(() => {
    if (activeTab !== 'scores' || loading || !you || pulsed.current) return
    pulsed.current = true
    window.requestAnimationFrame(() => flashYouRow())
  }, [loading, you, period, activeTab])

  const selectBoardTab = (tab: BoardTab) => {
    setBoardTab(tab)
  }

  if (!game) {
    return (
      <>
        <main className="lb-page">
          <SiteHeader />
          <div className="lb-page__inner">
            <p className="lb-empty">That game isn’t on the board.</p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <main className="lb-page">
        <SiteHeader />
        <div
          className="lb-page__inner game-lobby"
          style={
            {
              '--board-accent': accent,
              '--period-accent': accent,
            } as CSSProperties
          }
        >
          <GameLobbyArt slug={game.slug} accent={game.accent} />

          <header className="game-lobby__header">
            <h1 className="game-lobby__title">{game.name}</h1>
            <p className="game-lobby__blurb">{game.description}</p>
          </header>

          <div className="game-lobby__stats">
            <div className="lb-stat">
              <span className="lb-stat__label">Your best</span>
              <strong>{personalBest > 0 ? personalBest : '—'}</strong>
            </div>
            <div className="lb-stat">
              <span className="lb-stat__label">All time</span>
              <strong>{allTime > 0 ? allTime : '—'}</strong>
            </div>
          </div>

          {inDevelopment ? (
            <p className="game-lobby__unavailable">In development — not ready to play yet.</p>
          ) : comingSoon ? (
            <p className="game-lobby__unavailable">Coming soon — tile preview only.</p>
          ) : canPlay ? (
            <a
              className="lb-play game-lobby__play"
              href={playHref}
              style={{ background: game.accent }}
            >
              Play {game.name}
            </a>
          ) : (
            <p className="game-lobby__unavailable">
              {deviceNote ?? `${game.name} isn’t available on this device.`}
            </p>
          )}

          {boardSlug ? (
            <>
              <GameBoardSwitcher
                slug={boardSlug}
                accent={accent}
                active={activeTab}
                onSelect={selectBoardTab}
              />

              {activeTab === 'records' ? (
                <GameRecordsPanel game={boardSlug} accent={accent} />
              ) : (
                <>
                  <PeriodSwitcher
                    period={period}
                    accent={accent}
                    onSelect={setPeriod}
                  />

                  <section
                    key={`${boardSlug}-${period}`}
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

                    {canPlay &&
                    !(loading || error) &&
                    (entries.length > 0 || you) ? (
                      <a
                        className="lb-play"
                        href={playHref}
                        style={{ background: accent }}
                      >
                        Play {game.name}
                      </a>
                    ) : !canPlay && !(loading || error) ? (
                      <p
                        className="lb-device-note lb-device-note--footer"
                        role="note"
                      >
                        {deviceNote} Scores still count toward global rank.
                      </p>
                    ) : null}
                  </section>
                </>
              )}
            </>
          ) : null}

          <ScoreGuide
            how={game.how}
            rows={canPlay ? scoring : null}
            trigger="summary"
          />
        </div>
      </main>
      <Footer />
    </>
  )
}
