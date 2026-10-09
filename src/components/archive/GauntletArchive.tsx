import { useMemo } from 'react'
import { GauntletDrawing } from '../../games/wobblerun/GauntletDrawing'
import { dailyGauntlet, FIRST_DAY, gauntletDay, gauntletNumber } from '../../games/wobblerun/daily'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { usePastViewer, type PastSource } from '../../lib/dailyPast'
import { usePastBoards } from './pastBoards'
import { PastCourses } from './PastCourses'

const SLUG = 'wobblerun'

const anchor = (day: string) => day

const playHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`

// The name is the plan's, so a card has it without laying the course.
const title = (day: string) => `#${gauntletNumber(day)} ${dailyGauntlet(day).name}`

// The day's rounds to the Blip star cover the box, sky and all: the plan's round code is all it needs.
const art = (day: string) => {
  const gauntlet = dailyGauntlet(day)
  return <GauntletDrawing gauntlet={gauntlet} name={gauntlet.name} w={640} h={320} />
}

/**
 * Wobble Run's past gauntlets: every day's gauntlet before today's, newest first. Each keeps an All time board of
 * its own for good (lib/trackBoards.ts): any run through it, on its day or since, each player's best.
 */
export function GauntletArchive() {
  const today = gauntletDay()
  const viewer = usePastViewer()
  const boards = usePastBoards(SLUG, viewer.name, today, gauntletNumber)
  const source = useMemo<PastSource>(() => ({ slug: SLUG, today, first: FIRST_DAY, anchor, playHref, title, art, boards, pace }), [today, boards])
  return <PastCourses source={source} />
}

/** The day's blue blip, for your medal that day. */
function pace(day: string) {
  return dailyGauntlet(day).pace
}
