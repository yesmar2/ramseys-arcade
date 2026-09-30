import { useMemo } from 'react'
import { bugDay, dayNumber, dayWanted, FIRST_DAY, wantedNames } from '../../games/findbug/daily'
import { BugPortrait } from '../../games/findbug/Portrait'
import { gamePlayHref } from '../../hooks/useHashRoute'
import type { PastSource } from '../../lib/dailyPast'
import { PastCourses } from './PastCourses'
import '../../styles/todaysWanted.css'

const SLUG = 'findbug'

/** A day's five wanted bugs side by side: its picture, as Today's Wanted draws them. */
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

const anchor = (day: string) => day

const playHref = (day: string) => `${gamePlayHref(SLUG)}?day=${day}`

const title = (day: string) => `Wanted #${dayNumber(day)}`

const sub = (day: string) => wantedNames(dayWanted(day))

const art = (day: string) => <WantedFaces day={day} />

/** Find the Bug's past days: every Today's Wanted before today's, newest first, each to play again as practice. */
export function BugArchive() {
  const today = bugDay()
  const source = useMemo<PastSource>(
    () => ({ slug: SLUG, today, first: FIRST_DAY, number: dayNumber, anchor, playHref, title, sub, art }),
    [today],
  )
  return <PastCourses source={source} />
}
