import { useMemo } from 'react'
import { courseDay, courseNumber, FIRST_DAY } from '../../games/marblerun/daily'
import { keptRun, marbleDay } from '../../games/marblerun/runs'
import { formatRun } from '../../games/marblerun/score'
import { point, type Course } from '../../games/marblerun/sim'
import { useAccountId } from '../../hooks/useAccountId'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { dayBefore } from '../../lib/archive'
import { ArchiveList, type ArchiveItem } from './ArchiveList'

const SLUG = 'marblerun'

/**
 * A course from above, as its day's card draws it: the track in magenta light on the dark, the start and the
 * goal, filling the card's 16:10 frame round the course.
 */
function CourseDrawing({ course }: { course: Course }) {
  const [x0, x1, z0, z1] = course.box
  const pad = 12
  let w = x1 - x0 + pad * 2
  let h = z1 - z0 + pad * 2
  if (w / h < 16 / 10) w = (h * 16) / 10
  else h = (w * 10) / 16
  const ox = (w - (x1 - x0)) / 2 - x0
  const oz = (h - (z1 - z0)) / 2 - z0
  const paths: string[] = []
  for (const p of course.pieces) {
    if (p.gap) continue
    const n = Math.max(2, Math.ceil(p.len / 2))
    const pts: string[] = []
    for (let i = 0; i <= n; i++) {
      const [x, z] = point(p, (p.len * i) / n, 0)
      pts.push(`${(x + ox).toFixed(1)} ${(z + oz).toFixed(1)}`)
    }
    paths.push(`M${pts.join(' L')}`)
  }
  const d = paths.join(' ')
  const [sx, sz] = point(course.pieces[0]!, 0, 0)
  const goal = course.lines[course.lines.length - 1]!
  const [gx, gz] = point(goal.p, goal.u, 0)
  const stroke = Math.max(w, h) / 45
  return (
    <svg viewBox={`0 0 ${w.toFixed(1)} ${h.toFixed(1)}`} role="img" aria-label={`${course.name}, from above`}>
      <rect width={w} height={h} fill="#07040f" />
      <path d={d} fill="none" stroke="#ff5ce1" strokeOpacity="0.28" strokeWidth={stroke * 3} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#ff5ce1" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx + ox} cy={sz + oz} r={stroke * 1.4} fill="#f5b942" />
      <circle cx={gx + ox} cy={gz + oz} r={stroke * 1.6} fill="#ffffff" />
    </svg>
  )
}

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
