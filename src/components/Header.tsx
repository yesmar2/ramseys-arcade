import { PlayerBadge } from './PlayerBadge'

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__brand" href="#/">
          Ramsey’s <span>Arcade</span>
        </a>
        <nav className="site-header__nav" aria-label="Primary">
          <a href="#/">Games</a>
          <a href="#/tournaments">Tournaments</a>
          <a href="#/leaderboards/stacker/daily">Leaderboards</a>
        </nav>
        <div className="site-header__player">
          <PlayerBadge compact />
        </div>
      </div>
    </header>
  )
}
