import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { sentryInit, SentryErrorBoundary } from './lib/sentry'

// Init crash reporting before any other side effects so a JS error
// during App's first render lands in Sentry. No-op when
// VITE_SENTRY_DSN isn't set, so dev builds aren't noisy.
sentryInit()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary
      fallback={
        <div
          style={{
            padding: '40px 24px',
            fontFamily: 'Fraunces, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 18,
            textAlign: 'center',
            color: '#2a2419',
            background: '#f7f1e8',
            minHeight: '100vh',
          }}
        >
          Something broke. We've sent the details so we can fix it.
          Try closing and reopening the app.
        </div>
      }
    >
      <App />
    </SentryErrorBoundary>
  </StrictMode>,
)
