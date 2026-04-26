/**
 * Supabase compatibility shim — no Supabase SDK.
 * Auth  → Clerk (window.Clerk global, set by <ClerkProvider>)
 * DB    → Neon via /api/admin-proxy
 * Realtime → not supported (use polling)
 */
import { adminProxy } from './adminProxy';

// ── Clerk window type ─────────────────────────────────────────────────────────
function clerk(): any {
  return (window as any).Clerk;
}

// ── Auth shim ─────────────────────────────────────────────────────────────────
const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const c = clerk();
      if (!c) return { data: { user: null }, error: { message: 'Clerk not initialised' } };

      let result: any;
      try {
        result = await c.client?.signIn?.create({
          strategy: 'password',
          identifier: email,
          password,
        });
      } catch (clerkErr: any) {
        console.error('[Auth] Clerk signIn error:', clerkErr);
        const msg = clerkErr?.errors?.[0]?.longMessage || clerkErr?.errors?.[0]?.message || clerkErr?.message || 'Clerk sign-in failed';
        return { data: { user: null }, error: { message: msg } };
      }

      if (result?.status !== 'complete') {
        console.error('[Auth] signIn status:', result?.status, result);
        return { data: { user: null }, error: { message: `Sign-in status: ${result?.status}` } };
      }

      await c.setActive({ session: result.createdSessionId });

      // Fetch the internal user row from Neon by email so callers get the DB UUID
      const token = await c.session?.getToken();
      if (token) {
        const res = await fetch('/api/admin-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: 'from', table: 'users', method: 'select', columns: '*',
            filters: [{ type: 'eq', col: 'email', val: email }],
            single: false, maybeSingle: true,
          }),
        });
        const { data: row } = await res.json();
        if (row) return { data: { user: { id: row.id, email: row.email } }, error: null };
      }

      return { data: { user: { id: result.createdUserId, email } }, error: null };
    } catch (e: any) {
      return { data: { user: null }, error: { message: e.message ?? 'Sign-in error' } };
    }
  },

  async signUp({ email, password }: { email: string; password: string }) {
    try {
      const c = clerk();
      if (!c) return { data: { user: null }, error: { message: 'Clerk not initialised' } };
      const result = await c.client?.signUp?.create({ emailAddress: email, password });
      return { data: { user: { id: result?.createdUserId ?? crypto.randomUUID(), email } }, error: null };
    } catch (e: any) {
      return { data: { user: null }, error: { message: e.message ?? 'Sign-up error' } };
    }
  },

  async signOut() {
    try { await clerk()?.signOut(); } catch {}
    return { error: null };
  },

  async getSession() {
    try {
      const c = clerk();
      const token = await c?.session?.getToken();
      if (!token) return { data: { session: null }, error: null };
      return {
        data: { session: { access_token: token, expires_at: Math.floor(Date.now() / 1000) + 3600 } },
        error: null,
      };
    } catch {
      return { data: { session: null }, error: null };
    }
  },

  async getUser() {
    try {
      const c = clerk();
      const clerkUser = c?.user;
      if (!clerkUser) return { data: { user: null }, error: null };
      return { data: { user: { id: clerkUser.id, email: clerkUser.primaryEmailAddress?.emailAddress } }, error: null };
    } catch {
      return { data: { user: null }, error: null };
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    const handler = async ({ session: clerkSession }: any) => {
      if (clerkSession) {
        // Use the user ID already saved in localStorage (set by authService.login)
        // so App.tsx receives the DB UUID, not the Clerk user ID.
        try {
          const saved = localStorage.getItem('fireguard_session');
          const savedUser = saved ? JSON.parse(saved) : null;
          if (savedUser?.id) {
            const token = (await clerkSession.getToken?.()) ?? 'pending';
            callback('INITIAL_SESSION', { access_token: token, user: { id: savedUser.id } });
          }
        } catch {}
      } else {
        callback('SIGNED_OUT', null);
      }
    };

    // Register once Clerk is available; retry every 200 ms while it loads.
    let removeFn: (() => void) | null = null;
    const tryRegister = () => {
      const c = clerk();
      if (c) {
        c.addListener(handler);
        removeFn = () => c.removeListener(handler);
      } else {
        setTimeout(tryRegister, 200);
      }
    };
    tryRegister();

    return {
      data: { subscription: { unsubscribe: () => removeFn?.() } },
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
