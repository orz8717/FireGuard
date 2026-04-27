import { neon } from '@neondatabase/serverless';
import { signToken, hashPassword, verifyPassword } from './_auth';

const sql = neon(process.env.DATABASE_URL!);

async function query(queryStr: string, params: unknown[] = []): Promise<any[]> {
  const result = await sql.query(queryStr, params);
  return result.rows;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, password } = req.body ?? {};

  if (action === 'login') {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    try {
      const users = await query(
        `SELECT id, email, name, phone, role, is_active, password_hash FROM "users" WHERE email = $1 LIMIT 1`,
        [email]
      );

      if (!users.length || !users[0].is_active) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = users[0];

      if (!user.password_hash) {
        // First login — hash and store the password
        const hash = await hashPassword(password);
        await query(`UPDATE "users" SET password_hash = $1 WHERE id = $2`, [hash, user.id]);
      } else {
        const ok = await verifyPassword(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = signToken({ sub: user.id, email: user.email, role: user.role });

      return res.status(200).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          isActive: user.is_active,
        },
      });
    } catch (e: any) {
      console.error('[auth] login error:', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (action === 'changePassword') {
    const { userId, newPassword } = req.body ?? {};
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'userId and newPassword required' });
    }
    try {
      const hash = await hashPassword(newPassword);
      await query(`UPDATE "users" SET password_hash = $1 WHERE id = $2`, [hash, userId]);
      return res.status(200).json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
}
