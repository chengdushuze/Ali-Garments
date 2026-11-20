import { verifySessionToken } from './_auth.js';

async function getSession(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return null;
  const secret = process.env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
  return await verifySessionToken(token, secret);
}

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
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
          sql: 'SELECT id, user_id, content, created_at FROM items WHERE user_id = ? ORDER BY created_at DESC',
          params: [session.userId],
        }),
      });
      const data = await cfRes.json();
      return res.status(200).json({ items: data?.result?.[0]?.results || [] });
    }

    if (req.method === 'POST') {
      const { content } = req.body || {};
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Content is required.' });
      }

      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'INSERT INTO items (user_id, content) VALUES (?, ?)',
          params: [session.userId, content.trim()],
        }),
      });

      return res.status(201).json({ success: true, message: 'Item created' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Item ID is required.' });
      }

      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'DELETE FROM items WHERE id = ? AND user_id = ?',
          params: [id, session.userId],
        }),
      });

      return res.status(200).json({ success: true, message: 'Item deleted' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Vercel data error:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
