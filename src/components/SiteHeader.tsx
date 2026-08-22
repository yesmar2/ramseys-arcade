import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { rankHref } from '../hooks/useHashRoute'
import { useGlobalRank } from '../lib/globalRank'
import { normalizePlayerName } from '../lib/leaderboard'
import { currentTheme, THEME_EVENT, toggleTheme, type Theme } from '../lib/theme'
import { PlayerBadge, type PlayerBadgeHandle } from './PlayerBadge'
import { SITE_NAV_LINKS } from './siteNav'

/** Site-wide navigation — use this on every page (home, leaderboards, game hub, etc.). */
export function SiteHeader() {
  const { rank } = useGlobalRank()
  const { account, signedIn } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentTheme(),
  )
  const menuRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerBadgeHandle>(null)

  useEffect(() => {
    const sync = () => setTheme(currentTheme())
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  useEffect(() => {
    const close = () => setMenuOpen(false)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const accountLabel = playerName
    ? signedIn
      ? `${playerName} · Account`
      : 'Edit gamer tag'
    : signedIn
      ? account?.email ?? 'Account'
      : 'Set gamer tag'

  return (
    <nav className="site-header" aria-label="Site">
      <div className="site-header__start">
        <a className="site-header__brand" href="#/">
          Archiv<span>ade</span>
        </a>
        <div className="site-header__links" aria-label="Primary">
          {SITE_NAV_LINKS.map((item) => (
            <a key={item.href} className="site-header__link" href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div className="site-header__end">
        {playerName ? (
          <a
            className="site-header__you"
            href={rankHref()}
            title={rank != null ? `Your profile · #${rank}` : 'Your profile'}
          >
            {rank != null ? (
              <span className="site-header__you-rank">#{rank}</span>
            ) : null}
            <span className="site-header__you-name">{playerName}</span>
          </a>
        ) : (
          <button
            type="button"
            className="site-header__you site-header__you--empty"
            onClick={() => playerRef.current?.openEdit()}
          >
            Set gamer tag
          </button>
        )}

        <div className="site-header__more" ref={menuRef}>
          <button
            type="button"
            className="site-header__menu-btn"
            aria-label="More"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="More"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="1.7" fill="currentColor" />
              <circle cx="12" cy="12" r="1.7" fill="currentColor" />
              <circle cx="19" cy="12" r="1.7" fill="currentColor" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="site-header__menu" role="menu">
              {SITE_NAV_LINKS.map((item) => (
                <a
                  key={item.href}
                  className="site-header__menu-mobile"
                  role="menuitem"
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  toggleTheme()
                  setMenuOpen(false)
                }}
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  playerRef.current?.openEdit()
                }}
              >
                {accountLabel}
              </button>
            </div>
          ) : null}
        </div>

        <div className="site-header__player">
          <PlayerBadge ref={playerRef} icon className="site-header__player-badge" />
        </div>
      </div>
    </nav>
  )
}

/** @deprecated Use SiteHeader */
export const HomeBar = SiteHeader

/** @deprecated Use SiteHeader */
export const Header = SiteHeader
