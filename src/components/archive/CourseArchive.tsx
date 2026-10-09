import { useMemo } from 'react'
import { CourseDrawing } from '../../games/marblerun/CourseDrawing'
import { courseDay, courseNumber, dailyCourse, FIRST_DAY } from '../../games/marblerun/daily'
import { marbleDay } from '../../games/marblerun/runs'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { usePastViewer, type PastSource } from '../../lib/dailyPast'
import { usePastBoards } from './pastBoards'
import { PastCourses } from './PastCourses'

const SLUG = 'marblerun'

const anchor = (day: string) => day

const playHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`

// The name is the plan's, so a card has it without laying its course.
export const title = (day: string) => `#${courseNumber(day)} ${dailyCourse(day).name}`

// The drawing is 16:10 on its own dark: its box wears that dark round it (dailyPast.css).
export const art = (day: string) => (
  <span className="dp-art__ground dp-art__ground--marble">
    <CourseDrawing course={marbleDay(day).course} />
  </span>
)

/**
 * Marble Run's past courses: every day's course before today's, newest first. Each keeps an All time board of
 * its own for good (lib/trackBoards.ts): any run down it, on its day or since, each player's best.
 */
export function CourseArchive() {
  const today = courseDay()
  const viewer = usePastViewer()
  const boards = usePastBoards(SLUG, viewer.name, today, courseNumber)
  const source = useMemo<PastSource>(() => ({ slug: SLUG, today, first: FIRST_DAY, anchor, playHref, title, art, boards, pace, courseNumber: courseNumber }), [today, boards])
  return <PastCourses source={source} />
}

/** The day's blue ball, for your medal that day. */
function pace(day: string) {
  return dailyCourse(day).pace
}
