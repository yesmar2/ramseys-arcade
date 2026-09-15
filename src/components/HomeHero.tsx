import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { useDeviceType } from '../lib/device'
import { heroSlug, newestSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { EventArt } from './EventCard'
import { resolveGameAccent } from '../lib/theme'

/**
 * The single "what should I play" slot.
 *
 * The same hero every other page opens with — tinted from the game's colour,
 * art on the left, a kicker, the name, a line about it, and Play — so the
 * home page reads as the front door to the same building.
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
  const kicker = lastPlayed ? 'Jump back in' : isNew ? 'New in the arcade' : 'Today’s pick'

  return (
    <section
      className="hero home-hero"
      style={{ '--hero-accent': accent, '--thumb-accent': accent } as CSSProperties}
      aria-label="Play"
    >
      <div className="hero__main">
        <a className="hero__art home-hero__art" href={gamePlayHref(slug)} tabIndex={-1} aria-hidden="true">
          <EventArt games={[slug]} />
        </a>
        <div className="hero__text">
          <p className="ev-kicker hero__kicker">
            <span className="ev-kicker__bit">{kicker}</span>
          </p>
          <h2 className="hero__title home-hero__name">
            <a href={gamePlayHref(slug)}>{game.name}</a>
          </h2>
          <p className="hero__sub">{game.description}</p>
        </div>
        <div className="hero__actions">
          <a className="hero__cta" href={gamePlayHref(slug)}>
            Play
          </a>
          {best > 0 ? <span className="hero__hint">Your best {best.toLocaleString()}</span> : null}
        </div>
      </div>
    </section>
  )
}
