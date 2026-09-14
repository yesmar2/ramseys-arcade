import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { useDeviceType } from '../lib/device'
import { heroSlug, newestSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { GameThumbArt } from './GameThumbArt'
import { resolveGameAccent } from '../lib/theme'

/**
 * The single "what should I play" slot.
 *
 * Built as an oversized game tile rather than a card: the rest of this page is
 * pastel art panels sitting straight on the page gradient, so a white slab with
 * a shadow reads as imported from somewhere else.
 */
export function HomeHero() {
  const device = useDeviceType()
  const recent = useRecentGames()
  const newest = newestSlug(device)
  const slug = heroSlug(device, recent)
  const best = usePersonalBest(slug ?? '')
  const lastPlayed = slug != null && recent.includes(slug)

  if (!slug) return null
  const game = getGame(slug)
  if (!game) return null

  const accent = resolveGameAccent(slug, game.accent)
  const isNew = !lastPlayed && slug === newest

  return (
    <section
      className="home-hero"
      style={{ '--hero-accent': accent, '--thumb-accent': accent } as CSSProperties}
      aria-label="Play"
    >
      <a className="home-hero__art" href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
        <GameThumbArt slug={slug} accent={accent} />
      </a>
      <div className="home-hero__text">
        <p className="home-hero__kicker">
          {lastPlayed ? 'Jump back in' : isNew ? 'New in the arcade' : 'Today’s pick'}
        </p>
        <h2 className="home-hero__name">
          <a href={gamePlayHref(slug)}>{game.name}</a>
        </h2>
        <p className="home-hero__sub">
          {best > 0 ? `Your best ${best.toLocaleString()}` : game.description}
        </p>
      </div>
      <a className="home-hero__go" href={gamePlayHref(slug)}>
        Play
      </a>
    </section>
  )
}
