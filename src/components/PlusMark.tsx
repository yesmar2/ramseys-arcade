import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { navigate, plusHref } from '../hooks/useHashRoute'
import { usePlusMember } from '../lib/plus'
import '../styles/infoTip.css'
import '../styles/plusMark.css'

/*
 * The small mark beside a Plus member's tag, wherever it shows (PlayerName): a member is seen to be one, the
 * way subscriber badges are, and it's the quietest way Plus is offered. Paying or given members only, not a
 * free week (the API's memberNames). A plain mark, not a link or a button: names sit inside rows that are links
 * already.
 *
 * A gold four-point star, a plus with soft points and no box (B, Sparkle, of the "Plus page redesign" canvas's
 * marks, Ramsey's pick on 2026-10-07): the plus in a gold box it was could read as an Add button beside a name.
 *
 * Tapped, it says what it is, in InfoTip's tip (Ramsey's pick on 2026-10-20, from the "Launch UX picks" canvas:
 * a phone never shows the title a mouse gets). The tap is kept from the row's link.
 */
export function PlusMark({ name }: { name: string }) {
  const member = usePlusMember(name)
  const [open, setOpen] = useState(false)
  const markRef = useRef<HTMLSpanElement>(null)
  const close = useCallback(() => setOpen(false), [])
  if (!member) return null
  const toggle = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen((was) => !was)
  }
  return (
    <>
      <span ref={markRef} className="plus-mark plus-mark--tap" title="Plus member" aria-label="Plus member" role="img" onClick={toggle}>
        <PlusSparkle />
      </span>
      {open ? <PlusTip anchor={markRef} onClose={close} /> : null}
    </>
  )
}

/** Kept clear of the screen's edges, and between the star and its tip, in pixels (InfoTip's). */
const EDGE = 12
const GAP = 10
/** InfoTip's: one tip coming up puts any other away. */
const UP_EVENT = 'infotip:up'

/** What the star means, under it (over it when there's no room below), until a press elsewhere, Esc or a scroll away. */
function PlusTip({ anchor, onClose }: { anchor: RefObject<HTMLSpanElement | null>; onClose: () => void }) {
  const id = useId()
  const tipRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const place = () => {
      const at = anchor.current?.getBoundingClientRect()
      const tip = tipRef.current
      if (!at || !tip) return
      if (at.bottom < 0 || at.top > window.innerHeight) {
        onClose()
        return
      }
      const w = tip.offsetWidth
      const h = tip.offsetHeight
      const width = document.documentElement.clientWidth
      const below = at.bottom + GAP + h <= window.innerHeight - EDGE || at.top - GAP - h < EDGE
      const left = Math.max(EDGE, Math.min(at.left - EDGE, width - EDGE - w))
      tip.style.left = `${Math.round(left)}px`
      tip.style.top = `${Math.round(Math.max(EDGE, below ? at.bottom + GAP : at.top - GAP - h))}px`
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
  }, [anchor, onClose])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(UP_EVENT, { detail: id }))
    const onUp = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) onClose()
    }
    const onPress = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (target && (anchor.current?.contains(target) || tipRef.current?.contains(target))) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener(UP_EVENT, onUp)
    document.addEventListener('pointerdown', onPress, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener(UP_EVENT, onUp)
      document.removeEventListener('pointerdown', onPress, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose, id])

  if (typeof document === 'undefined') return null
  // A portal's clicks still bubble through the React tree, into whatever row the star sits in, so they stop at the
  // tip, and its link goes in-app itself (the router's document listener is past the stop).
  return createPortal(
    <div ref={tipRef} className="infotip-tip plus-mark__tip" role="status" onClick={(e) => e.stopPropagation()}>
      <b className="plus-mark__tip-title">Plus member</b>
      <span>Every past day of the dailies, the Gold Pass each season, and a new look each month.</span>
      <a
        className="plus-mark__tip-link"
        href={plusHref()}
        onClick={(e) => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          onClose()
          navigate(plusHref())
        }}
      >
        About Plus ›
      </a>
    </div>,
    document.body,
  )
}

function PlusSparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0.8C12.9 7.6 16.4 11.1 23.2 12C16.4 12.9 12.9 16.4 12 23.2C11.1 16.4 7.6 12.9 0.8 12C7.6 11.1 11.1 7.6 12 0.8Z" />
    </svg>
  )
}

/** The mark on its own, as an icon: the menu's Plus row, and the Plus page at any `size` (a CSS length). */
export function PlusGlyph({ size }: { size?: string }) {
  return (
    <span className="plus-mark plus-mark--icon" aria-hidden="true" style={size ? ({ '--plus-mark-size': size } as CSSProperties) : undefined}>
      <PlusSparkle />
    </span>
  )
}
