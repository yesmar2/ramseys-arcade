import { useMemo } from 'react'
import { CaveDrawing } from '../../games/lander/CaveDrawing'
import { caveDay, caveNumber, dailyCave, FIRST_DAY } from '../../games/lander/daily'
import { landerDay } from '../../games/lander/runs'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { usePastViewer, type PastSource } from '../../lib/dailyPast'
import { usePastBoards } from './pastBoards'
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

/**
 * Lander's past caves: every day's cave before today's, newest first. Each keeps an All time board of its own
 * for good (lib/trackBoards.ts): any flight down it, on its day or since, each pilot's best.
 */
export function CaveArchive() {
  const today = caveDay()
  const viewer = usePastViewer()
  const boards = usePastBoards(SLUG, viewer.name, today, caveNumber)
  const source = useMemo<PastSource>(() => ({ slug: SLUG, today, first: FIRST_DAY, anchor, playHref, title, art, boards, pace }), [today, boards])
  return <PastCourses source={source} />
}

/** The day's blue ship, for your medal that day. */
function pace(day: string) {
  return dailyCave(day).pace
}
