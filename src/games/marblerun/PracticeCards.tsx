import type { ReactNode } from 'react'
import { PastCourseResult, PastCourseStart, type PastWalkLink, type TodayCourse } from '../../components/PastCourseCards'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { archiveDayWords } from '../../lib/archive'
import type { PastFact } from '../../lib/pastPlay'
import { courseDay, courseNumber, dailyCourse, FIRST_DAY } from './daily'
import { dayFirst, type DayTop, type ItsDay } from './pastDay'
import type { MarbleDay } from './runs'
import { formatRun } from './score'

/*
 * The cards of a past day's course rolled again from the past tab (/games/marblerun/play?day=YYYY-MM-DD),
 * on the cards every daily's past course shares (components/PastCourseCards.tsx): the one it opens on,
 * and the one after a run. It's practice: its runs go on no board and pay nothing, and your best here
 * lasts only while the tab is open.
 */

const SLUG = 'marblerun'

/** A past day's course, by its day. */
const practiceHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`
const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

/** "‹ #2 Pebble Falls": the courses either side of a past day's, while they're past ones. */
function walkFor(day: string): { prev: PastWalkLink | null; next: PastWalkLink | null } {
  const link = (other: string) => ({ label: `#${courseNumber(other)} ${dailyCourse(other).name}`, href: practiceHref(other) })
  const before = shiftDay(day, -1)
  const after = shiftDay(day, 1)
  return { prev: before >= FIRST_DAY ? link(before) : null, next: after < courseDay() ? link(after) : null }
}

/** Today's course, which counts: "Today's course is the one that counts: Pebble Falls ›". */
const todayCourse = (): TodayCourse => ({ name: dailyCourse(courseDay()).name })

/**
 * A past course's start card: which course it was and when, that it's practice, how its day went, the
 * blue ball's run and your best here (`tiles`, as the pause card has them). A tap anywhere starts, as on
 * today's card.
 */
export function PracticeStartCard({ marble, facts, tiles }: { marble: MarbleDay; facts: readonly PastFact[]; tiles: ReactNode }) {
  return (
    <PastCourseStart
      slug={SLUG}
      course={marble.day}
      day={marble.day}
      kind="practice"
      title={marble.name}
      kicker={`Past course #${marble.n} · ${archiveDayWords(marble.day)}`}
      facts={facts}
      extraMeta={tiles}
      note="Your best here lasts while this tab is open."
      today={todayCourse()}
      walk={walkFor(marble.day)}
    />
  )
}

const fallWords = (falls: number) => (falls === 0 ? 'no falls' : falls === 1 ? '1 fall' : `${falls} falls`)

/** "1.20s quicker than your old best here, 50.12s.": the run against your best here before it. */
function bestWords(time: number, best: number, before: number | null, improved: boolean): string {
  if (improved) return before == null ? 'That’s your best here.' : `${(before - time).toFixed(2)}s quicker than your old best here, ${formatRun(before)}.`
  const gap = time - best
  return gap < 0.005 ? `Tied with your best here, ${formatRun(best)}.` : `${gap.toFixed(2)}s off your best here, ${formatRun(best)}.`
}

/** "You beat the blue ball by 1.20s, with no falls." */
function ballWords(time: number, pace: number, falls: number): string {
  const gap = time - pace
  const against = Math.abs(gap) < 0.005 ? 'Tied with the blue ball' : gap < 0 ? `You beat the blue ball by ${(-gap).toFixed(2)}s` : `${gap.toFixed(2)}s behind the blue ball`
  return `${against}, with ${fallWords(falls)}.`
}

/** "MAYA's 1st on its day, 48.37s, is 1.20s away.": the run against the day's 1st. */
function firstWords(time: number, first: { name: string; time: number; mine: boolean }): string {
  const whose = first.mine ? 'your' : `${first.name}’s`
  const at = formatRun(first.time)
  const gap = time - first.time
  if (Math.abs(gap) < 0.005) return `That ties ${whose} 1st on its day, ${at}.`
  if (gap < 0) return `That beats ${whose} 1st on its day, ${at}, by ${(-gap).toFixed(2)}s.`
  return `${first.mine ? 'Your' : whose} 1st on its day, ${at}, is ${gap.toFixed(2)}s away.`
}

/**
 * After a practice run: its time, that nothing was saved, against your best here and the blue ball's, and
 * against the day's 1st; then again, back to its row on the past tab, or today's course.
 */
export function PracticeResultCard({
  marble,
  time,
  falls,
  best,
  before,
  improved,
  pace,
  itsDay,
  top,
  onAgain,
}: {
  marble: MarbleDay
  time: number
  falls: number
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
  const first = dayFirst(marble.day, itsDay, top)
  return (
    <PastCourseResult
      slug={SLUG}
      course={marble.day}
      day={marble.day}
      kind="practice"
      kicker={`Past course #${marble.n} · ${marble.name}`}
      figure={formatRun(time)}
      line={`${bestWords(time, best, before, improved)} ${ballWords(time, pace, falls)}`}
      note={first ? firstWords(time, first) : null}
      today={todayCourse()}
      onAgain={onAgain}
    />
  )
}
