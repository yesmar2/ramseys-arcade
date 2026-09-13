import { homeGames, type Game } from '../data/games'
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
  return homeGames(device).filter((g) => !g.comingSoon && !g.inDevelopment && g.playable)
}

/** Newest addition to the catalog — the grid's feature slot. */
export function newestSlug(device: DeviceType): string | null {
  return playableHomeGames(device).at(-1)?.slug ?? null
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
