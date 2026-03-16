
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

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
