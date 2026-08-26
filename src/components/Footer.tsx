import { APP_NAME } from '../lib/brand'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <p>
        © {year} {APP_NAME}
      </p>
    </footer>
  )
}
