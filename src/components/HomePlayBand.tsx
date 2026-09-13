import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { dailyPick, newestSlug, playableHomeGames } from '../lib/homePicks'
import { resolveGameAccent } from '../lib/theme'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { useDeviceType } from '../lib/device'
import { useRecentGames } from '../lib/lastPlayed'
import { GameThumbArt } from './GameThumbArt'

/**
 * The one-click way in, directly under the header.
 *
 * Returning players get the game they last opened; everyone else gets the pick
 * of the day, so the band is never empty and never needs a decision first.
 */
export function HomePlayBand() {
  const device = useDeviceType()
  const recent = useRecentGames()
  const playableSlugs = playableHomeGames(device).map((g) => g.slug)
  const featured = newestSlug(device)

  const lastPlayed = recent.find((slug) => playableSlugs.includes(slug)) ?? null
  // With no history to offer back, avoid the title the grid already features.
  const slug =
    lastPlayed ?? dailyPick(playableSlugs.filter((s) => s !== featured)) ?? featured
  const best = usePersonalBest(slug ?? '')

  if (!slug) return null
  const game = getGame(slug)
  if (!game) return null

  const accent = resolveGameAccent(slug, game.accent)
  const alternative =
    playableSlugs.find((s) => s !== slug) ?? null

  return (
    <section
      className="home-play"
      style={{ '--game-accent': accent } as CSSProperties}
      aria-label={lastPlayed ? 'Pick up where you left off' : 'Play now'}
    >
      <a className="home-play__art" href={gamePlayHref(slug)} aria-hidden="true" tabIndex={-1}>
        <GameThumbArt slug={slug} accent={accent} />
      </a>
      <div className="home-play__body">
        <p className="home-play__kicker">
          {lastPlayed ? 'Pick up where you left off' : 'Today’s pick'}
        </p>
        <h2 className="home-play__name">{game.name}</h2>
        <p className="home-play__sub">
          {best > 0 ? `Your best ${best.toLocaleString()}` : game.description}
        </p>
      </div>
      <div className="home-play__actions">
        <a className="home-play__go" href={gamePlayHref(slug)}>
          {lastPlayed ? 'Play again' : 'Play'}
        </a>
        {alternative ? (
          <a className="home-play__alt" href={gamePlayHref(alternative)}>
            Something else
          </a>
        ) : null}
      </div>
    </section>
  )
}
