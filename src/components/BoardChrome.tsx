import type { CSSProperties, ReactNode } from 'react'
import { setDefaultPeriod } from '../lib/defaultPeriod'
import {
  LEADERBOARD_PERIODS,
  PERIOD_LABELS,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

type PeriodSwitcherProps = {
  period: LeaderboardPeriod
  onSelect: (period: LeaderboardPeriod) => void
  /** When set, tabs are links (hash routes). Otherwise plain buttons. */
  hrefFor?: (period: LeaderboardPeriod) => string
  accent?: string
  label?: string
}

export function PeriodSwitcher({
  period,
  hrefFor,
  onSelect,
  accent,
  label = 'Time period',
}: PeriodSwitcherProps) {
  const style = accent
    ? ({ '--period-accent': accent } as CSSProperties)
    : undefined

  return (
    <div
      className="lb-periods lb-periods--segment"
      role="tablist"
      aria-label={label}
      style={style}
    >
      {LEADERBOARD_PERIODS.map((p) => {
        const className = `lb-period${period === p ? ' lb-period--active' : ''}`
        if (hrefFor) {
          return (
            <a
              key={p}
              href={hrefFor(p)}
              role="tab"
              aria-selected={period === p}
              className={className}
              onClick={(e) => {
                e.preventDefault()
                setDefaultPeriod(p)
                onSelect(p)
              }}
            >
              {PERIOD_LABELS[p]}
            </a>
          )
        }
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            className={className}
            onClick={() => {
              setDefaultPeriod(p)
              onSelect(p)
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        )
      })}
    </div>
  )
}

export function BoardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ol className="lb-list lb-list--skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="lb-skel">
          <span className="lb-skel__rank" />
          <span className="lb-skel__name" />
          <span className="lb-skel__score" />
        </li>
      ))}
    </ol>
  )
}

export function BoardEmpty({
  title,
  detail,
  action,
}: {
  title: string
  detail?: string
  action?: ReactNode
}) {
  return (
    <div className="lb-empty-state">
      <p className="lb-empty-state__title">{title}</p>
      {detail ? <p className="lb-empty-state__detail">{detail}</p> : null}
      {action ? <div className="lb-empty-state__action">{action}</div> : null}
    </div>
  )
}
