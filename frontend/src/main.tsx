import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { reportClientError } from './features/admin/reportClientError'

window.addEventListener('error', (event) => {
  reportClientError(event.message, event.error instanceof Error ? event.error.stack : undefined)
})
window.addEventListener('unhandledrejection', (event) => {
  const reason: unknown = event.reason
  reportClientError(reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : undefined)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
