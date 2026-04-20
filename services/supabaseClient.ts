// Re-export from the canonical client to avoid duplication
export { supabase, supabaseUrl, supabaseAnonKey, getSupabaseAdmin, getSupabaseAnon } from '../src/lib/supabase';

// Legacy named exports — kept as client instances (not functions) for backward compatibility
import { getSupabaseAdmin, getSupabaseAnon } from '../src/lib/supabase';
export const supabaseAdmin = getSupabaseAdmin();
export const supabaseAnon = getSupabaseAnon();
