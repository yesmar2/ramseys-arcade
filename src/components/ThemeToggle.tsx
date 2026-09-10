import { useEffect, useState } from 'react'
import { currentTheme, THEME_EVENT, toggleTheme, themeLabel, type Theme } from '../lib/theme'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentTheme(),
  )

  useEffect(() => {
    const sync = () => setThemeState(currentTheme())
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  const label = themeLabel(theme)

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      aria-label={`Theme: ${label}. Switch theme`}
      title={`Theme: ${label}`}
      onClick={() => toggleTheme()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {theme === 'flat' ? (
          <rect
            x="5"
            y="5"
            width="14"
            height="14"
            rx="2.5"
            fill="currentColor"
            opacity="0.9"
          />
        ) : theme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M12 3.4v1.6M12 19v1.6M3.4 12h1.6M19 12h1.6M6.2 6.2l1.1 1.1M16.7 16.7l1.1 1.1M16.7 7.3l1.1-1.1M6.2 17.8l1.1-1.1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        ) : (
          <path
            d="M15.2 4.4A8.2 8.2 0 1 0 19.6 15 6.4 6.4 0 0 1 15.2 4.4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}
