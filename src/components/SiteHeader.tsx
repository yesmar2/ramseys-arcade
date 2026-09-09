import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlayerName } from '../hooks/usePlayerName'
import { rankHref, useHashRoute } from '../hooks/useHashRoute'
import { APP_NAME_ACCENT, APP_NAME_LEAD } from '../lib/brand'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { currentTheme, THEME_EVENT, toggleTheme, type Theme } from '../lib/theme'
import { normalizePlayerName } from '../lib/leaderboard'
import { useTrophySummary } from '../hooks/useTrophySummary'
import { useImpersonation } from '../hooks/useImpersonation'
import { DevImpersonateControl } from './DevImpersonateControl'
import { PendingInvitesStrip } from './PendingInvitesStrip'
import { PlayerBadge, type PlayerBadgeHandle } from './PlayerBadge'
import { SiteGroupControl } from './SiteGroupControl'
import { SitePeriodControl } from './SitePeriodControl'
import { SoundPackSelect } from './SoundPackSelect'
import { TrophyMark } from './TrophyMark'
import { usePendingInvites } from '../hooks/usePendingInvites'
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
  const rankLoading = useGlobalRankLoading()
  const playerName = normalizePlayerName(usePlayerName())
  const impersonation = useImpersonation()
  const trophySummary = useTrophySummary(playerName)
  const { count: inviteCount } = usePendingInvites()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [invitesOpen, setInvitesOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentTheme(),
  )
  const invitesRef = useRef<HTMLDivElement>(null)
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
    setInvitesOpen(false)
  }, [hashKey])

  useEffect(() => {
    if (!invitesOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!invitesRef.current?.contains(e.target as Node)) setInvitesOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInvitesOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [invitesOpen])

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

  const hash = typeof window !== 'undefined' ? window.location.hash : '#/'
  const showBoardFilters =
    route.name !== 'tournaments' &&
    route.name !== 'tournament' &&
    route.name !== 'tournamentCreate' &&
    route.name !== 'tournamentPlay'

  const linkClass = (match: (typeof SITE_NAV_LINKS)[number]['match'], base: string) =>
    `${base}${navActive(match, hash) ? ` ${base}--active` : ''}`

  return (
    <div className="site-chrome">
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
          {APP_NAME_LEAD}
          <span>{APP_NAME_ACCENT}</span>
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

      <div className="site-header__identity">
        {inviteCount > 0 ? (
          <div className="site-header__invites" ref={invitesRef}>
            <button
              type="button"
              className="site-header__invite-btn"
              aria-label={`${inviteCount} pending invite${inviteCount === 1 ? '' : 's'}`}
              aria-expanded={invitesOpen}
              aria-haspopup="dialog"
              onClick={() => setInvitesOpen((open) => !open)}
            >
              <span className="site-header__invite-count">{inviteCount}</span>
            </button>
            {invitesOpen ? (
              <div className="site-header__invite-panel" role="dialog" aria-label="Pending invites">
                <PendingInvitesStrip compact />
              </div>
            ) : null}
          </div>
        ) : null}

        {playerName ? (
          <a
            className={`site-header__you${navActive('you', hash) ? ' site-header__you--active' : ''}${impersonation ? ' site-header__you--impersonating' : ''}`}
            href={rankHref()}
            title={
              impersonation
                ? `Acting as ${playerName} (dev)`
                : rankLoading
                ? trophySummary.total > 0
                  ? `Your profile · Loading rank · ${trophySummary.total} trophies`
                  : 'Your profile · Loading rank'
                : rank != null
                  ? trophySummary.total > 0
                    ? `Your profile · #${rank} · ${trophySummary.total} trophies`
                    : `Your profile · #${rank}`
                  : trophySummary.total > 0
                    ? `Your profile · No rank yet · ${trophySummary.total} trophies`
                    : 'Your profile · No rank yet'
            }
            aria-current={navActive('you', hash) ? 'page' : undefined}
          >
            {rankLoading ? (
              <span
                className="site-header__you-rank site-header__you-rank--loading"
                aria-label="Loading rank"
              >
                <span className="site-header__rank-spinner" aria-hidden="true" />
              </span>
            ) : rank != null ? (
              <span className="site-header__you-rank">#{rank}</span>
            ) : null}
            {impersonation ? (
              <span className="site-header__you-act" aria-hidden="true">
                AS
              </span>
            ) : null}
            <span className="site-header__you-name">{playerName}</span>
            {trophySummary.total > 0 ? (
              <TrophyMark
                count={trophySummary.total}
                podium={trophySummary.podium}
                size="sm"
                className="site-header__you-trophy"
              />
            ) : null}
          </a>
        ) : null}

        <div className="site-header__player">
          <PlayerBadge ref={playerRef} icon className="site-header__player-badge" />
        </div>
      </div>
    </nav>

    {showBoardFilters ? (
      <div className="site-scopes" aria-label="Board filters">
        <SitePeriodControl variant="header" />
        <SiteGroupControl variant="header" />
      </div>
    ) : null}

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
                    {APP_NAME_LEAD}
                    <span>{APP_NAME_ACCENT}</span>
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
                  </a>
                </div>
                <div className="site-drawer__footer">
                  {showBoardFilters ? (
                    <section className="site-drawer__section" aria-label="Board filters">
                      <h3 className="site-drawer__section-title">Filters</h3>
                      <div className="site-drawer__section-body">
                        <SitePeriodControl
                          variant="drawer"
                          onSelect={() => setDrawerOpen(false)}
                        />
                        <SiteGroupControl
                          variant="drawer"
                          onSelect={() => setDrawerOpen(false)}
                        />
                      </div>
                    </section>
                  ) : null}
                  <section className="site-drawer__section" aria-label="Settings">
                    <h3 className="site-drawer__section-title">Settings</h3>
                    <div className="site-drawer__prefs">
                      <button
                        type="button"
                        className="site-drawer__pref"
                        onClick={() => {
                          toggleTheme()
                        }}
                      >
                        <span className="site-drawer__pref-label">Theme</span>
                        <span className="site-drawer__pref-value">
                          {theme === 'dark' ? 'Dark' : 'Light'}
                        </span>
                      </button>
                      <SoundPackSelect variant="drawer" />
                    </div>
                    <DevImpersonateControl variant="drawer" />
                  </section>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/** @deprecated Use SiteHeader */
export const HomeBar = SiteHeader

/** @deprecated Use SiteHeader */
export const Header = SiteHeader
