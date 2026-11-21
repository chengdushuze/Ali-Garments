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
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized. Please sign in.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secret = env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
  const session = await verifySessionToken(token, secret);

  if (!session) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid or expired session. Please sign in again.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { password, action } = await request.json().catch(() => ({}));

    if (!password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password is required for security verification.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Role checks based on action
    if (action === 'admin_gate' || action === 'recycle_bin_delete') {
      if (session.role !== 'admin' && session.role !== 'super_admin') {
        return new Response(
          JSON.stringify({ success: false, error: 'Forbidden. Administrator privileges required.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (action === 'role_change') {
      if (session.role !== 'super_admin') {
        return new Response(
          JSON.stringify({ success: false, error: 'Forbidden. Only Super Admin can modify user roles.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 1. Fetch user record from D1
    let user = null;
    if (env.DB) {
      user = await env.DB.prepare('SELECT id, name, email, role, password_hash, status, suspended_until FROM users WHERE id = ?').bind(session.userId).first();
      // Fallback by email if userId not found
      if (!user && session.email) {
        user = await env.DB.prepare('SELECT id, name, email, role, password_hash, status, suspended_until FROM users WHERE LOWER(email) = ?').bind(session.email.toLowerCase()).first();
      }
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: 'SELECT id, name, email, role, password_hash, status, suspended_until FROM users WHERE id = ? OR LOWER(email) = ? LIMIT 1',
          params: [session.userId, (session.email || '').toLowerCase()]
        }),
      });
      const data = await res.json();
      user = data?.result?.[0]?.results?.[0];
    }

    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Account record not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check account status
    if (user.status === 'suspended' && user.role !== 'super_admin') {
      return new Response(JSON.stringify({ success: false, error: 'Your account is suspended.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Verify password with stored hash
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Incorrect password. Authorization denied.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Log audit entry for sensitive operations
    if (env.DB && (action === 'admin_gate' || action === 'recycle_bin_delete' || action === 'role_change')) {
      try {
        const clientIp = request.headers.get('CF-Connecting-IP') || 'client';
        await env.DB.prepare(
          'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          user.id,
          user.email,
          `AUTH_${(action || 'VERIFY').toUpperCase()}`,
          `Password verified successfully for action: ${action}`,
          clientIp
        ).run().catch(() => {});
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        userId: user.id,
        email: user.email,
        role: user.role,
        message: 'Password verified successfully.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Password verification error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Server error during password verification. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
