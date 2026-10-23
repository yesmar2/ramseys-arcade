import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { applySitePeriod, applySiteGroup, useRoute } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { useSeason } from '../lib/season'
import { seasonHasStandings } from '../lib/seasonStandings'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import {
  cachedMyGroups,
  FRIENDS_SCOPE,
  groupsIndexHref,
  listMyGroups,
  MY_GROUPS_EVENT,
  setActiveGroup,
  storedActiveGroup,
  useActiveGroup,
  type GroupPublic,
} from '../lib/groups'

function Chevron() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  )
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 4.8a3.2 3.2 0 0 1 0 6.4" />
      <path d="M18 14.7c1.9.7 3 2.5 3 5.3" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

/** Your groups as this device last heard them, kept current as anything on the page asks again. */
function useMyGroups(): GroupPublic[] {
  const [groups, setGroups] = useState<GroupPublic[]>(() => cachedMyGroups())
  useEffect(() => {
    const heard = () => setGroups(cachedMyGroups())
    window.addEventListener(MY_GROUPS_EVENT, heard)
    return () => window.removeEventListener(MY_GROUPS_EVENT, heard)
  }, [])
  return groups
}

/**
 * What used to ride along with the header's "This week · Everyone" chip, on every page: the boards' choice put
 * right when it can't stand. A group you've left, your friends with nobody in them, or a season that's over
 * aren't boards to show. The choosing itself is on the boards now (BoardsAmong); SiteHeader runs this.
 */
