import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App'
import AppProviders from './providers/AppProviders'
import { queryClient } from './queryClient'
import './index.css'

// Force-unregister potential legacy service workers to prevent stale caching/lag
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    for (let registration of regs) {
      registration.unregister();
    }
  });
}

const clientID = import.meta.env.VITE_ADSENSE_CLIENT_ID || '';
window.__ADSENSE_ID = clientID;

// Deferred load of Google AdSense with the correct publisher ID
const loadAdSense = () => {
  if (!clientID) return;
  const s = document.createElement('script');
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientID}`;
  s.async = true;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
};

if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(loadAdSense);
} else {
  setTimeout(loadAdSense, 3000);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppProviders>
          <App />
        </AppProviders>
      </BrowserRouter>
    </QueryClientProvider>
  </GoogleOAuthProvider>,
)
