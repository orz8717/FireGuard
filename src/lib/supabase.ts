/**
 * Supabase compatibility shim — no Supabase SDK, no Clerk.
 * Auth  → custom JWT via /api/auth (Neon-backed)
 * DB    → Neon via /api/admin-proxy
 * Realtime → not supported (use polling)
 */
import { adminProxy } from './adminProxy';

// ── Auth shim ─────────────────────────────────────────────────────────────────
const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { data: { user: null }, error: { message: data.error || 'Login failed' } };
      }
      localStorage.setItem('fireguard_token', data.token);
      localStorage.setItem('fireguard_session', JSON.stringify(data.user));
      return { data: { user: data.user }, error: null };
    } catch (e: any) {
      return { data: { user: null }, error: { message: e.message ?? 'Sign-in error' } };
    }
  },

  async signUp({ email, password }: { email: string; password: string }) {
    // Actual user creation happens in authService.signUp via supabase.from('users').insert()
    // Password will be set on first login
    return { data: { user: { id: crypto.randomUUID(), email } }, error: null };
  },

  async signOut() {
    localStorage.removeItem('fireguard_token');
    localStorage.removeItem('fireguard_session');
    return { error: null };
  },

  async getSession() {
    const token = localStorage.getItem('fireguard_token');
    const saved = localStorage.getItem('fireguard_session');
    if (!token || !saved) return { data: { session: null }, error: null };
    try {
      const user = JSON.parse(saved);
      return { data: { session: { access_token: token, user } }, error: null };
    } catch {
      return { data: { session: null }, error: null };
    }
  },

  async getUser() {
    const saved = localStorage.getItem('fireguard_session');
    if (!saved) return { data: { user: null }, error: null };
    try {
      return { data: { user: JSON.parse(saved) }, error: null };
    } catch {
      return { data: { user: null }, error: null };
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Fire once on subscribe with current session state
    const token = localStorage.getItem('fireguard_token');
    const saved = localStorage.getItem('fireguard_session');

    if (token && saved) {
      try {
        const user = JSON.parse(saved);
        setTimeout(() => callback('INITIAL_SESSION', { access_token: token, user }), 0);
      } catch {}
    }

    // Detect logout in other tabs via storage events
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'fireguard_token' && !e.newValue) {
        callback('SIGNED_OUT', null);
      }
    };
    window.addEventListener('storage', storageHandler);

    return {
      data: { subscription: { unsubscribe: () => window.removeEventListener('storage', storageHandler) } },
    };
  },
};

// ── Realtime stub (no-op) ─────────────────────────────────────────────────────
const channelStub = {
  on: (_type: string, _opts: any, _cb: any) => channelStub,
  subscribe: () => ({ unsubscribe: () => {} }),
};

// ── Main supabase shim ────────────────────────────────────────────────────────
export const supabase = {
  auth,

  from(table: string) {
    return {
      select: (cols = '*') => adminProxy.from(table).select(cols),
      insert: (data: unknown) => adminProxy.from(table).insert(data),
      upsert: (data: unknown, opts?: { onConflict?: string }) =>
        adminProxy.from(table).upsert(data, opts),
      update: (data: unknown) => adminProxy.from(table).update(data),
      delete: () => adminProxy.from(table).delete(),
    };
  },

  rpc(fnName: string, args?: Record<string, unknown>) {
    return adminProxy.rpc(fnName, args);
  },

  channel(_name: string) {
    return channelStub;
  },

  removeChannel(_channel: any) {},
};

// ── Exports expected by legacy code ───────────────────────────────────────────
export const supabaseUrl = '';
export const supabaseAnonKey = '';

export const getSupabaseAdmin = () => adminProxy;
export const getSupabaseAnon = () => supabase as any;
export const hasAdminPrivileges = () => true;
