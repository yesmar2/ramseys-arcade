import { Suspense } from 'react'
import { lazyPage } from '../lib/lazyPage'
import { dailyWords } from '../lib/dailyWords'
import '../styles/dailyPast.css'

/*
 * A daily's past tab (/games/<slug>/past): Past tracks, Past holes, Past days or Past courses. What a past
 * course counts toward, the last seven days, and every course before today's with how its day went, each
 * to play again (components/archive/PastCourses.tsx). Each game's list comes in a chunk of its own, with
 * its plan.
 */

const TrackArchive = lazyPage(() => import('./archive/TrackArchive').then((m) => m.TrackArchive))
const HoleArchive = lazyPage(() => import('./archive/HoleArchive').then((m) => m.HoleArchive))
const BugArchive = lazyPage(() => import('./archive/BugArchive').then((m) => m.BugArchive))
const PourArchive = lazyPage(() => import('./archive/PourArchive').then((m) => m.PourArchive))
const CourseArchive = lazyPage(() => import('./archive/CourseArchive').then((m) => m.CourseArchive))

/** Each daily's list of its past courses. */
const LISTS: Record<string, typeof TrackArchive> = {
  hotlap: TrackArchive,
  acechase: HoleArchive,
  findbug: BugArchive,
  halffull: PourArchive,
  marblerun: CourseArchive,
}

/** While a game's list is on its way: the shape of the tab, so nothing jumps when it comes. */
function PastTabWaiting({ slug }: { slug: string }) {
  return (
    <div className="dp dp--wait" aria-busy="true" aria-label={`Loading ${dailyWords(slug).pastTab.toLowerCase()}`}>
      <div className="dp-skel dp-skel--rule" />
      <div className="dp-skel dp-skel--week" />
      <div className="dp-skel dp-skel--row" />
      <div className="dp-skel dp-skel--row" />
      <div className="dp-skel dp-skel--row" />
    </div>
  )
}

export function DailyPastTab({ slug }: { slug: string }) {
  const List = LISTS[slug]
  if (!List) return null
  return (
    <Suspense fallback={<PastTabWaiting slug={slug} />}>
      <List />
    </Suspense>
  )
}
