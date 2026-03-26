import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://rpdcfsqzvtiiiuvpzgxo.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZGNmc3F6dnRpaWl1dnB6Z3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDEyMDIsImV4cCI6MjA4NTc3NzIwMn0.qS0LwuQwjOcEFNu1L-mwrRh_Eg3yqOqyJVXCii37D38';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZGNmc3F6dnRpaWl1dnB6Z3hvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIwMTIwMiwiZXhwIjoyMDg1Nzc3MjAyfQ.9VCupnxdTQNUL_KOXkPKCFpWV98dEUIl28FfC9WrHRA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'supabase-admin'
  }
});

export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});
