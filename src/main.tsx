import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './styles/hero.css'
import './styles/events.css'
import './styles/profile.css'
import './styles/records.css'
import './styles/boards.css'
import './styles/list.css'
import './styles/avatar.css'
import './styles/home.css'
import './styles/hub.css'
import './styles/groups.css'
import './styles/celebrate.css'
import './styles/chrome.css'
import './styles/stats.css'
import './styles/panel.css'
import './styles/report.css'
import './styles/win.css'
import './styles/challenge.css'
import App from './App.tsx'
import { bootRouter } from './hooks/useHashRoute'
import { bootTheme } from './lib/theme'
import { bootPwaInstall } from './lib/pwaInstall'
import { bootFeedSync } from './lib/feedSync'
import { bootAnalytics } from './lib/analytics'
import { bootErrorReports } from './lib/errorReports'
import { SiteErrorBoundary } from './components/SiteErrorBoundary'

bootErrorReports()
bootRouter()
bootTheme()
bootPwaInstall()
bootFeedSync()
bootAnalytics()

/*
 * Pages and games load as their own chunks (App.tsx). A release renames
 * them, so a tab opened before it that then opens a page it has not loaded
 * yet asks for a chunk that is gone. One reload picks up the new shell; the
 * timestamp keeps a broken deploy from reloading forever.
 *
 * Right after a release the new service worker may still be installing, and
 * until it takes over a reload gets the old shell again, which fails the same
 * way (the 3D games' chunks are never in the old worker's cache). So the
 * reload waits for it, up to eight seconds. The failed import goes on to the
 * error screen meanwhile, as the "dynamically imported module" error that
 * errorReports leaves out.
 */
window.addEventListener('vite:preloadError', () => {
  const key = 'skermix-chunk-reload'
  let last = 0
  try {
    last = Number(sessionStorage.getItem(key) ?? 0)
  } catch {
    /* storage may be off; reload once anyway */
  }
  if (Date.now() - last < 30_000) return
  try {
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    /* as above */
  }
  void newShellReady(8000).then(() => window.location.reload())
})

/** Resolves once a release's service worker, if one is on its way, has taken over (or `ms` have passed). */
async function newShellReady(ms: number) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (!registration) return
    await registration.update().catch(() => {})
    const incoming = registration.installing ?? registration.waiting
    if (!incoming) return
    await new Promise<void>((done) => {
      const timer = window.setTimeout(done, ms)
      incoming.addEventListener('statechange', () => {
        if (incoming.state !== 'activated' && incoming.state !== 'redundant') return
        window.clearTimeout(timer)
        done()
      })
    })
  } catch {
    /* no worker to wait for: a plain reload */
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteErrorBoundary>
      <App />
    </SiteErrorBoundary>
  </StrictMode>,
)
