import { useState } from 'react'
import { openFeedback } from '../lib/feedback'
import { LAUNCH_DAY_ENDS } from '../lib/launch'
import { useSeason } from '../lib/season'
import '../styles/testRun.css'

/*
 * Under the header on every page until launch: the site is a test run, and what's played on it is reset when
 * Blipka opens (Ramsey, 2026-10-16: "maybe we should put a banner on the website informing users that the data
 * will be reset on that date?"). Accounts and tags stay through the reset (the API's resetWorld.ts). It also
 * asks testers to say what they find, through the feedback sheet.
 *
 * It goes once the launch reset has happened, or when launch day is over. Hidden with its close, it stays hidden
 * on this device, except that a note hidden before the last week comes back once for it.
 */

const HIDDEN_KEY = 'skermix-testrun-note'
/** The last week (from Oct 24, New York): a note hidden before this comes back once. */
const REMIND_FROM = Date.UTC(2026, 9, 24, 4, 0, 0)
/** A reset from Oct 30 on is the launch one: after it there's nothing left to warn about. */
const LAUNCH_RESET_FROM = Date.UTC(2026, 9, 30, 4, 0, 0)

function hiddenNow(now: number): boolean {
  try {
    const at = Number(localStorage.getItem(HIDDEN_KEY) ?? 0)
    return at > 0 && !(now >= REMIND_FROM && at < REMIND_FROM)
  } catch {
    return false
  }
}

export function TestRunBanner() {
  const { resetAt } = useSeason()
  const [hidden, setHidden] = useState(() => hiddenNow(Date.now()))
  if (hidden || Date.now() >= LAUNCH_DAY_ENDS || (resetAt ?? 0) >= LAUNCH_RESET_FROM) return null

  const hide = () => {
    setHidden(true)
    try {
      localStorage.setItem(HIDDEN_KEY, String(Date.now()))
    } catch {
      /* hidden for this visit only */
    }
  }

  return (
    <aside className="testrun" aria-label="Test run">
      <span className="testrun__kicker">Test run</span>
      <p className="testrun__text">
        Scores, tickets and progress reset on Oct 31, when Blipka opens. Your account and tag stay.
      </p>
      <button type="button" className="testrun__tell" onClick={() => openFeedback('problem')}>
        Found a bug? Tell us
      </button>
      <button type="button" className="testrun__close" aria-label="Hide this note" onClick={hide}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
          <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
        </svg>
      </button>
    </aside>
  )
}
