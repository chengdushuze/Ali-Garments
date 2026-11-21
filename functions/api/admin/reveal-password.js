import { verifySessionToken, verifyPassword, getSessionTokenFromRequest } from '../_auth.js';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Please sign in.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secret = env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
  const session = await verifySessionToken(token, secret);

  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden. Admin privileges required.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { userId, superAdminPassword } = await request.json().catch(() => ({}));

    if (!userId || !superAdminPassword) {
      return new Response(
        JSON.stringify({ error: 'User ID and Super Admin password are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch Super Admin record from D1
    let superAdmin = null;
    if (env.DB) {
      superAdmin = await env.DB.prepare("SELECT id, email, password_hash FROM users WHERE role = 'super_admin' LIMIT 1").first();
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: "SELECT id, email, password_hash FROM users WHERE role = 'super_admin' LIMIT 1" }),
      });
      const data = await res.json();
      superAdmin = data?.result?.[0]?.results?.[0];
    }

    if (!superAdmin) {
      return new Response(JSON.stringify({ error: 'Super Admin account not found.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Verify Super Admin Password
    const isValid = await verifyPassword(superAdminPassword, superAdmin.password_hash);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid Super Admin password. Access denied.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Fetch target user's password_plain
    let targetUser = null;
    if (env.DB) {
      targetUser = await env.DB.prepare('SELECT id, name, email, password_plain FROM users WHERE id = ?').bind(userId).first();
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'SELECT id, name, email, password_plain FROM users WHERE id = ?', params: [userId] }),
      });
      const data = await res.json();
      targetUser = data?.result?.[0]?.results?.[0];
    }

    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'User not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Log the audit event for security tracking
    if (env.DB) {
      try {
        const clientIp = request.headers.get('CF-Connecting-IP') || 
                         request.headers.get('x-real-ip') || 
                         request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                         'client';
        await env.DB.prepare(
          'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          session.userId || 1,
          session.email || 'admin',
          'PASSWORD_REVEALED',
          `Super admin authorized password reveal for user ${targetUser.email} (#${targetUser.id})`,
          clientIp
        ).run();
      } catch (e) {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
        },
        password: targetUser.password_plain || 'Password not stored in readable format. Please use Reset Password to set a new password.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Reveal password error:', err);
    return new Response(JSON.stringify({ error: 'Failed to process request.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
