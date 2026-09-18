export const THEME_KEY = 'skermix-theme'
const LEGACY_THEME_KEYS = ['fordriva-theme', 'acralia-theme', 'archivade-theme'] as const
export const THEME_EVENT = 'arcade-theme'

/** Two themes: dark by default, light by choice. */
export type Theme = 'light' | 'dark'

const THEMES: Theme[] = ['dark', 'light']

function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark'
}

export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** The stored choice, or null. A choice from a theme that no longer exists reads as null. */
export function storedTheme(): Theme | null {
  try {
    let value = localStorage.getItem(THEME_KEY)
    if (!isTheme(value)) {
      for (const key of LEGACY_THEME_KEYS) {
        value = localStorage.getItem(key)
        if (isTheme(value)) {
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

export function isDarkTheme() {
  return currentTheme() === 'dark'
}

/**
 * There used to be flat themes that drew no outlines. Both themes outline
 * now; this stays so the games' renderers keep reading the same way.
 */
export function isFlatTheme() {
  return false
}

/** A game's accent is its own in every theme. */
export function resolveGameAccent(_slug: string, fallback: string) {
  return fallback
}

export function themeLabel(theme: Theme = currentTheme()) {
  return theme === 'light' ? 'Light' : 'Dark'
}

/** Soft bead / crumb fill alpha. */
export function softFillAlpha(base = 0.22) {
  return base
}

/** Stroke an outlined shape. */
export function strokeOutlined(ctx: CanvasRenderingContext2D) {
  ctx.stroke()
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
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

/** Dark ↔ Light. */
export function cycleTheme() {
  const i = THEMES.indexOf(currentTheme())
  setTheme(THEMES[(i + 1) % THEMES.length]!)
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
