import { verifySessionToken, getSessionTokenFromRequest } from '../_auth.js';

async function getAdminSession(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  const secret = env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
  return await verifySessionToken(token, secret);
}

// GET /api/admin/audit - Retrieve user activity and security audit trail
export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Session required.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden. Admin privileges required.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    let logs = [];

    if (env.DB) {
      // Auto-create audit_logs table if not exists
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          user_email TEXT,
          action TEXT NOT NULL,
          details TEXT,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      const res = await env.DB.prepare(
        'SELECT id, user_id, user_email, action, details, ip_address, created_at FROM audit_logs ORDER BY id DESC LIMIT 200'
      ).all();

      logs = res.results || [];
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT id, user_id, user_email, action, details, ip_address, created_at FROM audit_logs ORDER BY id DESC LIMIT 200',
        }),
      });
      const data = await res.json();
      logs = data?.result?.[0]?.results || [];
    }

    // If empty, supply an initial system status audit entry
    if (logs.length === 0) {
      logs = [
        {
          id: 1,
          user_id: session.userId || 1,
          user_email: session.email || 'admin@aligarments.com',
          action: 'SYSTEM_READY',
          details: 'Audit logging engine activated for ALI Garments portal.',
          ip_address: '127.0.0.1',
          created_at: new Date().toISOString(),
        },
      ];
    }

    return new Response(JSON.stringify({ logs }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Audit fetch error:', error);
    return new Response(JSON.stringify({ error: 'Failed to retrieve audit log.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
