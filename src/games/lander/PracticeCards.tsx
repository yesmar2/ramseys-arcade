import type { ReactNode } from 'react'
import { PastCourseResult, PastCourseStart, type PastWalkLink, type TodayCourse } from '../../components/PastCourseCards'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { archiveDayWords } from '../../lib/archive'
import { BOARD_NAMES } from '../../lib/dailyWords'
import type { PastFact } from '../../lib/pastPlay'
import { caveDay, caveNumber, dailyCave, FIRST_DAY } from './daily'
import { dayFirst, type DayTop, type ItsDay } from './pastDay'
import type { LanderDay } from './runs'
import { crashWords, formatRun } from './score'

/*
 * The cards of a past day's cave flown again from the past tab (/games/lander/play?day=YYYY-MM-DD), on the
 * cards every daily's past course shares (components/PastCourseCards.tsx): the one it opens on, and the one
 * after a run. It's practice: its runs go on no board and pay nothing, and your best here lasts only while
 * the tab is open.
 */

const SLUG = 'lander'

/** A past day's cave, by its day. */
const practiceHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`
const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

/** "‹ #2 Amber Well": the caves either side of a past day's, while they're past ones. */
function walkFor(day: string): { prev: PastWalkLink | null; next: PastWalkLink | null } {
  const link = (other: string) => ({ label: `#${caveNumber(other)} ${dailyCave(other).name}`, href: practiceHref(other) })
  const before = shiftDay(day, -1)
  const after = shiftDay(day, 1)
  return { prev: before >= FIRST_DAY ? link(before) : null, next: after < caveDay() ? link(after) : null }
}

/** Today's cave, which counts: "Today's cave is the one that counts: Amber Well ›". */
const todayCave = (): TodayCourse => ({ name: dailyCave(caveDay()).name })

/**
 * A past cave's start card: which cave it was and when, that it's practice, how its Ranked board went, the
 * blue ship's run and your best here (`tiles`, as the pause card has them). A tap anywhere starts, as on
 * today's card.
 */
export function PracticeStartCard({ lander, facts, tiles }: { lander: LanderDay; facts: readonly PastFact[]; tiles: ReactNode }) {
  return (
    <PastCourseStart
      slug={SLUG}
      course={lander.day}
      day={lander.day}
      kind="practice"
      title={lander.name}
      kicker={`Past cave #${lander.n} · ${archiveDayWords(lander.day)}`}
      facts={facts}
      extraMeta={tiles}
      note="Your best here lasts while this tab is open."
      today={todayCave()}
      walk={walkFor(lander.day)}
    />
  )
}

/** "1.20s quicker than your old best here, 50.12s.": the run against your best here before it. */
function bestWords(time: number, best: number, before: number | null, improved: boolean): string {
  if (improved) return before == null ? 'That’s your best here.' : `${(before - time).toFixed(2)}s quicker than your old best here, ${formatRun(before)}.`
  const gap = time - best
  return gap < 0.005 ? `Tied with your best here, ${formatRun(best)}.` : `${gap.toFixed(2)}s off your best here, ${formatRun(best)}.`
}

/** "You beat the blue ship by 1.20s, with no crashes." */
function shipWords(time: number, pace: number, crashes: number): string {
  const gap = time - pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue ship' : gap < 0 ? `You beat the blue ship by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue ship`
  return `${against}, with ${crashWords(crashes)}.`
}

/** "MAYA's 1st on the Ranked board, 48.37s, is 1.20s away.": the run against the day's 1st. */
function firstWords(time: number, first: { name: string; time: number; mine: boolean }): string {
  const whose = first.mine ? 'your' : `${first.name}’s`
  const at = formatRun(first.time)
  const gap = time - first.time
  const ranked = `on the ${BOARD_NAMES.ranked} board`
  if (Math.abs(gap) < 0.005) return `That ties ${whose} 1st ${ranked}, ${at}.`
  if (gap < 0) return `That beats ${whose} 1st ${ranked}, ${at}, by ${(-gap).toFixed(2)}s.`
  return `${first.mine ? 'Your' : whose} 1st ${ranked}, ${at}, is ${gap.toFixed(2)}s away.`
}

/**
 * After a practice run: its time, that nothing was saved, against your best here and the blue ship's, and
 * against the day's 1st; then again, back to its row on the past tab, or today's cave.
 */
export function PracticeResultCard({
  lander,
  time,
  crashes,
  best,
  before,
  improved,
  pace,
  itsDay,
  top,
  onAgain,
}: {
  lander: LanderDay
  time: number
  crashes: number
  /** Your best here, this run's included. */
  best: number
  /** Your best here before this run, if you had one. */
  before: number | null
  improved: boolean
  pace: number
  itsDay: ItsDay
  top: DayTop
  onAgain: () => void
}) {
  const first = dayFirst(lander.day, itsDay, top)
  return (
    <PastCourseResult
      slug={SLUG}
      course={lander.day}
      day={lander.day}
      kind="practice"
      kicker={`Past cave #${lander.n} · ${lander.name}`}
      figure={formatRun(time)}
      line={`${bestWords(time, best, before, improved)} ${shipWords(time, pace, crashes)}`}
      note={first ? firstWords(time, first) : null}
      today={todayCave()}
      onAgain={onAgain}
    />
  )
}
