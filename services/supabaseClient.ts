
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://rpdcfsqzvtiiiuvpzgxo.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZGNmc3F6dnRpaWl1dnB6Z3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDEyMDIsImV4cCI6MjA4NTc3NzIwMn0.qS0LwuQwjOcEFNu1L-mwrRh_Eg3yqOqyJVXCii37D38';

// Standard client for public/authenticated RLS-governed access
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
 * ADMIN CLIENT (Architect Mode)
 * Uses Service Role Key to bypass RLS and perform DDL operations.
 * We keep this as a separate instance because it uses a different key (Service Role).
 * We set persistSession: false to avoid conflicts with the main client's session.
 */
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZGNmc3F6dnRpaWl1dnB6Z3hvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIwMTIwMiwiZXhwIjoyMDg1Nzc3MjAyfQ.9VCupnxdTQNUL_KOXkPKCFpWV98dEUIl28FfC9WrHRA'; 
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// Remove supabaseAnon and use supabase instead, as they use the same key.
// For operations that shouldn't affect the main session, we can use supabaseAdmin 
// or just accept that the main session might be affected (usually not an issue for signUp).
export const supabaseAnon = supabase;

export const hasAdminPrivileges = () => !!serviceRoleKey;
