import { useId, useState } from 'react'
import { todayHref } from '../hooks/useHashRoute'
import { addMonths, markOf, monthOf, monthShort, monthWords, useAccountDays, type DayMark } from '../lib/pastDays'
import { CloseIcon, Panel } from './Panel'
import { addDays, dayParts, fullDate } from './todayPunches'
import '../styles/pastDay.css'

/*
 * Every day there have been Dailies, a month at a time, for going back further than the strip of days
 * (components/DayStrip.tsx, whose All days opens it). Each day wears its mark, as the account kept it,
 * and picks that day's ticket; ‹ › step a month, and the month's name opens its year, to jump to any month
 * at once. Signed out, the days are there unmarked.
 */

const LeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
const RightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
)
const CaretIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

const WEEK_HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MARK_WORDS: Record<DayMark, string> = {
  full: 'a Full ticket',
  kept: 'kept',
  frozen: 'missed, a streak freeze covered it',
  played: 'played, not kept',
  none: 'not played',
}

/** The Monday on or before a day. */
const mondayOf = (day: string) => addDays(day, -((dayParts(day).weekday + 6) % 7))

function clamp(month: string, first: string, last: string): string {
  return month < first ? first : month > last ? last : month
}

export function DayPicker({
  today,
  picked,
  since,
  signedIn,
  onClose,
}: {
  today: string
  /** The day the page shows. */
  picked: string
  /** The first day there were Dailies. */
  since: string
  signedIn: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const first = monthOf(since)
  const last = monthOf(today)
  const [month, setMonth] = useState(() => clamp(monthOf(picked), first, last))
  // The year shown in place of the month, once its name is pressed.
  const [year, setYear] = useState<number | null>(null)
  const known = useAccountDays(signedIn, [month])

  if (year != null) {
    const firstYear = Number(first.slice(0, 4))
    const lastYear = Number(last.slice(0, 4))
    return (
      <Panel labelledBy={titleId} onClose={onClose} className="dpk">
        <div className="dpk__head">
          <button type="button" className="dpk__step" disabled={year <= firstYear} aria-label={`${year - 1}`} onClick={() => setYear(year - 1)}>
            <LeftIcon />
          </button>
          <button type="button" id={titleId} className="dpk__title" aria-label={`${year}: back to ${monthWords(month)}`} onClick={() => setYear(null)}>
            {year}
            <CaretIcon />
          </button>
          <button type="button" className="dpk__step" disabled={year >= lastYear} aria-label={`${year + 1}`} onClick={() => setYear(year + 1)}>
            <RightIcon />
          </button>
          <button type="button" className="dpk__close" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <ol className="dpk__months">
          {Array.from({ length: 12 }, (_, i) => {
            const m = `${year}-${String(i + 1).padStart(2, '0')}`
            const open = m >= first && m <= last
            return (
              <li key={m}>
                {open ? (
                  <button
                    type="button"
                    className={`dpk__month${m === month ? ' dpk__month--on' : ''}`}
                    aria-current={m === month ? 'date' : undefined}
                    onClick={() => {
                      setMonth(m)
                      setYear(null)
                    }}
                  >
                    {monthShort(m)}
                  </button>
                ) : (
                  <span className="dpk__month dpk__month--off" aria-disabled="true">
                    {monthShort(m)}
                    <small>{m < first ? 'Before the Dailies' : 'Still to come'}</small>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        <p className="dpk__note">A month opens on its days.</p>
      </Panel>
    )
  }

  const start = mondayOf(`${month}-01`)
  const lastDay = addDays(`${addMonths(month, 1)}-01`, -1)
  const end = addDays(mondayOf(lastDay), 6)
  const cells: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d)
  const marked = cells.some((d) => known.has(d))
  // The key says Frozen only for a month with a day a streak freeze covered.
  const frozen = cells.some((d) => known.get(d)?.frozen)
  return (
    <Panel labelledBy={titleId} onClose={onClose} className="dpk">
      <div className="dpk__head">
        <button
          type="button"
          className="dpk__step"
          disabled={month <= first}
          aria-label={month <= first ? `${monthWords(addMonths(month, -1))}: before the Dailies` : monthWords(addMonths(month, -1))}
          onClick={() => setMonth(addMonths(month, -1))}
        >
          <LeftIcon />
        </button>
        <button
          type="button"
          id={titleId}
          className="dpk__title"
          aria-label={`${monthWords(month)}: pick a month`}
          onClick={() => setYear(Number(month.slice(0, 4)))}
        >
          {monthWords(month)}
          <CaretIcon />
        </button>
        <button type="button" className="dpk__step" disabled={month >= last} aria-label={monthWords(addMonths(month, 1))} onClick={() => setMonth(addMonths(month, 1))}>
          <RightIcon />
        </button>
        <button type="button" className="dpk__close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="dpk__grid">
        {WEEK_HEAD.map((name, i) => (
          <span key={`h${i}`} className="dpk__dow" aria-hidden="true">
            {name}
          </span>
        ))}
        {cells.map((d) => {
          const n = dayParts(d).date.getUTCDate()
          if (monthOf(d) !== month) {
            return (
              <span key={d} className="dpk__d dpk__d--out" aria-hidden="true">
                {n}
              </span>
            )
          }
          if (d < since || d > today) {
            return (
              <span key={d} className="dpk__d dpk__d--off" aria-disabled="true" aria-label={`${fullDate(d)}: ${d < since ? 'before the Dailies' : 'still to come'}`}>
                {n}
              </span>
            )
          }
          const said = known.get(d)
          const mark = said ? markOf(said) : null
          const isToday = d === today
          return (
            <a
              key={d}
              className={`dpk__d${mark ? ` dpk__d--${mark}` : ''}${isToday ? ' dpk__d--today' : ''}${d === picked ? ' dpk__d--on' : ''}`}
              href={todayHref(isToday ? undefined : d)}
              aria-current={d === picked ? 'date' : undefined}
              aria-label={`${isToday ? 'Today, ' : ''}${fullDate(d)}${mark ? `: ${MARK_WORDS[mark]}` : ''}`}
              onClick={onClose}
            >
              {n}
            </a>
          )
        })}
      </div>
      <div className="dpk__foot">
        {marked ? (
          <span className="dpk__key" aria-hidden="true">
            <span className="dpk__key-kept">Kept</span>
            <span className="dpk__key-full">Full</span>
            <span className="dpk__key-played">Played</span>
            {frozen ? <span className="dpk__key-frozen">Frozen</span> : null}
          </span>
        ) : null}
        <a className="dpk__today" href={todayHref()} onClick={onClose}>
          Today
        </a>
      </div>
      <p className="dpk__note">‹ › step a month. The month’s name opens the year.</p>
    </Panel>
  )
}
