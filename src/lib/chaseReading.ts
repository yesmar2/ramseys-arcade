import type { Chase } from './chase'

/*
 * What the pace bar says (components/Chase.tsx ChaseBar), worked out from the
 * run so far. Kept apart from the component so the sums can be checked alone.
 */

/** "1.2s", for a time or a gap in one. */
export function chaseSeconds(ms: number): string {
  return `${(Math.abs(ms) / 1000).toFixed(1)}s`
}

export type ChaseReading = {
  head: string
  status: string
  tone: 'ahead' | 'behind' | 'won' | 'plain'
  /** Your mark along the bar, 0 to 1. */
  you: number
  /** The record's even pace along the bar, 0 to 1; null without a time to pace. */
  pace: number | null
  /** The figure at the bar's end. */
  end: string
}

export function chaseReading(
  chase: Chase,
  run: {
    /** Where a race's clock starts counting from (Snake's length when it sets off). */
    from: number
    /** The run's figure in the record's terms. */
    value: number
    /** The record's clock; null till the run sets off. */
    elapsedMs: number | null
    /** The last step forward and when it came. */
    last: { value: number; at: number } | null
    /** When the goal was reached. */
    reached: number | null
    /** The pace words, for before the first step ("2.27s a bite"). */
    paceWords: string | null
  },
): ChaseReading {
  const { from, value, elapsedMs, last, reached } = run
  const who = chase.name ? `${chase.name} ` : ''
  if (chase.unit === 'ms' && chase.goal != null) {
    const span = Math.max(1, chase.goal - from)
    const you = Math.max(0, Math.min(1, (Math.min(value, chase.goal) - from) / span))
    const end = String(chase.goal)
    const target = chase.target
    if (target == null) {
      return reached != null
        ? { head: `${chase.short} · nobody yet`, status: `First in ${chaseSeconds(reached)}`, tone: 'won', you, pace: null, end }
        : { head: `${chase.short} · nobody yet`, status: chaseSeconds(elapsedMs ?? 0), tone: 'plain', you, pace: null, end }
    }
    const head = `${chase.short} · ${who}${chaseSeconds(target)}`
    const pace = Math.max(0, Math.min(1, (elapsedMs ?? 0) / target))
    if (reached != null) {
      const gap = reached - target
      return gap < 0
        ? { head, status: `Beat it by ${chaseSeconds(gap)}`, tone: 'won', you, pace, end }
        : { head, status: `Missed by ${chaseSeconds(gap)}`, tone: 'behind', you, pace, end }
    }
    if (last) {
      // Ahead or behind at your last bite: the record's even pace would have reached that length at…
      const gap = last.at - ((last.value - from) / span) * target
      if (Math.abs(gap) < 50) return { head, status: 'On pace', tone: 'plain', you, pace, end }
      return { head, status: `${chaseSeconds(gap)} ${gap > 0 ? 'behind' : 'ahead'}`, tone: gap > 0 ? 'behind' : 'ahead', you, pace, end }
    }
    return { head, status: run.paceWords ?? '', tone: 'plain', you, pace, end }
  }
  // A number to pass: one more than the record beats it.
  const target = chase.target ?? 0
  const head = `${chase.short} · ${who}${target.toLocaleString()}`
  const you = target > 0 ? Math.max(0, Math.min(1, value / (target + 1))) : 1
  const end = (target + 1).toLocaleString()
  return value > target
    ? { head, status: 'Past it!', tone: 'won', you, pace: null, end }
    : { head, status: `${(target + 1 - value).toLocaleString()} to go`, tone: 'plain', you, pace: null, end }
}
