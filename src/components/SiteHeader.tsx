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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [invitesOpen, setInvitesOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentTheme(),
  )
  const invitesRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const youBtnRef = useRef<HTMLButtonElement>(null)
  const badgeRef = useRef<PlayerBadgeHandle>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const drawerTitleId = useId()
  const drawerId = 'site-account-drawer'

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
      'a[href], button:not([disabled]), input:not([disabled])',
    )
    focusable?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      youBtnRef.current?.focus()
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

  const youTitle = signedIn
    ? playerName
      ? impersonation
        ? `Menu · Acting as ${playerName}`
        : rankLoading
          ? trophySummary.total > 0
            ? `Menu · ${playerName} · Loading rank · ${trophySummary.total} trophies`
            : `Menu · ${playerName} · Loading rank`
          : rank != null
            ? trophySummary.total > 0
              ? `Menu · ${playerName} · #${rank} · ${trophySummary.total} trophies`
              : `Menu · ${playerName} · #${rank}`
            : trophySummary.total > 0
              ? `Menu · ${playerName} · No rank yet · ${trophySummary.total} trophies`
              : `Menu · ${playerName} · No rank yet`
      : 'Menu · Set gamer tag'
    : 'Menu · Sign in'

  return (
    <div className="site-chrome">
      <nav className="site-header" aria-label="Site">
        <div className="site-header__start">
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
            className={`site-header__you${drawerOpen ? ' site-header__you--open' : ''}${!signedIn || !playerName ? ' site-header__you--empty' : ''}${impersonation ? ' site-header__you--impersonating' : ''}`}
            aria-label={youTitle}
            title={youTitle}
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            aria-haspopup="dialog"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            {signedIn && playerName ? (
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
              <span className="site-header__you-name">
                {signedIn ? 'Set tag' : 'Sign in'}
              </span>
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

      {drawerOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="site-drawer site-drawer--account" role="presentation">
              <button
                type="button"
                className="site-drawer__scrim"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              />
              <div
                id={drawerId}
                ref={drawerRef}
                className="site-drawer__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={drawerTitleId}
              >
                <div className="site-drawer__head">
                  <div className="site-drawer__identity">
                    <div className="site-drawer__title-row">
                      <h2 id={drawerTitleId} className="site-drawer__title">
                        {signedIn ? playerName || 'Account' : 'Sign in'}
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
                      aria-label="Close menu"
                      onClick={() => setDrawerOpen(false)}
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
                    onClick={() => setDrawerOpen(false)}
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
                  {signedIn ? (
                    <a
                      className={linkClass(SITE_DRAWER_YOU.match, 'site-drawer__link')}
                      href={SITE_DRAWER_YOU.href}
                      aria-current={navActive('you', hash) ? 'page' : undefined}
                      onClick={() => setDrawerOpen(false)}
                    >
                      {SITE_DRAWER_YOU.label}
                    </a>
                  ) : null}
                </div>

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
