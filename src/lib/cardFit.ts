/** Steps a game card can tighten before it has to scroll: styles/panel.css says what each does. */
const STEPS = 2

/** Pixels a card wins back by closing up its top padding (1.1rem to 0.6rem, styles/panel.css), less one to spare. */
const TIGHT = 7

/**
 * A ref for a game card (the start card, the pause card) that keeps it inside
 * the space it's given. When the card is taller than that space it tightens a
 * step at a time, first less air and smaller figures, then without its blurb,
 * and only scrolls if it still doesn't fit. It looks again whenever the space
 * or the card's contents change: the window resized, a best score arriving,
 * the admin tools appearing. The step is the card's `data-fit`; a card a few
 * pixels over then closes up its top (`data-tight`), and one that still hides
 * some of what's in it is marked `data-scrolls`.
 */
export function fitCardToSpace(card: HTMLElement | null): (() => void) | undefined {
  const space = card?.parentElement
  if (!card || !space || typeof ResizeObserver === 'undefined') return undefined

  const fit = () => {
    let step = 0
    card.dataset.fit = '0'
    card.removeAttribute('data-tight')
    while (step < STEPS && card.scrollHeight > card.clientHeight + 1) {
      step += 1
      card.dataset.fit = String(step)
    }
    // What's cut off at its foot: what runs past the bottom padding, however much of that padding there is.
    const hidden = card.scrollHeight - card.clientHeight - parseFloat(getComputedStyle(card).paddingBottom)
    card.toggleAttribute('data-tight', hidden > 0.5 && hidden <= TIGHT)
    card.toggleAttribute('data-scrolls', hidden > TIGHT)
  }

  /*
   * A start card that scrolls takes the pointer, so a finger can scroll it (styles/panel.css), and a press on it
   * stays on it rather than reaching the playfield, where it would start the run; so does one with a menu open
   * in it (the ghost picker's), where a tap beside the menu only closes it. A press on one of its buttons or
   * links waits to be a tap, so a finger that lands on Start or How to play to scroll the card doesn't start the
   * run or open the rules: the press goes on as the finger lifts, Start's to the playfield as it always did.
   */
  const holds = () =>
    card.classList.contains('game-card--start') && (card.hasAttribute('data-scrolls') || card.querySelector('[aria-expanded="true"]') !== null)
  const CONTROL = 'button, a[href]'
  let held: { down: PointerEvent; path: EventTarget[] } | null = null
  let handing = false
  const press = (e: PointerEvent) => {
    if (handing || !holds()) return
    e.stopPropagation()
    held = e.target instanceof Element && e.target.closest(CONTROL) ? { down: e, path: e.composedPath() } : null
  }
  const lift = (e: PointerEvent) => {
    const tap = held
    held = null
    if (handing || !tap) return
    const { down, path } = tap
    if (down.pointerId !== e.pointerId || !(down.target instanceof Element) || !(e.target instanceof Element)) return
    const control = down.target.closest(CONTROL)
    if (!control || e.target.closest(CONTROL) !== control) return
    handing = true
    try {
      // The whole tap again, now that it is one: the press, then the lift in place of this one, so the game sees
      // both (a stick taken with the press is let go). A press that has already taken the card away (it started
      // the run) has its lift go on from the nearest part of the page still there.
      down.target.dispatchEvent(new PointerEvent('pointerdown', down))
      const at = down.target.isConnected ? down.target : path.find((t): t is Element => t instanceof Element && t.isConnected)
      at?.dispatchEvent(new PointerEvent('pointerup', e))
      e.stopPropagation()
    } finally {
      handing = false
    }
  }
  const drop = () => {
    held = null
  }
  card.addEventListener('pointerdown', press)
  card.addEventListener('pointerup', lift)
  card.addEventListener('pointercancel', drop)

  fit()
  const resize = new ResizeObserver(fit)
  resize.observe(space)
  resize.observe(card)
  // A card at its full height doesn't change size when its contents grow; this sees that too.
  const contents = new MutationObserver(fit)
  contents.observe(card, { childList: true, subtree: true, characterData: true })
  void document.fonts?.ready.then(() => {
    if (card.isConnected) fit()
  })
  return () => {
    resize.disconnect()
    contents.disconnect()
    card.removeEventListener('pointerdown', press)
    card.removeEventListener('pointerup', lift)
    card.removeEventListener('pointercancel', drop)
  }
}
