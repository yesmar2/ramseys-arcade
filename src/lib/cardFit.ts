/** Steps a game card can tighten before it has to scroll: styles/panel.css says what each does. */
const STEPS = 2

/**
 * A ref for a game card (the start card, the pause card) that keeps it inside
 * the space it's given. When the card is taller than that space it tightens a
 * step at a time, first less air and smaller figures, then without its blurb,
 * and only scrolls if it still doesn't fit. It looks again whenever the space
 * or the card's contents change: the window resized, a best score arriving,
 * the admin tools appearing. The step is the card's `data-fit`.
 */
export function fitCardToSpace(card: HTMLElement | null): (() => void) | undefined {
  const space = card?.parentElement
  if (!card || !space || typeof ResizeObserver === 'undefined') return undefined

  const fit = () => {
    let step = 0
    card.dataset.fit = '0'
    while (step < STEPS && card.scrollHeight > card.clientHeight + 1) {
      step += 1
      card.dataset.fit = String(step)
    }
  }

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
  }
}
