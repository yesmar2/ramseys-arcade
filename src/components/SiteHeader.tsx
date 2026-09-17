import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { rankHref, useHashRoute } from '../hooks/useHashRoute'
import { APP_NAME_ACCENT, APP_NAME_LEAD } from '../lib/brand'
import { logoutAccount } from '../lib/auth'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { AVATAR_EVENT, AVATARS_ENABLED, getLocalAvatarId } from '../lib/avatars'
import { PlayerAvatar } from './PlayerAvatar'
import { currentTheme, setTheme as chooseTheme, THEME_EVENT, themeLabel, type Theme } from '../lib/theme'
import { normalizePlayerName } from '../lib/leaderboard'
import { useTrophySummary } from '../hooks/useTrophySummary'
import { NotificationBell } from './NotificationBell'
import { useFriends } from '../hooks/useFriends'
import { useImpersonation } from '../hooks/useImpersonation'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { groupsIndexHref } from '../lib/groups'
import { PERIOD_LABELS } from '../lib/leaderboard'
import { DevImpersonateControl } from './DevImpersonateControl'
import { PendingInvitesStrip } from './PendingInvitesStrip'
import { PlayerBadge, type PlayerBadgeHandle } from './PlayerBadge'
import { SiteGroupControl } from './SiteGroupControl'
import { SitePeriodControl } from './SitePeriodControl'
import { SoundPackSelect } from './SoundPackSelect'
import { TrophyMark } from './TrophyMark'
import { usePendingInvites } from '../hooks/usePendingInvites'
import { navActive, SITE_NAV_LINKS } from './siteNav'

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

/** The themes, in the order the picker shows them. */
const THEME_CHOICES: Theme[] = ['light', 'dark', 'flat', 'google']

