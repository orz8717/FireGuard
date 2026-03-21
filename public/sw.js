console.log('Service Worker: Script evaluation started');

try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js');

  if (workbox) {
    console.log('Service Worker: Workbox loaded');

    // Explicitly load modules
    workbox.loadModule('workbox-routing');
    workbox.loadModule('workbox-strategies');
    workbox.loadModule('workbox-expiration');
    workbox.loadModule('workbox-cacheable-response');

    // Cache static assets (images, fonts, etc.)
    workbox.routing.registerRoute(
      ({ request }) => request.destination === 'image' || request.destination === 'font',
      new workbox.strategies.CacheFirst({
        cacheName: 'static-assets',
        plugins: [
          new workbox.expiration.ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          }),
        ],
      })
    );

    // Cache Supabase API metadata routes
    workbox.routing.registerRoute(
      ({ url }) => url.origin.includes('supabase.co') && (
        url.pathname.includes('form_templates') ||
        url.pathname.includes('form_fields') ||
        url.pathname.includes('customers') ||
        url.pathname.includes('users')
      ),
      new workbox.strategies.StaleWhileRevalidate({
        cacheName: 'supabase-metadata',
        plugins: [
          new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200],
          }),
          new workbox.expiration.ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 24 Hours
          }),
        ],
      })
    );

    // Default strategy for other Supabase requests
    workbox.routing.registerRoute(
      ({ url }) => url.origin.includes('supabase.co'),
      new workbox.strategies.NetworkFirst({
        cacheName: 'supabase-data',
        plugins: [
          new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200],
          }),
        ],
      })
    );

    // Handle offline fallback for SPA
    workbox.routing.registerRoute(
      ({ request }) => request.mode === 'navigate',
      new workbox.strategies.NetworkFirst({
        cacheName: 'pages',
        plugins: [
          new workbox.cacheableResponse.CacheableResponsePlugin({
            statuses: [0, 200],
          }),
        ],
      })
    );

    self.addEventListener('install', () => {
      self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
      event.waitUntil(self.clients.claim());
    });
  }
} catch (error) {
  console.error('Service Worker evaluation error:', error);
}
