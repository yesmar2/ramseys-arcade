import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { rankHref, useHashRoute } from '../hooks/useHashRoute'
import { APP_NAME_ACCENT, APP_NAME_LEAD } from '../lib/brand'
import { logoutAccount } from '../lib/auth'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { currentTheme, THEME_EVENT, toggleTheme, themeLabel, type Theme } from '../lib/theme'
import { normalizePlayerName } from '../lib/leaderboard'
import { useTrophySummary } from '../hooks/useTrophySummary'
import { useImpersonation } from '../hooks/useImpersonation'
import { DevImpersonateControl } from './DevImpersonateControl'
import { PendingInvitesStrip } from './PendingInvitesStrip'
import { EditIcon, LogoutIcon, PlayerBadge, type PlayerBadgeHandle } from './PlayerBadge'
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

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6.2 18.6c.7-3.2 3-4.8 5.8-4.8s5.1 1.6 5.8 4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 7.5h14M5 12h14M5 16.5h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Site-wide navigation — use this on every page (home, leaderboards, game hub, etc.). */
export function SiteHeader() {
  const route = useHashRoute()
  const hashKey = JSON.stringify(route)
  const { signedIn } = useAuth()
  const { rank } = useGlobalRank()
  const rankLoading = useGlobalRankLoading()
  const playerName = normalizePlayerName(usePlayerName())
  const impersonation = useImpersonation()
  const trophySummary = useTrophySummary(signedIn ? playerName : '')
  const { count: inviteCount } = usePendingInvites()
  const [accountOpen, setAccountOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [invitesOpen, setInvitesOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentTheme(),
  )
  const invitesRef = useRef<HTMLDivElement>(null)
  const accountDrawerRef = useRef<HTMLDivElement>(null)
  const navDrawerRef = useRef<HTMLDivElement>(null)
  const youBtnRef = useRef<HTMLButtonElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const badgeRef = useRef<PlayerBadgeHandle>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const accountTitleId = useId()
  const navTitleId = useId()
  const accountDrawerId = 'site-account-drawer'
  const navDrawerId = 'site-nav-drawer'

  useEffect(() => {
    const sync = () => setTheme(currentTheme())
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  useEffect(() => {
    setAccountOpen(false)
    setNavOpen(false)
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
    if (!accountOpen && !navOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (accountOpen) setAccountOpen(false)
      else setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const panel = accountOpen ? accountDrawerRef.current : navDrawerRef.current
    const focusable = panel?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled])',
    )
    focusable?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      if (accountOpen) youBtnRef.current?.focus()
      else menuBtnRef.current?.focus()
    }
  }, [accountOpen, navOpen])

  const hash = typeof window !== 'undefined' ? window.location.hash : '#/'
  const showBoardFilters =
    route.name !== 'tournaments' &&
    route.name !== 'tournament' &&
    route.name !== 'tournamentCreate' &&
    route.name !== 'tournamentPlay'

  const linkClass = (match: (typeof SITE_NAV_LINKS)[number]['match'], base: string) =>
    `${base}${navActive(match, hash) ? ` ${base}--active` : ''}`

  const youTitle = signedIn
    ? playerName
      ? impersonation
        ? `Account · Acting as ${playerName}`
        : rankLoading
          ? trophySummary.total > 0
            ? `Account · ${playerName} · Loading rank · ${trophySummary.total} trophies`
            : `Account · ${playerName} · Loading rank`
          : rank != null
            ? trophySummary.total > 0
              ? `Account · ${playerName} · #${rank} · ${trophySummary.total} trophies`
              : `Account · ${playerName} · #${rank}`
            : trophySummary.total > 0
              ? `Account · ${playerName} · No rank yet · ${trophySummary.total} trophies`
              : `Account · ${playerName} · No rank yet`
      : 'Account · Set gamer tag'
    : 'Account'

  const showUserChip = signedIn && Boolean(playerName)

  const navLinks = (
    <>
      <a
        className={`site-drawer__link${hash === '#/' || hash === '#' || hash === '' ? ' site-drawer__link--active' : ''}`}
        href="#/"
        aria-current={hash === '#/' || hash === '#' || hash === '' ? 'page' : undefined}
        onClick={() => setNavOpen(false)}
      >
        Games
      </a>
      {SITE_NAV_LINKS.map((item) => (
        <a
          key={item.href}
          className={linkClass(item.match, 'site-drawer__link')}
          href={item.href}
          aria-current={navActive(item.match, hash) ? 'page' : undefined}
          onClick={() => setNavOpen(false)}
        >
          {item.label}
        </a>
      ))}
      {signedIn ? (
        <a
          className={linkClass(SITE_DRAWER_YOU.match, 'site-drawer__link')}
          href={SITE_DRAWER_YOU.href}
          aria-current={navActive('you', hash) ? 'page' : undefined}
          onClick={() => setNavOpen(false)}
        >
          {SITE_DRAWER_YOU.label}
        </a>
      ) : null}
    </>
  )

  return (
    <div className="site-chrome">
      <nav className="site-header" aria-label="Site">
        <div className="site-header__start">
          <button
            ref={menuBtnRef}
            type="button"
            className={`site-header__menu-btn${navOpen ? ' site-header__menu-btn--open' : ''}`}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            aria-controls={navDrawerId}
            onClick={() => {
              setAccountOpen(false)
              setNavOpen((open) => !open)
            }}
          >
            <MenuIcon />
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
                <div
                  className="site-header__invite-panel"
                  role="dialog"
                  aria-label="Pending invites"
                >
                  <PendingInvitesStrip compact />
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            ref={youBtnRef}
            type="button"
            className={`site-header__you${accountOpen ? ' site-header__you--open' : ''}${!showUserChip ? ' site-header__you--icon' : ''}${impersonation ? ' site-header__you--impersonating' : ''}`}
            aria-label={youTitle}
            title={youTitle}
            aria-expanded={accountOpen}
            aria-controls={accountDrawerId}
            aria-haspopup="dialog"
            onClick={() => {
              setNavOpen(false)
              setAccountOpen((open) => !open)
            }}
          >
            {showUserChip ? (
              <>
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
              </>
            ) : (
              <UserIcon />
            )}
          </button>
        </div>
      </nav>

      {showBoardFilters ? (
        <div className="site-scopes" aria-label="Board filters">
          <SitePeriodControl variant="header" />
          <SiteGroupControl variant="header" />
        </div>
      ) : null}

      {navOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="site-drawer site-drawer--nav" role="presentation">
              <button
                type="button"
                className="site-drawer__scrim"
                aria-label="Close navigation"
                onClick={() => setNavOpen(false)}
              />
              <div
                id={navDrawerId}
                ref={navDrawerRef}
                className="site-drawer__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={navTitleId}
              >
                <div className="site-drawer__head">
                  <div className="site-drawer__identity">
                    <h2 id={navTitleId} className="site-drawer__title">
                      Menu
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="site-drawer__close"
                    aria-label="Close navigation"
                    onClick={() => setNavOpen(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="site-drawer__nav site-drawer__nav--always" aria-label="Primary">
                  {navLinks}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {accountOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="site-drawer site-drawer--account" role="presentation">
              <button
                type="button"
                className="site-drawer__scrim"
                aria-label="Close account"
                onClick={() => setAccountOpen(false)}
              />
              <div
                id={accountDrawerId}
                ref={accountDrawerRef}
                className="site-drawer__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={accountTitleId}
              >
                <div className="site-drawer__head">
                  <div className="site-drawer__identity">
                    <div className="site-drawer__title-row">
                      <h2 id={accountTitleId} className="site-drawer__title">
                        {signedIn ? playerName || 'Account' : 'Account'}
                      </h2>
                      {signedIn && playerName ? (
                        <button
                          type="button"
                          className="site-drawer__icon-btn"
                          aria-label="Edit gamer tag"
                          title="Edit gamer tag"
                          onClick={() => badgeRef.current?.openTagEdit()}
                        >
                          <EditIcon />
                        </button>
                      ) : null}
                    </div>
                    {!signedIn ? (
                      <p className="site-drawer__identity-meta">
                        Sign in to save scores and keep your tag across devices
                      </p>
                    ) : !playerName ? (
                      <p className="site-drawer__identity-meta">
                        Pick a gamer tag to save scores
                      </p>
                    ) : null}
                  </div>
                  <div className="site-drawer__head-actions">
                    {signedIn ? (
                      <button
                        type="button"
                        className="site-drawer__icon-btn"
                        aria-label="Sign out"
                        title="Sign out"
                        disabled={authBusy}
                        onClick={() => {
                          setAuthBusy(true)
                          void logoutAccount().finally(() => setAuthBusy(false))
                        }}
                      >
                        <LogoutIcon />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="site-drawer__close"
                      aria-label="Close account"
                      onClick={() => setAccountOpen(false)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <section className="site-drawer__section" aria-label="Account">
                  <PlayerBadge ref={badgeRef} embedded showSettings={false} />
                </section>

                {signedIn && playerName ? (
                  <a
                    className="site-drawer__rank"
                    href={rankHref()}
                    onClick={() => setAccountOpen(false)}
                    aria-label={
                      rankLoading
                        ? 'View profile · loading rank'
                        : rank != null
                          ? `View profile · global rank ${rank}`
                          : 'View profile · no rank yet'
                    }
                  >
                    {rankLoading ? (
                      <span
                        className="site-drawer__rank-circle site-drawer__rank-circle--loading"
                        aria-hidden="true"
                      >
                        <span className="site-drawer__rank-spinner" />
                      </span>
                    ) : (
                      <span
                        className={`site-drawer__rank-circle${rank == null ? ' site-drawer__rank-circle--empty' : ''}`}
                        aria-hidden="true"
                      >
                        <span className="site-drawer__rank-label">Rank</span>
                        <span
                          className={`site-drawer__rank-value${rank == null ? ' site-drawer__rank-value--text' : ''}`}
                        >
                          {rank != null ? `#${rank}` : 'No rank'}
                        </span>
                      </span>
                    )}
                    <span className="site-drawer__rank-foot">
                      {trophySummary.total > 0 ? (
                        <TrophyMark
                          count={trophySummary.total}
                          podium={trophySummary.podium}
                          size="md"
                          className="site-drawer__rank-trophy"
                        />
                      ) : null}
                      <span className="site-drawer__rank-cta">View profile</span>
                    </span>
                  </a>
                ) : null}

                <div className="site-drawer__footer">
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
                          {themeLabel(theme)}
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
