import { verifySessionToken } from './_auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const secret = env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
  const session = await verifySessionToken(token, secret);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session expired or invalid' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role || 'user',
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
