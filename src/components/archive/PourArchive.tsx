import { useMemo } from 'react'
import { dayNumber, dayRun, FIRST_DAY, pourDay } from '../../games/halffull/daily'
import { dayPlan, ROUNDS, type DayPlan } from '../../games/halffull/plan'
import { glassNames, pourPlan } from '../../games/halffull/planSvg'
import { judgeLevels, markFor } from '../../games/halffull/score'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { dayBefore } from '../../lib/archive'
import { ArchiveList, type ArchiveItem } from './ArchiveList'
import '../../styles/todaysPour.css'

const SLUG = 'halffull'

/** A day's glasses on the shelf and the counter, empty: its card's picture, as Today's Pour draws them. */
function PourGlasses({ plan }: { plan: DayPlan }) {
  const picture = useMemo(() => pourPlan(plan, 320, 200), [plan])
  return (
    <svg className="tpc-plan" viewBox={`0 0 ${picture.width} ${picture.height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {picture.layers.map((layer, i) => (
        <path key={i} className={`tpc-plan__${layer.part}`} d={layer.d} strokeWidth={layer.width} />
      ))}
    </svg>
  )
}

/**
 * Half Full's archive: every day's Today's Pour from the first, today's at the top. A past one pours again
 * as practice. What this device poured on a day shows as its squares, one a glass.
 */
export function PourArchive() {
  const today = pourDay()
  const items = useMemo(() => {
    const out: ArchiveItem[] = []
    for (let day = today; day >= FIRST_DAY; day = dayBefore(day)) {
      out.push({
        day,
        n: dayNumber(day),
        today: day === today,
        href: day === today ? gamePlayHref(SLUG) : `${gamePlayHref(SLUG)}?day=${day}`,
        // A day's glasses are built only as its card comes near: a day can try a good many sets.
        build: () => {
          const plan = dayPlan(day)
          const levels = dayRun(day)?.levels ?? []
          const mine = levels.length >= ROUNDS ? judgeLevels(plan, levels.slice(0, ROUNDS)) : null
          return {
            title: glassNames(plan),
            sub: mine ? mine.scores.map(markFor).join('') : `${plan.label}: four glasses and a fair split`,
            art: <PourGlasses plan={plan} />,
          }
        },
      })
    }
    return out
  }, [today])
  return <ArchiveList slug={SLUG} items={items} />
}
