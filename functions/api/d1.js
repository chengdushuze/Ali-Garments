import { verifySessionToken, getSessionTokenFromRequest } from './_auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
    // 1. Session verification (Cookie or Bearer token)
    const token = getSessionTokenFromRequest(request);
    const secret = env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
    const session = token ? await verifySessionToken(token, secret) : null;

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please sign in.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Real-time suspension check: immediately kick out suspended users!
    if (env.DB) {
      try {
        const dbUser = await env.DB.prepare('SELECT status, suspended_until, role FROM users WHERE id = ?').bind(session.userId).first();
        if (dbUser && dbUser.status === 'suspended' && dbUser.role !== 'super_admin') {
          if (dbUser.suspended_until && Date.now() >= dbUser.suspended_until) {
            await env.DB.prepare("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?").bind(session.userId).run().catch(() => {});
          } else {
            return new Response(JSON.stringify({ error: 'Your account has been temporarily suspended by an administrator.', isSuspended: true }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (e) {}
    }

    const { sql, params } = await request.json().catch(() => ({}));

    if (!sql) {
      return new Response(JSON.stringify({ error: 'Missing SQL query' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Strict Security: Block SQL Injection, internal schema tampering, and sensitive tables
    if (typeof sql !== 'string' || sql.length > 200000) {
      return new Response(JSON.stringify({ error: 'Invalid or oversized query payload.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (params && !Array.isArray(params)) {
      return new Response(JSON.stringify({ error: 'Query parameters must be formatted as an array.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Block access to sensitive or internal tables (users, login_attempts, sqlite internal tables, pragma)
    if (/\b(users|login_attempts|sqlite_master|sqlite_schema|sqlite_temp_master|pragma)\b/i.test(sql)) {
      console.warn(`[Security Alert] Blocked unauthorized query attempt by userId=${session.userId}`);
      return new Response(
        JSON.stringify({
          error: 'Access denied: Unauthorized table access blocked by security rules.'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (env.DB) {
      // Native Cloudflare D1 binding (0 API Token needed!)
      const stmt = env.DB.prepare(sql);
      const result = params && params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

      return new Response(JSON.stringify({ success: true, result: [result] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Direct REST API fallback
    const accountId = env.CF_ACCOUNT_ID;
    const databaseId = env.CF_DATABASE_ID;
    const apiToken = env.CF_API_TOKEN;

    if (!accountId || !databaseId || !apiToken) {
      return new Response(JSON.stringify({ error: 'D1 not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
    const cfRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params: params || [] }),
    });

    const data = await cfRes.json();
    return new Response(JSON.stringify(data), {
      status: cfRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('D1 execution error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
