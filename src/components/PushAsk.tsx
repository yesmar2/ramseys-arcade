import { useEffect, useId, useState, type MouseEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useDeliberatePress } from '../hooks/useDeliberatePress'
import { APP_NAME } from '../lib/brand'
import { acceptAsk, askMode, snoozeAsks, type AskMode, type AskReason } from '../lib/pushAsk'
import { fetchToday, liveDailies, subscribeToday, todayRule, todayServer, type TodayServer } from '../lib/today'
import { FlameIcon } from './chromeIcons'
import '../styles/pushAsk.css'

/*
 * The arcade's own ask for alerts (lib/pushAsk.ts): a card in the moment an alert is worth having, whose
 * yes brings up the browser's question. Nothing asks on a page load.
 */

type Words = { title: string; hint: string; yes: string; done: string }

const WORDS: Record<AskReason, Words> = {
  streak: {
    title: 'Want a nudge before your streak ends?',
    hint: 'One alert before the day ends, only on a day you haven’t kept. Never at night.',
    yes: 'Remind me',
    done: 'You’re set. On a day you haven’t kept, you’ll get a nudge before it ends.',
  },
  challenge: {
    title: 'Want to know when they beat it?',
    hint: 'One alert when your friend tops your score, so you can take it back.',
    yes: 'Tell me',
    done: 'You’re set. You’ll hear when they beat it.',
  },
  match: {
    title: 'Want an alert when your match opens?',
    hint: 'Matches run on a clock, and one you don’t play is lost. Never at night.',
    yes: 'Alert me',
    done: 'You’re set. You’ll get an alert when each match opens, and before it closes.',
  },
}

const HOME_SCREEN = `On iPhone, alerts work once ${APP_NAME} is on your Home Screen: tap Share, then Add to Home Screen, and open it from there.`

const FAILED: Record<string, string> = {
  denied: 'Your browser said no, so there won’t be alerts. You can allow notifications for this site in the browser’s settings.',
  'home-screen': HOME_SCREEN,
}
const FAILED_ELSE = 'Couldn’t turn alerts on just now. Try again in a moment.'

function BellGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3a5.5 5.5 0 0 0-5.5 5.5v3.1L4.8 15h14.4l-1.7-3.4V8.5A5.5 5.5 0 0 0 12 3Z" />
      <path d="M9.8 17.6a2.3 2.3 0 0 0 4.4 0" />
    </svg>
  )
}

/**
 * Ask for alerts for `reason`, if this device should be asked: signed in, alerts not on here yet, not held
 * back by a Not now, and the browser able to say yes. Renders nothing otherwise.
 */
export function PushAsk({
  reason,
  streak = 0,
  className = '',
  preview,
}: {
  reason: AskReason
  streak?: number
  className?: string
  /** Shown as this whatever the device (the dev page's samples): no sign-in or browser needed. */
  preview?: AskMode
}) {
  const { signedIn: reallySignedIn } = useAuth()
  const signedIn = reallySignedIn || Boolean(preview)
  const [mode, setMode] = useState<AskMode | null>(preview ?? null)
  const [state, setState] = useState<'open' | 'busy' | 'done' | 'closed'>('open')
  const [error, setError] = useState<string | null>(null)
  const allow = useDeliberatePress()
  const titleId = useId()

  useEffect(() => {
    if (preview) return
    if (!signedIn) {
      setMode(null)
      return
    }
    let live = true
    void askMode(reason, streak).then((m) => {
      if (live) setMode(m)
    })
    return () => {
      live = false
    }
  }, [preview, signedIn, reason, streak])

  if (!signedIn || !mode || state === 'closed') return null
  const words = WORDS[reason]
  const install = mode === 'home-screen'

  const yes = (e: MouseEvent) => {
    if (!allow(e) || state === 'busy') return
    // A sample says what a yes looks like, without asking the browser anything.
    if (preview) {
      setState('done')
      return
    }
    setState('busy')
    setError(null)
    // The browser's question comes first thing, inside the tap (lib/push.ts enablePush).
    void acceptAsk(reason).then(
      (result) => {
        if (result.ok) setState('done')
        else {
          setError(FAILED[result.reason] ?? FAILED_ELSE)
          setState('open')
        }
      },
      () => {
        setError(FAILED_ELSE)
        setState('open')
      },
    )
  }
  const notNow = (e: MouseEvent) => {
    if (!allow(e)) return
    if (!preview) snoozeAsks(streak)
    setState('closed')
  }

  const kicker = reason === 'streak' && streak > 0 ? (streak === 1 ? 'Streak started' : `Day ${streak} kept`) : null
  const done = state === 'done'
  const busy = state === 'busy'

  return (
    <div className={`push-ask push-ask--for-${reason} ${className}`} role="group" aria-labelledby={titleId}>
      <span className="push-ask__mark" aria-hidden="true">
        {reason === 'streak' ? <FlameIcon /> : <BellGlyph />}
      </span>
      <div className="push-ask__text">
        {kicker && !done ? <span className="push-ask__kicker">{kicker}</span> : null}
        <span className="push-ask__title" id={titleId}>
          {done ? 'Alerts on' : words.title}
        </span>
        <span className="push-ask__hint" aria-live="polite">
          {done ? words.done : install ? HOME_SCREEN : words.hint}
        </span>
        {error ? <span className="push-ask__error">{error}</span> : null}
      </div>
      {done ? null : (
        <div className="push-ask__acts">
          {install ? (
            <button type="button" className="panel__btn panel__btn--ghost push-ask__btn" onClick={notNow}>
              Got it
            </button>
          ) : (
            <>
              <button type="button" className="panel__btn push-ask__btn" disabled={busy} onClick={yes}>
                {busy ? 'Asking…' : words.yes}
              </button>
              <button type="button" className="panel__btn panel__btn--ghost push-ask__btn" onClick={notNow}>
                Not now
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Whether today's Dailies are kept, as the API has it: as many of today's card done as keep the day. */
function keptToday(server: TodayServer | null): boolean {
  if (!server) return false
  const live = server.live ?? liveDailies(server.day, server).map((d) => d.key)
  const need = server.need ?? todayRule(live.length, server.day).need
  return live.length > 0 && live.filter((key) => server.done[key as keyof TodayServer['done']]).length >= need
}

/**
 * The streak's ask, on a daily's result once today is kept: asked of the API again a moment after the run
 * saves, since a save that keeps the day doesn't always say so itself.
 */
export function StreakPushAsk({ active, className }: { active: boolean; className?: string }) {
  const [server, setServer] = useState<TodayServer | null>(() => todayServer())
  useEffect(() => {
    if (!active) return
    const sync = () => setServer(todayServer())
    const stop = subscribeToday(sync)
    const later = window.setTimeout(() => void fetchToday(true), 900)
    return () => {
      stop()
      window.clearTimeout(later)
    }
  }, [active])
  if (!active || !keptToday(server)) return null
  return <PushAsk reason="streak" streak={server?.streak.current ?? 0} className={className} />
}
