import { gamePlayableOn, games, type Game } from '../data/games'
import type { DeviceType } from './device'

/**
 * Which games the home page's two feature slots are allowed to promote.
 *
 * The play band and the grid's feature tile both want "something worth opening",
 * and with one new game in the catalog they kept landing on the same title —
 * the duplicate-artwork problem the grid already had. Both slots pick from here
 * so they can agree to differ.
 */

export function playableHomeGames(device: DeviceType): Game[] {
  // Catalog order, not shelf order — `newestSlug` below takes the last entry,
  // and that only means "newest" while the list is the append-only one.
  return games.filter(
    (g) => !g.hidden && !g.comingSoon && !g.inDevelopment && gamePlayableOn(g, device),
  )
}

/**
 * Newest addition to the catalog, or null when it will not run here.
 *
 * Deliberately not "last game playable on this device": on a phone that is
 * whatever happens to sit last after the device filter, and calling a years-old
 * title "new in the arcade" because of it is simply wrong.
 */
export function newestSlug(device: DeviceType): string | null {
  const newest = games.filter((g) => !g.hidden && !g.comingSoon).at(-1)?.slug ?? null
  if (!newest) return null
  return playableHomeGames(device).some((g) => g.slug === newest) ? newest : null
}

/** Stable for the day, so a reload isn't a reshuffle. */
export function dailyPick(slugs: string[]): string | null {
  if (slugs.length === 0) return null
  return slugs[Math.floor(Date.now() / 86_400_000) % slugs.length]
}

/**
 * The game the hero is showing. Shared with the grid so the same artwork does
 * not appear twice within a screen of itself.
 */
export function heroSlug(device: DeviceType, recent: string[]): string | null {
  const slugs = playableHomeGames(device).map((g) => g.slug)
  const lastPlayed = recent.find((slug) => slugs.includes(slug)) ?? null
  return lastPlayed ?? newestSlug(device) ?? dailyPick(slugs)
}
