import { TomorrowTease } from '../../components/TomorrowTease'
import { dayAfter } from '../../lib/dayBoard'
import { CourseDrawing } from './CourseDrawing'
import { courseDay, dailyCourse, msUntilNextCourse, untilWords } from './daily'
import { marbleDay } from './runs'

/** Tomorrow's course on a run's report, from above as its Past card draws it; none once it's out already. */
export function TomorrowCourse({ day }: { day: string }) {
  const next = dayAfter(day)
  // A run begun before midnight and finished after it: its tomorrow is today, and open already.
  if (next <= courseDay()) return null
  const course = dailyCourse(next)
  return (
    <TomorrowTease
      noun="course"
      n={course.n}
      name={course.name}
      msLeft={msUntilNextCourse}
      words={untilWords}
      picture={<CourseDrawing course={marbleDay(next).course} />}
    />
  )
}
