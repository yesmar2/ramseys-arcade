import type { KeyboardEvent } from 'react'

/*
 * The keys a row of choices answers when it tells a screen reader it's tabs (role="tablist") or radios
 * (role="radiogroup"): the row is one Tab stop, at the chosen one (each choice's `tabIndex={on ? 0 : -1}`), and
 * the arrow keys move along it and choose as they go, round from the last to the first, with Home and End for
 * the ends. The row's onKeyDown is `moveChoice`. The Oct 9 test found the wall's chips, the event maker's choices
 * and Tell us's kinds saying they were tabs and radios while answering only clicks, a Tab stop each.
 *
 * A row of links to other addresses isn't tabs: it's a nav, the link you're on marked aria-current (a board's
 * periods). A button that turns one thing on and off is aria-pressed.
 */

/** Tabs run along the row; radios answer up and down too. */
const STEPS: Record<string, Record<string, number>> = {
  tablist: { ArrowRight: 1, ArrowLeft: -1 },
  radiogroup: { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 },
}

/** A tablist's or a radiogroup's onKeyDown: an arrow, Home or End moves to a choice and chooses it. */
export function moveChoice(event: KeyboardEvent<HTMLElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const row = event.currentTarget
  const steps = STEPS[row.getAttribute('role') ?? '']
  if (!steps) return
  const choices = [...row.querySelectorAll<HTMLElement>('[role="tab"], [role="radio"]')].filter(
    (el) => el.closest('[role="tablist"], [role="radiogroup"]') === row && !el.matches(':disabled, [aria-disabled="true"]'),
  )
  const at = choices.indexOf(event.target as HTMLElement)
  if (at < 0) return
  const step = steps[event.key]
  const to =
    step !== undefined
      ? (at + step + choices.length) % choices.length
      : event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? choices.length - 1
          : -1
  if (to < 0) return
  event.preventDefault()
  const next = choices[to]
  if (!next || to === at) return
  // Chosen the way a press chooses it, then focused: a press that sends the focus on (Tell us's kinds, to the box
  // to type in) would otherwise leave the arrows nothing to move.
  next.click()
  next.focus()
}
