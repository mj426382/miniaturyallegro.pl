import React from 'react'
import ReactDOM from 'react-dom/client'
import AppToaster from './components/AppToaster'
import App from './App.tsx'
import './index.css'
import { initAnalytics } from './services/analytics'
import { initErrorReporting } from './services/errorReporting'

initErrorReporting()
initAnalytics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <AppToaster />
  </React.StrictMode>,
)
