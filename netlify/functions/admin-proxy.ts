import { createClient } from '@supabase/supabase-js';

// Minimal Netlify event/response types (avoids adding @netlify/functions dependency)
interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
}
interface NetlifyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const ALLOWED_RPCS = new Set([
  'get_public_tables',
  'get_table_columns',
  'check_table_exists',
  'create_dynamic_table',
  'add_column_to_table',
  'sync_table_columns',
  'reload_schema_cache',
  'get_triggers',
  'get_schema_definition',
]);

const json = (data: unknown, status = 200): NetlifyResponse => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

const errJson = (msg: string, status = 500): NetlifyResponse =>
  json({ data: null, error: { message: msg } }, status);

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod !== 'POST') return errJson('Method not allowed', 405);

  const auth = event.headers['authorization'] ?? event.headers['Authorization'] ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return errJson('Unauthorized', 401);

  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) return errJson('Invalid token', 401);

  let body: Record<string, any>;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return errJson('Invalid JSON body', 400);
  }

  const { action } = body;

  try {
    // ── RPC calls ──────────────────────────────────────────────────────────────
    if (action === 'rpc') {
      const { fnName, fnArgs } = body;
      if (!ALLOWED_RPCS.has(fnName)) return errJson(`RPC "${fnName}" not allowed`, 403);
      const result = await adminClient.rpc(fnName, fnArgs ?? {});
      return json(result);
    }

    // ── Auth admin ─────────────────────────────────────────────────────────────
    if (action === 'listUsers') {
      const result = await adminClient.auth.admin.listUsers();
      return json(result);
    }

    if (action === 'updateUserById') {
      const { userId, userAttrs } = body;
      if (!userId) return errJson('userId required', 400);
      const result = await adminClient.auth.admin.updateUserById(userId, userAttrs ?? {});
      return json(result);
    }

    // ── Table (from) operations ────────────────────────────────────────────────
    if (action === 'from') {
      const {
        table,
        method,
        columns = '*',
        selectAfter,
        data: payload,
        filters = [],
        range: rangeVal,
        order: orderVal,
        limit: limitVal,
        single,
        maybeSingle,
      } = body;

      let query: any;

      if (method === 'select') {
        query = adminClient.from(table).select(columns);
      } else if (method === 'insert') {
        query = adminClient.from(table).insert(payload);
        if (selectAfter !== undefined) query = query.select(selectAfter);
      } else if (method === 'upsert') {
        query = adminClient.from(table).upsert(payload);
        if (selectAfter !== undefined) query = query.select(selectAfter);
      } else if (method === 'update') {
        query = adminClient.from(table).update(payload);
      } else if (method === 'delete') {
        query = adminClient.from(table).delete();
      } else {
        return errJson(`Unknown method: ${method}`, 400);
      }

      // Apply filters
      for (const f of filters) {
        if (f.type === 'eq')  query = query.eq(f.col, f.val);
        else if (f.type === 'in')  query = query.in(f.col, f.val);
        else if (f.type === 'or')  query = query.or(f.val);
      }

      // For update, select comes after filters
      if ((method === 'update' || method === 'delete') && selectAfter !== undefined) {
        query = query.select(selectAfter);
      }

      if (rangeVal) query = query.range(rangeVal[0], rangeVal[1]);
      if (orderVal) query = query.order(orderVal.col, { ascending: orderVal.ascending ?? true });
      if (limitVal !== undefined) query = query.limit(limitVal);
      if (single) query = query.single();
      else if (maybeSingle) query = query.maybeSingle();

      const result = await query;
      return json(result);
    }

    return errJson(`Unknown action: ${action}`, 400);
  } catch (e: any) {
    console.error('[admin-proxy] Unhandled error:', e);
    return errJson(e.message ?? 'Internal server error');
  }
};
