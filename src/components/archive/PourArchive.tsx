import { useMemo } from 'react'
import { dayNumber, FIRST_DAY, pourDay } from '../../games/halffull/daily'
import { dayPlan, type DayPlan } from '../../games/halffull/plan'
import { glassNames, pourPlan } from '../../games/halffull/planSvg'
import { gamePlayHref } from '../../hooks/useHashRoute'
import type { PastSource } from '../../lib/dailyPast'
import { PastCourses } from './PastCourses'
import '../../styles/todaysPour.css'

const SLUG = 'halffull'

/** A day's glasses on the shelf and the counter, empty: its picture, as Today's Pour draws them. */
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

const anchor = (day: string) => day

const playHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`

const title = (day: string) => `Pour #${dayNumber(day)}`

const sub = (day: string) => glassNames(dayPlan(day))

// A day's glasses are worked out only as its row comes near: a day can try a good many sets.
const art = (day: string) => <PourGlasses plan={dayPlan(day)} />

/** Half Full's past days: every Today's Pour before today's, newest first, each to pour again as practice. */
export function PourArchive() {
  const today = pourDay()
  const source = useMemo<PastSource>(
    () => ({ slug: SLUG, today, first: FIRST_DAY, number: dayNumber, anchor, playHref, title, sub, art }),
    [today],
  )
  return <PastCourses source={source} />
}
