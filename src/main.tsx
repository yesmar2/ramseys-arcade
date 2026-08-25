import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.tsx'
import { bootTheme } from './lib/theme'
import { bootPwaInstall } from './lib/pwaInstall'

bootTheme()
bootPwaInstall()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
