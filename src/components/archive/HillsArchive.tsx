import { useMemo } from 'react'
import { HillsPostcard } from '../../games/swoop/HillsPostcard'
import { dailyHills, FIRST_DAY, hillsDay, hillsNumber } from '../../games/swoop/daily'
import { swoopDay } from '../../games/swoop/runs'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { usePastViewer, type PastSource } from '../../lib/dailyPast'
import { usePastBoards } from './pastBoards'
import { PastCourses } from './PastCourses'

const SLUG = 'swoop'

const anchor = (day: string) => day

const playHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`

// The name is the plan's, so a card has it without laying its hills.
export const title = (day: string) => `#${hillsNumber(day)} ${dailyHills(day).name}`

// The day's postcard covers its box, sky and all.
export const art = (day: string) => <HillsPostcard hills={swoopDay(day).hills} w={640} h={320} />

/**
 * Swoop's past hills: every day's hills before today's, newest first. Each keeps an All time board of its own
 * for good (lib/trackBoards.ts): any run over them, on their day or since, each player's best.
 */
export function HillsArchive() {
  const today = hillsDay()
  const viewer = usePastViewer()
  const boards = usePastBoards(SLUG, viewer.name, today, hillsNumber)
  const source = useMemo<PastSource>(() => ({ slug: SLUG, today, first: FIRST_DAY, anchor, playHref, title, art, boards, pace }), [today, boards])
  return <PastCourses source={source} />
}

/** The day's blue bird, for your medal that day. */
function pace(day: string) {
  return dailyHills(day).pace
}
