import type { ReactNode } from 'react'
import { Footer } from './Footer'
import { SiteHeader } from './SiteHeader'
import { TestRunBanner } from './TestRunBanner'

type PageShellProps = {
  children: ReactNode
  /** Main layout: home grid vs standard content page */
  variant?: 'home' | 'page'
  innerClassName?: string
  footer?: boolean
}

/**
 * Shared page chrome: nav header, main landmark, optional footer.
 *
 * The header comes before `main`, not in it, so `main` is the page's own and the header's Skip to content lands
 * on it. The page's wrapper keeps the classes `main` had, and `main` takes the place the inner box had (or, with
 * no inner box, lays its children out as the wrapper would), so nothing on the page moves.
 */
export function PageShell({
  children,
  variant = 'page',
  innerClassName,
  footer = true,
}: PageShellProps) {
  const stageClass = variant === 'home' ? 'home-stage home-stage--bare' : 'lb-page'

  return (
    <>
      <div className={stageClass}>
        {variant === 'home' ? (
          <div className="home-ambient" aria-hidden="true">
            <span className="home-ambient__orb home-ambient__orb--a" />
            <span className="home-ambient__orb home-ambient__orb--b" />
            <span className="home-ambient__orb home-ambient__orb--c" />
          </div>
        ) : null}
        <SiteHeader />
        <TestRunBanner />
        <main id="main" className={innerClassName ?? 'page-main'}>
          {children}
        </main>
      </div>
      {footer ? <Footer /> : null}
    </>
  )
}
