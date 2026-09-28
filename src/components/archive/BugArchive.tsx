import { useMemo } from 'react'
import { bugDay, dayNumber, dayRun, dayWanted, FIRST_DAY, sceneMark, wantedNames } from '../../games/findbug/daily'
import { BugPortrait } from '../../games/findbug/Portrait'
import { useAccountId } from '../../hooks/useAccountId'
import { gamePlayHref } from '../../hooks/useHashRoute'
import { dayBefore } from '../../lib/archive'
import { ArchiveList, type ArchiveItem } from './ArchiveList'
import '../../styles/todaysWanted.css'

const SLUG = 'findbug'

/** A day's five wanted bugs side by side: its card's picture, as Today's Wanted draws them. */
function WantedFaces({ day }: { day: string }) {
  const wanted = useMemo(() => dayWanted(day), [day])
  return (
    <span className="twc-faces">
      {wanted.map((w, i) => (
        <BugPortrait key={i} look={w.look} size={72} crop="head" className="twc-faces__face" fluid />
      ))}
    </span>
  )
}

/**
 * Find the Bug's archive: every day's Today's Wanted from the first, today's at the top. A past one plays
 * again as practice. What the player made of a day on this device shows as its squares, one a scene.
 */
export function BugArchive() {
  const today = bugDay()
  // The squares are the player's own: built again when someone else signs in or out.
  const viewer = useAccountId()
  const items = useMemo(() => {
    const out: ArchiveItem[] = []
    for (let day = today; day >= FIRST_DAY; day = dayBefore(day)) {
      out.push({
        day,
        n: dayNumber(day),
        today: day === today,
        href: day === today ? gamePlayHref(SLUG) : `${gamePlayHref(SLUG)}?day=${day}`,
        build: () => {
          const mine = dayRun(day, viewer)?.result
          return {
            title: wantedNames(dayWanted(day)),
            sub: mine?.times?.length ? mine.times.map(sceneMark).join('') : 'Five scenes, a bug wanted in each',
            art: <WantedFaces day={day} />,
          }
        },
      })
    }
    return out
  }, [today, viewer])
  return <ArchiveList slug={SLUG} items={items} />
}
