import { Suspense } from 'react'
import { lazyPage } from '../lib/lazyPage'
import { dailyWords } from '../lib/dailyWords'
import '../styles/dailyPast.css'

/*
 * A daily's past tab (/games/<slug>/past): Past tracks, Past holes, Past days, Past courses or Past caves. Every course
 * before today's as a card, with how its day went and its boards, each to play again
 * (components/archive/PastCourses.tsx). Each game's cards come in a chunk of their own, with its plan.
 */

const TrackArchive = lazyPage(() => import('./archive/TrackArchive').then((m) => m.TrackArchive))
const HoleArchive = lazyPage(() => import('./archive/HoleArchive').then((m) => m.HoleArchive))
const BugArchive = lazyPage(() => import('./archive/BugArchive').then((m) => m.BugArchive))
const PourArchive = lazyPage(() => import('./archive/PourArchive').then((m) => m.PourArchive))
const CourseArchive = lazyPage(() => import('./archive/CourseArchive').then((m) => m.CourseArchive))
const CaveArchive = lazyPage(() => import('./archive/CaveArchive').then((m) => m.CaveArchive))
const HillsArchive = lazyPage(() => import('./archive/HillsArchive').then((m) => m.HillsArchive))
const PlatesArchive = lazyPage(() => import('./archive/PlatesArchive').then((m) => m.PlatesArchive))

/** Each daily's cards of its past courses. */
const LISTS: Record<string, typeof TrackArchive> = {
  hotlap: TrackArchive,
  acechase: HoleArchive,
  findbug: BugArchive,
  halffull: PourArchive,
  centroid: PlatesArchive,
  marblerun: CourseArchive,
  lander: CaveArchive,
  swoop: HillsArchive,
}

/** While a game's cards are on their way: the tab's title and a row of cards' shapes, so nothing jumps when they come. */
function PastTabWaiting({ slug }: { slug: string }) {
  const words = dailyWords(slug)
  return (
    <div className="dp dp--wait" aria-busy="true" aria-label={`Loading ${words.pastTab.toLowerCase()}`}>
      <div className="dp-head">
        <h2 className="dp-head__title">{words.pastTab}</h2>
      </div>
      <div className="pc-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`dp-skel dp-skel--card${words.past === 'board' ? ' dp-skel--boards' : ''}`} />
        ))}
      </div>
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
