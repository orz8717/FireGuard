import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');

const root = ReactDOM.createRoot(rootElement);

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('Refresh Token') || event.reason?.message?.includes('refresh_token_not_found')) {
    console.error('Auth session error detected, clearing local storage...');
    localStorage.removeItem('fireguard_session');
  }
});

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

import { Workbox } from 'workbox-window';

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
