/** Browser Fullscreen API helpers (no-ops when unsupported, e.g. iOS Safari). */

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenEnabled?: boolean
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

export function fullscreenSupported() {
  if (typeof document === 'undefined') return false
  const doc = document as FullscreenDocument
  return Boolean(
    document.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      (document.documentElement as FullscreenElement).requestFullscreen ||
      (document.documentElement as FullscreenElement).webkitRequestFullscreen,
  )
}

export function isFullscreen() {
  if (typeof document === 'undefined') return false
  const doc = document as FullscreenDocument
  return Boolean(document.fullscreenElement || doc.webkitFullscreenElement)
}

export async function enterFullscreen(el: HTMLElement = document.documentElement) {
  if (!fullscreenSupported() || isFullscreen()) return
  const target = el as FullscreenElement
  try {
    if (target.requestFullscreen) await target.requestFullscreen()
    else if (target.webkitRequestFullscreen) await target.webkitRequestFullscreen()
  } catch {
    /* user gesture / policy may reject */
  }
}

export async function exitFullscreen() {
  if (!isFullscreen()) return
  const doc = document as FullscreenDocument
  try {
    if (document.exitFullscreen) await document.exitFullscreen()
    else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen()
  } catch {
    /* ignore */
  }
}

export async function toggleFullscreen(el?: HTMLElement) {
  if (isFullscreen()) await exitFullscreen()
  else await enterFullscreen(el)
}

export function subscribeFullscreen(onChange: () => void) {
  const handler = () => onChange()
  document.addEventListener('fullscreenchange', handler)
  document.addEventListener('webkitfullscreenchange', handler)
  return () => {
    document.removeEventListener('fullscreenchange', handler)
    document.removeEventListener('webkitfullscreenchange', handler)
  }
}
