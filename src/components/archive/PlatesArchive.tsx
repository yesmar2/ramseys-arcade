import { useMemo } from 'react'
import { dayNumber, FIRST_DAY, plateDay } from '../../games/dead-center/daily'
import { dayPlan } from '../../games/dead-center/plan'
import { gamePlayHref } from '../../hooks/useHashRoute'
import type { PastSource } from '../../lib/dailyPast'
import { PlatesPicture } from '../TodaysPlatesCard'
import { PastCourses } from './PastCourses'

const SLUG = 'centroid'

const anchor = (day: string) => day

const playHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`

const title = (day: string) => `Plates #${dayNumber(day)}`

const art = (day: string) => <PlatesPicture plan={dayPlan(day)} width={320} height={160} />

/** Centroid's past days: every Today's Plates before today's, newest first, each to play again as practice. */
export function PlatesArchive() {
  const today = plateDay()
  const source = useMemo<PastSource>(() => ({ slug: SLUG, today, first: FIRST_DAY, anchor, playHref, title, art }), [today])
  return <PastCourses source={source} />
}
