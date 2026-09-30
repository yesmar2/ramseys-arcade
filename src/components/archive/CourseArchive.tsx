import { useMemo } from 'react'
import { CourseDrawing } from '../../games/marblerun/CourseDrawing'
import { courseDay, courseNumber, dailyCourse, FIRST_DAY } from '../../games/marblerun/daily'
import { marbleDay } from '../../games/marblerun/runs'
import { formatRun } from '../../games/marblerun/score'
import { gamePlayHref } from '../../hooks/useHashRoute'
import type { PastSource } from '../../lib/dailyPast'
import { PastCourses } from './PastCourses'

const SLUG = 'marblerun'

const anchor = (day: string) => day

const playHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`

// The name is the plan's, so a row has it without laying its course.
const title = (day: string) => `#${courseNumber(day)} ${dailyCourse(day).name}`

function sub(day: string) {
  const marble = marbleDay(day)
  return `${Math.round(marble.course.length)} m · the blue ball ${formatRun(marble.pace)}`
}

const art = (day: string) => <CourseDrawing course={marbleDay(day).course} />

/** Marble Run's past courses: every day's course before today's, newest first, each to roll again as practice. */
export function CourseArchive() {
  const today = courseDay()
  const source = useMemo<PastSource>(
    () => ({ slug: SLUG, today, first: FIRST_DAY, number: courseNumber, anchor, playHref, title, sub, art }),
    [today],
  )
  return <PastCourses source={source} />
}
