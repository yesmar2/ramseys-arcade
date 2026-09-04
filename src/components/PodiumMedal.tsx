import type { LeaderboardPeriod } from '../lib/leaderboard'
import {
  AllTimeStar,
  MonthlyTrophyCup,
  WeeklyMedal,
  type TrophyArtSize,
} from './TrophyArt'

export type MedalKind = 'gold' | 'silver' | 'bronze'

const LABELS: Record<MedalKind, string> = {
  gold: '1st',
  silver: '2nd',
  bronze: '3rd',
}

const RANK: Record<MedalKind, number> = {
  gold: 1,
  silver: 2,
  bronze: 3,
}

export function medalKind(rank: number): MedalKind | null {
  if (rank === 1) return 'gold'
  if (rank === 2) return 'silver'
  if (rank === 3) return 'bronze'
  return null
}

/**
 * Compact podium badge for boards / lists.
 * Weekly → medal, monthly → cup, all-time → star.
 */
export function PodiumMedal({
  kind,
  period = 'all',
  size = 'sm',
}: {
  kind: MedalKind
  period?: LeaderboardPeriod
  size?: Extract<TrophyArtSize, 'sm' | 'md'>
}) {
  const rank = RANK[kind]
  return (
    <span
      className={`lb-medal lb-medal--${kind}`}
      title={LABELS[kind]}
      aria-hidden="true"
    >
      {period === 'monthly' ? (
        <MonthlyTrophyCup tone={kind} size={size} />
      ) : period === 'weekly' ? (
        <WeeklyMedal rank={rank} size={size} />
      ) : (
        <AllTimeStar rank={rank} size={size} />
      )}
    </span>
  )
}
