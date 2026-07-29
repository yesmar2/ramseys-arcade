export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="site-header__brand" href="/">
          Ramsey’s <span>Arcade</span>
        </a>
        <nav className="site-header__nav" aria-label="Primary">
          <a href="#leaderboards">Leaderboards</a>
        </nav>
      </div>
    </header>
  )
}
