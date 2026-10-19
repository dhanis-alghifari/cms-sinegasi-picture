import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/styles/index.css'
import './shared/validation/zodErrorMessages'
import App from './app/App'
import { RootErrorBoundary } from './app/components/RootErrorBoundary'
import { installGlobalClientErrorMonitoring } from './shared/monitoring/reportClientError'

const removeErrorMonitoring = installGlobalClientErrorMonitoring()
import.meta.hot?.dispose(removeErrorMonitoring)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
