import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ACCOUNT_ID_EVENT, AUTH_EVENT } from '../lib/accountEvents'
import { PLAYER_NAME_EVENT } from '../lib/leaderboard'
import { PENDING_SAVED_EVENT, savePendingRuns, type PendingSaved } from '../lib/pendingRuns'
import '../styles/pendingRuns.css'

/*
 * Runs played signed out go on the boards once their player signs in (lib/pendingRuns.ts): whenever this
 * device signs in, changes account or takes a tag, and once as the site opens. A note says what went on,
 * for a few seconds, over whatever page is up.
 */

/** A beat after the sign-in or the tag, so the account's tag and its claim are in before the saves go. */
const SETTLE_MS = 1500
const NOTE_MS = 6000

export function PendingRunsSaver() {
  const [note, setNote] = useState<PendingSaved | null>(null)

  useEffect(() => {
    let timer = window.setTimeout(() => void savePendingRuns(), SETTLE_MS * 2)
    const soon = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void savePendingRuns(), SETTLE_MS)
    }
    const events = [AUTH_EVENT, ACCOUNT_ID_EVENT, PLAYER_NAME_EVENT]
    for (const name of events) window.addEventListener(name, soon)
    return () => {
      window.clearTimeout(timer)
      for (const name of events) window.removeEventListener(name, soon)
    }
  }, [])

  useEffect(() => {
    let hide = 0
    const onSaved = (e: Event) => {
      setNote((e as CustomEvent<PendingSaved>).detail)
      window.clearTimeout(hide)
      hide = window.setTimeout(() => setNote(null), NOTE_MS)
    }
    window.addEventListener(PENDING_SAVED_EVENT, onSaved)
    return () => {
      window.clearTimeout(hide)
      window.removeEventListener(PENDING_SAVED_EVENT, onSaved)
    }
  }, [])

  if (!note || typeof document === 'undefined') return null
  // On the page itself, as a panel is (Panel.tsx), so it shows over a run's report when it's up.
  return createPortal(
    <div className="pending-note" role="status">
      <span className="pending-note__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.2 4.2L19 7" />
        </svg>
      </span>
      <span className="pending-note__words">
        <b>
          {note.saved === 1 ? 'Your earlier run is saved' : `Your ${note.saved} earlier runs are saved`}
        </b>
        <span>
          On the boards from before you signed in{note.tickets > 0 ? `, with ${note.tickets} ${note.tickets === 1 ? 'ticket' : 'tickets'}` : ''}.
        </span>
      </span>
      <button type="button" className="pending-note__close" aria-label="Close" onClick={() => setNote(null)}>
        ×
      </button>
    </div>,
    document.body,
  )
}
