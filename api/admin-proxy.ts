import { Pool } from '@neondatabase/serverless';
import { verifyToken } from './_auth';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query(queryStr: string, params: unknown[] = []): Promise<any[]> {
  const result = await pool.query(queryStr, params);
  return result.rows;
}

// ── Safe identifier quoting ───────────────────────────────────────────────────
function q(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// ── JWT verification (Clerk) ──────────────────────────────────────────────────
function verifyUser(token: string): string | null {
  const payload = verifyToken(token);
  return (payload?.sub as string) ?? null;
}

// ── Filter builder ────────────────────────────────────────────────────────────
type FilterDef =
  | { type: 'eq'; col: string; val: unknown }
  | { type: 'in'; col: string; val: unknown[] }
  | { type: 'or'; val: string };

function parseOrFilter(filterStr: string, params: unknown[]): string {
  const parts = filterStr.split(',').map(part => {
    const first = part.indexOf('.');
    const second = part.indexOf('.', first + 1);
    if (first === -1 || second === -1) return '1=1';
    const col = part.slice(0, first);
    const op = part.slice(first + 1, second);
    const val = part.slice(second + 1);
    switch (op) {
      case 'eq':    params.push(val); return `${q(col)} = $${params.length}`;
      case 'neq':   params.push(val); return `${q(col)} != $${params.length}`;
      case 'ilike': params.push(val); return `${q(col)} ILIKE $${params.length}`;
      case 'like':  params.push(val); return `${q(col)} LIKE $${params.length}`;
      case 'is':    return val === 'null' ? `${q(col)} IS NULL` : `${q(col)} IS NOT NULL`;
      default:      params.push(val); return `${q(col)} = $${params.length}`;
    }
  });
  return `(${parts.join(' OR ')})`;
}

function buildWhere(filters: FilterDef[], params: unknown[]): string {
  if (!filters.length) return '';
  const conditions = filters.map(f => {
    if (f.type === 'eq') {
      params.push(f.val);
      return `${q(f.col)} = $${params.length}`;
    }
    if (f.type === 'in') {
      const placeholders = (f.val as unknown[]).map(v => {
        params.push(v); return `$${params.length}`;
      }).join(', ');
      return `${q(f.col)} IN (${placeholders})`;
    }
    if (f.type === 'or') {
      return parseOrFilter(f.val as string, params);
    }
    return '1=1';
  });
  return `WHERE ${conditions.join(' AND ')}`;
}

function buildColStr(columns: string): string {
  if (columns === '*') return '*';
  return columns.split(',').map(c => {
    const t = c.trim();
    if (t === '*') return '*';
    if (t.includes(':')) {
      const [col, alias] = t.split(':');
      return `${q(col.trim())} AS ${q(alias.trim())}`;
    }
    return q(t);
  }).join(', ');
}

const ALLOWED_RPCS = new Set([
  'get_public_tables', 'get_table_columns', 'check_table_exists',
  'create_dynamic_table', 'add_column_to_table', 'sync_table_columns',
  'reload_schema_cache', 'get_triggers', 'get_schema_definition',
  'get_schema_metadata',
]);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ data: null, error: { message: 'Method not allowed' } });
  }

  const authHeader: string = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });

  const userId = verifyUser(token);
  if (!userId) return res.status(401).json({ data: null, error: { message: 'Invalid token' } });

  const body = req.body ?? {};
  const { action } = body;

  try {
    // ── RPC ───────────────────────────────────────────────────────────────────
    if (action === 'rpc') {
      const { fnName, fnArgs = {} } = body;
      if (!ALLOWED_RPCS.has(fnName)) {
        return res.status(403).json({ data: null, error: { message: `RPC "${fnName}" not allowed` } });
      }
      const params: unknown[] = [];
      const argEntries = Object.entries(fnArgs as Record<string, unknown>);
      let queryStr: string;
      if (argEntries.length === 0) {
        queryStr = `SELECT * FROM ${fnName}()`;
      } else {
        const argStr = argEntries.map(([k, v]) => {
          params.push(v);
          return `${k} => $${params.length}`;
        }).join(', ');
        queryStr = `SELECT * FROM ${fnName}(${argStr})`;
      }
      const rows = await query(queryStr, params);
      return res.status(200).json({ data: rows, error: null });
    }

    // ── List users ─────────────────────────────────────────────────────────
    if (action === 'listUsers') {
      const rows = await query(`SELECT * FROM "users" ORDER BY created_at DESC`);
      return res.status(200).json({ data: { users: rows }, error: null });
    }

    // ── Update user ────────────────────────────────────────────────────────
    if (action === 'updateUserById') {
      const { userId: targetId, userAttrs = {} } = body;

      // email_confirm → no-op (Clerk handles verification)
      if ('email_confirm' in userAttrs && Object.keys(userAttrs).length === 1) {
        return res.status(200).json({ data: { user: { id: targetId } }, error: null });
      }

      // password → hash and update password_hash in Neon
      if (userAttrs.password) {
        const { hashPassword } = await import('./_auth');
        const hash = await hashPassword(userAttrs.password as string);
        await query(`UPDATE "users" SET password_hash = $1 WHERE id = $2`, [hash, targetId]);
      }

      // Other attrs → SQL UPDATE on users table
      const updateEntries = Object.entries(userAttrs as Record<string, unknown>)
        .filter(([k]) => !['email_confirm', 'password'].includes(k));
      if (updateEntries.length > 0) {
        const params: unknown[] = [];
        const setClauses = updateEntries.map(([k, v]) => {
          params.push(v);
          return `${q(k)} = $${params.length}`;
        }).join(', ');
        params.push(targetId);
        await query(`UPDATE "users" SET ${setClauses} WHERE id = $${params.length}`, params);
      }

      return res.status(200).json({ data: { user: { id: targetId } }, error: null });
    }

    // ── Table operations ───────────────────────────────────────────────────
    if (action === 'from') {
      const {
        table, method,
        columns = '*', selectAfter,
        data: payload,
        filters = [],
        range: rangeVal,
        order: orderVal,
        limit: limitVal,
        single: isSingle,
        maybeSingle: isMaybeSingle,
        onConflict = 'id',
      } = body;

      if (!table || typeof table !== 'string') {
        return res.status(400).json({ data: null, error: { message: 'Invalid table name' } });
      }

      const params: unknown[] = [];

      // SELECT ────────────────────────────────────────────────────────────────
      if (method === 'select') {
        let queryStr = `SELECT ${buildColStr(columns)} FROM ${q(table)}`;
        const w = buildWhere(filters, params);
        if (w) queryStr += ' ' + w;
        if (orderVal) queryStr += ` ORDER BY ${q(orderVal.col)} ${orderVal.ascending ? 'ASC' : 'DESC'}`;
        if (limitVal !== undefined) { params.push(limitVal); queryStr += ` LIMIT $${params.length}`; }
        if (rangeVal) { params.push(rangeVal[0]); queryStr += ` OFFSET $${params.length}`; }

        const rows = await query(queryStr, params);
        if (isSingle) {
          if (!rows.length) return res.status(200).json({ data: null, error: { code: 'PGRST116', message: 'No rows found' } });
          return res.status(200).json({ data: rows[0], error: null });
        }
        if (isMaybeSingle) return res.status(200).json({ data: rows[0] ?? null, error: null });
        return res.status(200).json({ data: rows, error: null });
      }

      // INSERT ────────────────────────────────────────────────────────────────
      if (method === 'insert') {
        const records: Record<string, unknown>[] = Array.isArray(payload) ? payload : [payload];
        if (!records.length) return res.status(200).json({ data: [], error: null });
        const cols = Object.keys(records[0]).filter(k => records[0][k] !== undefined);
        const colList = cols.map(q).join(', ');
        const valueSets = records.map(r => {
          const ph = cols.map(c => { params.push(r[c] ?? null); return `$${params.length}`; }).join(', ');
          return `(${ph})`;
        }).join(', ');
        const ret = selectAfter !== undefined ? ` RETURNING ${selectAfter === '*' ? '*' : buildColStr(selectAfter)}` : '';
        const rows = await query(`INSERT INTO ${q(table)} (${colList}) VALUES ${valueSets}${ret}`, params);
        return res.status(200).json({ data: selectAfter !== undefined ? (isSingle ? rows[0] ?? null : rows) : null, error: null });
      }

      // UPSERT ────────────────────────────────────────────────────────────────
      if (method === 'upsert') {
        const records: Record<string, unknown>[] = Array.isArray(payload) ? payload : [payload];
        if (!records.length) return res.status(200).json({ data: [], error: null });
        const cols = Object.keys(records[0]).filter(k => records[0][k] !== undefined);
        const colList = cols.map(q).join(', ');
        const valueSets = records.map(r => {
          const ph = cols.map(c => { params.push(r[c] ?? null); return `$${params.length}`; }).join(', ');
          return `(${ph})`;
        }).join(', ');
        const updateCols = cols.filter(c => c !== onConflict);
        const updateSet = updateCols.length
          ? updateCols.map(c => `${q(c)} = EXCLUDED.${q(c)}`).join(', ')
          : `${q(onConflict)} = EXCLUDED.${q(onConflict)}`;
        const ret = selectAfter !== undefined ? ` RETURNING ${selectAfter === '*' ? '*' : buildColStr(selectAfter)}` : '';
        const rows = await query(
          `INSERT INTO ${q(table)} (${colList}) VALUES ${valueSets} ON CONFLICT (${q(onConflict)}) DO UPDATE SET ${updateSet}${ret}`,
          params
        );
        return res.status(200).json({ data: selectAfter !== undefined ? rows : null, error: null });
      }

      // UPDATE ────────────────────────────────────────────────────────────────
      if (method === 'update') {
        const record = payload as Record<string, unknown>;
        const cols = Object.keys(record).filter(k => record[k] !== undefined);
        if (!cols.length) return res.status(400).json({ data: null, error: { message: 'No fields to update' } });
        const setClauses = cols.map(c => { params.push(record[c] ?? null); return `${q(c)} = $${params.length}`; }).join(', ');
        let queryStr = `UPDATE ${q(table)} SET ${setClauses}`;
        const w = buildWhere(filters, params);
        if (w) queryStr += ' ' + w;
        const ret = selectAfter !== undefined ? ` RETURNING ${selectAfter === '*' ? '*' : buildColStr(selectAfter)}` : '';
        queryStr += ret;
        const rows = await query(queryStr, params);
        return res.status(200).json({ data: selectAfter !== undefined ? (isSingle ? rows[0] ?? null : rows) : null, error: null });
      }

      // DELETE ────────────────────────────────────────────────────────────────
      if (method === 'delete') {
        let queryStr = `DELETE FROM ${q(table)}`;
        const w = buildWhere(filters, params);
        if (w) queryStr += ' ' + w;
        if (selectAfter !== undefined) queryStr += ' RETURNING *';
        const rows = await query(queryStr, params);
        return res.status(200).json({ data: selectAfter !== undefined ? rows : null, error: null });
      }

      return res.status(400).json({ data: null, error: { message: `Unknown method: ${method}` } });
    }

    return res.status(400).json({ data: null, error: { message: `Unknown action: ${action}` } });
  } catch (e: any) {
    console.error('[admin-proxy] Error:', e);
    return res.status(500).json({ data: null, error: { message: e.message ?? 'Internal server error' } });
  }
}
