import type { AccountPlan } from './auth'

/**
 * What a plan allows, as the server reports it.
 *
 * The server is authoritative — it re-checks every limit on write and answers
 * a refusal with 402 PLAN_LIMIT. These values come down with `/auth/me` and
 * exist so the UI can disable a control before someone fills in a form they
 * are not allowed to submit, rather than to decide anything.
 */
export type PlanLimits = {
  activeEvents: number
  groups: number
  groupMembers: number
  maxDraw: number
  doubleElimination: boolean
  multiGameRounds: boolean
}

/** Which allowance a refusal was about. */
export type PlanLimitKind = keyof PlanLimits

/**
 * Used until `/auth/me` answers, and for signed-out visitors.
 *
 * Deliberately the free set: showing the generous caps first and snapping down
 * would read as something being taken away.
 */
export const FREE_LIMITS: PlanLimits = {
  activeEvents: 1,
  groups: 1,
  groupMembers: 20,
  maxDraw: 8,
  doubleElimination: false,
  multiGameRounds: false,
}

export const PLUS_PRICE = '$3/mo'

/** A 402 from any write that a plan does not cover. */
export type PlanLimitError = {
  code: 'PLAN_LIMIT'
  limit: PlanLimitKind
  plan: AccountPlan
  allowed: number | boolean
  message: string
}

export function isPlanLimitError(err: unknown): err is Error & PlanLimitError {
  return Boolean(err) && (err as { code?: string }).code === 'PLAN_LIMIT'
}

/** What Plus would give you, for the prompt shown when a limit is hit. */
export const PLAN_UPSELL: Record<PlanLimitKind, string> = {
  activeEvents: 'Run up to five events at once',
  groups: 'Run up to five groups',
  groupMembers: 'Up to 100 players in a group',
  maxDraw: 'Draws of up to 64 players',
  doubleElimination: 'Double elimination, so one loss is not the end',
  multiGameRounds: 'A different game every round',
}
