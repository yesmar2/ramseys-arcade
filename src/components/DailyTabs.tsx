import { useEffect, useState, type ReactNode, type Ref } from 'react'
import { dailyTabHref } from '../hooks/useHashRoute'
import { dailyWords, type DailyTab } from '../lib/dailyWords'
import '../styles/dailyTabs.css'

/*
 * A daily game's tabs, under its hero: Today (the page itself), its past courses and its records. Each is
 * a real link with its own address, so a tab can be shared, opened in a new tab or reached with Back. On a
 * phone they are one segmented control. They stand in for the header's week and month: a daily's page is
 * always today's.
 */

const TodayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M10 8.8v6.4l5.2-3.2z" />
  </svg>
)

const PastIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
)

const RecordsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5.2a3 3 0 0 0 3.2 4M16 6h2.8a3 3 0 0 1-3.2 4M12 13v4M8.5 20.5h7M9.5 17h5" />
  </svg>
)

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

const dayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

/** "Tue, Sep 29": the day on the boards' clock, moved on at midnight while the page is open. */
function useBoardDayWords(): string {
  const [words, setWords] = useState(() => dayFormat.format(new Date()))
  useEffect(() => {
    const timer = window.setInterval(() => setWords(dayFormat.format(new Date())), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return words
}

export function DailyTabs({
  slug,
  gameName,
  tab,
  ref,
}: {
  slug: string
  gameName: string
  tab: DailyTab
  /** The bar, for the page to scroll to when the tab changes. */
  ref?: Ref<HTMLDivElement>
}) {
  const words = dailyWords(slug)
  const day = useBoardDayWords()
  const tabs: { key: DailyTab; label: string; icon: ReactNode }[] = [
    { key: 'today', label: 'Today', icon: <TodayIcon /> },
    { key: 'past', label: words.pastTab, icon: <PastIcon /> },
    { key: 'records', label: 'Records', icon: <RecordsIcon /> },
  ]
  return (
    <div className="dtabs" ref={ref}>
      <nav className="dtabs__list" aria-label={`${gameName} pages`}>
        {tabs.map((t) => (
          <a
            key={t.key}
            className="dtabs__tab"
            href={dailyTabHref(slug, t.key)}
            aria-current={t.key === tab ? 'page' : undefined}
          >
            {t.icon}
            {t.label}
          </a>
        ))}
      </nav>
      <p className="dtabs__meta">
        <ClockIcon />
        <span>
          {day} · a new {words.course} comes at midnight, New York time
        </span>
      </p>
    </div>
  )
}
