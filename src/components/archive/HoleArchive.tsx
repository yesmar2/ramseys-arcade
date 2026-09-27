import { useMemo } from 'react'
import { DAILY_EPOCH, dailyNumber } from '../../games/acechase/daily'
import { ACECHASE_SCORE_BASE } from '../../games/acechase/score'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { usePlayerName } from '../../hooks/usePlayerName'
import { dayBefore, useArchiveDays } from '../../lib/archive'
import { dailyDay, PLACE_NAME, todaysHole } from '../../lib/dailyHole'
import { normalizePlayerName } from '../../lib/leaderboard'
import { useHoleRecords } from '../../lib/pastHoles'
import { HolePlan } from '../TodaysHoleCard'
import { ArchiveGrid, type ArchiveItem, type ArchiveResult } from './ArchiveList'

const SLUG = 'acechase'

/**
 * Ace Chase's archive: every day's hole from the first, today's at the top. Today's shows the day's best;
 * a past one shows its record, since its board stays open for a player's first result on it
 * (lib/pastHoles.ts), and your result and place.
 */
export function HoleArchive() {
  const today = dailyDay()
  const me = normalizePlayerName(usePlayerName())
  const days = useArchiveDays(SLUG, me)
  const records = useHoleRecords(me)
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
        ...(day === today ? {} : { empty: 'Nobody on its board yet' }),
      })
    }
    return out
  }, [today])
  const results = useMemo(() => {
    const out = new Map<string, ArchiveResult>()
    const now = days?.find((d) => d.day === today)
    if (now) out.set(today, now)
    for (const r of records ?? []) {
      if (r.day === today || !r.record) continue
      // The archive prints a hole's result as its board does, from a million less the tries.
      out.set(r.day, {
        top: { name: r.record.name, score: ACECHASE_SCORE_BASE - r.record.tries, avatarId: r.record.avatarId },
        players: r.players,
        you: r.you ? { score: ACECHASE_SCORE_BASE - r.you.tries, place: r.you.place } : null,
        record: true,
      })
    }
    return out
  }, [days, records, today])
  return <ArchiveGrid slug={SLUG} items={items} results={results} asked={days !== null && records !== null} />
}
