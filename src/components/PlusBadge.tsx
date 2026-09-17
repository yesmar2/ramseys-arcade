import { plusHref } from '../hooks/useHashRoute'
import { isPlanLimitError, PLAN_UPSELL, PLUS_PRICE } from '../lib/plans'

/**
 * Marks a control as belonging to Plus.
 *
 * Used on things a free account cannot submit, so the limit is visible before
 * someone fills in a form that will be refused. Labelling up front is the
 * whole trick: what people resent is the surprise, not the price.
 */
export function PlusBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`plus-badge${className ? ` ${className}` : ''}`} title="A Plus feature">
      Plus
    </span>
  )
}

/**
 * Shown when the server refuses a write on plan grounds.
 *
 * Leads with what they were trying to do rather than with the price, and names
 * the one thing Plus would change — a list of everything in the tier reads as
 * a sales page at the moment someone is trying to get something done.
 */
export function PlanLimitNotice({ error }: { error: unknown }) {
  if (!isPlanLimitError(error)) return null
  return (
    <div className="plus-wall" role="status">
      <p className="plus-wall__msg">{error.message}</p>
      <p className="plus-wall__offer">
        <span className="plus-wall__what">{PLAN_UPSELL[error.limit]}</span>
        <a className="plus-wall__price" href={plusHref()}>
          Plus · {PLUS_PRICE}
        </a>
      </p>
    </div>
  )
}
