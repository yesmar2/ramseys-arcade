export const THEME_KEY = 'skermix-theme'
const LEGACY_THEME_KEYS = ['fordriva-theme', 'acralia-theme', 'archivade-theme'] as const
export const THEME_EVENT = 'arcade-theme'

export type Theme = 'light' | 'dark'

export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function storedTheme(): Theme | null {
  try {
    let value = localStorage.getItem(THEME_KEY)
    if (value !== 'light' && value !== 'dark') {
      for (const key of LEGACY_THEME_KEYS) {
        value = localStorage.getItem(key)
        if (value === 'light' || value === 'dark') {
          localStorage.setItem(THEME_KEY, value)
          break
        }
      }
    }
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  return storedTheme() ?? 'dark'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
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

export function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark')
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

export function isDarkTheme() {
  return currentTheme() === 'dark'
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
