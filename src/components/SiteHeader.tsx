import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { rankHref, useHashRoute } from '../hooks/useHashRoute'
import { useGlobalRank } from '../lib/globalRank'
import { currentTheme, THEME_EVENT, toggleTheme, type Theme } from '../lib/theme'
import { normalizePlayerName } from '../lib/leaderboard'
import { PlayerBadge, type PlayerBadgeHandle } from './PlayerBadge'
import { SitePeriodControl } from './SitePeriodControl'
import {
  navActive,
  SITE_DRAWER_YOU,
  SITE_NAV_LINKS,
} from './siteNav'

/** Site-wide navigation — use this on every page (home, leaderboards, game hub, etc.). */
export function SiteHeader() {
  const route = useHashRoute()
  const hashKey = JSON.stringify(route)
  const { rank } = useGlobalRank()
  const { account, signedIn } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [utilOpen, setUtilOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentTheme(),
  )
  const utilRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const playerRef = useRef<PlayerBadgeHandle>(null)
  const drawerTitleId = useId()

  useEffect(() => {
    const sync = () => setTheme(currentTheme())
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
    setUtilOpen(false)
  }, [hashKey])

  useEffect(() => {
    if (!utilOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!utilRef.current?.contains(e.target as Node)) setUtilOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUtilOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [utilOpen])

  useEffect(() => {
    if (!drawerOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const focusable = drawerRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled])',
    )
    focusable?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  const accountLabel = playerName
    ? signedIn
      ? `${playerName} · Account`
      : 'Edit gamer tag'
    : signedIn
      ? account?.email ?? 'Account'
      : 'Set gamer tag'

  const hash = typeof window !== 'undefined' ? window.location.hash : '#/'

  const linkClass = (match: (typeof SITE_NAV_LINKS)[number]['match'], base: string) =>
    `${base}${navActive(match, hash) ? ` ${base}--active` : ''}`

  return (
    <nav className="site-header" aria-label="Site">
      <div className="site-header__start">
        <button
          ref={menuBtnRef}
          type="button"
          className="site-header__drawer-btn"
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
          aria-controls="site-nav-drawer"
          onClick={() => setDrawerOpen((open) => !open)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
            {drawerOpen ? (
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                d="M6 6l12 12M18 6L6 18"
              />
            ) : (
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                d="M4 7h16M4 12h16M4 17h16"
              />
            )}
          </svg>
        </button>
        <a className="site-header__brand" href="#/">
          Ford<span>riva</span>
        </a>
        <div className="site-header__links" aria-label="Primary">
          {SITE_NAV_LINKS.map((item) => (
            <a
              key={item.href}
              className={linkClass(item.match, 'site-header__link')}
              href={item.href}
              aria-current={navActive(item.match, hash) ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div className="site-header__end">
        {playerName ? (
          <a
            className={`site-header__you${navActive('you', hash) ? ' site-header__you--active' : ''}`}
            href={rankHref()}
            title={rank != null ? `Your ranking · #${rank}` : 'Your ranking'}
            aria-current={navActive('you', hash) ? 'page' : undefined}
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

        <SitePeriodControl variant="header" />

        <div className="site-header__more site-header__more--desktop" ref={utilRef}>
          <button
            type="button"
            className="site-header__menu-btn"
            aria-label="Settings"
            aria-expanded={utilOpen}
            aria-haspopup="menu"
            title="Settings"
            onClick={() => setUtilOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="1.7" fill="currentColor" />
              <circle cx="12" cy="12" r="1.7" fill="currentColor" />
              <circle cx="19" cy="12" r="1.7" fill="currentColor" />
            </svg>
          </button>
          {utilOpen ? (
            <div className="site-header__menu" role="menu">
              <SitePeriodControl
                variant="menu"
                onSelect={() => setUtilOpen(false)}
              />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  toggleTheme()
                  setUtilOpen(false)
                }}
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUtilOpen(false)
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

      {drawerOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="site-drawer" role="presentation">
              <button
                type="button"
                className="site-drawer__scrim"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              />
              <div
                id="site-nav-drawer"
                ref={drawerRef}
                className="site-drawer__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={drawerTitleId}
              >
                <div className="site-drawer__head">
                  <h2 id={drawerTitleId} className="site-drawer__title">
                    Menu
                  </h2>
                  <button
                    type="button"
                    className="site-drawer__close"
                    aria-label="Close menu"
                    onClick={() => setDrawerOpen(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="site-drawer__nav" aria-label="Primary">
                  <a
                    className={`site-drawer__link${hash === '#/' || hash === '#' || hash === '' ? ' site-drawer__link--active' : ''}`}
                    href="#/"
                    aria-current={
                      hash === '#/' || hash === '#' || hash === '' ? 'page' : undefined
                    }
                    onClick={() => setDrawerOpen(false)}
                  >
                    Games
                  </a>
                  {SITE_NAV_LINKS.map((item) => (
                    <a
                      key={item.href}
                      className={linkClass(item.match, 'site-drawer__link')}
                      href={item.href}
                      aria-current={navActive(item.match, hash) ? 'page' : undefined}
                      onClick={() => setDrawerOpen(false)}
                    >
                      {item.label}
                    </a>
                  ))}
                  <a
                    className={linkClass(SITE_DRAWER_YOU.match, 'site-drawer__link')}
                    href={SITE_DRAWER_YOU.href}
                    aria-current={navActive('you', hash) ? 'page' : undefined}
                    onClick={() => setDrawerOpen(false)}
                  >
                    {SITE_DRAWER_YOU.label}
                    {playerName ? (
                      <span className="site-drawer__meta">
                        {rank != null ? `#${rank} · ${playerName}` : playerName}
                      </span>
                    ) : null}
                  </a>
                </div>
                <div className="site-drawer__utils">
                  <SitePeriodControl
                    variant="drawer"
                    onSelect={() => setDrawerOpen(false)}
                  />
                  <button
                    type="button"
                    className="site-drawer__util"
                    onClick={() => {
                      toggleTheme()
                    }}
                  >
                    {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </button>
                  <button
                    type="button"
                    className="site-drawer__util"
                    onClick={() => {
                      setDrawerOpen(false)
                      playerRef.current?.openEdit()
                    }}
                  >
                    {accountLabel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </nav>
  )
}

/** @deprecated Use SiteHeader */
export const HomeBar = SiteHeader

/** @deprecated Use SiteHeader */
export const Header = SiteHeader
