/*
 * Keyboard focus in a row that scrolls sideways (a strip of cards on a phone) stays wholly in sight, ring and
 * all. Chrome and Safari leave a focused thing where it is once 32px of it shows, so tabbing along a strip
 * could stop on a card two-thirds out of sight, its ring cut off at the row's edge. When the keyboard's focus
 * lands on something not wholly inside its row, the row scrolls it in (and its snap, if it has one, settles
 * on the next card that way). Only that row moves, never the boxes round it. A row with something over its
 * edge (a fade, a › button) says how wide it is with scroll-padding, and the focused thing stays clear of it.
 */
function revealInRow(e: FocusEvent) {
  const el = e.target
  if (!(el instanceof Element) || !el.matches(':focus-visible')) return
  for (let row = el.parentElement; row && row !== document.body; row = row.parentElement) {
    const rowLook = getComputedStyle(row)
    const overflow = rowLook.overflowX
    if ((overflow !== 'auto' && overflow !== 'scroll') || row.scrollWidth <= row.clientWidth) continue
    const look = getComputedStyle(el)
    const ring = look.outlineStyle === 'none' ? 0 : Math.max(0, parseFloat(look.outlineWidth) + parseFloat(look.outlineOffset))
    const box = el.getBoundingClientRect()
    const edge = row.getBoundingClientRect().left + row.clientLeft
    const padLeft = parseFloat(rowLook.scrollPaddingLeft) || 0
    const padRight = parseFloat(rowLook.scrollPaddingRight) || 0
    const left = Math.max(edge, 0) + Math.max(ring + 1, padLeft)
    const right = Math.min(edge + row.clientWidth, document.documentElement.clientWidth) - Math.max(ring + 1, padRight)
    const by = box.left < left || box.width > right - left ? box.left - left : box.right > right ? box.right - right : 0
    if (by) row.scrollBy({ left: by, behavior: 'instant' })
    return
  }
}

export function bootFocusReveal() {
  document.addEventListener('focusin', revealInRow, true)
}
