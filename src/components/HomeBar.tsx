import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePlayerName } from '../hooks/usePlayerName'
import { leaderboardHref, rankHref } from '../hooks/useHashRoute'
import { useGlobalRank } from '../lib/globalRank'
import { normalizePlayerName } from '../lib/leaderboard'
import { currentTheme, THEME_EVENT, toggleTheme, type Theme } from '../lib/theme'
import { PlayerBadge, type PlayerBadgeHandle } from './PlayerBadge'
import { ThemeToggle } from './ThemeToggle'

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

  const rankLabel = rank != null ? `#${rank}` : playerName ? '—' : null

  return (
    <nav className="home-bar" aria-label="Site">
      {rankLabel ? (
        <a
          className="home-bar__rank"
          href={rankHref()}
          aria-label={rank != null ? `Global rank ${rank}` : 'Global rank'}
          title={rank != null ? `Global rank #${rank}` : 'Your global rank'}
        >
          {rankLabel}
        </a>
      ) : null}
      <a className="home-bar__brand" href="#/">
        Archiv<span>ade</span>
      </a>
      <div className="home-bar__icons">
        <a
          className="home-bar__nav-icon"
          href={leaderboardHref()}
          aria-label="Leaderboards"
          title="Leaderboards"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M8 21h8M12 17v4M7 4h10v3a5 5 0 0 1-5 5h0a5 5 0 0 1-5-5V4z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M17 6h2.2a1.8 1.8 0 0 1 0 3.6H17M7 6H4.8a1.8 1.8 0 0 0 0 3.6H7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        <a
          className="home-bar__nav-icon"
          href="#/tournaments"
          aria-label="Tournaments"
          title="Tournaments"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 5v16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M5 5h12l-2.4 3.4L17 12H5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        <ThemeToggle className="home-bar__icon home-bar__theme" />

        <div className="home-bar__more" ref={menuRef}>
          <button
            type="button"
            className="home-bar__icon"
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
              {rankLabel ? (
                <a
                  role="menuitem"
                  href={rankHref()}
                  onClick={() => setMenuOpen(false)}
                >
                  Rank {rankLabel}
                </a>
              ) : null}
              <a
                role="menuitem"
                href={leaderboardHref()}
                onClick={() => setMenuOpen(false)}
              >
                Leaderboards
              </a>
              <a
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
                {playerName
                  ? signedIn
                    ? `${playerName} · Account`
                    : playerName
                  : signedIn
                    ? account?.email ?? 'Account'
                    : 'Set gamer tag'}
              </button>
            </div>
          ) : null}
        </div>

        <PlayerBadge ref={playerRef} icon className="home-bar__player" />
      </div>
    </nav>
  )
}
