/*
 * The page stops scrolling while anything is open over it (a panel, the site menu), and gets back what it
 * had when the last one closes, whatever order they close in. Each one locks as it opens and unlocks once
 * as it closes. Saving and restoring the page's overflow one by one broke when two overlapped: a panel
 * closed under the menu restored scrolling, then the menu restored the lock it had found.
 */
let locks = 0
let before = ''

export function lockScroll() {
  if (locks++ === 0) {
    before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

export function unlockScroll() {
  if (locks === 0) return
  if (--locks === 0) document.body.style.overflow = before
}
