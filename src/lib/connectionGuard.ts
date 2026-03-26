import { supabase } from '../lib/supabase';

export const isSupabaseReady = async (): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    // Check if session exists and is not expired
    if (!session) return false;
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    return expiresAt > Date.now();
  } catch (e) {
    return false;
  }
};

export const waitUntilReady = async (maxRetries = 10): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    if (navigator.onLine && await isSupabaseReady()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(1.5, i)));
  }
  return false;
};
