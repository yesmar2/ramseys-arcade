export const THEME_KEY = 'skermix-theme'
const LEGACY_THEME_KEYS = ['fordriva-theme', 'acralia-theme', 'archivade-theme'] as const
export const THEME_EVENT = 'arcade-theme'

export type Theme = 'light' | 'dark' | 'flat'

const THEMES: Theme[] = ['dark', 'light', 'flat']

function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark' || value === 'flat'
}

export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function storedTheme(): Theme | null {
  try {
    let value = localStorage.getItem(THEME_KEY)
    if (!isTheme(value)) {
      for (const key of LEGACY_THEME_KEYS) {
        value = localStorage.getItem(key)
        if (value === 'light' || value === 'dark') {
          localStorage.setItem(THEME_KEY, value)
          break
        }
      }
    }
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

export function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme')
  if (isTheme(attr)) return attr
  return storedTheme() ?? 'dark'
}

/** Dark chrome colors (flat sits on the dark palette). */
export function isDarkTheme() {
  const theme = currentTheme()
  return theme === 'dark' || theme === 'flat'
}

/** Fill-forward art: no outlines on beads / thumbs / soft shapes. */
export function isFlatTheme() {
  return currentTheme() === 'flat'
}

export function themeLabel(theme: Theme = currentTheme()) {
  if (theme === 'flat') return 'Flat'
  if (theme === 'light') return 'Light'
  return 'Dark'
}

/** Soft bead / crumb fill alpha — stronger when outlines are off. */
export function softFillAlpha(base = 0.22) {
  return isFlatTheme() ? Math.min(0.78, base * 3.2) : base
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark'
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore quota / private mode */
  }
  applyTheme(theme)
  cachedPlayfield = ''
  cachedInk = ''
  window.dispatchEvent(new Event(THEME_EVENT))
}

/** Cycle Dark → Light → Flat → Dark. */
export function cycleTheme() {
  const i = THEMES.indexOf(currentTheme())
  setTheme(THEMES[(i + 1) % THEMES.length])
}

/** @deprecated Prefer cycleTheme — kept for existing call sites. */
export function toggleTheme() {
  cycleTheme()
}

let cachedPlayfield = ''
let cachedInk = ''

function cssVar(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function playfieldColor() {
  if (!cachedPlayfield) cachedPlayfield = cssVar('--playfield', '#edf7f4')
  return cachedPlayfield
}

export function playfieldRgb() {
  const hex = playfieldColor().replace('#', '')
  if (hex.length !== 6) return { r: 237, g: 247, b: 244 }
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

export function inkColor() {
  if (!cachedInk) cachedInk = cssVar('--ink', '#1a2b3c')
  return cachedInk
}

export function bootTheme() {
  applyTheme(storedTheme() ?? 'dark')
}

if (typeof window !== 'undefined') {
  window.addEventListener(THEME_EVENT, () => {
    cachedPlayfield = ''
    cachedInk = ''
  })
}
