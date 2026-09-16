import { useEffect, useState, type CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gamePlayHref } from '../hooks/useHashRoute'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useDeviceType } from '../lib/device'
import { heroSlug, newestSlug } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import {
  fetchPlayerBests,
  normalizePlayerName,
  PERIOD_LABELS,
} from '../lib/leaderboard'
import { usePlayerName } from '../hooks/usePlayerName'
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
  const name = normalizePlayerName(usePlayerName())
  const period = useDefaultPeriod()
  const [best, setBest] = useState(0)
  const lastPlayed = slug != null && recent.includes(slug)

  useEffect(() => {
    if (!name || !slug) {
      setBest(0)
      return
    }
    let cancelled = false
    fetchPlayerBests(name, period)
      .then((bests) => {
        if (!cancelled) setBest(bests[slug] ?? 0)
      })
      .catch(() => {
        if (!cancelled) setBest(0)
      })
    return () => {
      cancelled = true
    }
  }, [name, slug, period])

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
        </div>
        <div className="hero__actions">
          <a className="hero__cta" href={gamePlayHref(slug)}>
            Play
          </a>
          {best > 0 ? (
            <span className="hero__hint">
              {PERIOD_LABELS[period]} best {best.toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  )
}
