import { useEffect, useRef, useState } from 'react'
import { applySitePeriod, applySiteGroup, periodFromRoute, useRoute } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import { useDefaultPeriod } from '../lib/defaultPeriod'
import {
  cachedMyGroups,
  groupsIndexHref,
  listMyGroups,
  setActiveGroup,
  storedActiveGroup,
  useActiveGroup,
  type GroupPublic,
} from '../lib/groups'
import {
  coerceVisiblePeriod,
  PERIOD_LABELS,
  VISIBLE_LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
} from '../lib/leaderboard'

function BarsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M4 20v-7" />
      <path d="M12 20V4" />
      <path d="M20 20v-9" />
    </svg>
  )
}

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

/**
 * What every board on the site shows: which period, and whether everyone or
 * one of your groups. One control in the header rather than two unlabelled
 * pills, so it says what it is, and a popover with both choices in it.
 */
export function SiteScopeControl() {
  const route = useRoute()
  const storedPeriod = useDefaultPeriod()
  const period = coerceVisiblePeriod(periodFromRoute(route) ?? storedPeriod)
  const { account } = useAuth()
  const activeId = useActiveGroup()
  const [groups, setGroups] = useState<GroupPublic[]>(() => cachedMyGroups())
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    listMyGroups()
      .then((list) => {
        if (cancelled) return
        setGroups(list)
        setLoaded(true)
        // A group you have left is no longer one the boards can show.
        const current = storedActiveGroup()
        if (current && !list.some((g) => g.id === current)) setActiveGroup(null)
      })
      .catch(() => {
        if (!cancelled) setGroups([])
      })
    return () => {
      cancelled = true
    }
  }, [account?.id, activeId])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = groups.find((g) => g.id === activeId) ?? null
  const pending = Boolean(activeId) && !active && !loaded
  const among = activeId ? (active?.name ?? 'Your group') : 'Everyone'
  const periodLabel = PERIOD_LABELS[period]

  const pickPeriod = (next: LeaderboardPeriod) => {
    applySitePeriod(next, route)
    setOpen(false)
  }
  const pickGroup = (id: string | null) => {
    applySiteGroup(id, route)
    setOpen(false)
  }

  return (
    <div className="site-scope" ref={ref}>
      <button
        type="button"
        className={`site-scope__btn${activeId ? ' site-scope__btn--group' : ''}`}
        aria-label={`Boards show ${periodLabel.toLowerCase()}, among ${pending ? 'your group' : among}. Change`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((was) => !was)}
      >
        <span className="site-scope__mark">
          <BarsIcon />
        </span>
        <span className="site-scope__period">{periodLabel}</span>
        <span className="site-scope__among">
          <span aria-hidden="true">· </span>
          {pending ? <span className="skel-line site-scope__skel" /> : among}
        </span>
        <span className="site-scope__chev">
          <Chevron />
        </span>
      </button>
      {open ? (
        <div className="site-scope__pop" role="dialog" aria-label="What the boards show">
          <p className="site-scope__cap">Boards show</p>
          <div className="site-seg" role="group" aria-label="Period">
            {VISIBLE_LEADERBOARD_PERIODS.map((p) => (
              <button key={p} type="button" aria-pressed={p === period} onClick={() => pickPeriod(p)}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <p className="site-scope__cap">Among</p>
          <ul className="site-scope__groups">
            <li>
              <button
                type="button"
                className="site-scope__option"
                aria-pressed={!activeId}
                onClick={() => pickGroup(null)}
              >
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
            {groups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className="site-scope__option"
                  aria-pressed={g.id === activeId}
                  onClick={() => pickGroup(g.id)}
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
                {groups.length > 0 ? 'Start or manage a group' : 'Start a group, and the boards can show just it'}
              </a>
            </li>
          </ul>
          <p className="site-scope__note">Every board, rank and banner on the site follows this.</p>
        </div>
      ) : null}
    </div>
  )
}
