import { leaderboardHref } from '../hooks/useHashRoute'
import { PlayerBadge } from './PlayerBadge'
import { ThemeToggle } from './ThemeToggle'

export function HomeBar() {
  return (
    <nav className="home-bar" aria-label="Site">
      <a className="home-bar__brand" href="#/">
        Archiv<span>ade</span>
      </a>
      <div className="home-bar__icons">
        <a
          className="home-bar__icon"
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
          className="home-bar__icon"
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
        <ThemeToggle className="home-bar__icon" />
        <PlayerBadge icon />
      </div>
    </nav>
  )
}
