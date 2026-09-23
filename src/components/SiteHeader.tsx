import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { useImpersonation } from '../hooks/useImpersonation'
import { useNotifications } from '../hooks/useNotifications'
import { usePendingInvites } from '../hooks/usePendingInvites'
import { usePlayerName } from '../hooks/usePlayerName'
import { useTrophySummary } from '../hooks/useTrophySummary'
import { currentPath, homeHref, useRoute } from '../hooks/useHashRoute'
import { logoutAccount } from '../lib/auth'
import { AVATAR_EVENT, AVATARS_ENABLED, getLocalAvatarId } from '../lib/avatars'
import { APP_NAME_ACCENT, APP_NAME_LEAD } from '../lib/brand'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import { useGlobalRank, useGlobalRankLoading } from '../lib/globalRank'
import { cachedMyGroups, useActiveGroup } from '../lib/groups'
import { normalizePlayerName } from '../lib/leaderboard'
import { currentTheme, THEME_EVENT, type Theme } from '../lib/theme'
import { AvatarStudio } from './AvatarStudio'
import { UserIcon } from './chromeIcons'
import { NotificationBell } from './NotificationBell'
import { PendingInvitesStrip } from './PendingInvitesStrip'
import { PlayerAvatar } from './PlayerAvatar'
import type { PlayerBadgeHandle } from './PlayerBadge'
import { SiteMenu } from './SiteMenu'
import { SiteScopeControl } from './SiteScopeControl'
import { SiteSearch } from './SiteSearch'
import { SiteTabs } from './SiteTabs'
import { navActive, OPEN_MENU_EVENT, SITE_NAV_LINKS } from './siteNav'

/**
 * The site's header, on every page but a game screen: one floating bar with
 * the name, the places, search, what the boards show, and you. You opens your
 * menu. On a phone the bar keeps only the name, the boards and search, and the
 * places and You move to a tab bar along the bottom.
 */
