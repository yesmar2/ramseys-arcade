/*
 * The games hear their keys on the window, so Enter or Space pressed on a focused button reaches them
 * too. On a start card that started the run, and How to play, the sound, the boards and Leave never
 * answered: a keyboard player couldn't open the rules or leave. A focused control keeps those two keys
 * now, and the game lets them by.
 */

/** What answers Enter or Space itself: buttons, links, fields, and anything playing one. */
const CONTROL = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[role="tab"]',
].join(', ')

/** A start card's Start, which hands its press on to the playfield as a tap on the card does (GameStartCard.tsx). */
const PASSES_ON = '.game-card--start .game-card__start'

/**
 * The controls pressed with a pointer since Tab last moved the focus. A click leaves focus on what it
 * pressed (and a panel it opened hands focus back to it), and the Space after it is the game's, as it always
 * was: mute with the mouse, then Space to start. A control reached with the keyboard keeps the keys.
 */
let clicked = new WeakSet<Element>()

if (typeof window !== 'undefined') {
  const quietly = { capture: true, passive: true }
  window.addEventListener('pointerdown', (e) => {
    const control = e.target instanceof Element ? e.target.closest(CONTROL) : null
    if (control) clicked.add(control)
  }, quietly)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') clicked = new WeakSet()
  }, quietly)
}

/** Whether this Enter or Space is the focused control's to answer rather than the game's. */
export function controlTakesKey(e: KeyboardEvent): boolean {
  if (e.code !== 'Space' && e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.key !== ' ' && e.key !== 'Enter') return false
  const target = e.target instanceof Element ? e.target : null
  if (!target || target.closest(PASSES_ON)) return false
  const control = target.closest(CONTROL)
  return control !== null && !clicked.has(control)
}

/**
 * The same in a run, for the play screen's own buttons (‹ Leave, fullscreen, pause): reached with Tab, one
 * answers Enter or Space itself, where the game would otherwise take them as a Bop or a pin.
 */
export function chromeTakesKey(e: KeyboardEvent): boolean {
  return e.target instanceof Element && e.target.closest('.game-play-chrome') !== null && controlTakesKey(e)
}
