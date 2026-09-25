import type { CSSProperties } from 'react'
import { gamePlayableOn, getGame, type Game } from '../data/games'
import { gameBoardHref, gameHref, gamePlayHref, leaderboardHref } from '../hooks/useHashRoute'
import type { GameBest } from '../hooks/useProfileBoards'
import { useDeviceType } from '../lib/device'
import { hasGamePreview } from '../lib/gamePreviews'
import {
  VISIBLE_LEADERBOARD_GAMES,
  type GlobalGamePlace,
  type LeaderboardGame,
  type LeaderboardPeriod,
} from '../lib/leaderboard'
import { ordinal, periodWord, scoreWithUnit } from '../lib/profileMath'
import { resolveGameAccent } from '../lib/theme'
import { GameArt } from './GameArt'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'

/** The short name of a period, for the cabinet's line: WEEK, MONTH, ALL. */
const PERIOD_TAG: Record<LeaderboardPeriod, string> = {
  daily: 'TODAY',
  weekly: 'WEEK',
  monthly: 'MONTH',
  all: 'ALL',
}

function Cabinet({
  game,
  period,
  place,
  best,
  bestsLoading,
}: {
  game: Game
  period: LeaderboardPeriod
  /** Where the player is on the game's board this period; null when they have no run on it this period. */
  place: GlobalGamePlace | null
  best: GameBest | null
  bestsLoading: boolean
}) {
  const accent = resolveGameAccent(game.slug, game.accent)
  const style = { '--tile-accent': accent } as CSSProperties
  const flag = best
    ? best.rank <= 3
      ? { text: `${ordinal(best.rank)} all time`, tone: best.rank === 1 ? 'gold' : best.rank === 2 ? 'silver' : 'bronze' }
      : best.rank <= 10
        ? { text: 'Top 10 all time', tone: 'ten' }
        : null
    : null
  const word = periodWord(period)
  const label = [
    game.name,
    place
      ? `${ordinal(place.place)}${place.total ? ` of ${place.total}` : ''} ${word}, ${place.points} points`
      : `no run ${word}`,
    best ? `best run ${scoreWithUnit(game.slug, best.score)}, ${ordinal(best.rank)} of ${best.total} all time` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <li className="wall__cell">
      <a
        className={`wall-tile pgame${place ? '' : ' pgame--idle'}`}
        href={gameBoardHref(game.slug as LeaderboardGame, period)}
        style={style}
        aria-label={label}
      >
        <span className="wall-tile__screen">
          <span className="wall-tile__art" aria-hidden="true">
            <GameArt slug={game.slug} shape="card" fallback={<GameThumbArt slug={game.slug} accent={accent} />} />
          </span>
          {hasGamePreview(game.slug) ? <GamePreview slug={game.slug} className="wall-tile__preview" hoverOnly /> : null}
          {flag ? (
            <span className={`pbest__flag pbest__flag--${flag.tone} pgame__flag`} aria-hidden="true">
              {flag.text}
            </span>
          ) : null}
        </span>
        <span className="pgame__info" aria-hidden="true">
          <span className="pgame__title">
            <span className="pgame__name">{game.name}</span>
            {place ? (
              <span className="pgame__place">
                <b className={place.place <= 3 ? `pgame__medal pgame__medal--${place.place}` : undefined}>#{place.place}</b>
                {place.total ? ` of ${place.total}` : ''}
              </span>
            ) : null}
          </span>
          <span className="pgame__line">
            <span className="pgame__tag">{PERIOD_TAG[period]}</span>
            {place ? (
              <>
                <span className="pgame__figure">{place.points} pts</span>
                <span className="pgame__bar">
                  <span style={{ width: `${Math.min(100, place.points)}%` }} />
                </span>
              </>
            ) : (
              <span className="pgame__none">No run {word}</span>
            )}
          </span>
          <span className="pgame__line">
            <span className="pgame__tag">BEST</span>
            {best ? (
              <>
                <span className="pgame__figure">{scoreWithUnit(game.slug, best.score)}</span>
                <span className="pgame__of">
                  {ordinal(best.rank)} of {best.total.toLocaleString()}
                </span>
              </>
            ) : bestsLoading ? (
              <span className="skel-line pgame__skel" />
            ) : (
              <span className="pgame__none">—</span>
            )}
          </span>
        </span>
      </a>
    </li>
  )
}

