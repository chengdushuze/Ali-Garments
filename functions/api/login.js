import { verifyPassword, signSessionToken, hashPassword } from './_auth.js';

const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

const SUPER_ADMIN_EMAIL = 'admin@chengdushuze.com';
const SUPER_ADMIN_HASH = 'b50227a85b94e8b3f28e2afd64a2f457:92e731c334e5fe3c283e5aa2170463bded2e000fbacdb501bca351fe35c7bef3';

export async function ensureSuperAdminInD1(db, env = null) {
  if (db) {
    try {
      // 1. Create users table if not exists with all required columns
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      // 2. Ensure status column exists in existing tables
      try {
        await db.prepare("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'").run();
      } catch (e) {}

      // 3. Check if Super Admin exists in users table
      const existing = await db.prepare('SELECT id, name, email, password_hash, role, status FROM users WHERE LOWER(email) = ?')
        .bind(SUPER_ADMIN_EMAIL)
        .first();

      if (!existing) {
        await db.prepare(
          'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)'
        ).bind('Super Admin', SUPER_ADMIN_EMAIL, SUPER_ADMIN_HASH, 'super_admin', 'active').run();
        console.log('[D1] Successfully inserted Super Admin into users table:', SUPER_ADMIN_EMAIL);
      } else if (existing.role !== 'super_admin' || existing.status !== 'active' || existing.password_hash !== SUPER_ADMIN_HASH) {
        await db.prepare(
          'UPDATE users SET role = ?, status = ?, password_hash = ? WHERE LOWER(email) = ?'
        ).bind('super_admin', 'active', SUPER_ADMIN_HASH, SUPER_ADMIN_EMAIL).run();
        console.log('[D1] Successfully refreshed Super Admin role and password in users table:', SUPER_ADMIN_EMAIL);
      }
    } catch (err) {
      console.error('[D1 Error] Failed to ensure Super Admin in D1 via binding:', err);
    }
  }

  // Fallback direct REST query if env Cloudflare credentials exist
  if (env && env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: `
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'user',
              status TEXT DEFAULT 'active',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT OR IGNORE INTO users (name, email, password_hash, role, status) VALUES ('Super Admin', '${SUPER_ADMIN_EMAIL}', '${SUPER_ADMIN_HASH}', 'super_admin', 'active');
            UPDATE users SET role = 'super_admin', status = 'active', password_hash = '${SUPER_ADMIN_HASH}' WHERE LOWER(email) = '${SUPER_ADMIN_EMAIL}';
          `
        }),
      });
    } catch (restErr) {
      console.error('[D1 REST Error]', restErr);
    }
  }
}

// GET /api/login - Proactively seeds Super Admin into D1 and returns health status
export async function onRequestGet(context) {
  const { env } = context;
  await ensureSuperAdminInD1(env.DB, env);
  return new Response(JSON.stringify({ ok: true, message: 'Super admin ensured in D1 database', email: SUPER_ADMIN_EMAIL }), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  // 1. Proactively ensure users table and Super Admin are saved in D1 immediately!
  await ensureSuperAdminInD1(env.DB, env);

  try {
    const { email, password } = await request.json().catch(() => ({}));

    if (!email || !password) {
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

    // Check Rate Limiting
    let failedCount = 0;
    let oldestAttemptTime = null;

    if (env.DB) {
      await env.DB.prepare('DELETE FROM login_attempts WHERE attempt_time < ?')
        .bind(cutoff)
        .run()
        .catch(() => {});

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
      user = await env.DB.prepare('SELECT id, name, email, password_hash, role, status, suspended_until FROM users WHERE LOWER(email) = ?')
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
          sql: 'SELECT id, name, email, password_hash, role, status, suspended_until FROM users WHERE LOWER(email) = ? LIMIT 1',
          params: [cleanEmail],
        }),
      });
      const data = await res.json();
      user = data?.result?.[0]?.results?.[0] || null;
    }

    // Check if user is suspended (Super Admin is NEVER suspended)
    if (user && user.status === 'suspended' && user.role !== 'super_admin') {
      if (user.suspended_until && Date.now() >= user.suspended_until) {
        // Auto-reactivate expired suspension
        if (env.DB) {
          await env.DB.prepare("UPDATE users SET status = 'active', suspended_until = NULL WHERE id = ?").bind(user.id).run().catch(() => {});
        }
        user.status = 'active';
      } else {
        const remainingDays = user.suspended_until ? Math.ceil((user.suspended_until - Date.now()) / (24 * 60 * 60 * 1000)) : null;
        const untilMsg = remainingDays ? ` for ${remainingDays} more day(s)` : '';
        return new Response(
          JSON.stringify({
            error: `Your account has been temporarily suspended by an administrator${untilMsg}. Please contact management.`,
            isSuspended: true,
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Password verification via cryptographic PBKDF2 hash
    let isValid = false;
    if (user && user.password_hash) {
      isValid = await verifyPassword(password, user.password_hash);
    }

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
        token: sessionToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || 'user',
          is_super_admin: user.role === 'super_admin' || user.email === SUPER_ADMIN_EMAIL,
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
