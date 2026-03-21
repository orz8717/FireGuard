
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Global error handler for Supabase refresh token issues
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && (event.reason.message?.includes('Refresh Token') || event.reason.message?.includes('refresh_token_not_found'))) {
    console.error('Auth session error detected, clearing local storage...');
    localStorage.removeItem('fireguard_session');
    // We don't necessarily want to reload immediately as it might cause a loop, 
    // but the app state should react to the missing session.
  }
});

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import { Workbox } from 'workbox-window';

// Register Service Worker using Workbox
if ('serviceWorker' in navigator) {
  const wb = new Workbox('/sw.js');

  wb.addEventListener('installed', (event) => {
    if (event.isUpdate) {
      if (confirm('גרסה חדשה זמינה. האם ברצונך לרענן?')) {
        window.location.reload();
      }
    }
  });

  wb.register();
}