/**
 * The player's games as cabinets, like the home wall's: each one's screen,
 * where they placed on it this period and for how many points, and their best
 * run on it ever, with where that stands. Games played before but not this
 * period stand after them, quieter. Every game never played goes in a panel
 * underneath, as what it is: up to a hundred more points each.
 */
export function ProfileGames({
  name,
  isSelf,
  period,
  byGame,
  everPlayed,
  bests,
  quickest,
  progressHref,
}: {
  name: string
  isSelf: boolean
  period: LeaderboardPeriod
  /** This period's places. */
  byGame: Partial<Record<string, GlobalGamePlace>>
  /** Every game the player has ever placed on, from the all-time rank; null while it loads. */
  everPlayed: Set<string> | null
  bests: Record<string, GameBest> | null
  /** Tell the unplayed games as the player's quickest points, as it is for anyone outside the top ten. */
  quickest: boolean
  /** On your own card: your stats, where each game's progress is. */
  progressHref?: string
}) {
  const device = useDeviceType()
  const word = periodWord(period)
  const games = VISIBLE_LEADERBOARD_GAMES.map((slug) => getGame(slug)).filter((g): g is Game => Boolean(g))
  const placed = games
    .filter((g) => byGame[g.slug])
    .sort((a, b) => (byGame[b.slug]?.points ?? 0) - (byGame[a.slug]?.points ?? 0) || (byGame[a.slug]?.place ?? 0) - (byGame[b.slug]?.place ?? 0))
  const earlier = everPlayed ? games.filter((g) => !byGame[g.slug] && everPlayed.has(g.slug)) : []
  const never = everPlayed ? games.filter((g) => !byGame[g.slug] && !everPlayed.has(g.slug)) : []
  const shown = [...placed, ...earlier]
  const bestsLoading = bests === null

  return (
    <section className="pgames" aria-labelledby="pgames-title" id="games">
      <div className="pgames__bar">
        <h2 className="pgames__title" id="pgames-title">
          Games
        </h2>
        <span className="pgames__count">
          {placed.length === 0 ? `None placed ${word}` : `${placed.length} placed ${word}`}
          {earlier.length > 0 ? `, ${earlier.length} played before` : ''}
          {shown.length > 0 ? ' · the best run on each, all time' : ''}
        </span>
        {progressHref && shown.length > 0 ? (
          <a className="pgames__progress" href={progressHref}>
            Your progress on each ›
          </a>
        ) : null}
        <a className="pgames__all" href={leaderboardHref(period)}>
          All boards ›
        </a>
      </div>
      {shown.length > 0 ? (
        <ul className="wall__grid pgames__grid">
          {shown.map((g) => (
            <Cabinet
              key={g.slug}
              game={g}
              period={period}
              place={byGame[g.slug] ?? null}
              best={bests?.[g.slug] ?? null}
              bestsLoading={bestsLoading}
            />
          ))}
        </ul>
      ) : null}
      {never.length > 0 ? (
        <div className={`pgames__todo${quickest ? ' pgames__todo--quick' : ''}`} id="quick">
          <div className="pgames__todo-head">
            <h3 className="pgames__todo-title">{quickest ? 'Your quickest points' : 'Not played yet'}</h3>
            <p className="pgames__todo-note">
              {isSelf
                ? `Each game you place on ${period === 'all' ? '' : `${word} `}adds up to 100 points. A run in the middle of its board is worth about 50.`
                : `${never.length} ${never.length === 1 ? 'game' : 'games'} ${name} hasn’t posted a score on yet.`}
            </p>
          </div>
          <ul className="pgames__todo-list">
            {never.map((g) => {
              const accent = resolveGameAccent(g.slug, g.accent)
              const here = gamePlayableOn(g, device)
              return (
                <li key={g.slug}>
                  <a
                    className={`pgames__try${here ? '' : ' pgames__try--elsewhere'}`}
                    href={isSelf ? gamePlayHref(g.slug) : gameHref(g.slug)}
                    style={{ '--tile-accent': accent } as CSSProperties}
                  >
                    <GameThumbArt slug={g.slug} accent={accent} />
                    <span className="pgames__try-name">{g.name}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
