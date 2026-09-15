import { useMemo, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameBoardHref, gamePlayHref } from '../hooks/useHashRoute'
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import {
  normalizePlayerName,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_GAMES,
  type GameBoardPreview,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { resolveGameAccent } from '../lib/theme'
import { GameThumbArt } from './GameThumbArt'
import { PodiumMedal, medalKind } from './PodiumMedal'

type BoardsGameIndexProps = {
  games: GameBoardPreview[]
  loading?: boolean
  playerName?: string
  period: LeaderboardPeriod
}

/**
 * One card per game with its top three inside — the same card a running
 * event gets on the events list, so the two indexes read the same way.
 */
export function BoardsGameIndex({
  games,
  loading,
  playerName = '',
  period,
}: BoardsGameIndexProps) {
  const sorted = useMemo(
    () =>
      [...games].sort((a, b) => {
        const nameA = getGame(a.slug)?.name ?? a.slug
        const nameB = getGame(b.slug)?.name ?? b.slug
        return nameA.localeCompare(nameB)
      }),
    [games],
  )
  const youName = normalizePlayerName(playerName)

  if (loading) {
    return (
      <ul className="evl__grid" aria-busy="true">
        {VISIBLE_LEADERBOARD_GAMES.map((slug) => (
          <li key={slug}>
            <div className="evc evc--skel" />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="evl__grid">
      {sorted.map(({ slug, entries }) => {
        const game = getGame(slug)
        if (!game || game.hidden) return null
        const accent = resolveGameAccent(slug, game.accent)
        const top = entries.slice(0, 3)
        const yours = top.some((e) => normalizePlayerName(e.name ?? '') === youName)
        return (
          <li key={slug}>
            <a
              className="evc"
              href={top.length ? gameBoardHref(slug, period) : gamePlayHref(slug)}
              style={{ '--event-accent': accent } as CSSProperties}
            >
              <span className="ev-art ev-art--solo evc__art" aria-hidden="true">
                <GameThumbArt slug={slug} accent={accent} />
              </span>
              <span className="evc__body">
                <span className="ev-kicker evc__kicker">
                  <span className="ev-kicker__bit">Top scores</span>
                  <span className="ev-kicker__bit">{PERIOD_LABELS[period]}</span>
                  {yours ? <span className="ev-kicker__bit ev-kicker__joined">You’re up</span> : null}
                </span>
                <span className="evc__title">{game.name}</span>
                {top.length ? (
                  <ol className="evc__leaders">
                    {top.map((entry, i) => {
                      const place = i + 1
                      const medal = medalKind(place)
                      const name = normalizePlayerName(entry.name ?? '')
                      return (
                        <li key={entry.id} className={`evc__leader evc__leader--${place}`}>
                          <span className="evc__pos">
                            {medal ? <PodiumMedal kind={medal} period={period} size="sm" /> : place}
                          </span>
                          <span className="evc__who">{name}</span>
                          <span className="evc__val">{formatLeaderboardScore(slug, entry.score)}</span>
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <span className="evc__empty">No scores yet — be first on the board</span>
                )}
              </span>
              <span className="evc__foot">
                <span className="evc__players">
                  {top.length ? 'Tap for the full board' : 'Nobody has played yet'}
                </span>
                <span className="evc__go">{top.length ? 'Board' : 'Play'}</span>
              </span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
