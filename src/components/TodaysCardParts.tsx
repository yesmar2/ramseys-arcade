import { dailyTabHref } from '../hooks/useHashRoute'
import { dailyWords, todayKind } from '../lib/dailyWords'
import { RunLabel } from './RunLabel'
import { openSiteMenu } from './siteNav'

/*
 * What every daily's Today card (Today's Track, Hole, Wanted, Pour and Course) says the same way: that
 * today's run counts toward your rank (or is just for fun, on Ace Chase, Find the Bug and Half Full), and a
 * real button to the game's past courses, named as its page's tab is, where a past one is played again
 * without counting. And a racing daily's run played signed out, which only this device has.
 */

const PastIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
)

/** What today's run counts toward: the label every Today card wears under its name. */
export function TodayCounts({ slug }: { slug: string }) {
  return <RunLabel kind={todayKind(slug)} slug={slug} className="evp-daily__label" />
}

/**
 * A racing daily's best today, run signed out (lib/deviceRuns.ts): its game keeps it here, and the Dailies ticket on
 * this device counts it, but only a sign-in on its run's report could have put it on the board, and that report is
 * gone. A run kept for a sign-in later (lib/pendingRuns.ts) is never a daily's. So: where it is, and the way to sign
 * in before the next. `run` is "lap" on Hot Lap.
 */
export function DeviceRunNote({ time, run = 'run' }: { time: string; run?: string }) {
  return (
    <p className="evp-card__copy evp-daily__mine">
      Your best {run} today, {time}, is on this device only.{' '}
      <button type="button" className="evp-daily__signin" onClick={openSiteMenu}>
        Sign in
      </button>{' '}
      and your next {run} goes on the board.
    </p>
  )
}

/** The way to a daily's past courses: its page's Past tab, "Past tracks", "Past days"… */
export function PastTabButton({ slug }: { slug: string }) {
  return (
    <a className="evp-btn evp-btn--small evp-btn--ghost evp-daily__past" href={dailyTabHref(slug, 'past')}>
      <PastIcon />
      {dailyWords(slug).pastTab}
    </a>
  )
}
