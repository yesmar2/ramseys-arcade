import { useMemo } from 'react'
import { DAILY_EPOCH, dailyNumber } from '../../games/acechase/daily'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { dayBefore } from '../../lib/archive'
import { dailyDay, PLACE_NAME, todaysHole } from '../../lib/dailyHole'
import { HolePlan } from '../TodaysHoleCard'
import { ArchiveList, type ArchiveItem } from './ArchiveList'

const SLUG = 'acechase'

/** Ace Chase's archive: every day's hole from the first, today's at the top. A past one plays as practice. */
export function HoleArchive() {
  const today = dailyDay()
  const items = useMemo(() => {
    const out: ArchiveItem[] = []
    for (let day = today; day >= DAILY_EPOCH; day = dayBefore(day)) {
      out.push({
        day,
        n: dailyNumber(day),
        today: day === today,
        href: day === today ? gamePlayHref(SLUG) : `${gamePlayHref(SLUG)}?hole=day:${day}`,
        build: () => {
          const hole = todaysHole(day)
          return { title: hole.def.name, sub: `On ${PLACE_NAME[hole.pick.style]}`, art: <HolePlan hole={hole} /> }
        },
      })
    }
    return out
  }, [today])
  return <ArchiveList slug={SLUG} items={items} />
}
