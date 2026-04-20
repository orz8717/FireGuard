
import { createClient } from '@supabase/supabase-js';
import { adminProxy } from './adminProxy';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export { supabaseUrl, supabaseAnonKey };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

let _supabaseAnon: ReturnType<typeof createClient> | null = null;
export const getSupabaseAnon = () => {
  if (!_supabaseAnon) {
    _supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }
  return _supabaseAnon;
};

/**
 * Returns the admin proxy — routes all calls through the Netlify Function
 * (netlify/functions/admin-proxy.ts) using SUPABASE_SERVICE_ROLE_KEY server-side.
 * The service-role key is never exposed to the browser.
 */
export const getSupabaseAdmin = () => adminProxy;

export const hasAdminPrivileges = () => true;
