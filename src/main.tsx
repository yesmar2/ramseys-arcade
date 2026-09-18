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
import './styles/bop.css'
import './styles/putt.css'
import './styles/home.css'
import './styles/hub.css'
import './styles/groups.css'
import './styles/celebrate.css'
import './styles/findbug.css'
import './styles/barrage.css'
import './styles/crumbtrail.css'
import App from './App.tsx'
import { bootRouter } from './hooks/useHashRoute'
import { bootTheme } from './lib/theme'
import { bootPwaInstall } from './lib/pwaInstall'

bootRouter()
bootTheme()
bootPwaInstall()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
