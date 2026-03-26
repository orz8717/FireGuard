
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://rpdcfsqzvtiiiuvpzgxo.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZGNmc3F6dnRpaWl1dnB6Z3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDEyMDIsImV4cCI6MjA4NTc3NzIwMn0.qS0LwuQwjOcEFNu1L-mwrRh_Eg3yqOqyJVXCii37D38';

// Singleton client for public/authenticated RLS-governed access
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

/**
 * NON-PERSISTING ANON CLIENT
 * Used for operations like signUp that shouldn't affect the main session.
 */
let _supabaseAnon: any = null;
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

const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZGNmc3F6dnRpaWl1dnB6Z3hvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIwMTIwMiwiZXhwIjoyMDg1Nzc3MjAyfQ.9VCupnxdTQNUL_KOXkPKCFpWV98dEUIl28FfC9WrHRA';

let _supabaseAdmin: any = null;
export const getSupabaseAdmin = () => {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      db: { schema: 'public' },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }
  return _supabaseAdmin;
};

export const hasAdminPrivileges = () => !!serviceRoleKey;
