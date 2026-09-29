import { useMemo } from 'react'
import { CourseDrawing } from '../../games/marblerun/CourseDrawing'
import { courseDay, courseNumber, FIRST_DAY } from '../../games/marblerun/daily'
import { keptRun, marbleDay } from '../../games/marblerun/runs'
import { formatRun } from '../../games/marblerun/score'
import { useAccountId } from '../../hooks/useAccountId'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { dayBefore } from '../../lib/archive'
import { ArchiveList, type ArchiveItem } from './ArchiveList'

const SLUG = 'marblerun'

/**
 * Marble Run's archive: every day's course from the first, today's at the top. A past one rolls again as
 * practice. Your best run of a day on this device shows under its name while the device still has it.
 */
export function CourseArchive() {
  const today = courseDay()
  // Your best here is your own: built again when someone else signs in or out.
  const viewer = useAccountId()
  const items = useMemo(() => {
    const out: ArchiveItem[] = []
    for (let day = today; day >= FIRST_DAY; day = dayBefore(day)) {
      out.push({
        day,
        n: courseNumber(day),
        today: day === today,
        href: day === today ? gamePlayHref(SLUG) : `${gamePlayHref(SLUG)}?day=${day}`,
        build: () => {
          const marble = marbleDay(day)
          const mine = keptRun(day, viewer)
          return {
            title: marble.name,
            sub: mine ? `Your best here: ${formatRun(mine.time)}` : `${Math.round(marble.course.length)} m · the blue ball ${formatRun(marble.pace)}`,
            art: <CourseDrawing course={marble.course} />,
          }
        },
      })
    }
    return out
  }, [today, viewer])
  return <ArchiveList slug={SLUG} items={items} />
}
