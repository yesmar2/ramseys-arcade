import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { firstMoveFor, type FirstGesture, type FirstMove } from '../data/firstMoves'
import { usePersonalBest } from '../hooks/usePersonalBest'
import '../styles/firstMoveHint.css'

/*
 * A game's first move, shown once: the first time a game is played on a device, as its run gets under way, a
 * finger does the move over the play area with a few words under it (Barrage: "Drag anywhere to fly"), or on
 * a computer the words alone, with the keys. The player's first press or key takes it away, and so does a
 * pause, the run's end, or eight seconds; after that it never comes back for that game. A player who already
 * has a best in the game has played it, and never sees it. It takes no press itself: every touch goes through
 * to the game. The moves are in data/firstMoves.ts; GamePlayChrome (GameHud.tsx) puts it on every game.
 */

/** The games whose move this device has been shown, as one list of slugs. */
const SHOWN_KEY = 'skermix-first-moves'

/** A phone or tablet with nothing but a finger to play with: the How to play panel's test (HowToPlay.tsx). */
const TOUCH_ONLY = '(hover: none) and (pointer: coarse)'

/**
 * The press that started the run comes just before the hint does: nothing this soon counts as the first move,
 * nor does a held key repeating.
 */
const GRACE_MS = 350

/** Up for this long at most, if the player hasn't moved by then. */
const UP_MS = 8000

/** Shown this visit: in a browser that keeps nothing (a private window), it still shows only once a visit. */
const shownHere = new Set<string>()

function shownList(): string[] {
  try {
    const kept = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '[]') as unknown
    return Array.isArray(kept) ? kept.filter((slug): slug is string => typeof slug === 'string') : []
  } catch {
    return []
  }
}

function wasShown(slug: string): boolean {
  return shownHere.has(slug) || shownList().includes(slug)
}

function markShown(slug: string) {
  shownHere.add(slug)
  const list = shownList()
  if (list.includes(slug)) return
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...list, slug]))
  } catch {
    /* a private window keeps nothing: the set above holds it for the visit */
  }
}

function touchOnly(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(TOUCH_ONLY).matches === true
}

/** What a game's hint shows on this device: its move, the finger's part, and the words (none where the game says them). */
type Offer = { move: FirstMove; gesture: FirstGesture | null; words: string | null }

/** The hint this device is owed for a game, or none: no move for it, shown already, or nothing to draw here. */
function offerFor(slug: string): Offer | null {
  const move = firstMoveFor(slug)
  if (!move || wasShown(slug)) return null
  const touch = touchOnly()
  const gesture = touch ? (move.gesture ?? null) : null
  const words = move.saysItself === 'both' || (touch && move.saysItself === 'touch') ? null : touch ? move.touch : move.keys
  return gesture || words ? { move, gesture, words } : null
}

/**
 * `live` is the run under way and not paused, as GamePlayChrome reads it each time the game draws: the hint
 * comes up the first time it's true, and goes the first time after that it isn't. Worked out once, as the game
 * mounts; once the hint has been and gone, or was never owed, nothing of it is left running in the game's draws.
 */
export function FirstMoveHint({ slug, live }: { slug: string; live: boolean }) {
  const [offer] = useState(() => offerFor(slug))
  const [over, setOver] = useState(offer === null)
  const finish = useCallback(() => setOver(true), [])
  if (over || !offer) return null
  return <Hint slug={slug} live={live} offer={offer} finish={finish} />
}

function Hint({ slug, live, offer, finish }: { slug: string; live: boolean; offer: Offer; finish: () => void }) {
  const best = usePersonalBest(slug)
  const [up, setUp] = useState(false)

  // A best here means the game's been played: no hint, now or later. Otherwise it comes up with the run, and
  // is spent from then on, whatever takes it down (or the page going).
  useEffect(() => {
    if (up) return
    if (best > 0) {
      markShown(slug)
      finish()
    } else if (live) {
      markShown(slug)
      setUp(true)
    }
  }, [up, best, live, slug, finish])

  // Up: the player's first press or key anywhere takes it down, and so does a pause, the run's end, or time.
  // Caught on the way down (capture), before a game or its buttons can stop it.
  useEffect(() => {
    if (!up) return
    if (!live) {
      finish()
      return
    }
    const upAt = performance.now()
    const onInput = (e: Event) => {
      if (performance.now() - upAt < GRACE_MS) return
      if (e instanceof KeyboardEvent && e.repeat) return
      finish()
    }
    const timer = window.setTimeout(finish, UP_MS)
    document.addEventListener('pointerdown', onInput, true)
    document.addEventListener('keydown', onInput, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', onInput, true)
      document.removeEventListener('keydown', onInput, true)
    }
  }, [up, live, finish])

  if (!up || !live) return null

  const { move, gesture, words } = offer
  const place = {
    '--first-move-x': move.at?.x ?? '50%',
    '--first-move-y': move.at?.y ?? '62%',
    ...(move.wordsAt ? { '--first-move-words-y': move.wordsAt } : null),
  } as CSSProperties
  const upward = move.way === 'up'
  const classes = [
    'first-move',
    gesture ? `first-move--${gesture}` : 'first-move--words-only',
    gesture && upward ? 'first-move--up' : '',
    move.wordsAt ? 'first-move--words-at' : '',
  ]
  return (
    // Seen, not read out: How to play says the same in words, for a screen reader too.
    <div className={classes.filter(Boolean).join(' ')} style={place} aria-hidden="true">
      {gesture ? <Finger gesture={gesture} upward={upward} /> : null}
      {words ? (
        <div className="first-move__line">
          <p className="first-move__words">{words}</p>
        </div>
      ) : null}
    </div>
  )
}

/** The finger, at the hint's spot, and what's drawn with it: the drag's path, the swipe's arrow, the hold's ring. */
function Finger({ gesture, upward }: { gesture: FirstGesture; upward: boolean }) {
  return (
    <div className="first-move__spot">
      {gesture === 'drag' ? (
        upward ? (
          <svg className="first-move__arc" viewBox="0 0 60 230">
            <path className="first-move__trail" d="M22 8 Q58 115 22 222" />
            <path className="first-move__head" d="M12 14 L21 4 L28 16" />
            <path className="first-move__head" d="M12 216 L21 226 L28 214" />
          </svg>
        ) : (
          <svg className="first-move__arc" viewBox="0 0 230 60">
            <path className="first-move__trail" d="M8 22 Q115 58 222 22" />
            <path className="first-move__head" d="M14 12 L4 21 L16 28" />
            <path className="first-move__head" d="M216 12 L226 21 L214 28" />
          </svg>
        )
      ) : null}
      {gesture === 'swipe' ? (
        <svg className="first-move__arrow" viewBox="0 0 150 24">
          <path className="first-move__trail" d="M8 12 H136" />
          <path className="first-move__head" d="M128 4 L140 12 L128 20" />
        </svg>
      ) : null}
      {gesture === 'hold' ? (
        <svg className="first-move__ring" viewBox="0 0 76 76">
          <circle className="first-move__ring-track" cx="38" cy="38" r="32" />
          <circle className="first-move__ring-fill" cx="38" cy="38" r="32" />
        </svg>
      ) : null}
      {gesture === 'pull' ? (
        <>
          <span className="first-move__anchor" />
          <span className="first-move__band" />
          <svg className="first-move__fling" viewBox="0 0 24 16">
            <path className="first-move__head" d="M4 13 L12 5 L20 13" />
          </svg>
        </>
      ) : null}
      {gesture === 'tap' ? <span className="first-move__ripple" /> : null}
      <span className="first-move__finger" />
    </div>
  )
}
