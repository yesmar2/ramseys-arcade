import type { ReactNode } from 'react'
import type { LeaderboardPeriod } from '../lib/leaderboard'
import { ordinal } from '../lib/scoreboard'
import { metalTone } from '../lib/trophies'
import { AllTimeStar, MonthlyTrophyCup, SeasonTrophy, TopTenRibbon, WeeklyMedal } from './TrophyArt'

/*
 * What the top three of a standings list are shown holding: the trophy that place takes when the period closes
 * (Ramsey, 2026-11-05: "should we use the trophies that they'd actually win if they win?"). A week's medal, a
 * month's cup, the season's cup (only while enough are playing for it, as its line under the places says),
 * and all time's star, which the boards alone give since all time never closes. A group's boards hand out
 * nothing, so they have none.
 *
 * A closed week's or month's final shows what each place took, the rest of its top ten their ribbons too
 * (Ramsey, 2026-11-05: "the last months/weeks/etc final should show the trophies too right?").
 */

export type PodiumPrize = { art: ReactNode; label: string }
export type Podium = (rank: number) => PodiumPrize | null

export function boardPodium({
  period,
  seasonId = null,
  cupPlaces = null,
  final = false,
}: {
  period: LeaderboardPeriod
  seasonId?: number | null
  /** The last place that takes the season's cup, or null while too few are playing for it. */
  cupPlaces?: number | null
  /** A closed period's final: what each place took, its top ten's ribbons with them. */
  final?: boolean
}): Podium {
  const takes = final ? 'took' : 'takes'
  return (rank) => {
    const place = ordinal(rank)
    if (final && rank >= 4 && rank <= 10 && (period === 'weekly' || period === 'monthly')) {
      return { art: <TopTenRibbon tone={period} rank={rank} size="md" />, label: `${place}, took a top ten ribbon` }
    }
    if (rank < 1 || rank > 3) return null
    const metal = metalTone(rank)
    if (period === 'weekly') return { art: <WeeklyMedal rank={rank} size="md" />, label: `${place}, ${takes} a ${metal} medal` }
    if (period === 'monthly') return { art: <MonthlyTrophyCup tone={metal} size="md" />, label: `${place}, ${takes} a ${metal} cup` }
    if (period === 'season') {
      if (seasonId == null || cupPlaces == null || rank > cupPlaces) return null
      return { art: <SeasonTrophy season={seasonId} rank={rank} size="md" />, label: `${place}, ${takes} the Season ${seasonId} cup in ${metal}` }
    }
    if (period === 'all') return { art: <AllTimeStar rank={rank} size="md" />, label: place }
    return null
  }
}
