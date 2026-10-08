import { prizesHref, seasonHref } from '../hooks/useHashRoute'
import { liveSeason, type SeasonInfo, type SeasonPlus, type SeasonReward } from './season'
import { SEASON_CALENDAR, type SeasonDates } from './seasonCalendar'
import type { Skin } from './skins'

/*
 * Where a skin comes from, for its card on a board (components/season/SkinCard.tsx), and the way there: the live
 * season's pass at its level (the free row or Pass+), the Hangar at its price, or a season that isn't on now, over
 * or still to come, which the card can only name. The game page's skin picker leads the same ways.
 */

export type SkinWhere =
  | { kind: 'pass'; season: SeasonInfo; level: number; plus: boolean }
  | { kind: 'hangar'; price: number }
  | { kind: 'season'; season: SeasonDates | null; when: 'over' | 'soon' | null }

type SeasonStore = { season: SeasonInfo | null; rewards: SeasonReward[]; plus?: SeasonPlus | null }

export function skinWhere(skin: Skin, store: SeasonStore, now = Date.now()): SkinWhere {
  if (skin.price != null) return { kind: 'hangar', price: skin.price }
  const live = liveSeason(store)
  if (live && skin.season === live.id) {
    const onPlus = store.plus?.rewards.find((r) => r.id === skin.id)
    const reward = store.rewards.find((r) => r.id === skin.id) ?? onPlus
    if (reward) return { kind: 'pass', season: live, level: reward.level, plus: reward === onPlus }
  }
  const season = SEASON_CALENDAR.find((s) => s.id === skin.season) ?? null
  // The boards' day (New York), as the seasons' days are.
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const when = !season ? null : today > season.lastDay ? 'over' : today < season.firstDay ? 'soon' : null
  return { kind: 'season', season, when }
}

/** "Jan 4": one of a season's days, YYYY-MM-DD, as a card says it. */
export function seasonDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** A skin's tile on the Season page, which turns its row to it and lights it (pages/SeasonPage.tsx). */
export function seasonSkinHref(id: string): string {
  return `${seasonHref()}#skin-${id}`
}

/** A skin's bay in the Hangar, at the prize counter, lit (components/prizes/HangarBays.tsx). */
export function hangarSkinHref(id: string): string {
  return `${prizesHref()}#hangar-${id}`
}
