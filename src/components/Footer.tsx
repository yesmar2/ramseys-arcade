export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <p>© {year} Ramsey’s Arcade</p>
    </footer>
  )
}
