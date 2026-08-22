import { useEffect, useState, type CSSProperties } from 'react'
import { PeriodSwitcher } from '../components/BoardChrome'
import { Footer } from '../components/Footer'
import { GameTileArt } from '../components/GameTileArt'
import { HomeBar } from '../components/HomeBar'
import { LeaderboardList } from '../components/LeaderboardList'
import {
  deviceRequirementLabel,
  getGame,
  gamePlayableOn,
} from '../data/games'
import { scoringFor } from '../data/scoring'
import { useBoardRecord } from '../hooks/useBoardRecord'
import { gamePlayHref, leaderboardHref, recordsHref } from '../hooks/useHashRoute'
import { gameHasRecords } from '../lib/records'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { usePlayerName } from '../hooks/usePlayerName'
import { useDeviceType } from '../lib/device'
import {
  getLeaderboard,
  LEADERBOARD_GAMES,
  PERIOD_LABELS,
  type LeaderboardEntry,
  type LeaderboardGame,
  type LeaderboardPeriod,
  type YouEntry,
} from '../lib/leaderboard'

const PREVIEW_ROWS = 8

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

export function GamePreviewPage({ slug }: { slug: string }) {
  const game = getGame(slug)
  const device = useDeviceType()
  const playerName = usePlayerName().trim().toUpperCase()
  const personalBest = usePersonalBest(slug)
  const allTime = useBoardRecord(slug)
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [you, setYou] = useState<YouEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canPlay = game ? gamePlayableOn(game, device) : false
  const comingSoon = Boolean(game?.comingSoon)
  const scoring = scoringFor(slug)
  const boardSlug: LeaderboardGame | null = isBoardGame(slug) ? slug : null

  useEffect(() => {
    if (!boardSlug) {
      setEntries([])
      setYou(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
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
  }, [boardSlug, period, playerName])

  if (!game) {
    return (
      <>
        <main className="lb-page">
          <HomeBar />
          <div className="lb-page__inner">
            <p className="lb-empty">That game isn’t on the board.</p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const playHref = gamePlayHref(slug)
  const deviceNote = deviceRequirementLabel(game)

  return (
    <>
      <main className="lb-page">
        <HomeBar />
        <div className="lb-page__inner game-lobby">
          <div
            className="game-lobby__art"
            style={{ '--tile-accent': game.accent } as CSSProperties}
          >
            <div className="game-lobby__stage">
              <GameTileArt slug={game.slug} />
            </div>
          </div>

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

          {comingSoon ? (
            <p className="game-lobby__unavailable">Coming soon — tile preview only.</p>
          ) : canPlay ? (
            <a
              className="lb-play game-lobby__play"
              href={playHref}
              style={{ background: game.accent }}
            >
              Play
            </a>
          ) : (
            <p className="game-lobby__unavailable">
              {deviceNote ?? `${game.name} isn’t available on this device.`}
            </p>
          )}

          {boardSlug ? (
            <>
              <PeriodSwitcher
                period={period}
                accent={game.accent}
                onSelect={setPeriod}
              />
              <section
                key={period}
                className="lb-board lb-board--fade"
                aria-label={`${game.name} leaderboard`}
              >
                {loading ? (
                  <p className="lb-empty">Loading scores…</p>
                ) : error ? (
                  <p className="lb-empty">
                    Couldn’t load scores. Is the API running?
                  </p>
                ) : entries.length === 0 && !you ? (
                  <p className="lb-empty">
                    No scores for {PERIOD_LABELS[period].toLowerCase()} yet.
                    {canPlay ? ' Play to claim the top spot.' : ''}
                  </p>
                ) : (
                  <LeaderboardList
                    entries={entries}
                    you={you}
                    playerName={playerName}
                    accent={game.accent}
                    shown={PREVIEW_ROWS}
                  />
                )}

                <a className="game-lobby__all-boards" href={leaderboardHref(boardSlug)}>
                  Full leaderboards
                </a>
                {gameHasRecords(boardSlug) ? (
                  <a className="game-lobby__all-boards" href={recordsHref(boardSlug)}>
                    Record books
                  </a>
                ) : null}
              </section>
            </>
          ) : null}

          <section className="game-lobby__section" aria-labelledby="game-how-heading">
            <h2 id="game-how-heading" className="game-lobby__h">
              How to play
            </h2>
            <p className="game-lobby__how">{game.how}</p>
            {scoring && scoring.length > 0 ? (
              <ul className="game-lobby__scoring">
                {scoring.map((row) => (
                  <li key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
