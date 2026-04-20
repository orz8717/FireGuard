import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ data: null, error: { message: 'Method not allowed' } });
  }

  const auth: string = req.headers['authorization'] ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
  }

  const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ data: null, error: { message: 'Invalid token' } });
  }

  const body = req.body ?? {};
  const { action } = body;

  try {
    // ── RPC calls ──────────────────────────────────────────────────────────
    if (action === 'rpc') {
      const { fnName, fnArgs } = body;
      if (!ALLOWED_RPCS.has(fnName)) {
        return res.status(403).json({ data: null, error: { message: `RPC "${fnName}" not allowed` } });
      }
      const result = await adminClient.rpc(fnName, fnArgs ?? {});
      return res.status(200).json(result);
    }

    // ── Auth admin ─────────────────────────────────────────────────────────
    if (action === 'listUsers') {
      const result = await adminClient.auth.admin.listUsers();
      return res.status(200).json(result);
    }

    if (action === 'updateUserById') {
      const { userId, userAttrs } = body;
      if (!userId) return res.status(400).json({ data: null, error: { message: 'userId required' } });
      const result = await adminClient.auth.admin.updateUserById(userId, userAttrs ?? {});
      return res.status(200).json(result);
    }

    // ── Table (from) operations ────────────────────────────────────────────
    if (action === 'from') {
      const {
        table, method,
        columns = '*', selectAfter,
        data: payload,
        filters = [],
        range: rangeVal,
        order: orderVal,
        limit: limitVal,
        single, maybeSingle,
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
        return res.status(400).json({ data: null, error: { message: `Unknown method: ${method}` } });
      }

      for (const f of filters) {
        if (f.type === 'eq')  query = query.eq(f.col, f.val);
        else if (f.type === 'in')  query = query.in(f.col, f.val);
        else if (f.type === 'or')  query = query.or(f.val);
      }

      if ((method === 'update' || method === 'delete') && selectAfter !== undefined) {
        query = query.select(selectAfter);
      }

      if (rangeVal)            query = query.range(rangeVal[0], rangeVal[1]);
      if (orderVal)            query = query.order(orderVal.col, { ascending: orderVal.ascending ?? true });
      if (limitVal !== undefined) query = query.limit(limitVal);
      if (single)              query = query.single();
      else if (maybeSingle)    query = query.maybeSingle();

      const result = await query;
      return res.status(200).json(result);
    }

    return res.status(400).json({ data: null, error: { message: `Unknown action: ${action}` } });
  } catch (e: any) {
    console.error('[admin-proxy] Error:', e);
    return res.status(500).json({ data: null, error: { message: e.message ?? 'Internal server error' } });
  }
}
