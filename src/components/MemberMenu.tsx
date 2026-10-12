import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/*
 * The '…' beside someone in a list of people: Remove on your friends, Make host and Remove on a group's
 * roster. Its menu opens beside the '…' only where it covers nothing there: no other row, nothing to tap in its
 * own. Anywhere tighter (a phone, a long tag, two choices) it opens under the row, in its flow, pushing the rows
 * below down, so a tap always lands on what it's over. It closes on a choice, a tap anywhere else (not a scroll),
 * Tab moving focus on (so opening the next one closes this) and Esc, which leaves focus on the '…'.
 */

const DotsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </svg>
)

/** Where an open menu is: beside its '…' while it's measured there, beside it, or under its row. */
type Place = 'measure' | 'side' | 'under'

/** A phone's width, as groups.css has it: there it always opens under its row, the same for every row. */
const NARROW = '(max-width: 560px)'

const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/**
 * Whether the menu, beside its '…', covers nothing: clear of what's above and below its row (another row, or what
 * the list sits between), inside the row, and off anything in it to tap but its own '…'.
 */
function fitsBeside(pop: HTMLElement, menu: HTMLElement, row: HTMLElement): boolean {
  const at = pop.getBoundingClientRect()
  const above = row.previousElementSibling ?? row.parentElement?.previousElementSibling
  const below = row.nextElementSibling ?? row.parentElement?.nextElementSibling
  if (above && at.top < above.getBoundingClientRect().bottom) return false
  if (below && at.bottom > below.getBoundingClientRect().top) return false
  if (at.left < row.getBoundingClientRect().left) return false
  return [...row.querySelectorAll('a[href], button')].every((el) => menu.contains(el) || !overlaps(at, el.getBoundingClientRect()))
}

export function MemberMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const open = place != null

  // Measured beside the '…' before it's drawn, and put under the row if it would cover anything there.
  useLayoutEffect(() => {
    const menu = ref.current
    const pop = popRef.current
    const row = menu?.closest('li')
    if (place !== 'measure' || !menu || !pop || !row) return
    setPlace(!window.matchMedia(NARROW).matches && fitsBeside(pop, menu, row) ? 'side' : 'under')
  }, [place])

  // It can open past the screen's foot, or under the phone or tablet's tab bar (its scroll-margin, groups.css):
  // brought up into view. ('nearest' would leave it under the bar: it ignores the margin once the menu's in view.)
  useEffect(() => {
    const pop = popRef.current
    if (place === 'measure' || !pop) return
    const margin = parseFloat(getComputedStyle(pop).scrollMarginBottom) || 0
    if (pop.getBoundingClientRect().bottom + margin > window.innerHeight) pop.scrollIntoView({ block: 'end' })
  }, [place])

  useEffect(() => {
    const menu = ref.current
    if (!open || !menu) return
    const close = () => setPlace(null)
    // A click, not a press: a finger scrolling the page leaves it open.
    const onClick = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      buttonRef.current?.focus()
    }
    // Focus moved on by keyboard closes it (Tab past its choices, or on to the next '…'). Focus moved by a press
    // doesn't: its click does, once it has landed, as closing at the press would move the rows under the finger.
    const onFocusIn = (e: FocusEvent) => {
      const to = e.target
      if (to instanceof Element && !menu.contains(to) && to.matches(':focus-visible')) close()
    }
    // A new width can leave it over something, so it closes; a phone's address bar coming and going is no new width.
    const width = window.innerWidth
    const onResize = () => {
      if (window.innerWidth !== width) close()
    }
    window.addEventListener('click', onClick, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [open])

  return (
    <div ref={ref} className="grp-menu">
      <button
        ref={buttonRef}
        type="button"
        className="grp-menu__btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setPlace(open ? null : 'measure')}
      >
        <DotsIcon />
      </button>
      {open ? (
        // A choice closes it and leaves focus on the '…', where the question it asks gives focus back.
        <div
          ref={popRef}
          className={`grp-menu__pop${place === 'under' ? ' grp-menu__pop--under' : ''}`}
          onClick={() => {
            buttonRef.current?.focus()
            setPlace(null)
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
