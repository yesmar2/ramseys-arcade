import { useEffect, useRef, useState } from 'react'
import { applySiteGroup, useHashRoute } from '../hooks/useHashRoute'
import { useAuth } from '../hooks/useAuth'
import {
  groupsIndexHref,
  listMyGroups,
  setActiveGroup,
  storedActiveGroup,
  useActiveGroup,
  type GroupPublic,
} from '../lib/groups'

type SiteGroupControlProps = {
  variant: 'header' | 'drawer'
  onSelect?: () => void
}

export function SiteGroupControl({ variant, onSelect }: SiteGroupControlProps) {
  const route = useHashRoute()
  const { account } = useAuth()
  const activeId = useActiveGroup()
  const [groups, setGroups] = useState<GroupPublic[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    listMyGroups()
      .then((list) => {
        if (cancelled) return
        setGroups(list)
        const current = storedActiveGroup()
        if (current && !list.some((g) => g.id === current)) {
          setActiveGroup(null)
        }
      })
      .catch(() => {
        if (!cancelled) setGroups([])
      })
    return () => {
      cancelled = true
    }
  }, [account?.id, activeId])

  useEffect(() => {
    if (variant !== 'header' || !open) return
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
  }, [open, variant])

  const active = groups.find((g) => g.id === activeId) ?? null
  const label = activeId ? (active?.name ?? 'Group') : 'Everyone'

  const select = (id: string | null) => {
    applySiteGroup(id, route)
    setOpen(false)
    onSelect?.()
  }

  if (variant === 'drawer') {
    return (
      <div className="site-drawer__period" aria-label="Group">
        <span className="site-drawer__period-label">Group</span>
        <div className="site-drawer__period-tabs site-drawer__period-tabs--stack" role="group">
          <button
            type="button"
            className={`site-drawer__period-tab${!activeId ? ' site-drawer__period-tab--active' : ''}`}
            aria-pressed={!activeId}
            onClick={() => select(null)}
          >
            Everyone
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`site-drawer__period-tab${g.id === activeId ? ' site-drawer__period-tab--active' : ''}`}
              aria-pressed={g.id === activeId}
              onClick={() => select(g.id)}
            >
              {g.name}
            </button>
          ))}
          <a
            className="site-drawer__period-tab"
            href={groupsIndexHref()}
            onClick={() => onSelect?.()}
          >
            {account ? 'Create or manage…' : 'Groups…'}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="site-header__period site-header__period--desktop" ref={ref}>
      <button
        type="button"
        className="site-header__period-btn"
        aria-label={`Group: ${label}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="site-header__period-btn-label">{label}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true" width="10" height="10">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            d="M2.5 4.5 6 8l3.5-3.5"
          />
        </svg>
      </button>
      {open ? (
        <div className="site-header__period-popover" role="listbox" aria-label="Group">
          <button
            type="button"
            role="option"
            aria-selected={!activeId}
            className={`site-header__period-option${!activeId ? ' site-header__period-option--active' : ''}`}
            onClick={() => select(null)}
          >
            Everyone
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              role="option"
              aria-selected={g.id === activeId}
              className={`site-header__period-option${g.id === activeId ? ' site-header__period-option--active' : ''}`}
              onClick={() => select(g.id)}
            >
              {g.name}
            </button>
          ))}
          <a
            className="site-header__period-option site-header__period-option--link"
            href={groupsIndexHref()}
            onClick={() => {
              setOpen(false)
              onSelect?.()
            }}
          >
            {account ? 'Create or manage…' : 'Groups…'}
          </a>
        </div>
      ) : null}
    </div>
  )
}
