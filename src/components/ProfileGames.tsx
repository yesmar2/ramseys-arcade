import type { CSSProperties } from 'react'
import { gamePlayableOn, getGame, isDailyGame, type Game } from '../data/games'
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
import { formatLeaderboardScore } from '../lib/leaderboardFormat'
import { ordinal, periodWord } from '../lib/profileMath'
import { resolveGameAccent } from '../lib/theme'
import { GameArt } from './GameArt'
import { GamePreview } from './GamePreview'
import { GameThumbArt } from './GameThumbArt'

/** The period after a cabinet's place, cut short on a phone: #3 week. */
const PERIOD_SHORT: Record<LeaderboardPeriod, string> = {
  daily: 'today',
  weekly: 'week',
  monthly: 'month',
  all: 'all time',
}

function Cabinet({
  game,
  period,
  place,
  allTime,
  allTimeLoading,
  best,
  bestsLoading,
}: {
  game: Game
  period: LeaderboardPeriod
  /** Where the player is on the game's board this period; null when they have no run on it this period. */
  place: GlobalGamePlace | null
  /** Where the player is on the game's all-time board, among players. */
  allTime: GlobalGamePlace | null
  allTimeLoading: boolean
  best: GameBest | null
  bestsLoading: boolean
}) {
  const accent = resolveGameAccent(game.slug, game.accent)
  const style = { '--tile-accent': accent } as CSSProperties
  const word = periodWord(period)
  // A daily's all-time board is its day points, a row per player, so it says only the place (leaderboardFormat isDayPointsBoard).
  const daily = isDailyGame(game.slug)
  // The player's place among players. A best run's rank counts every run, other players' second-bests too, so it reads lower.
  const allPlace = allTime?.place ?? (daily ? (best?.rank ?? null) : null)
  const flag =
    allPlace == null
      ? null
      : allPlace <= 3
        ? { text: `${ordinal(allPlace)} all time`, tone: allPlace === 1 ? 'gold' : allPlace === 2 ? 'silver' : 'bronze' }
        : allPlace <= 10
          ? { text: 'Top 10 all time', tone: 'ten' }
          : null
  // Looking at all time, the place beside the name is already the all-time one.
  const allTimeShown = period === 'all' ? null : allPlace
  const label = [
    game.name,
    place ? `${ordinal(place.place)} ${word}` : `no run ${word}`,
    daily
      ? allTimeShown != null
        ? `${ordinal(allTimeShown)} all time`
        : null
      : best
        ? `best run ${formatLeaderboardScore(game.slug, best.score)}${allTimeShown != null ? `, ${ordinal(allTimeShown)} all time` : ''}`
        : null,
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
                <span className="pgame__when"> {word}</span>
                <span className="pgame__when pgame__when--short"> {PERIOD_SHORT[period]}</span>
              </span>
            ) : (
              <span className="pgame__place">
                No run<span className="pgame__when"> {word}</span>
              </span>
            )}
          </span>
          {daily ? (
            // All time is the place beside the name already.
            period === 'all' ? null : (
              <span className="pgame__line">
                <span className="pgame__tag">ALL TIME</span>
                {allPlace != null ? (
                  <span className="pgame__figure">{ordinal(allPlace)}</span>
                ) : allTimeLoading ? (
                  <span className="skel-line pgame__skel" />
                ) : (
                  <span className="pgame__none">—</span>
                )}
              </span>
            )
          ) : (
            <span className="pgame__line">
              <span className="pgame__tag">BEST</span>
              {best ? (
                <>
                  <span className="pgame__figure">{formatLeaderboardScore(game.slug, best.score)}</span>
                  {allTimeShown != null ? <span className="pgame__of">· {ordinal(allTimeShown)} all time</span> : null}
                </>
              ) : bestsLoading ? (
                <span className="skel-line pgame__skel" />
              ) : (
                <span className="pgame__none">—</span>
              )}
            </span>
          )}
        </span>
      </a>
    </li>
  )
}

/**
 * The player's games as cabinets, like the home wall's: each one's screen,
 * their place on it this period, and their best run on it ever, with their
 * place all time. Games played before but not this period stand after them,
 * quieter. Every game never played goes in a panel underneath, as the next
 * ones to try.
 */
export function ProfileGames({
  name,
  isSelf,
  period,
  byGame,
  allTimeByGame,
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
  /** All-time places, among players; null while they load. */
  allTimeByGame: Partial<Record<string, GlobalGamePlace>> | null
  /** Every game the player has ever placed on, from the all-time rank; null while it loads. */
  everPlayed: Set<string> | null
  bests: Record<string, GameBest> | null
  /** Put the unplayed games first as the ones to try next, as it is for anyone outside the top ten. */
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
          {placed.length === 0 ? `None played ${word}` : `${placed.length} played ${word}`}
          {earlier.length > 0 ? `, ${earlier.length} before` : ''}
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
              allTime={allTimeByGame?.[g.slug] ?? null}
              allTimeLoading={allTimeByGame === null}
              best={bests?.[g.slug] ?? null}
              bestsLoading={bestsLoading}
            />
          ))}
        </ul>
      ) : null}
      {never.length > 0 ? (
        <div className={`pgames__todo${quickest ? ' pgames__todo--quick' : ''}`} id="quick">
          <div className="pgames__todo-head">
            <h3 className="pgames__todo-title">{quickest ? 'Try these next' : 'Not played yet'}</h3>
            <p className="pgames__todo-note">
              {isSelf
                ? 'Every new game you play moves you up.'
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
