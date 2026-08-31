import { APP_NAME } from '../lib/brand'
import { privacyHref, termsHref } from '../hooks/useHashRoute'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <nav className="site-footer__links" aria-label="Legal">
        <a href={privacyHref()}>Privacy</a>
        <span className="site-footer__sep" aria-hidden="true">
          ·
        </span>
        <a href={termsHref()}>Terms</a>
      </nav>
      <p>
        © {year} {APP_NAME}
      </p>
    </footer>
  )
}
