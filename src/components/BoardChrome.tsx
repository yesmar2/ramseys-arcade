import type { CSSProperties, ReactNode } from 'react'
import type { PagedBoard } from '../hooks/usePagedBoard'
import {
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

type PeriodSwitcherProps = {
  period: LeaderboardPeriod
  onSelect: (period: LeaderboardPeriod) => void
  /** When set, tabs are links (hash routes). Otherwise plain buttons. */
  hrefFor?: (period: LeaderboardPeriod) => string
  accent?: string
  label?: string
  className?: string
}

export function PeriodSwitcher({
  period,
  hrefFor,
  onSelect,
  accent,
  label = 'Time period',
  className,
}: PeriodSwitcherProps) {
  const style = (accent ? { '--period-accent': accent } : undefined) as CSSProperties | undefined

  return (
    <div
      className={`chips${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={label}
      style={style}
    >
      {VISIBLE_LEADERBOARD_PERIODS.map((p) => {
        const cls = `chips__item${period === p ? ' chips__item--active' : ''}`
        if (hrefFor) {
          return (
            <a
              key={p}
              href={hrefFor(p)}
              role="tab"
              aria-selected={period === p}
              className={cls}
              onClick={(e) => {
                e.preventDefault()
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
            className={cls}
            onClick={() => onSelect(p)}
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

/**
 * The foot of a board that keeps going.
 *
 * Scrolling reveals the next rows on its own; the button is what makes that
 * visible, and the way down for anyone on a keyboard or without an observer.
 * The count is the point of the whole exercise — it says how deep the field
 * a rank is measured against actually goes.
 */
export function BoardMore({
  board,
  hidden,
  unit = 'rows',
}: {
  board: Pick<
    PagedBoard<unknown, unknown>,
    'shown' | 'total' | 'loadingMore' | 'showMore' | 'sentinelRef'
  >
  hidden?: boolean
  unit?: string
}) {
  const { shown, total, loadingMore, showMore, sentinelRef } = board
  if (hidden) return null
  const left = Math.max(0, total - shown)
  return (
    <div className="lst__foot">
      {/* Sits below the last row: reaching it is what asks for more. */}
      <span ref={sentinelRef} className="lst__sentinel" aria-hidden="true" />
      {left > 0 ? (
        /* One step at a time, same as scrolling — so it says so, and the
           count below carries how far there is left to go. */
        <button type="button" className="lst__more" onClick={showMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Show more'}
        </button>
      ) : null}
      {total > shown ? (
        <p className="lst__count" role="status">
          {shown.toLocaleString()} of {total.toLocaleString()} {unit}
        </p>
      ) : total > 0 ? (
        <p className="lst__count">
          All {total.toLocaleString()} {unit}
        </p>
      ) : null}
    </div>
  )
}
