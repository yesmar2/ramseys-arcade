import { Component, type ReactNode } from 'react'
import { reportError } from '../lib/errorReports'

/**
 * The last word when the site throws while drawing a page: instead of a blank
 * screen, say so and offer a reload. The error goes to the admin's list.
 * It sits outside the app, so its buttons load the page afresh rather than
 * route.
 */
export class SiteErrorBoundary extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false }

  static getDerivedStateFromError() {
    return { broken: true }
  }

  componentDidCatch(error: unknown) {
    reportError(error)
  }

  render() {
    if (!this.state.broken) return this.props.children
    return (
      <main className="site-broken">
        <div className="panel" role="alert">
          <div className="panel__head">
            <div className="panel__heading">
              <h1 className="panel__title">Something went wrong</h1>
            </div>
          </div>
          <div className="panel__body">
            <p className="panel__text">This page hit a problem. Reloading usually sorts it out.</p>
          </div>
          <div className="panel__actions">
            <button type="button" className="panel__btn" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button type="button" className="panel__btn panel__btn--ghost" onClick={() => window.location.assign('/')}>
              Home
            </button>
          </div>
        </div>
      </main>
    )
  }
}
