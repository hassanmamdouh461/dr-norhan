import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Build marker: bump to force a new content hash (new /assets/ URL) when a
// poisoned CDN edge cache must be bypassed — see 2026-07-15 deploy incident
// where an edge node cached the SPA-fallback HTML under an asset URL with
// the /assets/* immutable headers. Exposed on window so support can also
// confirm which build a student's browser is actually running.
(window as any).__FUSHA_BUILD__ = '20260917.01';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Register the service worker only in production builds so local dev
// always sees fresh code (no stale cache-first assets while iterating).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-v4.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}
