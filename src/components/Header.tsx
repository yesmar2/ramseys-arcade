import { useEffect, useRef, useState } from 'react'
import { usePlayerName } from '../hooks/usePlayerName'
import { rankHref } from '../hooks/useHashRoute'
import { useGlobalRank } from '../lib/globalRank'
import { normalizePlayerName } from '../lib/leaderboard'
import { currentTheme, THEME_EVENT, toggleTheme, type Theme } from '../lib/theme'
import { PlayerBadge } from './PlayerBadge'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { href: '#/', label: 'Games' },
  { href: '#/tournaments', label: 'Tournaments' },
  { href: '#/leaderboards', label: 'Leaderboards' },
]

const MOBILE_MQ = '(max-width: 720px)'

export function Header() {
  const { rank } = useGlobalRank()
  const playerName = normalizePlayerName(usePlayerName())
  const [open, setOpen] = useState(false)
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MQ).matches : false,
  )
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentTheme(),
  )
  const headerRef = useRef<HTMLElement>(null)
  const rankLabel = rank != null ? `#${rank}` : playerName ? '—' : null


  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const sync = () => setTheme(currentTheme())
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header
      className={`site-header${open ? ' site-header--open' : ''}`}
      ref={headerRef}
    >
      <div className="site-header__inner">
        <button
          type="button"
          className="site-header__menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M5 7h14M5 12h14M5 17h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
        <a className="site-header__brand" href="#/">
          Archiv<span>ade</span>
        </a>
        <nav className="site-header__nav" id="site-nav" aria-label="Primary">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
          {narrow ? (
            <button
              type="button"
              className="site-header__nav-theme"
              onClick={() => {
                toggleTheme()
                setOpen(false)
              }}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          ) : null}
        </nav>
        <div className="site-header__player">
          {rankLabel ? (
            <a
              className="home-bar__rank site-header__rank"
              href={rankHref()}
              aria-label={rank != null ? `Global rank ${rank}` : 'Global rank'}
              title={rank != null ? `Global rank #${rank}` : 'Your global rank'}
            >
              {rankLabel}
            </a>
          ) : null}
          {!narrow ? <ThemeToggle /> : null}
          <PlayerBadge compact={!narrow} icon={narrow} />
        </div>
      </div>
    </header>
  )
}
