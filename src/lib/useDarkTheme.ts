import { useSyncExternalStore } from 'react'
import { isDarkTheme, THEME_EVENT } from './theme'

const subscribe = (onChange: () => void) => {
  window.addEventListener(THEME_EVENT, onChange)
  return () => window.removeEventListener(THEME_EVENT, onChange)
}

/**
 * Whether the site is on its dark theme, kept up as the theme is changed (lib/theme.ts setTheme): for a picture
 * that's drawn one way by day and another by night. Dark where there's no page to ask, as the site is by default.
 */
export function useDarkTheme(): boolean {
  return useSyncExternalStore(subscribe, isDarkTheme, () => true)
}