/** Site-wide navigation — use this on every page (home, leaderboards, game hub, etc.). */
export function SiteHeader() {
  const route = useHashRoute()
  const hashKey = JSON.stringify(route)
  const { signedIn } = useAuth()
  const { rank, avatarId: rankAvatarId } = useGlobalRank()
  const rankLoading = useGlobalRankLoading()
  const playerName = normalizePlayerName(usePlayerName())
  const impersonation = useImpersonation()
  const trophySummary = useTrophySummary(signedIn ? playerName : '')
  const { count: inviteCount } = usePendingInvites()
  const friendsState = useFriends()
  const friendRequests = friendsState.incoming.length

  // The drawer draws your mark: what you saved on this device wins until the API catches up.
  const [localAvatarId, setLocalAvatar] = useState<string | null>(() => getLocalAvatarId(playerName))
  useEffect(() => {
    setLocalAvatar(getLocalAvatarId(playerName))
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; avatarId?: string }>).detail
      if (detail?.name === playerName && detail.avatarId) setLocalAvatar(detail.avatarId)
    }
    window.addEventListener(AVATAR_EVENT, onChange)
    return () => window.removeEventListener(AVATAR_EVENT, onChange)
  }, [playerName])
  const defaultPeriod = useDefaultPeriod()
  const [accountOpen, setAccountOpen] = useState(false)
  const [invitesOpen, setInvitesOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentTheme(),
  )
  const invitesRef = useRef<HTMLDivElement>(null)
  const accountDrawerRef = useRef<HTMLDivElement>(null)
  const youBtnRef = useRef<HTMLButtonElement>(null)
  const badgeRef = useRef<PlayerBadgeHandle>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const accountTitleId = useId()
  const accountDrawerId = 'site-account-drawer'

  useEffect(() => {
    const sync = () => setTheme(currentTheme())
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  useEffect(() => {
    setAccountOpen(false)
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
    if (!accountOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const focusable = accountDrawerRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled])',
    )
    focusable?.focus()
    // The chip that opened the drawer gets focus back when it closes.
    const opener = youBtnRef.current
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [accountOpen])

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

  const homeActive = hash === '#/' || hash === '#' || hash === ''
  const goRows = (
    <>
      <a
        className={`site-drawer__row${homeActive ? ' site-drawer__row--active' : ''}`}
        href="#/"
        aria-current={homeActive ? 'page' : undefined}
        onClick={() => setAccountOpen(false)}
      >
        <span className="site-drawer__row-label">Games</span>
        <span className="site-drawer__row-chev" aria-hidden="true">
          ›
        </span>
      </a>
      {SITE_NAV_LINKS.map((item) => (
        <a
          key={item.href}
          className={linkClass(item.match, 'site-drawer__row')}
          href={item.href}
          aria-current={navActive(item.match, hash) ? 'page' : undefined}
          onClick={() => setAccountOpen(false)}
        >
          <span className="site-drawer__row-label">{item.label}</span>
          <span className="site-drawer__row-chev" aria-hidden="true">
            ›
          </span>
        </a>
      ))}
    </>
  )

  const standingText = `${
    rank != null ? `#${rank} ${PERIOD_LABELS[defaultPeriod].toLowerCase()}` : 'No rank yet'
  }${
    trophySummary.total > 0
      ? ` · ${trophySummary.total} ${trophySummary.total === 1 ? 'trophy' : 'trophies'}`
      : ''
  }`
  const profileLabel = rankLoading
    ? 'View profile · loading rank'
    : rank != null
      ? `View profile · global rank ${rank}`
      : 'View profile · no rank yet'

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
          <NotificationBell enabled={signedIn} />

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
            onClick={() => setAccountOpen((open) => !open)}
          >
            {showUserChip ? (
              <>
                {rankLoading ? (
                  <span
                    className="site-header__you-rank site-header__you-rank--loading"
                    aria-label="Loading rank"
                  >
                    <span className="skel-line site-header__rank-skel" aria-hidden="true" />
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
            {friendRequests > 0 ? (
              <span
                className="site-header__you-dot"
                aria-label={`${friendRequests} friend ${friendRequests === 1 ? 'request' : 'requests'}`}
              />
            ) : null}
          </button>
        </div>
      </nav>

      {showBoardFilters ? (
        <div className="site-scopes" aria-label="Board filters">
          <SitePeriodControl variant="header" />
          <SiteGroupControl variant="header" />
        </div>
      ) : null}

      {accountOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="site-drawer site-drawer--account" role="presentation">
              <button
                type="button"
                className="site-drawer__scrim"
                aria-label="Close menu"
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
                {/* You, as a hero: the mark, the tag, where you stand. The whole thing goes to the profile. */}
                <div className="site-drawer__hero">
                  <button
                    type="button"
                    className="site-drawer__close"
                    aria-label="Close menu"
                    onClick={() => setAccountOpen(false)}
                  >
                    ✕
                  </button>
                  {signedIn && playerName ? (
                    <>
                      <a
                        className="site-drawer__hero-id"
                        href={rankHref()}
                        onClick={() => setAccountOpen(false)}
                        aria-label={profileLabel}
                      >
                        <span
                          className={`site-drawer__hero-mark${AVATARS_ENABLED ? ' site-drawer__hero-mark--avatar' : ''}`}
                          aria-hidden="true"
                        >
                          {AVATARS_ENABLED ? (
                            <PlayerAvatar
                              avatarId={localAvatarId ?? rankAvatarId}
                              name={playerName}
                              size="xl"
                            />
                          ) : (
                            playerName.charAt(0)
                          )}
                        </span>
                        <span id={accountTitleId} className="site-drawer__hero-name">
                          {playerName}
                        </span>
                        <span className="site-drawer__hero-meta">
                          {rankLoading ? <span className="skel-line" aria-hidden="true" /> : standingText}
                        </span>
                      </a>
                      <div className="site-drawer__hero-actions">
                        <a
                          className="site-drawer__ghost"
                          href={rankHref()}
                          onClick={() => setAccountOpen(false)}
                        >
                          Profile
                        </a>
                        <button
                          type="button"
                          className="site-drawer__ghost"
                          onClick={() => badgeRef.current?.openTagEdit()}
                        >
                          Edit tag
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="site-drawer__hero-text">
                      <h2 id={accountTitleId} className="site-drawer__hero-name">
                        {signedIn ? 'Pick a gamer tag' : 'Sign in'}
                      </h2>
                      <p className="site-drawer__hero-meta">
                        {signedIn
                          ? 'A tag saves your scores and puts you on the boards.'
                          : 'Save scores and keep your tag across devices.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* The tag form, the sign-in button, and any error: only there when there is something to show. */}
                <section className="site-drawer__section" aria-label="Account">
                  <PlayerBadge ref={badgeRef} embedded showSettings={false} />
                </section>

                {/* Where to go. On wide screens the header carries these, so the rows only show on phones. */}
                <nav className="site-drawer__rows site-drawer__rows--go" aria-label="Primary">
                  {goRows}
                </nav>

                {signedIn ? (
                  <nav className="site-drawer__rows" aria-label="Yours">
                    <a
                      className="site-drawer__row"
                      href={rankHref()}
                      onClick={() => setAccountOpen(false)}
                    >
                      <span className="site-drawer__row-label">Friends</span>
                      <span className="site-drawer__row-value">
                        {friendsState.loaded ? friendsState.friends.length : ''}
                        {friendRequests > 0 ? (
                          <span className="site-drawer__badge">
                            {friendRequests} {friendRequests === 1 ? 'request' : 'requests'}
                          </span>
                        ) : null}
                      </span>
                      <span className="site-drawer__row-chev" aria-hidden="true">
                        ›
                      </span>
                    </a>
                    <a
                      className="site-drawer__row"
                      href={groupsIndexHref()}
                      onClick={() => setAccountOpen(false)}
                    >
                      <span className="site-drawer__row-label">Groups</span>
                      <span className="site-drawer__row-chev" aria-hidden="true">
                        ›
                      </span>
                    </a>
                  </nav>
                ) : null}

                {/* Settings as controls you can see all of, not rows that cycle. */}
                <section className="site-drawer__settings" aria-label="Settings">
                  <h3 className="site-drawer__section-title">Theme</h3>
                  <div
                    className="seg"
                    role="group"
                    aria-label="Theme"
                    style={{ '--seg-count': THEME_CHOICES.length } as CSSProperties}
                  >
                    {THEME_CHOICES.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        className={`seg__item${theme === choice ? ' seg__item--active' : ''}`}
                        aria-pressed={theme === choice}
                        onClick={() => chooseTheme(choice)}
                      >
                        {themeLabel(choice)}
                      </button>
                    ))}
                  </div>
                  <h3 className="site-drawer__section-title">Sounds</h3>
                  <SoundPackSelect variant="chips" />
                  <DevImpersonateControl variant="drawer" />
                </section>

                {signedIn ? (
                  <button
                    type="button"
                    className="site-drawer__signout"
                    disabled={authBusy}
                    onClick={() => {
                      setAuthBusy(true)
                      void logoutAccount().finally(() => setAuthBusy(false))
                    }}
                  >
                    Sign out
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
