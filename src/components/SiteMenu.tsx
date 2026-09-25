import { useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { aboutHref, privacyHref, rankHref, statsHref, termsHref } from '../hooks/useHashRoute'
import { AVATARS_ENABLED, avatarWashColor, resolveAvatar } from '../lib/avatars'
import { APP_NAME } from '../lib/brand'
import { inkOn } from '../lib/color'
import { groupsIndexHref } from '../lib/groups'
import { ordinal, periodWord, pts } from '../lib/profileMath'
import { setTheme, themeLabel, type Theme } from '../lib/theme'
import type { LeaderboardPeriod } from '../lib/leaderboard'
import type { TrophySummary } from '../lib/trophies'
import {
  BellIcon,
  BoardsIcon,
  ChevronRightIcon,
  CloseIcon,
  EventsIcon,
  FriendIcon,
  GroupsIcon,
  MedalIcon,
  MoonIcon,
  PencilIcon,
  SignOutIcon,
  StatsIcon,
  SunIcon,
} from './chromeIcons'
import type { AvatarWear } from './AvatarStudio'
import { DevImpersonateControl } from './DevImpersonateControl'
import { Inbox, type NotificationsState } from './NotificationBell'
import { useInboxLook } from '../hooks/useNotifications'
import { inboxSummary } from '../lib/notifications'
import { PendingInvitesStrip } from './PendingInvitesStrip'
import { PlayerAvatar } from './PlayerAvatar'
import { PlayerBadge, type PlayerBadgeHandle } from './PlayerBadge'
import { MusicToggle } from './MusicToggle'
import { SoundPackSelect } from './SoundPackSelect'
import { BugHuntMenuRow, HiddenBug } from './BugHunt'

/** The themes, in the order the picker shows them. */
const THEME_CHOICES: Theme[] = ['light', 'dark']

export type MenuStanding = {
  loading: boolean
  rank: number | null
  score: number
  period: LeaderboardPeriod
  /** "in the arcade", or "in" a group while the boards are scoped to one. */
  where: string
}

/**
 * Your menu: a panel from the right on a wide screen, a sheet from the bottom
 * on a phone (where the tab bar's You opens it). You at the top as a small
 * player card; then your inbox, stats, friends and groups; then the theme and
 * the sounds as controls you can see all of; sign out; the small print. Signed
 * out, the top says what an account is for and holds the way in.
 */
export function SiteMenu({
  id,
  titleId,
  panelRef,
  onClose,
  signedIn,
  name,
  impersonating,
  avatarId,
  standing,
  trophies,
  friends,
  friendRequests,
  invites,
  notes,
  theme,
  badgeRef,
  onEditTag,
  onEditAvatar,
  onWear,
  onSignOut,
  signingOut,
}: {
  id: string
  titleId: string
  panelRef: Ref<HTMLDivElement>
  onClose: () => void
  signedIn: boolean
  /** Your gamer tag; empty until you pick one. */
  name: string
  impersonating: boolean
  avatarId?: string
  standing: MenuStanding
  trophies: TrophySummary
  /** How many friends you have, once known. */
  friends: number | null
  friendRequests: number
  invites: number
  notes: NotificationsState
  theme: Theme
  badgeRef: Ref<PlayerBadgeHandle>
  onEditTag: () => void
  onEditAvatar?: () => void
  /** Put on flair a trophy in the inbox unlocked. */
  onWear?: (wear: AvatarWear) => void
  onSignOut: () => void
  signingOut: boolean
}) {
  // The inbox opens in place of the menu, as a sheet of its own with a way back.
  const [view, setView] = useState<'menu' | 'inbox'>('menu')
  const isFresh = useInboxLook(notes, view === 'inbox')
  if (typeof document === 'undefined') return null

  const tagged = signedIn && Boolean(name)
  const accent = tagged && AVATARS_ENABLED ? avatarWashColor(resolveAvatar(avatarId, name)) : undefined
  const word = periodWord(standing.period)
  const facts = [
    standing.rank != null ? pts(standing.score) : null,
    trophies.total > 0 ? `${trophies.total} ${trophies.total === 1 ? 'trophy' : 'trophies'}` : null,
    trophies.events > 0 ? `${trophies.events} ${trophies.events === 1 ? 'event' : 'events'} won` : null,
  ].filter(Boolean)

  const summary = inboxSummary(notes.items)

  const card = tagged ? (
    <div
      className="site-menu__card"
      style={accent ? ({ '--card-accent': accent, '--card-ink': inkOn(accent) } as CSSProperties) : undefined}
    >
      <div className="site-menu__card-head">
        <span className="site-menu__card-mark" aria-hidden="true">
          {AVATARS_ENABLED ? (
            <PlayerAvatar avatarId={avatarId} name={name} size="lg" />
          ) : (
            <span className="site-menu__card-glyph">{name.charAt(0)}</span>
          )}
        </span>
        <div className="site-menu__card-text">
          <span className="site-menu__card-name">
            {name}
            {!impersonating ? (
              <button
                type="button"
                className="site-menu__card-edit"
                aria-label="Change your gamer tag"
                title="Change your gamer tag"
                onClick={onEditTag}
              >
                <PencilIcon />
              </button>
            ) : null}
          </span>
          <span className="site-menu__card-line">
            {impersonating ? (
              'Acting as this player for testing'
            ) : standing.loading ? (
              <span className="skel-line" aria-hidden="true" />
            ) : standing.rank != null ? (
              `${ordinal(standing.rank)} ${standing.where} ${word}`
            ) : (
              `Not on the boards ${word} yet`
            )}
          </span>
          {facts.length > 0 ? <span className="site-menu__card-facts">{facts.join(' · ')}</span> : null}
        </div>
      </div>
      <div className="site-menu__card-acts">
        <a className="site-menu__card-cta" href={rankHref()} onClick={onClose}>
          Your player card
        </a>
        {onEditAvatar ? (
          <button type="button" className="site-menu__card-ghost" onClick={onEditAvatar}>
            <PencilIcon />
            Avatar
          </button>
        ) : null}
      </div>
    </div>
  ) : signedIn ? (
    <div className="site-menu__card site-menu__card--pitch">
      <span className="site-menu__pitch-mark" aria-hidden="true">
        <MedalIcon />
      </span>
      <span className="site-menu__pitch-title">Pick a gamer tag</span>
      <span className="site-menu__pitch-copy">Your tag is how the boards know your scores.</span>
    </div>
  ) : (
    <div className="site-menu__card site-menu__card--pitch">
      <span className="site-menu__pitch-mark" aria-hidden="true">
        <MedalIcon />
      </span>
      <span className="site-menu__pitch-title">Put your scores on the boards</span>
      <span className="site-menu__pitch-copy">
        Playing needs no account. Sign in to pick a gamer tag and put your scores on the boards.
      </span>
      <PlayerBadge ref={badgeRef} embedded showSettings={false} className="site-menu__signin" />
    </div>
  )

  const row = (icon: ReactNode, label: string, sub: string | null, href: string, value?: string | null, badge?: string | null) => (
    <li>
      <a className="site-menu__row" href={href} onClick={onClose}>
        <span className="site-menu__row-mark">{icon}</span>
        <span className="site-menu__row-text">
          <span className="site-menu__row-label">{label}</span>
          {sub ? <span className="site-menu__row-sub">{sub}</span> : null}
        </span>
        {value ? <span className="site-menu__row-value">{value}</span> : null}
        {badge ? <span className="site-menu__badge">{badge}</span> : null}
        <span className="site-menu__row-go">
          <ChevronRightIcon />
        </span>
      </a>
    </li>
  )

  if (view === 'inbox' && signedIn) {
    const freshCount = notes.items.filter(isFresh).length
    return createPortal(
      <div className="site-menu" role="presentation">
        <button type="button" className="site-menu__scrim" aria-label="Close menu" onClick={onClose} />
        <div id={id} ref={panelRef} className="site-menu__panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <span className="site-menu__grab" aria-hidden="true" />
          <div className="site-menu__top site-menu__top--inbox">
            <button type="button" className="site-menu__back" aria-label="Back to your menu" onClick={() => setView('menu')}>
              <ChevronRightIcon />
            </button>
            <h2 id={titleId} className="site-menu__inbox-title">
              Notifications
            </h2>
            {freshCount > 0 ? <span className="inbox__new">{freshCount} new</span> : null}
            <button type="button" className="site-menu__close" aria-label="Close menu" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
          <div className="site-menu__body site-menu__body--inbox">
            <div className="inbox inbox--sheet">
              <Inbox notes={notes} isFresh={isFresh} onNavigate={onClose} onWear={onWear} />
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div className="site-menu" role="presentation">
      <button type="button" className="site-menu__scrim" aria-label="Close menu" onClick={onClose} />
      <div id={id} ref={panelRef} className="site-menu__panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="site-menu__grab" aria-hidden="true" />
        <div className="site-menu__top">
          <h2 id={titleId} className="site-menu__cap">
            {tagged ? 'Your menu' : 'Menu'}
          </h2>
          <button type="button" className="site-menu__close" aria-label="Close menu" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="site-menu__body">
          {card}

          {/* Signed in, the badge draws only when there is something to show: the tag form, an error, the testing notice. */}
          {signedIn ? <PlayerBadge ref={badgeRef} embedded showSettings={false} className="site-menu__badge-slot" /> : null}

          {signedIn ? (
            <ul className="site-menu__rows" aria-label="Yours">
              <li>
                <button type="button" className="site-menu__row" onClick={() => setView('inbox')}>
                  <span className="site-menu__row-mark site-menu__row-mark--bell">
                    <BellIcon />
                    {notes.unread > 0 ? (
                      <span className="site-menu__row-count">{notes.unread > 9 ? '9+' : notes.unread}</span>
                    ) : null}
                  </span>
                  <span className="site-menu__row-text">
                    <span className="site-menu__row-label">Notifications</span>
                    {summary ? (
                      <>
                        <span className={`site-menu__row-sub site-menu__row-lead${summary.hot ? ' site-menu__row-lead--hot' : ''}`}>
                          {summary.lead}
                        </span>
                        {summary.rest ? <span className="site-menu__row-sub site-menu__row-lead">{summary.rest}</span> : null}
                      </>
                    ) : (
                      <span className="site-menu__row-sub">Nothing new</span>
                    )}
                  </span>
                  <span className="site-menu__row-go">
                    <ChevronRightIcon />
                  </span>
                </button>
              </li>
              {tagged ? row(<StatsIcon />, 'Your stats', 'Streaks and near records', statsHref()) : null}
              {row(
                <FriendIcon />,
                'Friends',
                null,
                rankHref(undefined, undefined, 'friends'),
                friends != null && friends > 0 ? String(friends) : null,
                friendRequests > 0 ? `${friendRequests} ${friendRequests === 1 ? 'request' : 'requests'}` : null,
              )}
              {row(<GroupsIcon />, 'Groups', null, groupsIndexHref())}
            </ul>
          ) : (
            <ul className="site-menu__rows site-menu__rows--plain" aria-label="What an account adds">
              <li className="site-menu__row">
                <span className="site-menu__row-mark">
                  <BoardsIcon />
                </span>
                <span className="site-menu__row-text">
                  <span className="site-menu__row-label">A place on every board</span>
                  <span className="site-menu__row-sub">Ranked each week, each month and all time</span>
                </span>
              </li>
              <li className="site-menu__row">
                <span className="site-menu__row-mark">
                  <EventsIcon />
                </span>
                <span className="site-menu__row-text">
                  <span className="site-menu__row-label">Trophies and events</span>
                  <span className="site-menu__row-sub">Win one with friends and it stays on your shelf</span>
                </span>
              </li>
              <li className="site-menu__row">
                <span className="site-menu__row-mark">
                  <GroupsIcon />
                </span>
                <span className="site-menu__row-text">
                  <span className="site-menu__row-label">Friends and groups</span>
                  <span className="site-menu__row-sub">Boards of just the people you play with</span>
                </span>
              </li>
            </ul>
          )}

          <ul className="site-menu__rows" aria-label="Bug hunt">
            <li>
              <BugHuntMenuRow onOpen={onClose} />
            </li>
          </ul>

          {invites > 0 ? (
            <section className="site-menu__invites" aria-label="Invites">
              <p className="site-menu__cap">Invites</p>
              <PendingInvitesStrip compact />
            </section>
          ) : null}

          <section className="site-menu__settings" aria-label="Settings">
            <div className="site-menu__setting">
              <span className="site-menu__cap">Theme</span>
              <div className="site-seg site-menu__seg" role="group" aria-label="Theme">
                {THEME_CHOICES.map((choice) => (
                  <button key={choice} type="button" aria-pressed={theme === choice} onClick={() => setTheme(choice)}>
                    {choice === 'light' ? <SunIcon /> : <MoonIcon />}
                    {themeLabel(choice)}
                  </button>
                ))}
              </div>
            </div>
            <div className="site-menu__setting">
              <span className="site-menu__cap">Sounds</span>
              <SoundPackSelect variant="chips" className="site-seg site-menu__seg site-menu__sounds" />
            </div>
            <div className="site-menu__setting">
              <span className="site-menu__cap">
                Music
                <HiddenBug spot="menu" onCaught={onClose} />
              </span>
              <MusicToggle variant="seg" className="site-menu__seg" />
            </div>
            <DevImpersonateControl variant="drawer" />
          </section>

          {signedIn ? (
            <button type="button" className="site-menu__signout" disabled={signingOut} onClick={onSignOut}>
              <SignOutIcon />
              Sign out
            </button>
          ) : null}

          <nav className="site-menu__foot" aria-label="About">
            <a href={aboutHref()} onClick={onClose}>
              About {APP_NAME}
            </a>
            <a href={privacyHref()} onClick={onClose}>
              Privacy
            </a>
            <a href={termsHref()} onClick={onClose}>
              Terms
            </a>
          </nav>
        </div>
      </div>
    </div>,
    document.body,
  )
}
