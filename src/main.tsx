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

bootRouter()
bootTheme()
bootPwaInstall()
bootFeedSync()

/*
 * Pages and games load as their own chunks (App.tsx). A release renames
 * them, so a tab opened before it that then opens a page it has not loaded
 * yet asks for a chunk that is gone. One reload picks up the new shell; the
 * timestamp keeps a broken deploy from reloading forever.
 */
window.addEventListener('vite:preloadError', (event) => {
  const key = 'skermix-chunk-reload'
  let last = 0
  try {
    last = Number(sessionStorage.getItem(key) ?? 0)
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    /* storage may be off; reload once anyway */
  }
  if (Date.now() - last < 10_000) return
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
