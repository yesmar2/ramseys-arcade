import { PERIOD_LABELS, type LeaderboardPeriod } from '../lib/leaderboard'

/** The periods' short names, for a phone, where four tabs share the row once the Season's is there. */
const SHORT_LABELS: Partial<Record<LeaderboardPeriod, string>> = { weekly: 'Week', monthly: 'Month' }

/**
 * A period tab's name. In a row of four (`four`, its tabs `seg--four`), a phone reads the short one
 * (boards.css): Week · Month · All time · Season.
 */
export function PeriodLabel({ period, four }: { period: LeaderboardPeriod; four: boolean }) {
  const short = four ? SHORT_LABELS[period] : undefined
  if (!short) return <>{PERIOD_LABELS[period]}</>
  return (
    <>
      <span className="seg__long">{PERIOD_LABELS[period]}</span>
      <span className="seg__short">{short}</span>
    </>
  )
}
