import { useEffect, useRef, useState } from 'react'
import { todayHref } from '../hooks/useHashRoute'
import { doneOf, markOf, type DayMark } from '../lib/pastDays'
import type { TodayServerDay } from '../lib/today'
import { DayPicker } from './DayPicker'
import { CheckIcon } from './TodayCard'
import { FreezeIcon, StarIcon } from './TodayChip'
import { addDays, dayParts, fullDate } from './todayPunches'
import '../styles/pastDay.css'

/*
 * The Dailies page's strip of days, under its head: the last week, ending today, each with how it went
 * (a Full ticket, kept, played, or not), and the one shown picked. Any of them opens that day's ticket;
 * All days opens the calendar (DayPicker), for going back a month at a time. Days before the Dailies
 * began are there, and closed. A phone scrolls it.
 */

/** The strip's days: a week, ending today. */
const STRIP_DAYS = 7
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MARK_WORDS: Record<DayMark, string> = { full: 'Full', kept: 'Kept', frozen: 'Frozen', played: '', none: 'Not played' }

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
)

export function DayStrip({
  today,
  picked,
  since,
  known,
  todayCount,
  signedIn,
}: {
  today: string
  /** The day the page shows. */
  picked: string
  /** The first day there were Dailies. */
  since: string
  /** The account's days the page knows (lib/pastDays.ts useAccountDays). */
  known: ReadonlyMap<string, TodayServerDay>
  /** Today so far, as the ticket has it: this device's punches count at once. */
  todayCount: { done: number; of: number; mark: DayMark }
  signedIn: boolean
}) {
  const [picking, setPicking] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i - (STRIP_DAYS - 1)))

  // A narrow strip scrolls: the picked day is brought into view, without moving the page.
  useEffect(() => {
    const list = listRef.current
    const chip = list?.querySelector<HTMLElement>('[aria-current="date"]')
    if (!list || !chip) return
    const left = chip.offsetLeft - list.offsetLeft
    if (left < list.scrollLeft || left + chip.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = left - (list.clientWidth - chip.offsetWidth) / 2
    }
  }, [picked])

  return (
    <nav className="pds" aria-label="Pick a day">
      <ol className="pds__days" ref={listRef}>
        {days.map((day) => {
          const isToday = day === today
          const { weekday, date } = dayParts(day)
          const name = isToday ? 'Today' : WEEKDAY_SHORT[weekday]
          const n = date.getUTCDate()
          if (day < since) {
            return (
              <li key={day}>
                <span className="pds__day pds__day--off" aria-disabled="true" aria-label={`${fullDate(day)}: before the Dailies`}>
                  <span className="pds__name">{name}</span>
                  <b className="pds__n">{n}</b>
                  <span className="pds__sub">Before the Dailies</span>
                </span>
              </li>
            )
          }
          const said = known.get(day)
          const mark = isToday ? todayCount.mark : said ? markOf(said) : null
          const count = isToday ? todayCount : said ? doneOf(said) : null
          const sub = isToday
            ? count?.of
              ? `${count.done} of ${count.of} so far`
              : ''
            : mark && count
              ? mark === 'none'
                ? MARK_WORDS.none
                : [MARK_WORDS[mark], `${count.done} of ${count.of}`].filter(Boolean).join(' · ')
              : ''
          const on = day === picked
          return (
            <li key={day}>
              <a
                className={`pds__day${mark ? ` pds__day--${mark}` : ''}${isToday ? ' pds__day--today' : ''}${on ? ' pds__day--on' : ''}`}
                href={todayHref(isToday ? undefined : day)}
                aria-current={on ? 'date' : undefined}
                aria-label={`${isToday ? 'Today, ' : ''}${fullDate(day)}${sub ? `: ${sub}` : ''}`}
              >
                <span className="pds__name">{name}</span>
                <b className="pds__n">{n}</b>
                <span className="pds__mark" aria-hidden="true">
                  {mark === 'full' ? <StarIcon /> : mark === 'kept' ? <CheckIcon /> : mark === 'frozen' ? <FreezeIcon /> : isToday && count?.of ? count.done : null}
                </span>
                {sub ? <span className="pds__sub">{sub}</span> : null}
              </a>
            </li>
          )
        })}
      </ol>
      <button type="button" className="pds__all" aria-haspopup="dialog" onClick={() => setPicking(true)}>
        <CalendarIcon />
        All days
      </button>
      {picking ? <DayPicker today={today} picked={picked} since={since} signedIn={signedIn} onClose={() => setPicking(false)} /> : null}
    </nav>
  )
}
