import { useMemo } from 'react'
import { DAILY_EPOCH, dailyNumber } from '../../games/acechase/daily'
import { useAccountId } from '../../hooks/useAccountId'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { dailyDay, todaysHole } from '../../lib/dailyHole'
import type { PastSource } from '../../lib/dailyPast'
import { solvedHere } from '../../lib/pastHoles'
import { HolePlan } from '../TodaysHoleCard'
import { PastCourses } from './PastCourses'

const SLUG = 'acechase'

const anchor = (day: string) => String(dailyNumber(day))

const playHref = (day: string) => `${gamePlayHref(SLUG)}?hole=day:${day}`

function title(day: string) {
  const hole = todaysHole(day)
  return `#${hole.n} ${hole.def.name}`
}

function art(day: string) {
  return <HolePlan hole={todaysHole(day)} />
}

/**
 * Ace Chase's past holes: every hole before today's, newest first, each to play again as practice. Ace Chase
 * is just for fun (data/games.ts Game.ranked), so its holes keep no All time boards: the API answers none
 * (its holesRoutes.ts), and none are asked for.
 */
export function HoleArchive() {
  const today = dailyDay()
  const account = useAccountId()
  const source = useMemo<PastSource>(
    () => ({
      slug: SLUG,
      today,
      first: DAILY_EPOCH,
      anchor,
      playHref,
      title,
      art,
      firstResultOnly: true,
      // A bullseye this device has kept but not sent yet is a result all the same: the next one is practice.
      resultHere: (day: string) => account !== undefined && solvedHere(day, account) != null,
    }),
    [today, account],
  )
  return <PastCourses source={source} />
}
