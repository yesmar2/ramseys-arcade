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
  /** What's chased and whose: "Length 30 · YESMAR 61.2s". */
  head: string
  /** The same, short, for the one-line chip: "Length 30 in 61.2s". */
  brief: string
  status: string
  tone: 'ahead' | 'behind' | 'won' | 'plain'
  /** Your mark along the bar, 0 to 1. */
  you: number
  /** The record's even pace along the bar, 0 to 1; null without a time to pace. */
  pace: number | null
  /** The figure at the bar's end. */
  end: string
}

/** For a lap (lib/chase.ts Chase.kind): which wave the run is on, how long into it, and the chased wave's clear. */
export type ChaseLap = {
  wave: number
  /** Time into the wave under way. */
  inWaveMs: number
  /** The chased wave's clear time, once it is cleared this run. */
  clearedMs: number | null
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
    /** The last step and when it came. */
    last: { value: number; at: number } | null
    /** When the goal was reached. */
    reached: number | null
    /** The pace words, for before the first step ("2.27s a bite"). */
    paceWords: string | null
    lap?: ChaseLap
  },
): ChaseReading {
  const { from, value, elapsedMs, last, reached } = run
  const who = chase.name ? `${chase.name} ` : ''
  const target = chase.target

  if (chase.unit === 'ms' && chase.kind === 'lap' && chase.goal != null) {
    const goal = chase.goal
    const lap = run.lap ?? { wave: 1, inWaveMs: 0, clearedMs: null }
    const head = target == null ? `${chase.short} · nobody yet` : `${chase.short} · ${who}${chaseSeconds(target)}`
    const brief = target == null ? chase.short : `${chase.short} in ${chaseSeconds(target)}`
    const end = target == null ? '' : chaseSeconds(target)
    if (lap.clearedMs != null) {
      if (target == null) return { head, brief, status: `First in ${chaseSeconds(lap.clearedMs)}`, tone: 'won', you: 1, pace: null, end }
      const gap = lap.clearedMs - target
      return gap < 0
        ? { head, brief, status: `Beat it by ${chaseSeconds(gap)}`, tone: 'won', you: 1, pace: null, end }
        : { head, brief, status: `Missed by ${chaseSeconds(gap)}`, tone: 'behind', you: 1, pace: null, end }
    }
    if (lap.wave < goal) {
      const away = goal - lap.wave
      return { head, brief, status: away === 1 ? 'Next wave' : `${away} waves to go`, tone: 'plain', you: 0, pace: null, end }
    }
    // The wave itself: the record's time running out.
    if (target == null) return { head, brief, status: chaseSeconds(lap.inWaveMs), tone: 'plain', you: 0, pace: null, end }
    const left = target - lap.inWaveMs
    const you = Math.max(0, Math.min(1, lap.inWaveMs / target))
    return left > 0
      ? { head, brief, status: `${chaseSeconds(left)} left`, tone: 'plain', you, pace: null, end }
      : { head, brief, status: `Over by ${chaseSeconds(left)}`, tone: 'behind', you: 1, pace: null, end }
  }

  if (chase.unit === 'ms' && chase.goal != null) {
    const span = Math.max(1, chase.goal - from)
    const you = Math.max(0, Math.min(1, (Math.min(value, chase.goal) - from) / span))
    const end = String(chase.goal)
    if (target == null) {
      const head = `${chase.short} · nobody yet`
      return reached != null
        ? { head, brief: chase.short, status: `First in ${chaseSeconds(reached)}`, tone: 'won', you, pace: null, end }
        : { head, brief: chase.short, status: chaseSeconds(elapsedMs ?? 0), tone: 'plain', you, pace: null, end }
    }
    const head = `${chase.short} · ${who}${chaseSeconds(target)}`
    const brief = `${chase.short} in ${chaseSeconds(target)}`
    const pace = Math.max(0, Math.min(1, (elapsedMs ?? 0) / target))
    if (reached != null) {
      const gap = reached - target
      return gap < 0
        ? { head, brief, status: `Beat it by ${chaseSeconds(gap)}`, tone: 'won', you, pace, end }
        : { head, brief, status: `Missed by ${chaseSeconds(gap)}`, tone: 'behind', you, pace, end }
    }
    if (last) {
      // Ahead or behind at your last step: the record's even pace would have reached that far at…
      const gap = last.at - ((last.value - from) / span) * target
      if (Math.abs(gap) < 50) return { head, brief, status: 'On pace', tone: 'plain', you, pace, end }
      return { head, brief, status: `${chaseSeconds(gap)} ${gap > 0 ? 'behind' : 'ahead'}`, tone: gap > 0 ? 'behind' : 'ahead', you, pace, end }
    }
    // Before the first step: the record's pace where a step has a name ("2.27s a bite"), else the run's clock.
    return { head, brief, status: run.paceWords ?? chaseSeconds(elapsedMs ?? 0), tone: 'plain', you, pace, end }
  }

  // A number to pass: one more than the record beats it.
  const count = target ?? 0
  const head = `${chase.short} · ${who}${count.toLocaleString()}`
  const brief = `${chase.short} ${count.toLocaleString()}`
  const you = count > 0 ? Math.max(0, Math.min(1, value / (count + 1))) : 1
  const end = (count + 1).toLocaleString()
  return value > count
    ? { head, brief, status: 'Past it!', tone: 'won', you, pace: null, end }
    : { head, brief, status: `${(count + 1 - value).toLocaleString()} to go`, tone: 'plain', you, pace: null, end }
}
