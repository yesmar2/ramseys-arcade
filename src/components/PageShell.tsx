import type { ReactNode } from 'react'
import { Footer } from './Footer'
import { SiteHeader } from './SiteHeader'

type PageShellProps = {
  children: ReactNode
  /** Main layout: home grid vs standard content page */
  variant?: 'home' | 'page'
  innerClassName?: string
  footer?: boolean
}

/** Shared page chrome: nav header, main landmark, optional footer. */
export function PageShell({
  children,
  variant = 'page',
  innerClassName,
  footer = true,
}: PageShellProps) {
  const mainClass = variant === 'home' ? 'home-stage home-stage--bare' : 'lb-page'

  return (
    <>
      <main className={mainClass}>
        {variant === 'home' ? (
          <div className="home-ambient" aria-hidden="true">
            <span className="home-ambient__orb home-ambient__orb--a" />
            <span className="home-ambient__orb home-ambient__orb--b" />
            <span className="home-ambient__orb home-ambient__orb--c" />
          </div>
        ) : null}
        <SiteHeader />
        {innerClassName ? (
          <div className={innerClassName}>{children}</div>
        ) : (
          children
        )}
      </main>
      {footer ? <Footer /> : null}
    </>
  )
}
