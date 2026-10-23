import { Component, type ReactNode } from 'react'
import { isMissingFile, reloadIntoNewRelease } from '../lib/appUpdate'
import { reportError } from '../lib/errorReports'

/**
 * The last word when the site throws while drawing a page: instead of a blank
 * screen, say so and offer a reload. The error goes to the admin's list.
 * It sits outside the app, so its buttons load the page afresh rather than
 * route.
 */
export class SiteErrorBoundary extends Component<
  { children: ReactNode },
  { broken: boolean; offline: boolean; updated: boolean }
> {
  state = { broken: false, offline: false, updated: false }

  static getDerivedStateFromError(error: unknown) {
    // Offline, what failed is most likely a page or game this device hasn't kept yet: they're kept as they're
    // first used (src/sw.ts).
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return { broken: true, offline, updated: !offline && isMissingFile(error) }
  }

  componentDidCatch(error: unknown) {
    reportError(error)
    // A file gone in a release since this tab opened: the page reloads onto the new one, showing it's on its way.
    // One that won't (it reloaded a moment ago, and the release itself is broken) says so.
    if (this.state.updated && !reloadIntoNewRelease()) this.setState({ updated: false })
    // Back online, the page it couldn't fetch can come.
    if (navigator.onLine === false) window.addEventListener('online', () => window.location.reload(), { once: true })
  }

  render() {
    if (!this.state.broken) return this.props.children
    const { offline, updated } = this.state
    if (updated) {
      return (
        <main className="site-broken" aria-busy="true">
          <p className="panel__text">Getting the latest version…</p>
        </main>
      )
    }
    return (
      <main className="site-broken">
        <div className="panel" role="alert">
          <div className="panel__head">
            <div className="panel__heading">
              <h1 className="panel__title">
                {offline ? "You're offline" : 'Something went wrong'}
              </h1>
            </div>
          </div>
          <div className="panel__body">
            <p className="panel__text">
              {offline
                ? "This page isn't saved on this device yet. It opens as soon as you're back online, and plays offline after that."
                : 'This page hit a problem. Reloading usually sorts it out.'}
            </p>
          </div>
          <div className="panel__actions">
            <button type="button" className="panel__btn" onClick={() => window.location.reload()}>
              {offline ? 'Try again' : 'Reload'}
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

/**
 * One part of a page that comes as a chunk of its own (the home page's Dailies row, its pictures): when it
 * fails to come or to draw (a network blip, or a release that took its old file away), `fallback` takes its
 * place and the rest of the page carries on, where the site's boundary above would take the whole page.
 * The error goes to the admin's list all the same.
 */
export class PartErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { broken: boolean }> {
  state = { broken: false }

  static getDerivedStateFromError() {
    return { broken: true }
  }

  componentDidCatch(error: unknown) {
    reportError(error)
  }

  render() {
    return this.state.broken ? this.props.fallback : this.props.children
  }
}
