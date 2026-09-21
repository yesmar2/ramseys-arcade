import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gameBoardHref, gameHref, gamePlayHref, recordsHref } from '../hooks/useHashRoute'
import {
  LEADERBOARD_GAMES,
  VISIBLE_LEADERBOARD_GAMES,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { GAMES_WITH_RECORDS, gameHasRecords } from '../lib/records'
import { resolveGameAccent } from '../lib/theme'
import { GameThumbArt } from './GameThumbArt'

type BoardSideRailProps = {
  slug: string
  accent: string
  period: LeaderboardPeriod
  canPlay: boolean
  /** Which family of boards this page is in, so the list below offers the rest of that family. */
  mode: 'board' | 'records'
}

function isBoardGame(slug: string): slug is LeaderboardGame {
  return (LEADERBOARD_GAMES as readonly string[]).includes(slug)
}

/**
 * The side rail beside a board: the game the board belongs to, with a way to
 * play it and to its other pages, then the rest of the boards in the same
 * family, so a wide screen carries the way onward instead of a wider list.
 */
export function BoardSideRail({ slug, accent, period, canPlay, mode }: BoardSideRailProps) {
  const game = getGame(slug)
  if (!game) return null
  const others: readonly string[] =
    mode === 'board'
      ? VISIBLE_LEADERBOARD_GAMES.filter((g) => g !== slug)
      : GAMES_WITH_RECORDS.filter((g) => g !== slug)

  return (
    <>
      <section className="side-card" aria-label={game.name}>
        <div className="side-card__top">
          <GameThumbArt slug={slug} accent={accent} />
          <div className="side-card__text">
            <p className="side-card__name">{game.name}</p>
            <p className="side-card__desc">{game.description}</p>
          </div>
        </div>
        <div className="side-card__acts">
          {canPlay ? (
            <a className="side-card__cta" href={gamePlayHref(slug)}>
              Play
            </a>
          ) : null}
          <a className="side-card__link" href={gameHref(slug)}>
            Game page
          </a>
          {mode === 'board' && gameHasRecords(slug) ? (
            <a className="side-card__link" href={recordsHref(slug, period)}>
              Record books
            </a>
          ) : null}
          {mode === 'records' && isBoardGame(slug) ? (
            <a className="side-card__link" href={gameBoardHref(slug, period)}>
              Top scores
            </a>
          ) : null}
        </div>
      </section>

      {others.length > 0 ? (
        <section className="side-list" aria-label={mode === 'board' ? 'More boards' : 'More record books'}>
          <h2 className="side-list__head">{mode === 'board' ? 'More boards' : 'More record books'}</h2>
          <ul className="side-list__items">
            {others.map((g) => {
              const meta = getGame(g)
              if (!meta) return null
              const a = resolveGameAccent(g, meta.accent)
              const href = mode === 'board' && isBoardGame(g) ? gameBoardHref(g, period) : recordsHref(g, period)
              return (
                <li key={g}>
                  <a href={href} style={{ '--thumb-accent': a } as CSSProperties}>
                    <GameThumbArt slug={g} accent={a} />
                    <span>{meta.name}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </>
  )
}
