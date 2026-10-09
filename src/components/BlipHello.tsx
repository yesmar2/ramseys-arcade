import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { homeHref, navigate, useRoute } from '../hooks/useHashRoute'
import { usePoll } from '../lib/poll'
import { scrollToPlace } from '../lib/scrollToPlace'
import { BlipFigure } from './BlipFigure'
import '../styles/blipPoll.css'

/*
 * Blip says hello once a day (the light B on the "Blip's daily poll" canvas, 2026-10-09): a little while
 * after the first page of the day opens, he waves from the corner with today's question for you. Tap him and
 * you're at his card on the home page; the cross, or a while untouched, sends him off till tomorrow. Not on a
 * game's screen, on /admin, once today's question is answered, or on anyone's very first visit (the welcome is
 * enough that day).
 */

const SEEN_KEY = 'skermix-blip-hello'
/** How long after the page opens he comes out, and how long he waits to be tapped. */
const COME_OUT_MS = 2500
const WAIT_MS = 14_000

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

  useEffect(() => {
    if (!out || !today) return
    const go = window.setTimeout(() => {
      markSeen(today.day)
      setOut(false)
    }, WAIT_MS)
    return () => window.clearTimeout(go)
  }, [out, today])

  if (!out || !due || !today) return null

  const close = () => {
    markSeen(today.day)
    setOut(false)
  }
  const open = () => {
    close()
    if (route.name !== 'home') navigate(homeHref())
    scrollToPlace(() => document.getElementById('blip-poll'), 'center')
  }

  return (
    <div className="blip-hello" role="complementary" aria-label="Blip has a question">
      <button type="button" className="blip-hello__bubble" onClick={open}>
        Quick question for you!
        <span className="blip-hello__q">{today.q}</span>
      </button>
      <button type="button" className="blip-hello__blip" onClick={open} aria-label={`Answer Blip: ${today.q}`}>
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
