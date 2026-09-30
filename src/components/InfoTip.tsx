import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import '../styles/infoTip.css'

/*
 * A tip on a word or an icon: a few words about it, up while a mouse is over it or the keyboard is on it,
 * and put up or away by a tap. It floats over the page on a layer of its own, under its word (over it when
 * there's no room below), and keeps a gutter inside the screen's edges, so it never runs off them. Esc, or
 * a press anywhere else, puts it away, and only one is up at a time. Its words are its trigger's
 * description (aria-describedby), so a screen reader says them with the word, whether the tip is up or not.
 */

/** Kept clear of the screen's edges, and between the trigger and its tip, in pixels. */
const EDGE = 12
const GAP = 10
/** How far left of its trigger a tip starts, so its arrow sits in from its corner. */
const LEAD = 12
/** How long a tip waits for the pointer to cross from its trigger onto it. */
const LINGER_MS = 120
/** A tip coming up says so, and any other goes away. */
const UP_EVENT = 'infotip:up'

type InfoTipProps = {
  /** What the tip says. */
  children: ReactNode
  /** What the trigger shows: a word, an icon. Without one it's a small "i". */
  trigger?: ReactNode
  /** The trigger's name, for one with no words of its own: an icon, or the "i". */
  label?: string
  /** The tip's words for a screen reader, when `children` is more than words (a heading, an icon). */
  description?: string
  /** The trigger's classes. */
  className?: string
  /** The tip's classes, for its look. */
  tipClassName?: string
}

export function InfoTip({ children, trigger, label, description, className, tipClassName }: InfoTipProps) {
  const id = useId()
  const describedBy = `${id}tip`
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const linger = useRef(0)
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  // Put away (Esc, or a second press) while the pointer or the focus is still on it: until they leave.
  const [hushed, setHushed] = useState(false)
  const up = !hushed && (pinned || hovered || focused)

  useEffect(() => () => window.clearTimeout(linger.current), [])

  // Only one up at a time: this one coming up puts any other away.
  useEffect(() => {
    if (!up) return
    window.dispatchEvent(new CustomEvent(UP_EVENT, { detail: id }))
    const onUp = (e: Event) => {
      if ((e as CustomEvent<string>).detail === id) return
      setPinned(false)
      setHovered(false)
      setFocused(false)
    }
    window.addEventListener(UP_EVENT, onUp)
    return () => window.removeEventListener(UP_EVENT, onUp)
  }, [up, id])

  // A press anywhere but the trigger or the tip, or Esc, puts it away.
  useEffect(() => {
    if (!up) return
    const onPress = (e: globalThis.PointerEvent) => {
      const target = e.target as Node | null
      if (target && (buttonRef.current?.contains(target) || tipRef.current?.contains(target))) return
      setPinned(false)
      setHovered(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPinned(false)
      setHushed(true)
    }
    document.addEventListener('pointerdown', onPress, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPress, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [up])

  // Under its trigger, or over it when there's no room below; never past the screen's edges.
  useLayoutEffect(() => {
    if (!up) return
    const place = () => {
      const button = buttonRef.current
      const tip = tipRef.current
      if (!button || !tip) return
      const at = button.getBoundingClientRect()
      const width = document.documentElement.clientWidth
      const height = window.innerHeight
      // Its word scrolled off the screen: it goes with it, rather than hang at the edge.
      if (at.bottom < 0 || at.top > height) {
        setPinned(false)
        setHushed(true)
        return
      }
      // Its width is its words', up to its style's most (under the screen's, less a gutter each side).
      const w = tip.offsetWidth
      const h = tip.offsetHeight
      const below = at.bottom + GAP + h <= height - EDGE || at.top - GAP - h < EDGE
      const left = Math.max(EDGE, Math.min(at.left - LEAD, width - EDGE - w))
      const top = below ? at.bottom + GAP : at.top - GAP - h
      tip.style.left = `${Math.round(left)}px`
      tip.style.top = `${Math.round(Math.max(EDGE, top))}px`
      // The arrow points at the trigger's middle, kept clear of the tip's corners.
      tip.style.setProperty('--infotip-arrow', `${Math.round(Math.max(16, Math.min(w - 16, at.left + at.width / 2 - left)))}px`)
      tip.dataset.side = below ? 'below' : 'above'
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [up])

  // A mouse (or a pen) over the trigger or the tip; a touch is a tap, which toggles.
  const enter = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    window.clearTimeout(linger.current)
    setHovered(true)
  }
  const leave = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    window.clearTimeout(linger.current)
    linger.current = window.setTimeout(() => {
      setHovered(false)
      setHushed(false)
    }, LINGER_MS)
  }
  // The keyboard's focus puts it up; a tap's or a click's doesn't, so that a tap toggles it.
  const onFocus = (e: FocusEvent<HTMLButtonElement>) => {
    if (e.currentTarget.matches(':focus-visible')) setFocused(true)
  }
  const onBlur = () => {
    setFocused(false)
    setPinned(false)
    setHushed(false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`infotip${trigger ? '' : ' infotip--i'}${className ? ` ${className}` : ''}`}
        aria-label={label}
        aria-describedby={describedBy}
        data-open={up ? '' : undefined}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (up) {
            setPinned(false)
            setHushed(true)
          } else {
            setPinned(true)
            setHushed(false)
          }
        }}
      >
        {trigger ?? 'i'}
      </button>
      <span id={describedBy} role="tooltip" hidden>
        {description ?? children}
      </span>
      {up && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={tipRef}
              className={`infotip-tip${tipClassName ? ` ${tipClassName}` : ''}`}
              aria-hidden="true"
              onPointerEnter={enter}
              onPointerLeave={leave}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
