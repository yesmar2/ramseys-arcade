import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { leaderboardHref, rankHref } from '../hooks/useHashRoute'
import { useGlobalRank } from '../lib/globalRank'
import { normalizePlayerName } from '../lib/leaderboard'
import { currentTheme, THEME_EVENT, toggleTheme, type Theme } from '../lib/theme'
import { PlayerBadge, type PlayerBadgeHandle } from './PlayerBadge'

export function HomeBar() {
  const { rank } = useGlobalRank()
  const { account, signedIn } = useAuth()
  const playerName = normalizePlayerName(usePlayerName())
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentTheme(),
  )
  const menuRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerBadgeHandle>(null)

  useEffect(() => {
    const sync = () => setTheme(currentTheme())
    window.addEventListener(THEME_EVENT, sync)
    return () => window.removeEventListener(THEME_EVENT, sync)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const accountLabel = playerName
    ? signedIn
      ? `${playerName} · Account`
      : 'Edit gamer tag'
    : signedIn
      ? account?.email ?? 'Account'
      : 'Set gamer tag'

  return (
    <nav className="home-bar" aria-label="Site">
      <div className="home-bar__start">
        <a className="home-bar__brand" href="#/">
          Archiv<span>ade</span>
        </a>
        <div className="home-bar__links" aria-label="Primary">
          <a className="home-bar__link" href={leaderboardHref()}>
            Rankings
          </a>
          <a className="home-bar__link" href="#/tournaments">
            Tournaments
          </a>
        </div>
      </div>

      <div className="home-bar__end">
        {playerName ? (
          <a
            className="home-bar__you"
            href={rankHref()}
            title={rank != null ? `Your profile · #${rank}` : 'Your profile'}
          >
            {rank != null ? (
              <span className="home-bar__you-rank">#{rank}</span>
            ) : null}
            <span className="home-bar__you-name">{playerName}</span>
          </a>
        ) : (
          <button
            type="button"
            className="home-bar__you home-bar__you--empty"
            onClick={() => playerRef.current?.openEdit()}
          >
            Set gamer tag
          </button>
        )}

        <div className="home-bar__more" ref={menuRef}>
          <button
            type="button"
            className="home-bar__menu-btn"
            aria-label="More"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="More"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="1.7" fill="currentColor" />
              <circle cx="12" cy="12" r="1.7" fill="currentColor" />
              <circle cx="19" cy="12" r="1.7" fill="currentColor" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="home-bar__menu" role="menu">
              <a
                className="home-bar__menu-mobile"
                role="menuitem"
                href={leaderboardHref()}
                onClick={() => setMenuOpen(false)}
              >
                Rankings
              </a>
              <a
                className="home-bar__menu-mobile"
                role="menuitem"
                href="#/tournaments"
                onClick={() => setMenuOpen(false)}
              >
                Tournaments
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  toggleTheme()
                  setMenuOpen(false)
                }}
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  playerRef.current?.openEdit()
                }}
              >
                {accountLabel}
              </button>
            </div>
          ) : null}
        </div>

        <div className="home-bar__player">
          <PlayerBadge ref={playerRef} icon className="home-bar__player-badge" />
        </div>
      </div>
    </nav>
  )
}
