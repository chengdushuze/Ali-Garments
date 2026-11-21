import { verifyPassword, signSessionToken, getSessionSecret, getCorsHeaders, isVpnOrProxy } from './_auth.js';

const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
const SUPER_ADMIN_EMAIL = 'admin@chengdushuze.com';

// GET /api/login - Prohibit auto-seeding over public HTTP; return 405 Method Not Allowed
export async function onRequestGet(context) {
  const { request } = context;
  const corsHeaders = getCorsHeaders(request);
  return new Response(JSON.stringify({ 
    error: 'Method Not Allowed. Super admin seeding is restricted to CLI scripts (scripts/seed-super-admin.js).' 
  }), {
    status: 405,
    headers: {
      ...corsHeaders,
      'Allow': 'POST, OPTIONS',
      'Content-Type': 'application/json',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // Ensure database columns exist safely
  if (env.DB) {
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN allow_vpn INTEGER DEFAULT 0').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN allow_foreign_access INTEGER DEFAULT 0').run(); } catch (e) {}
    try { await env.DB.prepare('ALTER TABLE users ADD COLUMN suspended_until INTEGER').run(); } catch (e) {}
  }

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
      // Proactively purge and drop legacy password_plain column if present
      await env.DB.prepare('UPDATE users SET password_plain = NULL WHERE password_plain IS NOT NULL').run().catch(() => {});
      await env.DB.prepare('ALTER TABLE users DROP COLUMN password_plain').run().catch(() => {});
      await env.DB.prepare('ALTER TABLE users ADD COLUMN suspension_reason TEXT').run().catch(() => {});

      user = await env.DB.prepare(
        `SELECT id, name, email, password_hash, role, status, suspended_until, suspension_reason, 
                COALESCE(token_version, 1) as token_version, 
                COALESCE(allow_vpn, 0) as allow_vpn,
                COALESCE(allow_foreign_access, 0) as allow_foreign_access 
         FROM users WHERE LOWER(email) = ?`
      )
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
          sql: `SELECT id, name, email, password_hash, role, status, suspended_until, suspension_reason, 
                       COALESCE(token_version, 1) as token_version, 
                       COALESCE(allow_vpn, 0) as allow_vpn,
                       COALESCE(allow_foreign_access, 0) as allow_foreign_access 
                FROM users WHERE LOWER(email) = ? LIMIT 1`,
          params: [cleanEmail],
        }),
      });
      const data = await res.json();
      user = data?.result?.[0]?.results?.[0] || null;
    }

    // Check Pakistan-only Geo Restriction (Super Admin & Admin & users with foreign/VPN permission)
    const clientCountry = request.cf?.country; // Undefined in local dev / native requests
    const isSuperAdmin = user && (user.role === 'super_admin' || user.email?.toLowerCase() === 'admin@chengdushuze.com');
    const isAdmin = user && user.role === 'admin';
    
    if (clientCountry && clientCountry !== 'PK') {
      const hasForeignAccess = isSuperAdmin || isAdmin || (user && (Number(user.allow_foreign_access) === 1 || Number(user.allow_vpn) === 1));
      if (!hasForeignAccess) {
        if (env.DB) {
          try {
            await env.DB.prepare(
              'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
            ).bind(
              user?.id || null,
              cleanEmail,
              'GEO_BLOCKED',
              `Login blocked: Access from country '${clientCountry}' denied (User lacks foreign access or VPN permission).`,
              clientIp
            ).run();
          } catch (e) {}
        }

        return new Response(
          JSON.stringify({
            error: `Access restricted to Pakistan (PK). Your detected location is ${clientCountry}. Please contact Super Admin for foreign access authorization.`,
            code: 'GEO_BLOCKED',
            isGeoBlocked: true,
            country: clientCountry
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Check Strict VPN / Proxy Policy (Super Admin & Admin & users with allow_vpn = 1)
    if (isVpnOrProxy(request)) {
      const isVpnAllowed = isSuperAdmin || isAdmin || (user && Number(user.allow_vpn) === 1);
      if (!user || !isVpnAllowed) {
        if (env.DB) {
          try {
            await env.DB.prepare(
              'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
            ).bind(
              user?.id || null,
              cleanEmail,
              'VPN_BLOCKED',
              `Login blocked: Access via VPN or proxy denied without admin authorization.`,
              clientIp
            ).run();
          } catch (e) {}
        }

        return new Response(
          JSON.stringify({
            error: 'VPN or Proxy connection detected. Security policy requires Administrator authorization to access ALI Garments through a VPN or Proxy. Please disable your VPN or contact your administrator.',
            code: 'VPN_BLOCKED',
            isVpnBlocked: true
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
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
        const defaultReason = 'We suspected unusual activity on your account.';
        const reason = user.suspension_reason?.trim() || defaultReason;
        return new Response(
          JSON.stringify({
            error: `Your account has been temporarily suspended by an administrator${untilMsg}.\nReason: ${reason}`,
            isSuspended: true,
            reason: reason,
            suspendedDays: remainingDays,
            suspendedUntil: user.suspended_until,
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

      const message = remaining === 0
        ? 'Too many failed login attempts (3 maximum). For your security, login is locked for 15 minutes.'
        : 'Email or Password Are incorrect.';

      return new Response(
        JSON.stringify({
          error: message,
          isWrongPassword: !!user,
          isRateLimited: remaining === 0,
        }),
        {
          status: remaining === 0 ? 429 : 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Determine client device type from User-Agent
    const userAgent = request.headers.get('User-Agent') || request.headers.get('user-agent') || '';
    let deviceType = 'Desktop Web';
    if (/android.*wv|capacitor|cordova/i.test(userAgent)) {
      deviceType = 'Android App (APK)';
    } else if (/android/i.test(userAgent)) {
      deviceType = 'Android Mobile';
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      deviceType = 'iOS Mobile';
    } else if (/windows/i.test(userAgent)) {
      deviceType = 'Windows PC';
    } else if (/macintosh|mac os/i.test(userAgent)) {
      deviceType = 'Mac OS';
    } else if (/linux/i.test(userAgent)) {
      deviceType = 'Linux';
    }

    // 4. Successful Login: Clear all failed attempts for this email and IP
    if (env.DB) {
      await env.DB.prepare('DELETE FROM login_attempts WHERE identifier = ? OR identifier = ?')
        .bind(cleanEmail, clientIp)
        .run()
        .catch(() => {});

      // Record audit log and update last login IP & device info
      try {
        await env.DB.prepare(
          'CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, user_email TEXT, action TEXT NOT NULL, details TEXT, ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
        ).run().catch(() => {});

        await env.DB.prepare('ALTER TABLE users ADD COLUMN last_login_ip TEXT').run().catch(() => {});
        await env.DB.prepare('ALTER TABLE users ADD COLUMN last_login_device TEXT').run().catch(() => {});
        await env.DB.prepare('ALTER TABLE users ADD COLUMN last_login_at DATETIME').run().catch(() => {});

        await env.DB.prepare(
          'UPDATE users SET last_login_ip = ?, last_login_device = ?, last_login_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(clientIp, deviceType, user.id).run().catch(() => {});

        await env.DB.prepare(
          'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
        ).bind(user.id, user.email, 'USER_LOGIN', `User ${user.name} signed in from ${deviceType} (IP: ${clientIp}${clientCountry ? ', Country: ' + clientCountry : ''})`, clientIp).run().catch(() => {});
      } catch (e) {}
    }

    // 5. Sign session token with SESSION_SECRET (Strict 5-Day Expiration for Security)
    const secret = getSessionSecret(env);
    const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
    const FIVE_DAYS_SECONDS = 5 * 24 * 60 * 60; // 432,000 seconds

    const isSuper = user.role === 'super_admin' || user.email?.toLowerCase() === 'admin@chengdushuze.com';
    const sessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      allow_vpn: isSuper ? 1 : (user.allow_vpn || 0),
      allow_foreign_access: isSuper ? 1 : (user.allow_foreign_access || 0),
      ver: user.token_version || 1,
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
          allow_vpn: isSuper ? 1 : (user.allow_vpn || 0),
          allow_foreign_access: isSuper ? 1 : (user.allow_foreign_access || 0),
          is_super_admin: isSuper,
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

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
