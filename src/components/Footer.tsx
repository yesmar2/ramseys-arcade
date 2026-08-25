export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <p>© {year} Acralia</p>
    </footer>
  )
}
