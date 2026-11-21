import { verifyPassword, signSessionToken } from './_auth.js';

const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
    const { email, password } = await request.json().catch(() => ({}));

    if (!email || !password) {
      // 500ms security delay on failed attempts
      await new Promise(r => setTimeout(r, 500));
      return new Response(JSON.stringify({ error: 'Email and password are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const clientIp = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('x-real-ip') || 
                     request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     'client';

    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;

    // Auto-create rate limiting table in D1 if not exists
    if (env.DB) {
      try {
        await env.DB.prepare(
          'CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, identifier TEXT NOT NULL, attempt_time INTEGER NOT NULL)'
        ).run();
      } catch (e) {}
    }

    // 1. Check Rate Limiting for this email or client IP (Max 3 failed attempts in 15 minutes)
    let failedCount = 0;
    let oldestAttemptTime = null;

    if (env.DB) {
      // Clean up expired attempts older than 15 minutes
      await env.DB.prepare('DELETE FROM login_attempts WHERE attempt_time < ?')
        .bind(cutoff)
        .run()
        .catch(() => {});

      // Count attempts within last 15 minutes for this email or IP
      const stats = await env.DB.prepare(
        'SELECT COUNT(*) as total, MIN(attempt_time) as oldest FROM login_attempts WHERE (identifier = ? OR identifier = ?) AND attempt_time >= ?'
      )
        .bind(cleanEmail, clientIp, cutoff)
        .first();

      failedCount = Number(stats?.total || 0);
      oldestAttemptTime = stats?.oldest ? Number(stats.oldest) : null;
    }

    if (failedCount >= RATE_LIMIT_MAX_ATTEMPTS) {
      const waitRemainingMs = oldestAttemptTime ? Math.max(0, (oldestAttemptTime + RATE_LIMIT_WINDOW_MS) - now) : RATE_LIMIT_WINDOW_MS;
      const minutesRemaining = Math.max(1, Math.ceil(waitRemainingMs / 60000));

      return new Response(
        JSON.stringify({
          error: `Too many failed login attempts (3 maximum). For your security, login is locked for ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`,
          isRateLimited: true,
          retryAfterMinutes: minutesRemaining,
          remainingAttempts: 0
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(waitRemainingMs / 1000)),
          },
        }
      );
    }

    // 2. Query user from Cloudflare D1
    let user = null;
    if (env.DB) {
      // Auto-ensure status column exists
      try {
        await env.DB.prepare("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'").run();
      } catch (e) {}

      user = await env.DB.prepare('SELECT id, name, email, password_hash, role, status FROM users WHERE LOWER(email) = ?')
        .bind(cleanEmail)
        .first();
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT id, name, email, password_hash, role, status FROM users WHERE LOWER(email) = ? LIMIT 1',
          params: [cleanEmail],
        }),
      });
      const data = await res.json();
      user = data?.result?.[0]?.results?.[0] || null;
    }

    // Check if user is suspended
    if (user && user.status === 'suspended') {
      return new Response(
        JSON.stringify({
          error: 'Your account has been temporarily suspended by an administrator. Please contact management.',
          isSuspended: true,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const isValid = user && (await verifyPassword(password, user.password_hash));

    // 3. Handle Failed Login (Record attempt & enforce rate limit)
    if (!isValid) {
      if (env.DB) {
        // Record failed attempt for both email and client IP
        await env.DB.prepare('INSERT INTO login_attempts (identifier, attempt_time) VALUES (?, ?)')
          .bind(cleanEmail, now)
          .run()
          .catch(() => {});
        if (clientIp !== cleanEmail) {
          await env.DB.prepare('INSERT INTO login_attempts (identifier, attempt_time) VALUES (?, ?)')
            .bind(clientIp, now)
            .run()
            .catch(() => {});
        }
      }

      const newFailedCount = failedCount + 1;
      const remaining = Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - newFailedCount);

      // 500ms security delay on failed logins to prevent brute-force timing attacks
      await new Promise(r => setTimeout(r, 500));

      // Do NOT reveal remaining attempt count to attacker before the 15-minute lock
      const message = remaining === 0
        ? 'Too many failed login attempts (3 maximum). For your security, login is locked for 15 minutes.'
        : 'Invalid email or password.';

      return new Response(
        JSON.stringify({
          error: message,
          isRateLimited: remaining === 0,
        }),
        {
          status: remaining === 0 ? 429 : 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Successful Login: Clear all failed attempts for this email and IP
    if (env.DB) {
      await env.DB.prepare('DELETE FROM login_attempts WHERE identifier = ? OR identifier = ?')
        .bind(cleanEmail, clientIp)
        .run()
        .catch(() => {});

      // Record audit log for successful user login
      try {
        await env.DB.prepare(
          'CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, user_email TEXT, action TEXT NOT NULL, details TEXT, ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
        ).run();
        await env.DB.prepare(
          'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
        ).bind(user.id, user.email, 'USER_LOGIN', `User ${user.name} signed in successfully`, clientIp).run();
      } catch (e) {}
    }

    // 5. Sign session token with SESSION_SECRET (Strict 5-Day Expiration for Security)
    const secret = env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
    const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
    const FIVE_DAYS_SECONDS = 5 * 24 * 60 * 60; // 432,000 seconds

    const sessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      exp: Date.now() + FIVE_DAYS_MS,
    };

    const sessionToken = await signSessionToken(sessionPayload, secret);

    // Set HttpOnly, Secure, SameSite=Strict cookie with 5-day lifespan
    const cookieHeader = `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${FIVE_DAYS_SECONDS}`;

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || 'user',
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader,
        },
      }
    );
  } catch (error) {
    console.error('Login technical error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
