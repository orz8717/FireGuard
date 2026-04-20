import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Guard: the service-role key must never be bundled into the client.
    if (env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        '[vite.config] VITE_SUPABASE_SERVICE_ROLE_KEY must not exist. ' +
        'The service_role key is server-only. ' +
        'Rename it to SUPABASE_SERVICE_ROLE_KEY and use it only in netlify/functions/.'
      );
    }

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
