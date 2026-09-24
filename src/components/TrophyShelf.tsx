import { useState } from 'react'
import { tournamentCreateHref } from '../hooks/useHashRoute'
import { ordinal } from '../lib/profileMath'
import { summarizeTrophies, trophyTone, type TrophyAward } from '../lib/trophies'
import { medalKind } from './PodiumMedal'
import { EventCup, MonthlyTrophyCup, TopTenRibbon, WeeklyMedal } from './TrophyArt'

/** Board trophies shown before "Show all": two shelves' worth on a wide screen. */
const BOARD_SHOWN = 8

function TrophyIcon({ trophy }: { trophy: TrophyAward }) {
  const kind = medalKind(trophy.rank)
  // An event win is a cup: the whole thing, not a place on a board.
  if (trophy.period === 'event') return <EventCup size="md" />
  if (trophy.period === 'monthly') return kind ? <MonthlyTrophyCup tone={kind} size="md" /> : <TopTenRibbon tone="monthly" rank={trophy.rank} size="md" />
  return kind ? <WeeklyMedal rank={trophy.rank} size="md" /> : <TopTenRibbon tone="weekly" rank={trophy.rank} size="md" />
}

/** When a trophy was for: a day for an event, the week's Monday, or the month. */
function trophyWhen(t: TrophyAward): string {
  try {
    if (t.period === 'monthly') {
      const y = Math.floor(t.periodKey / 100)
      const m = t.periodKey % 100
      return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    const y = Math.floor(t.periodKey / 10_000)
    const m = Math.floor((t.periodKey % 10_000) / 100)
    const d = t.periodKey % 100
    const day = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return t.period === 'weekly' ? `Week of ${day}` : day
  } catch {
    return ''
  }
}

/** What the trophy was won with: 583 pts over 6 games. A bracket is won on matches, not points, so it says nothing. */
function trophyHaul(t: TrophyAward): string | null {
  if (t.score <= 0) return null
  const points = `${t.score.toLocaleString()} ${t.score === 1 ? 'pt' : 'pts'}`
  return t.games > 0 ? `${points} over ${t.games} ${t.games === 1 ? 'game' : 'games'}` : points
}

function Item({ trophy, wide }: { trophy: TrophyAward; wide?: boolean }) {
  const isEvent = trophy.period === 'event'
  const title = isEvent
    ? (trophy.eventTitle ?? 'An event')
    : `${ordinal(trophy.rank)} of the ${trophy.period === 'monthly' ? 'month' : 'week'}`
  const when = trophyWhen(trophy)
  const haul = trophyHaul(trophy)
  return (
    <li className={`pshelf__item${wide ? ' pshelf__item--wide' : ''}`}>
      {/* The plinth takes the trophy's colour, so a shelf reads by its metals at a glance. */}
      <span className={`pshelf__plinth pshelf__plinth--lit trophy-tone--${trophyTone(trophy.period, trophy.rank)}`}>
        <TrophyIcon trophy={trophy} />
      </span>
      <span className="pshelf__words">
        <span className="pshelf__name">{title}</span>
        <span className="pshelf__when">{isEvent ? `Event won · ${when}` : when}</span>
        {haul ? <span className="pshelf__haul">{haul}</span> : null}
      </span>
    </li>
  )
}

/**
 * The trophy shelf: event wins on one shelf, top-ten finishes of a week or a
 * month on another, newest first. Your own shelf keeps a place open for this
 * week. With nothing on it yet, it says how things get onto it; for most of
 * the arcade that is winning an event among friends, since the top ten of
 * everyone is a small club.
 */
export function TrophyShelf({
  trophies,
  isSelf,
  name,
}: {
  /** Null while loading. */
  trophies: TrophyAward[] | null
  isSelf: boolean
  name: string
}) {
  const [showAll, setShowAll] = useState(false)

  if (trophies === null) {
    return (
      <article className="pshelf pcard-panel" id="trophies" aria-busy="true" aria-label="Trophies">
        <div className="pshelf__head">
          <h2 className="pshelf__title">Trophy shelf</h2>
        </div>
        <div className="pshelf__shelf pshelf__shelf--wait" aria-hidden="true" />
      </article>
    )
  }

  const newest = (a: TrophyAward, b: TrophyAward) => b.awardedAt - a.awardedAt || a.rank - b.rank
  const events = trophies.filter((t) => t.period === 'event').sort(newest)
  const boards = trophies.filter((t) => t.period !== 'event').sort(newest)
  const shownBoards = showAll ? boards : boards.slice(0, BOARD_SHOWN)
  const s = summarizeTrophies(trophies)
  const bits = [
    s.events > 0 ? `${s.events} ${s.events === 1 ? 'event' : 'events'} won` : null,
    s.podium > 0 ? `${s.podium} ${s.podium === 1 ? 'podium' : 'podiums'}` : null,
    s.topTen > 0 ? `${s.topTen} top ten` : null,
  ].filter(Boolean)

  return (
    <article className="pshelf pcard-panel" id="trophies" aria-labelledby="pshelf-title">
      <div className="pshelf__head">
        <h2 className="pshelf__title" id="pshelf-title">
          Trophy shelf
        </h2>
        <span className="pshelf__note">{trophies.length === 0 ? 'None yet' : bits.join(' · ')}</span>
      </div>

      {trophies.length === 0 ? (
        <div className="pshelf__shelf pshelf__shelf--grow pshelf__shelf--empty">
          <p className="pshelf__cap">Ways onto the shelf</p>
          <ul className="pshelf__ways">
            <li className="pshelf__way">
              <span className="pshelf__plinth pshelf__plinth--empty">
                <EventCup size="md" />
              </span>
              <span className="pshelf__words">
                <span className="pshelf__name">Win an event</span>
                <span className="pshelf__when">
                  {isSelf
                    ? 'Start one with friends. Whoever finishes on top takes a trophy.'
                    : `Every event’s winner takes a trophy.`}
                </span>
                {isSelf ? (
                  <a className="pshelf__link" href={tournamentCreateHref()}>
                    Create an event ›
                  </a>
                ) : null}
              </span>
            </li>
            <li className="pshelf__way">
              <span className="pshelf__plinth pshelf__plinth--empty">
                <TopTenRibbon tone="weekly" size="md" />
              </span>
              <span className="pshelf__words">
                <span className="pshelf__name">Arcade top ten</span>
                <span className="pshelf__when">
                  {isSelf
                    ? 'Finish a week or a month in the top ten of the whole arcade.'
                    : `${name}’s first top-ten week or month will show here.`}
                </span>
              </span>
            </li>
          </ul>
        </div>
      ) : (
        <>
          {events.length > 0 ? (
            <div className="pshelf__shelf">
              <p className="pshelf__cap">Events won</p>
              <ol className="pshelf__row pshelf__row--events">
                {events.map((t) => (
                  <Item key={t.id} trophy={t} wide />
                ))}
              </ol>
            </div>
          ) : null}
          {boards.length > 0 || isSelf ? (
            <div className="pshelf__shelf pshelf__shelf--grow">
              <p className="pshelf__cap">Arcade top ten</p>
              <ol className="pshelf__row">
                {shownBoards.map((t) => (
                  <Item key={t.id} trophy={t} />
                ))}
                {isSelf ? (
                  <li className="pshelf__item pshelf__item--open">
                    <span className="pshelf__plinth pshelf__plinth--open" aria-hidden="true">
                      +
                    </span>
                    <span className="pshelf__words">
                      <span className="pshelf__name">This week</span>
                      <span className="pshelf__when">Still open</span>
                    </span>
                  </li>
                ) : null}
              </ol>
              {boards.length > BOARD_SHOWN ? (
                <button type="button" className="pshelf__more" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show fewer' : `Show all ${boards.length}`}
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      <p className="pshelf__foot">The arcade’s top ten each week and month get a trophy, and so does every event’s winner.</p>
    </article>
  )
}
