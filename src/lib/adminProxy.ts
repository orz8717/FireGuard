const PROXY_URL = '/api/admin-proxy';

async function getToken(): Promise<string | null> {
  return localStorage.getItem('fireguard_token');
}

async function callProxy(body: Record<string, unknown>): Promise<{ data: any; error: any }> {
  const token = await getToken();
  if (!token) return { data: null, error: { message: 'Not authenticated' } };

  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const msg = await res.text();
      return { data: null, error: { message: msg } };
    }

    return res.json();
  } catch (e: any) {
    return { data: null, error: { message: e.message ?? 'Network error' } };
  }
}

// ── Query builder ─────────────────────────────────────────────────────────────

type FilterDef =
  | { type: 'eq'; col: string; val: unknown }
  | { type: 'in'; col: string; val: unknown[] }
  | { type: 'or'; val: string };

interface BuilderSpec {
  action: 'from';
  table: string;
  method: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  columns: string;
  selectAfter?: string;
  data?: unknown;
  filters: FilterDef[];
  range?: [number, number];
  order?: { col: string; ascending: boolean };
  limit?: number;
  single: boolean;
  maybeSingle: boolean;
  onConflict?: string;
}

class FromBuilder {
  private s: BuilderSpec;

  constructor(table: string, method: BuilderSpec['method'], data?: unknown, onConflict?: string) {
    this.s = {
      action: 'from',
      table,
      method,
      columns: '*',
      data,
      filters: [],
      single: false,
      maybeSingle: false,
      onConflict,
    };
  }

  private clone(): FromBuilder {
    const b = new FromBuilder(this.s.table, this.s.method, this.s.data, this.s.onConflict);
    b.s = { ...this.s, filters: [...this.s.filters] };
    return b;
  }

  select(cols = '*'): FromBuilder {
    const b = this.clone();
    if (this.s.method === 'select') {
      b.s.columns = cols;
    } else {
      b.s.selectAfter = cols;
    }
    return b;
  }

  eq(col: string, val: unknown): FromBuilder {
    const b = this.clone();
    b.s.filters.push({ type: 'eq', col, val });
    return b;
  }

  in(col: string, vals: unknown[]): FromBuilder {
    const b = this.clone();
    b.s.filters.push({ type: 'in', col, val: vals });
    return b;
  }

  or(filter: string): FromBuilder {
    const b = this.clone();
    b.s.filters.push({ type: 'or', val: filter });
    return b;
  }

  range(from: number, to: number): FromBuilder {
    const b = this.clone();
    b.s.range = [from, to];
    return b;
  }

  order(col: string, opts?: { ascending?: boolean }): FromBuilder {
    const b = this.clone();
    b.s.order = { col, ascending: opts?.ascending ?? true };
    return b;
  }

  limit(n: number): FromBuilder {
    const b = this.clone();
    b.s.limit = n;
    return b;
  }

  single(): Promise<{ data: any; error: any }> {
    const b = this.clone();
    b.s.single = true;
    return callProxy(b.s as unknown as Record<string, unknown>);
  }

  maybeSingle(): Promise<{ data: any; error: any }> {
    const b = this.clone();
    b.s.maybeSingle = true;
    return callProxy(b.s as unknown as Record<string, unknown>);
  }

  then(
    resolve: (v: { data: any; error: any }) => any,
    reject?: (e: any) => any,
  ): Promise<any> {
    return callProxy(this.s as unknown as Record<string, unknown>).then(resolve, reject);
  }
}

// ── Public adminProxy object ──────────────────────────────────────────────────

export const adminProxy = {
  from(table: string) {
    return {
      select: (cols = '*') => new FromBuilder(table, 'select').select(cols),
      insert: (data: unknown) => new FromBuilder(table, 'insert', data),
      upsert: (data: unknown, opts?: { onConflict?: string }) =>
        new FromBuilder(table, 'upsert', data, opts?.onConflict),
      update: (data: unknown) => new FromBuilder(table, 'update', data),
      delete: () => new FromBuilder(table, 'delete'),
    };
  },

  rpc(fnName: string, args?: Record<string, unknown>): Promise<{ data: any; error: any }> {
    return callProxy({ action: 'rpc', fnName, fnArgs: args ?? {} });
  },

  auth: {
    admin: {
      listUsers: (): Promise<{ data: any; error: any }> =>
        callProxy({ action: 'listUsers' }),

      updateUserById: (
        userId: string,
        attrs: Record<string, unknown>,
      ): Promise<{ data: any; error: any }> =>
        callProxy({ action: 'updateUserById', userId, userAttrs: attrs }),
    },
  },
};

export type AdminProxy = typeof adminProxy;
