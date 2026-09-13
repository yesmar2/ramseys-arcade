import type { CSSProperties } from 'react'
import { getGame } from '../data/games'
import { gamePlayHref } from '../hooks/useHashRoute'
import { usePersonalBest } from '../hooks/usePersonalBest'
import { useDeviceType } from '../lib/device'
import { dailyPick, newestSlug, playableHomeGames } from '../lib/homePicks'
import { useRecentGames } from '../lib/lastPlayed'
import { GameThumbArt } from './GameThumbArt'
import { resolveGameAccent } from '../lib/theme'

/**
 * The single "what should I play" slot.
 *
 * This was two cards — a continue band and a feature tile in the grid — which
 * put two near-identical "here's a game, press Play" panels within a screen of
 * each other. One panel leads, and anything new rides along on its footer.
 */
export function HomeHero() {
  const device = useDeviceType()
  const recent = useRecentGames()
  const playable = playableHomeGames(device)
  const slugs = playable.map((g) => g.slug)
  const newest = newestSlug(device)

  const lastPlayed = recent.find((slug) => slugs.includes(slug)) ?? null
  const slug = lastPlayed ?? newest ?? dailyPick(slugs)
  const best = usePersonalBest(slug ?? '')

  if (!slug) return null
  const game = getGame(slug)
  if (!game) return null

  const accent = resolveGameAccent(slug, game.accent)
  const isNew = !lastPlayed && slug === newest
  const alsoNew = lastPlayed && newest && newest !== slug ? getGame(newest) : null

  return (
    <section
      className="home-hero"
      style={{ '--hero-accent': accent, '--thumb-accent': accent } as CSSProperties}
      aria-label="Play"
    >
      <a className="home-hero__main" href={gamePlayHref(slug)}>
        <span className="home-hero__art">
          <GameThumbArt slug={slug} accent={accent} />
        </span>
        <span className="home-hero__text">
          <span className="home-hero__kicker">
            {lastPlayed ? 'Jump back in' : isNew ? 'New in the arcade' : 'Today’s pick'}
          </span>
          <span className="home-hero__name">{game.name}</span>
          <span className="home-hero__sub">
            {best > 0 ? `Your best ${best.toLocaleString()}` : game.description}
          </span>
        </span>
        <span className="home-hero__go">Play</span>
      </a>
      {alsoNew ? (
        <a className="home-hero__also" href={gamePlayHref(alsoNew.slug)}>
          <span className="home-hero__also-k">New</span>
          {alsoNew.name}
          <span aria-hidden="true"> →</span>
        </a>
      ) : null}
    </section>
  )
}