export function useSiteScopeKeeper() {
  const route = useRoute()
  const period = useDefaultPeriod()
  const { account } = useAuth()
  const { loaded: friendsLoaded, error: friendsError, friends, signedOut } = useFriends()
  const activeId = useActiveGroup()

  useEffect(() => {
    let cancelled = false
    listMyGroups()
      .then((list) => {
        if (cancelled) return
        const current = storedActiveGroup()
        if (current && current !== FRIENDS_SCOPE && !list.some((g) => g.id === current)) setActiveGroup(null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [account?.id, activeId])

  // Your friends with nobody in them: a shared ?group=friends link, or your last friend gone, would leave you first
  // among one. Everyone, then.
  const noFriends = signedOut || (friendsLoaded && !friendsError && friends.length === 0)
  useEffect(() => {
    if (activeId === FRIENDS_SCOPE && noFriends) applySiteGroup(null, route)
  }, [activeId, noFriends, route])

  // Between seasons there's no season to show: the boards go back to the week.
  const season = useSeason()
  const hasSeason = seasonHasStandings(season.season)
  useEffect(() => {
    if (season.loaded && !hasSeason && period === 'season') applySitePeriod('weekly', route)
  }, [season.loaded, hasSeason, period, route])
}

/**
 * Whose boards these are: everyone, your friends or one of your groups, beside a board's period tabs. It was in
 * the header on every page until Ramsey asked to take it out (2026-10-20); the period is the boards' own tabs.
 *
 * Only there for a player with someone to pick: friends or a group, or a group on (a shared link's) to turn off.
 * Everyone else sees just the boards. The pick holds for every board on the site.
 */
export function BoardsAmong({ className }: { className?: string }) {
  const route = useRoute()
  const { account } = useAuth()
  const { friends, loaded: friendsLoaded } = useFriends()
  const activeId = useActiveGroup()
  const groups = useMyGroups()
  const [open, setOpen] = useState(false)
  // Which edge of the chip the choices hang from: its right, unless there's no room on its left for them.
  const [fromStart, setFromStart] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    // Escape gives the keys back to the chip they opened it from, not the top of the page.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      btnRef.current?.focus()
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // A game's banner cuts off whatever hangs out of it: there the choices float over the page, under the chip,
  // and go with it as the page scrolls.
  const float = Boolean(className?.includes('site-scope--banner'))
  useLayoutEffect(() => {
    if (!open || !float) return
    const place = () => {
      const box = btnRef.current?.getBoundingClientRect()
      const pop = popRef.current
      if (!box || !pop) return
      const w = pop.offsetWidth
      const left = fromStart ? box.left : box.right - w
      pop.style.left = `${Math.round(Math.max(16, Math.min(left, document.documentElement.clientWidth - 16 - w)))}px`
      pop.style.top = `${Math.round(box.bottom + 8)}px`
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, float, fromStart])

  // Opened low on a phone, the choices would hang under its tab bar: the page comes up to show them.
  useEffect(() => {
    if (!open) return
    const pop = popRef.current
    const tabs = document.querySelector('.site-tabs')
    if (!pop) return
    const floor = tabs && getComputedStyle(tabs).position === 'fixed' ? tabs.getBoundingClientRect().top : window.innerHeight
    const under = pop.getBoundingClientRect().bottom + 12 - floor
    if (under > 0) window.scrollBy({ top: under })
  }, [open])

  const friendCount = friends.length
  const hasFriends = Boolean(account) && friendCount > 0
  if (!activeId && !hasFriends && groups.length === 0) return null

  const active = groups.find((g) => g.id === activeId) ?? null
  const onFriends = activeId === FRIENDS_SCOPE
  const among = onFriends ? 'Friends' : activeId ? (active?.name ?? 'Your group') : 'Everyone'

  const pick = (id: string | null) => {
    applySiteGroup(id, route)
    setOpen(false)
  }

  return (
    <div
      className={`site-scope${className ? ` ${className}` : ''}`}
      ref={ref}
      // Tabbing on past the last choice closes it, so it never sits open over what has the focus.
      onBlur={(e) => {
        if (open && e.relatedTarget && !ref.current?.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className={`site-scope__btn${activeId ? ' site-scope__btn--group' : ''}${onFriends ? ' site-scope__btn--friends' : ''}`}
        aria-label={`Boards show ${among}. Change`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          const box = btnRef.current?.getBoundingClientRect()
          // 21rem wide, or the screen less its gutters: whichever is narrower (chrome.css).
          const wide = Math.min(21 * 16, window.innerWidth - 32)
          setFromStart(Boolean(box && box.right < wide + 16))
          setOpen((was) => !was)
        }}
      >
        {/* Said only on a phone, where the chip is the tabs' second line (.board-picks, chrome.css). */}
        <span className="site-scope__lead">Among</span>
        <span className="site-scope__mark">
          <PeopleIcon />
        </span>
        <span className="site-scope__among">{among}</span>
        <span className="site-scope__chev">
          <Chevron />
        </span>
      </button>
      {open ? (
        <div
          ref={popRef}
          className={`site-scope__pop${fromStart ? ' site-scope__pop--start' : ''}${float ? ' site-scope__pop--float' : ''}`}
          role="dialog"
          aria-label="Whose boards"
        >
          <p className="site-scope__cap">Boards show</p>
          <ul className="site-scope__groups">
            <li>
              <button type="button" className="site-scope__option" aria-pressed={!activeId} onClick={() => pick(null)}>
                <span className="site-scope__option-mark">
                  <PeopleIcon />
                </span>
                <span className="site-scope__option-text">
                  <span className="site-scope__option-name">Everyone</span>
                  <span className="site-scope__option-sub">Every player on the site</span>
                </span>
                {!activeId ? (
                  <span className="site-scope__check">
                    <Check />
                  </span>
                ) : null}
              </button>
            </li>
            {/* Your friends, a group made from who you've added: there to pick once there's someone in it. */}
            {hasFriends || onFriends ? (
              <li>
                <button
                  type="button"
                  className="site-scope__option"
                  aria-pressed={onFriends}
                  onClick={() => pick(FRIENDS_SCOPE)}
                >
                  <span className="site-scope__option-mark site-scope__option-mark--friends">
                    <PeopleIcon />
                  </span>
                  <span className="site-scope__option-text">
                    <span className="site-scope__option-name">Friends</span>
                    <span className="site-scope__option-sub">
                      {friendsLoaded ? `You and ${friendCount} ${friendCount === 1 ? 'friend' : 'friends'}` : 'You and your friends'}
                    </span>
                  </span>
                  {onFriends ? (
                    <span className="site-scope__check">
                      <Check />
                    </span>
                  ) : null}
                </button>
              </li>
            ) : null}
            {groups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className="site-scope__option"
                  aria-pressed={g.id === activeId}
                  onClick={() => pick(g.id)}
                >
                  <span className="site-scope__option-mark site-scope__option-mark--group">
                    {g.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="site-scope__option-text">
                    <span className="site-scope__option-name">{g.name}</span>
                    <span className="site-scope__option-sub">
                      {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </span>
                  {g.id === activeId ? (
                    <span className="site-scope__check">
                      <Check />
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
            <li>
              <a className="site-scope__add" href={groupsIndexHref()} onClick={() => setOpen(false)}>
                <span className="site-scope__option-mark">
                  <PlusIcon />
                </span>
                {groups.length > 0 ? 'Add friends, or start or manage a group' : 'Add friends, or start a group'}
              </a>
            </li>
          </ul>
          <p className="site-scope__note">Changes what every board on the site shows.</p>
        </div>
      ) : null}
    </div>
  )
}
