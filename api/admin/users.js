import { verifySessionToken, hashPassword } from '../_auth.js';

async function getAdminSession(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return null;
  const secret = process.env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
  return await verifySessionToken(token, secret);
}

export default async function handler(req, res) {
  const session = await getAdminSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (session.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const databaseId = process.env.CF_DATABASE_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  try {
    if (req.method === 'GET') {
      const cfRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC',
        }),
      });
      const data = await cfRes.json();
      return res.status(200).json({ users: data?.result?.[0]?.results || [] });
    }

    if (req.method === 'POST') {
      const { name, email, password, role } = req.body || {};
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const userRole = role === 'admin' ? 'admin' : 'user';
      const passwordHash = await hashPassword(password);

      const cfRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
          params: [name.trim(), cleanEmail, passwordHash, userRole],
        }),
      });

      const data = await cfRes.json();
      if (!cfRes.ok || !data.success) {
        const errorMsg = data.errors?.[0]?.message || 'Failed to insert user';
        console.error('Vercel admin create user error:', errorMsg);
        const isConflict = errorMsg.includes('UNIQUE constraint');
        return res.status(isConflict ? 409 : 500).json({
          error: isConflict ? 'A user with this email already exists.' : 'Something went wrong. Please try again.',
        });
      }

      return res.status(201).json({
        success: true,
        message: `User ${cleanEmail} created successfully`,
        user: { name: name.trim(), email: cleanEmail, role: userRole },
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Vercel admin user error:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
