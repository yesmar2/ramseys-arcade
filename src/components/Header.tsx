import { useEffect, useRef, useState } from 'react'
import { PlayerBadge } from './PlayerBadge'

const NAV = [
  { href: '#/', label: 'Games' },
  { href: '#/tournaments', label: 'Tournaments' },
  { href: '#/leaderboards/stacker/daily', label: 'Leaderboards' },
]

export function Header() {
  const [open, setOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const close = () => setOpen(false)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false)
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

  return (
    <header
      className={`site-header${open ? ' site-header--open' : ''}`}
      ref={headerRef}
    >
      <div className="site-header__inner">
        <button
          type="button"
          className="site-header__menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M5 7h14M5 12h14M5 17h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
        <a className="site-header__brand" href="#/">
          Archiv<span>ade</span>
        </a>
        <nav className="site-header__nav" id="site-nav" aria-label="Primary">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="site-header__player">
          <PlayerBadge compact />
        </div>
      </div>
    </header>
  )
}
