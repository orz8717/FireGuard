import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Guard: DATABASE_URL and Clerk secret must never reach the browser bundle.
  if (env.VITE_DATABASE_URL) {
    throw new Error('[vite.config] VITE_DATABASE_URL must not exist. Rename to DATABASE_URL and use only in api/admin-proxy.ts');
  }
  if (env.VITE_CLERK_SECRET_KEY) {
    throw new Error('[vite.config] VITE_CLERK_SECRET_KEY must not exist. Rename to CLERK_SECRET_KEY and use only in api/admin-proxy.ts');
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
