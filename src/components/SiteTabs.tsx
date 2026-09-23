import { createPortal } from 'react-dom'
import { currentPath } from '../hooks/useHashRoute'
import { AVATARS_ENABLED } from '../lib/avatars'
import { BoardsIcon, EventsIcon, GamesIcon, RecordsIcon, UserIcon } from './chromeIcons'
import { PlayerAvatar } from './PlayerAvatar'
import { navActive, SITE_TABS, type SiteNavItem } from './siteNav'

const TAB_ICON: Partial<Record<SiteNavItem['match'], typeof GamesIcon>> = {
  games: GamesIcon,
  boards: BoardsIcon,
  events: EventsIcon,
  records: RecordsIcon,
}

/**
 * The phone's way around: a bar along the bottom within thumb's reach, with
 * the four places and You, which opens your menu. Phones and upright tablets
 * show it; wider screens have the links in the header. Game screens have no
 * header, so it never sits over a game.
 */
export function SiteTabs({
  menuId,
  menuOpen,
  onMenu,
  name,
  avatarId,
  here,
  alert,
  youLabel,
}: {
  menuId: string
  menuOpen: boolean
  onMenu: () => void
  /** Your tag, when you have one: You wears your character. */
  name: string
  avatarId?: string
  /** You are on your own player card, so You is the current place. */
  here: boolean
  /** Something new waits in the menu: a notification, a friend request, an invite. */
  alert: boolean
  youLabel: string
}) {
  if (typeof document === 'undefined') return null
  const path = currentPath()

  return createPortal(
    <nav className="site-tabs" aria-label="Primary">
      {SITE_TABS.map((tab) => {
        const on = !menuOpen && navActive(tab.match, path)
        const Icon = TAB_ICON[tab.match]
        return (
          <a
            key={tab.match}
            className={`site-tabs__tab${on ? ' site-tabs__tab--on' : ''}`}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
          >
            <span className="site-tabs__icon">{Icon ? <Icon /> : null}</span>
            <span className="site-tabs__label">{tab.label}</span>
          </a>
        )
      })}
      <button
        type="button"
        className={`site-tabs__tab${menuOpen || here ? ' site-tabs__tab--on' : ''}`}
        aria-current={here && !menuOpen ? 'page' : undefined}
        aria-label={youLabel}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-haspopup="dialog"
        onClick={onMenu}
      >
        <span className="site-tabs__icon">
          {name && AVATARS_ENABLED ? (
            <PlayerAvatar avatarId={avatarId} name={name} size="md" className="site-tabs__avatar" />
          ) : (
            <UserIcon />
          )}
          {alert ? <span className="site-tabs__dot" aria-hidden="true" /> : null}
        </span>
        <span className="site-tabs__label">You</span>
      </button>
    </nav>,
    document.body,
  )
}
