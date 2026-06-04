import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Force-unregister potential legacy service workers to prevent stale caching/lag
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    for (let registration of regs) {
      registration.unregister();
    }
  });
}

// Expose AdSense client ID for the deferred loader in index.html
window.__ADSENSE_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID || '';

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />,
)
