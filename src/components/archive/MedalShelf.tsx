import { plusHref } from '../../hooks/useHashRoute'
import { formatLeaderboardScore } from '../../lib/leaderboardFormat'
import { MEDAL_NAMES, MEDALS, nextMedal, type Medal, type RaceGame } from '../../lib/raceMedals'
import { MedalIcon } from '../RaceMedal'
import '../../styles/medalShelf.css'

/*
 * Your medals on a racing daily's past courses (Ramsey picked A and C of the "Medal collection" canvas,
 * 2026-10-09): over the cards, a shelf of how many of each you hold and how many courses are gold or better,
 * with filters for the ones short of gold and the ones not raced; and on each card, its four medals with yours
 * lit and the next one's gap ("0.62s to platinum"). Your best on a course is your quickest run on it: on its
 * day, in the week after, or as a Plus member's practice once it's older (lib/courseBests.ts). Older courses
 * stay Plus's to race again, and both the shelf and the cards say so (his "make sure user is still aware of
 * the Plus on the older tracks").
 */

/** Your medal on one course: your best time on it (ms, none if not raced), what it takes, and the next one. */
export type CourseMedal = { ms: number | null; medal: Medal | null; paceMs: number }

export type MedalFilter = 'all' | 'short' | 'none'

const goldOrBetter = (m: Medal | null) => m === 'gold' || m === 'platinum'

/** Whether a course shows under a filter. */
export function medalFilterKeeps(filter: MedalFilter, m: CourseMedal | undefined): boolean {
  if (filter === 'all') return true
  if (filter === 'none') return !m || m.ms == null
  return Boolean(m && m.ms != null && !goldOrBetter(m.medal))
}

/** Seconds as a card says a gap: "0.62s". */
const gapWords = (ms: number) => `${(Math.max(ms, 10) / 1000).toFixed(2)}s`

export function MedalShelf({
  game,
  courses,
  medals,
  filter,
  onFilter,
  locked,
}: {
  game: string
  /** Every past course's day. */
  courses: readonly string[]
  medals: ReadonlyMap<string, CourseMedal>
  filter: MedalFilter
  onFilter: (f: MedalFilter) => void
  /** How many of the courses are over a week old and, without Plus, not yours to race again. */
  locked: number
}) {
  const counts: Record<Medal, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 }
  let notYet = 0
  let short = 0
  for (const day of courses) {
    const m = medals.get(day)
    if (m?.medal) counts[m.medal]++
    else notYet++
    if (m && m.ms != null && !goldOrBetter(m.medal)) short++
  }
  const top = counts.gold + counts.platinum
  const total = courses.length
  const notRaced = courses.filter((d) => medalFilterKeeps('none', medals.get(d))).length
  const chips: { id: MedalFilter; label: string }[] = [
    { id: 'all', label: `All ${total}` },
    { id: 'short', label: `Short of gold · ${short}` },
    { id: 'none', label: `Not raced · ${notRaced}` },
  ]
  return (
    <section className="ms" aria-labelledby="ms-title">
      <div className="ms__main">
        <div className="ms__head">
          <h3 id="ms-title" className="ms__title">
            Your medals
          </h3>
          <span className="ms__sub">Your best on each {game === 'hotlap' ? 'track' : 'course'}, against its blue</span>
        </div>
        <ul className="ms__counts">
          {[...MEDALS].reverse().map((medal) => (
            <li key={medal} className="ms__count">
              <MedalIcon medal={medal} size={28} dim={counts[medal] === 0} />
              <span>
                <b>{counts[medal]}</b>
                <small>{MEDAL_NAMES[medal]}</small>
              </span>
            </li>
          ))}
          <li className="ms__count ms__count--none">
            <span className="ms__empty" aria-hidden="true" />
            <span>
              <b>{notYet}</b>
              <small>Not yet</small>
            </span>
          </li>
        </ul>
      </div>
      <div className="ms__side">
        <span className="ms__progress-words">
          <b>
            Gold or better on {top} of {total}
          </b>
        </span>
        <span className="ms__bar" role="img" aria-label={`Gold or better on ${top} of ${total}`}>
          <span style={{ width: `${total ? Math.round((top / total) * 100) : 0}%` }} />
        </span>
        <div className="ms__chips" role="group" aria-label="Show">
          {chips.map((c) => (
            <button key={c.id} type="button" className={`ms__chip${filter === c.id ? ' ms__chip--on' : ''}`} aria-pressed={filter === c.id} onClick={() => onFilter(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {locked > 0 ? (
        <p className="ms__plus">
          <span>
            {locked} of these {locked === 1 ? 'is' : 'are'} over a week old. Your medals on them stay yours; racing them again, to better
            them, is Plus.
          </span>
          <a href={plusHref()}>See Plus ›</a>
        </p>
      ) : null}
    </section>
  )
}

/** A card's four medals, yours lit, and what the next one takes; on a course over a week old without Plus, that it's Plus's. */
export function CardMedals({ game, slug, medal, locked }: { game: RaceGame; slug: string; medal: CourseMedal; locked: boolean }) {
  const next = nextMedal(game, medal.paceMs, medal.medal)
  let words: string
  if (!next) words = 'All four'
  else if (locked) words = medal.ms == null ? 'Race it with Plus' : `Plus to go for ${MEDAL_NAMES[next.medal].toLowerCase()}`
  else if (medal.ms == null) words = `Beat ${formatLeaderboardScore(slug, 1_000_000 - next.ms)} for ${MEDAL_NAMES[next.medal].toLowerCase()}`
  else words = `${gapWords(medal.ms - next.ms)} to ${MEDAL_NAMES[next.medal].toLowerCase()}`
  const held = medal.medal ? MEDALS.indexOf(medal.medal) : -1
  return (
    <div className={`pcm${locked ? ' pcm--locked' : ''}`}>
      <span className="pcm__ladder" role="img" aria-label={medal.medal ? `Your medal: ${MEDAL_NAMES[medal.medal]}` : 'No medal yet'}>
        {MEDALS.map((m, i) => (
          <MedalIcon key={m} medal={m} size={20} dim={i > held} className={m === medal.medal ? 'pcm__held' : undefined} />
        ))}
      </span>
      <span className={`pcm__next${next ? '' : ' pcm__next--all'}`}>{words}</span>
    </div>
  )
}

/** The medal in a card's corner. */
export function CardBadge({ medal }: { medal: Medal }) {
  return (
    <span className="pcm-badge">
      <MedalIcon medal={medal} size={18} />
      {MEDAL_NAMES[medal]}
    </span>
  )
}

/** What a card's play button says when a medal is there to chase. */
export function chaseWords(game: RaceGame, medal: CourseMedal): string | null {
  const next = nextMedal(game, medal.paceMs, medal.medal)
  return next ? `Go for ${MEDAL_NAMES[next.medal].toLowerCase()}` : null
}
