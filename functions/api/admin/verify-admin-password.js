import { verifySessionToken, verifyPassword, getSessionTokenFromRequest, getSessionSecret, getCorsHeaders } from '../_auth.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized. Please sign in.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secret = getSessionSecret(env);
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
      return new Response(JSON.stringify({
        success: false,
        error: 'Your account has been suspended Please contact administrator',
        isSuspended: true
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = Date.now();
    const FIFTEEN_MINS_MS = 15 * 60 * 1000;
    const windowCutoff = now - FIFTEEN_MINS_MS;
    const dayCutoff = now - 24 * 60 * 60 * 1000;
    const userEmail = (user.email || '').toLowerCase().trim();

    // Check rate limit status for this user
    if (env.DB) {
      try {
        await env.DB.prepare(
          'CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, identifier TEXT NOT NULL, attempt_time INTEGER NOT NULL)'
        ).run();

        // 1. Check cumulative 24h failures (6-attempt auto suspension)
        const dayStats = await env.DB.prepare(
          'SELECT COUNT(*) as total FROM login_attempts WHERE identifier = ? AND attempt_time >= ?'
        ).bind(userEmail, dayCutoff).first();

        if (Number(dayStats?.total || 0) >= 6 && user.role !== 'super_admin') {
          await env.DB.prepare(
            "UPDATE users SET status = 'suspended', suspension_reason = 'Account automatically suspended due to 6 failed password attempts' WHERE id = ?"
          ).bind(user.id).run().catch(() => {});

          return new Response(JSON.stringify({
            success: false,
            error: 'Your account has been automatically suspended due to 6 failed password attempts Please contact administrator',
            isSuspended: true,
            autoSuspended: true
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 2. Check 15-minute window failures (3 maximum)
        const winStats = await env.DB.prepare(
          'SELECT COUNT(*) as total, MIN(attempt_time) as oldest FROM login_attempts WHERE identifier = ? AND attempt_time >= ?'
        ).bind(userEmail, windowCutoff).first();

        if (Number(winStats?.total || 0) >= 3) {
          const oldest = Number(winStats?.oldest || now);
          const remainingSecs = Math.max(0, Math.ceil(((oldest + FIFTEEN_MINS_MS) - now) / 1000));
          const remainingMins = Math.max(1, Math.ceil(remainingSecs / 60));

          return new Response(JSON.stringify({
            success: false,
            error: `Too many failed password attempts (3 maximum) Access is locked for ${remainingMins} minute${remainingMins > 1 ? 's' : ''}`,
            isRateLimited: true,
            retryAfterMinutes: remainingMins,
            retryAfterSeconds: remainingSecs
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(remainingSecs) },
          });
        }
      } catch (e) {
        console.warn('Rate limit query warning:', e);
      }
    }

    // 2. Verify password with stored hash
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      let failuresCount = 1;
      let windowCount = 1;

      if (env.DB) {
        try {
          await env.DB.prepare('INSERT INTO login_attempts (identifier, attempt_time) VALUES (?, ?)')
            .bind(userEmail, now)
            .run();

          const dayStats = await env.DB.prepare(
            'SELECT COUNT(*) as total FROM login_attempts WHERE identifier = ? AND attempt_time >= ?'
          ).bind(userEmail, dayCutoff).first();
          failuresCount = Number(dayStats?.total || 1);

          const winStats = await env.DB.prepare(
            'SELECT COUNT(*) as total FROM login_attempts WHERE identifier = ? AND attempt_time >= ?'
          ).bind(userEmail, windowCutoff).first();
          windowCount = Number(winStats?.total || 1);
        } catch (e) {}
      }

      // Check if 6 failed attempts reached -> suspend immediately
      if (failuresCount >= 6) {
        if (env.DB && user.role !== 'super_admin') {
          await env.DB.prepare(
            "UPDATE users SET status = 'suspended', suspension_reason = 'Account automatically suspended due to 6 failed password attempts' WHERE id = ?"
          ).bind(user.id).run().catch(() => {});
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Your account has been automatically suspended due to 6 failed password attempts Please contact administrator',
            isSuspended: true,
            autoSuspended: true
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if 3 failed attempts in window -> 15 min lock
      if (windowCount >= 3) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Too many failed password attempts (3 maximum) For your security access is locked for 15 minutes',
            isRateLimited: true,
            retryAfterMinutes: 15
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '900' } }
        );
      }

      const attemptsLeft = Math.max(0, 3 - windowCount);
      const triesUntilSuspension = Math.max(0, 6 - failuresCount);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Incorrect password (${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining before 15-minute lock ${triesUntilSuspension} before suspension)`,
          remainingAttempts: attemptsLeft,
          triesUntilSuspension
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clear failed attempts on successful verification
    if (env.DB) {
      await env.DB.prepare('DELETE FROM login_attempts WHERE identifier = ?').bind(userEmail).run().catch(() => {});
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
