import { verifyPassword, signSessionToken } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      await new Promise(r => setTimeout(r, 500));
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const accountId = process.env.CF_ACCOUNT_ID;
    const databaseId = process.env.CF_DATABASE_ID;
    const apiToken = process.env.CF_API_TOKEN;

    if (!accountId || !databaseId || !apiToken) {
      console.error('Vercel server error: Missing CF_ACCOUNT_ID, CF_DATABASE_ID, or CF_API_TOKEN in environment variables.');
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const cleanEmail = email.toLowerCase().trim();

    const cfRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: 'SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = ? LIMIT 1',
        params: [cleanEmail],
      }),
    });

    const data = await cfRes.json();
    const user = data?.result?.[0]?.results?.[0] || null;

    const isValid = user && (await verifyPassword(password, user.password_hash));

    if (!isValid) {
      // Exactly 500ms security delay on failed attempts
      await new Promise(r => setTimeout(r, 500));
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const secret = process.env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
    const sessionToken = await signSessionToken(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      secret
    );

    res.setHeader('Set-Cookie', `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
      },
    });
  } catch (error) {
    // Log real technical error on server for Vercel runtime logs
    console.error('Vercel login error:', error);
    // Return clean, generic error to screen
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