export function SiteHeader() {
  const route = useRoute()
  const routeKey = JSON.stringify(route)
  const { signedIn } = useAuth()
  const impersonation = useImpersonation()
  const { rank, score, avatarId: rankAvatarId } = useGlobalRank()
  const rankLoading = useGlobalRankLoading()
  const playerName = normalizePlayerName(usePlayerName())
  const trophySummary = useTrophySummary(signedIn ? playerName : '')
  const { count: inviteCount } = usePendingInvites()
  const friendsState = useFriends()
  const friendRequests = friendsState.incoming.length
  const notes = useNotifications(signedIn)
  const period = useDefaultPeriod()
  const groupId = useActiveGroup()
  // Editing the avatar needs a session, or the dev impersonation which carries a claim token.
  const canEditAvatar = (signedIn || Boolean(impersonation)) && AVATARS_ENABLED && Boolean(playerName)

  // Your mark: what you saved on this device wins until the API catches up.
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
  const avatarId = localAvatarId ?? rankAvatarId

  const [menuOpen, setMenuOpen] = useState(false)
  const [invitesOpen, setInvitesOpen] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [theme, setThemeState] = useState<Theme>(() => (typeof document === 'undefined' ? 'light' : currentTheme()))
  const invitesRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<PlayerBadgeHandle>(null)
  // Whatever opened the menu (the chip, or the tab bar's You) gets focus back when it closes.
  const openerRef = useRef<HTMLElement | null>(null)
  const menuTitleId = useId()
  const menuId = 'site-menu'

  useEffect(() => {
    const sync = () => setThemeState(currentTheme())
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  // Going somewhere closes whatever the header had open.
  useEffect(() => {
    setMenuOpen(false)
    setInvitesOpen(false)
  }, [routeKey])

  // A page can ask for the menu, to sign in from where the reason to is.
  useEffect(() => {
    const open = () => {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setMenuOpen(true)
    }
    window.addEventListener(OPEN_MENU_EVENT, open)
    return () => window.removeEventListener(OPEN_MENU_EVENT, open)
  }, [])

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
    if (!menuOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        return
      }
      // Tab goes round the menu rather than out to the page under it.
      const panel = panelRef.current
      if (e.key !== 'Tab' || !panel) return
      const stops = [
        ...panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.getClientRects().length > 0)
      if (stops.length === 0) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      const active = document.activeElement
      if (!panel.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.querySelector<HTMLElement>('.site-menu__close')?.focus()
    const opener = openerRef.current
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [menuOpen])

  const toggleMenu = () => {
    if (!menuOpen) openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setMenuOpen((open) => !open)
  }

  const path = currentPath()
  // Events and groups have boards of their own, so the site's boards control stays off their pages.
  const showScope =
    route.name !== 'tournaments' &&
    route.name !== 'tournament' &&
    route.name !== 'tournamentCreate' &&
    route.name !== 'tournamentPlay' &&
    route.name !== 'groups' &&
    route.name !== 'group'

  const tagged = signedIn && Boolean(playerName)
  // Your own player card is where You leads, so You shows as the current place there.
  const onOwnCard =
    tagged && route.name === 'rank' && (!route.player || normalizePlayerName(route.player) === playerName)
  const groupName = groupId ? cachedMyGroups().find((g) => g.id === groupId)?.name : undefined
  const where = groupName ? `in ${groupName}` : 'in the arcade'
  const alert = notes.unread > 0 || friendRequests > 0 || inviteCount > 0

  const youLabel = !signedIn
    ? 'Menu: sign in, theme and sounds'
    : !playerName
      ? 'Your menu: pick a gamer tag'
      : impersonation
        ? `Your menu, acting as ${playerName}`
        : `Your menu: ${playerName}${rank != null ? `, number ${rank}` : ''}${alert ? ', something new' : ''}`

  return (
    <div className="site-chrome">
      <nav className="site-bar" aria-label="Site">
        <a className="site-bar__brand" href={homeHref()}>
          {APP_NAME_LEAD}
          <span>{APP_NAME_ACCENT}</span>
        </a>
        <div className="site-bar__links">
          {SITE_NAV_LINKS.map((item) => {
            const on = navActive(item.match, path)
            return (
              <a
                key={item.href}
                className={`site-bar__link${on ? ' site-bar__link--on' : ''}`}
                href={item.href}
                aria-current={on ? 'page' : undefined}
              >
                {item.label}
              </a>
            )
          })}
        </div>

        <div className="site-bar__end">
          <SiteSearch />
          {showScope ? <SiteScopeControl /> : null}

          <div className="site-bar__you">
            {signedIn ? <NotificationBell notes={notes} /> : null}

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

            {tagged ? (
              <button
                type="button"
                className={`site-you${menuOpen ? ' site-you--open' : ''}${onOwnCard ? ' site-you--here' : ''}${impersonation ? ' site-you--acting' : ''}`}
                aria-label={youLabel}
                title={youLabel}
                aria-expanded={menuOpen}
                aria-controls={menuId}
                aria-haspopup="dialog"
                onClick={toggleMenu}
              >
                <span className="site-you__mark">
                  {AVATARS_ENABLED ? (
                    <PlayerAvatar avatarId={avatarId} name={playerName} size="md" />
                  ) : (
                    playerName.charAt(0)
                  )}
                </span>
                {impersonation ? (
                  <span className="site-you__act" aria-hidden="true">
                    AS
                  </span>
                ) : null}
                <span className="site-you__name">{playerName}</span>
                {rankLoading ? (
                  <span className="skel-line site-you__skel" aria-hidden="true" />
                ) : rank != null ? (
                  <span className="site-you__rank">#{rank}</span>
                ) : null}
                {alert ? (
                  <span
                    className={`site-you__dot${friendRequests > 0 ? '' : ' site-you__dot--folded'}`}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            ) : (
              <button
                type="button"
                className={`site-signin${signedIn ? ' site-signin--tag' : ''}${menuOpen ? ' site-signin--open' : ''}`}
                aria-label={youLabel}
                aria-expanded={menuOpen}
                aria-controls={menuId}
                aria-haspopup="dialog"
                onClick={toggleMenu}
              >
                <UserIcon />
                {signedIn ? 'Pick a tag' : 'Sign in'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {menuOpen ? (
        <SiteMenu
          id={menuId}
          titleId={menuTitleId}
          panelRef={panelRef}
          onClose={() => setMenuOpen(false)}
          signedIn={signedIn}
          name={playerName}
          impersonating={Boolean(impersonation)}
          avatarId={avatarId}
          standing={{ loading: rankLoading, rank, score, period, where }}
          trophies={trophySummary}
          friends={friendsState.loaded ? friendsState.friends.length : null}
          friendRequests={friendRequests}
          invites={inviteCount}
          notes={notes}
          theme={theme}
          badgeRef={badgeRef}
          onEditTag={() => badgeRef.current?.openTagEdit()}
          onEditAvatar={
            canEditAvatar
              ? () => {
                  setMenuOpen(false)
                  setStudioOpen(true)
                }
              : undefined
          }
          onSignOut={() => {
            setSigningOut(true)
            void logoutAccount().finally(() => setSigningOut(false))
          }}
          signingOut={signingOut}
        />
      ) : null}

      <SiteTabs
        menuId={menuId}
        menuOpen={menuOpen}
        onMenu={toggleMenu}
        name={tagged ? playerName : ''}
        avatarId={avatarId}
        here={onOwnCard}
        alert={alert}
        youLabel={youLabel}
      />

      {/* The bar's blur would hold a full-screen overlay inside it, so the studio goes to the page's body. */}
      {studioOpen && playerName && typeof document !== 'undefined'
        ? createPortal(
            <AvatarStudio
              name={playerName}
              current={avatarId}
              onSaved={(id) => {
                setLocalAvatar(id)
                setStudioOpen(false)
              }}
              onClose={() => setStudioOpen(false)}
            />,
            document.body,
          )
        : null}
    </div>
  )
}
