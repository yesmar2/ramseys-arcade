import { useMemo } from 'react'
import { TowerPostcard } from '../../games/sling/TowerPostcard'
import { dailyTower, FIRST_DAY, towerDay, towerNumber } from '../../games/sling/daily'
import { slingDay } from '../../games/sling/runs'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { usePastViewer, type PastSource } from '../../lib/dailyPast'
import { usePastBoards } from './pastBoards'
import { PastCourses } from './PastCourses'

const SLUG = 'sling'

const anchor = (day: string) => day

const playHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`

// The name is the plan's, so a card has it without laying its tower.
export const title = (day: string) => `#${towerNumber(day)} ${dailyTower(day).name}`

// The day's postcard covers its box, sky and all.
export const art = (day: string) => <TowerPostcard tower={slingDay(day).tower} w={640} h={320} />

/**
 * Sling's past towers: every day's tower before today's, newest first. Each keeps an All time board of its own
 * for good (lib/trackBoards.ts): any run over them, on their day or since, each player's best.
 */
export function TowerArchive() {
  const today = towerDay()
  const viewer = usePastViewer()
  const boards = usePastBoards(SLUG, viewer.name, today, towerNumber)
  const source = useMemo<PastSource>(() => ({ slug: SLUG, today, first: FIRST_DAY, anchor, playHref, title, art, boards, pace, courseNumber: towerNumber }), [today, boards])
  return <PastCourses source={source} />
}

/** The day's blue blip, for your medal that day. */
function pace(day: string) {
  return dailyTower(day).pace
}
