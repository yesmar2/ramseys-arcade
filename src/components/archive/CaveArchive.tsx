import { useMemo } from 'react'
import { CaveDrawing } from '../../games/lander/CaveDrawing'
import { caveDay, caveNumber, dailyCave, FIRST_DAY } from '../../games/lander/daily'
import { landerDay } from '../../games/lander/runs'
import { gamePlayHref } from '../../hooks/useHashRoute'
import type { PastSource } from '../../lib/dailyPast'
import { PastCourses } from './PastCourses'

const SLUG = 'lander'

const anchor = (day: string) => day

const playHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`

// The name is the plan's, so a card has it without digging its cave.
const title = (day: string) => `#${caveNumber(day)} ${dailyCave(day).name}`

// A cave runs tall: the drawing keeps its shape on the dark of the rock round it (dailyPast.css).
const art = (day: string) => (
  <span className="dp-art__ground dp-art__ground--cave">
    <CaveDrawing cave={landerDay(day).cave} />
  </span>
)

/** Lander's past caves: every day's cave before today's, newest first, each to fly again as practice. */
export function CaveArchive() {
  const today = caveDay()
  const source = useMemo<PastSource>(() => ({ slug: SLUG, today, first: FIRST_DAY, anchor, playHref, title, art }), [today])
  return <PastCourses source={source} />
}
