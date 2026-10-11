import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../hooks/useAuth'
import { useRoute } from '../hooks/useHashRoute'
import { usePoll } from '../lib/poll'
import { BlipFigure } from './BlipFigure'
import { BlipPoll } from './BlipPoll'
import { OPEN_MENU_EVENT } from './siteNav'
import '../styles/blipPoll.css'

/*
 * Blip says hello once a day (the light B on the "Blip's daily poll" canvas, 2026-10-09): a little while
 * after the first page of the day opens, he waves from the corner with today's question for you. Tap him and
 * the question opens right there, a sheet up from the bottom on a phone and a card over him on a desk, to
 * answer without leaving the page (Ramsey, 2026-10-11: "should it be a modal on mobile so it doesn't take you
 * to a different part of the page when you click on the blip?"). He waits until you tap him, answer or press
 * the cross, page to page and through a reload (he'd gone after 14 untouched seconds, which was easy to miss);
 * the cross sends him off till tomorrow. Not on a game's screen, on /admin, once today's question is answered, or on anyone's very
 * first visit (the welcome is enough that day).
 */

const SEEN_KEY = 'skermix-blip-hello'
/** How long after the page opens he comes out. */
const COME_OUT_MS = 2500

function seenDay(): string | null | undefined {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return undefined
  }
}

function markSeen(day: string) {
  try {
    localStorage.setItem(SEEN_KEY, day)
  } catch {
    /* a browser that keeps nothing just sees him again */
  }
}

export function BlipHello({ onGameScreen }: { onGameScreen: boolean }) {
  const route = useRoute()
  const { signedIn } = useAuth()
  const { view } = usePoll(signedIn)
  const [out, setOut] = useState(false)
  const [open, setOpen] = useState(false)
  const today = view?.today ?? null
  const due = Boolean(today && today.pick == null && !onGameScreen && route.name !== 'admin')

  useEffect(() => {
    if (!due || !today) return
    const seen = seenDay()
    // Storage that can't be read, or a first visit: no hello today (and the first visit marks the day).
    if (seen === undefined) return
    if (seen === null) {
      markSeen(today.day)
      return
    }
    if (seen === today.day) return
    const come = window.setTimeout(() => setOut(true), COME_OUT_MS)
    return () => window.clearTimeout(come)
  }, [due, today])

  // Escape closes the question, as any sheet does.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Signing in is in the menu, which opens under the sheet: the sheet steps aside for it.
  useEffect(() => {
    if (!open) return
    const onMenu = () => setOpen(false)
    window.addEventListener(OPEN_MENU_EVENT, onMenu)
    return () => window.removeEventListener(OPEN_MENU_EVENT, onMenu)
  }, [open])

  // Leaving for a game's screen puts it all away.
  useEffect(() => {
    if (onGameScreen) {
      setOpen(false)
      setOut(false)
    }
  }, [onGameScreen])

  if (!today) return null

  if (open) {
    // On the page's body, as the phone's tab bar is (SiteTabs.tsx), so it can come up over it.
    return createPortal(
      <>
        <div className="blip-sheet__dim" aria-hidden="true" onClick={() => setOpen(false)} />
        <div className="blip-sheet" role="dialog" aria-modal="true" aria-label="Blip’s question">
          <BlipPoll inSheet />
          <button type="button" className="blip-sheet__close" onClick={() => setOpen(false)} aria-label="Close">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>
      </>,
      document.body,
    )
  }

  if (!out || !due) return null

  const close = () => {
    markSeen(today.day)
    setOut(false)
  }
  const ask = () => {
    // He's said hello for today: the question opens here, and he won't come out again until tomorrow.
    markSeen(today.day)
    setOut(false)
    setOpen(true)
  }

  return (
    <div className="blip-hello" role="complementary" aria-label="Blip has a question">
      <button type="button" className="blip-hello__bubble" onClick={ask}>
        Quick question for you!
        <span className="blip-hello__q">{today.q}</span>
      </button>
      <button type="button" className="blip-hello__blip" onClick={ask} aria-label={`Answer Blip: ${today.q}`}>
        <BlipFigure wave />
      </button>
      <button type="button" className="blip-hello__close" onClick={close} aria-label="Not now">
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  )
}
