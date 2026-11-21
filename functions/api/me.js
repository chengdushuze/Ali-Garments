import { verifySessionToken, getSessionTokenFromRequest } from './_auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const token = getSessionTokenFromRequest(request);

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

  let liveUser = null;
  if (env.DB) {
    try {
      liveUser = await env.DB.prepare('SELECT id, name, email, role, COALESCE(status, \'active\') as status, suspended_until FROM users WHERE id = ?')
        .bind(session.userId)
        .first();
    } catch (e) {}
  } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'SELECT id, name, email, role, COALESCE(status, \'active\') as status, suspended_until FROM users WHERE id = ?', params: [session.userId] }),
      });
      const data = await res.json();
      liveUser = data?.result?.[0]?.results?.[0];
    } catch (e) {}
  }

  // Real-time suspension check: immediately kick out suspended users!
  if (liveUser && liveUser.status === 'suspended' && liveUser.role !== 'super_admin') {
    if (liveUser.suspended_until && Date.now() >= liveUser.suspended_until) {
      // Auto-reactivate expired suspension
      if (env.DB) {
        await env.DB.prepare("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?").bind(liveUser.id).run().catch(() => {});
      }
      liveUser.status = 'active';
    } else {
      const remainingDays = liveUser.suspended_until ? Math.ceil((liveUser.suspended_until - Date.now()) / (24 * 60 * 60 * 1000)) : null;
      const untilText = remainingDays ? ` for ${remainingDays} more day(s)` : '';
      return new Response(
        JSON.stringify({
          error: `Your account has been temporarily suspended by an administrator${untilText}. Please contact management.`,
          isSuspended: true,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({
      user: {
        id: liveUser ? liveUser.id : session.userId,
        name: liveUser ? liveUser.name : session.name,
        email: liveUser ? liveUser.email : session.email,
        role: liveUser ? liveUser.role : (session.role || 'user'),
        status: liveUser ? liveUser.status : 'active',
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
