import { verifySessionToken } from './_auth.js';

export default async function handler(req, res) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const secret = process.env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
  const session = await verifySessionToken(token, secret);

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  return res.status(200).json({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role || 'user',
    },
  });
}
