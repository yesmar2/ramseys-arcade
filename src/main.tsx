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
import './styles/prizes.css'
import App from './App.tsx'
import { bootRouter } from './hooks/useHashRoute'
import { bootTheme } from './lib/theme'
import { bootPwaInstall } from './lib/pwaInstall'
import { bootFeedSync } from './lib/feedSync'
import { bootAnalytics } from './lib/analytics'
import { bootErrorReports } from './lib/errorReports'
import { bootFocusReveal } from './lib/focusReveal'
import { bootGate } from './lib/gate'
import { bootOfflineCopy } from './lib/offlineCopy'
import { bootAppUpdate, noteNewRelease } from './lib/appUpdate'
import { SiteErrorBoundary } from './components/SiteErrorBoundary'

bootErrorReports()
bootRouter()
bootTheme()
bootPwaInstall()
bootFeedSync()
bootAnalytics()
bootFocusReveal()
bootGate()
bootOfflineCopy()
bootAppUpdate()

/*
 * Pages and games load as their own chunks (App.tsx). A release renames them, so a tab opened before it that then
 * asks for one it hasn't loaded finds it gone. Pages and parts handle that themselves (lib/lazyPage.ts); any other
 * chunk gone means the next link tapped opens on the new release (lib/appUpdate.ts), never a reload under a game.
 */
window.addEventListener('vite:preloadError', () => {
  if (navigator.onLine !== false) noteNewRelease()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteErrorBoundary>
      <App />
    </SiteErrorBoundary>
  </StrictMode>,
)
