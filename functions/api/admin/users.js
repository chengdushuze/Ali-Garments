import { verifySessionToken, hashPassword, verifyPassword, getSessionTokenFromRequest, getSessionSecret, getCorsHeaders, encryptPassword } from '../_auth.js';

async function getAdminSession(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  const secret = getSessionSecret(env);
  return await verifySessionToken(token, secret);
}

async function recordAudit(env, session, request, action, details) {
  if (!env.DB) return;
  try {
    const clientIp = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('x-real-ip') || 
                     request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     'client';
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
    await env.DB.prepare(
      'INSERT INTO audit_logs (user_id, user_email, action, details, ip_address) VALUES (?, ?, ?, ?, ?)'
    ).bind(session.userId || 1, session.email || 'admin', action, details, clientIp).run();
  } catch (e) {
    console.warn('Audit logging failed silently:', e);
  }
}

// GET /api/admin/users - List all users
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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
    let users = [];
    if (env.DB) {
      // Ensure users table and status column exist in SQLite/D1
      try {
        await env.DB.prepare(`
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
        await env.DB.prepare("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'").run();
      } catch (e) {}

      // Ensure all admin and super_admin accounts have VPN and foreign access enabled
      await env.DB.prepare("UPDATE users SET allow_foreign_access = 1, allow_vpn = 1 WHERE role IN ('super_admin', 'admin')").run().catch(() => {});

      // Proactively purge and drop legacy password_plain column if present
      await env.DB.prepare('UPDATE users SET password_plain = NULL WHERE password_plain IS NOT NULL').run().catch(() => {});
      await env.DB.prepare('ALTER TABLE users DROP COLUMN password_plain').run().catch(() => {});
      await env.DB.prepare('ALTER TABLE users ADD COLUMN suspension_reason TEXT').run().catch(() => {});

      // Ensure last_login and policy columns exist
      await env.DB.prepare('ALTER TABLE users ADD COLUMN last_login_ip TEXT').run().catch(() => {});
      await env.DB.prepare('ALTER TABLE users ADD COLUMN last_login_device TEXT').run().catch(() => {});
      await env.DB.prepare('ALTER TABLE users ADD COLUMN last_login_at DATETIME').run().catch(() => {});
      await env.DB.prepare('ALTER TABLE users ADD COLUMN allow_vpn INTEGER DEFAULT 0').run().catch(() => {});
      await env.DB.prepare('ALTER TABLE users ADD COLUMN allow_foreign_access INTEGER DEFAULT 0').run().catch(() => {});
      await env.DB.prepare('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1').run().catch(() => {});

      const res = await env.DB.prepare('SELECT id, name, email, role, COALESCE(status, \'active\') as status, suspended_until, suspension_reason, COALESCE(allow_vpn, 0) as allow_vpn, COALESCE(allow_foreign_access, 0) as allow_foreign_access, last_login_ip, last_login_device, last_login_at, created_at FROM users ORDER BY created_at DESC').all();
      users = res.results || [];
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT id, name, email, role, COALESCE(status, \'active\') as status, suspended_until, suspension_reason, COALESCE(allow_vpn, 0) as allow_vpn, COALESCE(allow_foreign_access, 0) as allow_foreign_access, last_login_ip, last_login_device, last_login_at, created_at FROM users ORDER BY created_at DESC',
        }),
      });
      const data = await res.json();
      users = data?.result?.[0]?.results || [];
    }

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/admin/users - Create new user account
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden. Only administrators can create new user accounts.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { name, email, password, role } = await request.json().catch(() => ({}));

    if (!name || !email || !password) {
      return new Response(JSON.stringify({ error: 'Name, email, and password are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Prevent duplicate Super Admin
    if (cleanEmail === SUPER_ADMIN_EMAIL || role === 'super_admin') {
      return new Response(JSON.stringify({ error: 'Super Admin is a unique single account and cannot be created here.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userRole = role === 'admin' ? 'admin' : 'user';
    const passwordHash = await hashPassword(password);

    if (env.DB) {
      try {
        await env.DB.prepare('ALTER TABLE users ADD COLUMN allow_vpn INTEGER DEFAULT 0').run();
      } catch (e) {}

      await env.DB.prepare(
        'INSERT INTO users (name, email, password_hash, role, status, allow_vpn, token_version) VALUES (?, ?, ?, ?, ?, 0, 1)'
      )
        .bind(name.trim(), cleanEmail, passwordHash, userRole, 'active')
        .run();
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'INSERT INTO users (name, email, password_hash, role, status, allow_vpn, token_version) VALUES (?, ?, ?, ?, ?, 0, 1)',
          params: [name.trim(), cleanEmail, passwordHash, userRole, 'active'],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || 'D1 insertion failed');
      }
    }

    await recordAudit(env, session, request, 'USER_CREATED', `Created user ${cleanEmail} (${userRole})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${cleanEmail} created successfully with role: ${userRole}`,
        user: { name: name.trim(), email: cleanEmail, role: userRole },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Admin create user technical error:', error);
    const isConflict = error.message && error.message.includes('UNIQUE constraint');
    return new Response(
      JSON.stringify({
        error: isConflict ? 'A user with this email already exists.' : 'Something went wrong. Please try again.',
      }),
      {
        status: isConflict ? 409 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

// DELETE /api/admin/users?id=123 - Remove user account
export async function onRequestDelete(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safety guard: Admin cannot delete their own active account
    if (parseInt(session.userId, 10) === parseInt(id, 10)) {
      return new Response(JSON.stringify({ error: 'You cannot remove your own active administrator account.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Protection Guard: Super Admin cannot be deleted by ANY admin
    let targetUser = null;
    if (env.DB) {
      targetUser = await env.DB.prepare('SELECT email, role FROM users WHERE id = ?').bind(id).first();
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'SELECT email, role FROM users WHERE id = ?', params: [id] }),
      });
      const data = await res.json();
      targetUser = data?.result?.[0]?.results?.[0];
    }

    if (targetUser && targetUser.role === 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Super Admin account is permanently protected and cannot be deleted by any administrator' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (env.DB) {
      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'DELETE FROM users WHERE id = ?',
          params: [id],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || 'D1 delete failed');
      }
    }

    await recordAudit(env, session, request, 'USER_DELETED', `Deleted user account #${id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User account removed successfully.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Admin delete user error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// PATCH /api/admin/users - Change user password OR toggle user suspension status (with admin consent verification)
export async function onRequestPatch(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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
    const { id, newPassword, status, durationDays, suspensionReason, role, allowVpn, allowForeignAccess, adminPassword } = await request.json().catch(() => ({}));

    if (!id || !adminPassword) {
      return new Response(JSON.stringify({ error: 'User ID and admin verification password are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Must provide either newPassword, status, role, allowVpn, or allowForeignAccess
    if (!newPassword && !status && !role && allowVpn === undefined && allowForeignAccess === undefined) {
      return new Response(JSON.stringify({ error: 'Please specify a new password, status update, role change, VPN setting, or foreign access permission.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (newPassword && newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'New password must be at least 6 characters long.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guard: Admin cannot suspend their own active account
    if (status && status === 'suspended' && parseInt(session.userId, 10) === parseInt(id, 10)) {
      return new Response(JSON.stringify({ error: 'You cannot suspend your own active administrator account.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Protection Guard: Super Admin cannot be suspended, and only Super Admin can change their own password
    let targetUser = null;
    if (env.DB) {
      targetUser = await env.DB.prepare('SELECT email, role FROM users WHERE id = ?').bind(id).first();
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'SELECT email, role FROM users WHERE id = ?', params: [id] }),
      });
      const data = await res.json();
      targetUser = data?.result?.[0]?.results?.[0];
    }

    if (targetUser && (targetUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL || targetUser.role === 'super_admin')) {
      if (status === 'suspended') {
        return new Response(
          JSON.stringify({ error: 'Super Admin account is permanently protected and cannot be suspended.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (newPassword && session.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
        return new Response(
          JSON.stringify({ error: 'Only the Super Admin can change the Super Admin account password.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 1. Fetch current admin's stored password hash to verify consent
    let currentAdmin = null;
    if (env.DB) {
      currentAdmin = await env.DB.prepare('SELECT id, email, password_hash FROM users WHERE id = ?')
        .bind(session.userId)
        .first();
      if (!currentAdmin && session.email) {
        currentAdmin = await env.DB.prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
          .bind(session.email)
          .first();
      }
    } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT id, email, password_hash FROM users WHERE id = ?',
          params: [session.userId],
        }),
      });
      const data = await res.json();
      currentAdmin = data?.result?.[0]?.results?.[0];
    }

    if (!currentAdmin || !currentAdmin.password_hash) {
      return new Response(JSON.stringify({ error: 'Admin identity could not be verified in database.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Cryptographically verify the admin's password before proceeding
    const isConsentValid = await verifyPassword(adminPassword, currentAdmin.password_hash);
    if (!isConsentValid) {
      await new Promise((r) => setTimeout(r, 500));
      return new Response(JSON.stringify({ error: 'Incorrect admin verification password. Action denied.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ensure status column exists if updating status
    if (env.DB && status) {
      try {
        await env.DB.prepare("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'").run();
        await env.DB.prepare("ALTER TABLE users ADD COLUMN suspension_reason TEXT").run();
      } catch (e) {}
    }

    // 3. Perform update based on requested action
    // A) Role Change (Super Admin privilege only)
    if (role) {
      if (session.role !== 'super_admin') {
        return new Response(JSON.stringify({ error: 'Forbidden. Only Super Admin has authority to change user roles.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (targetUser && targetUser.role === 'super_admin') {
        return new Response(JSON.stringify({ error: 'Super Admin position is permanent and cannot be modified' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const safeRole = role === 'admin' ? 'admin' : 'user';

      if (env.DB) {
        await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(safeRole, id).run();
      } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
        const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: 'UPDATE users SET role = ? WHERE id = ?', params: [safeRole, id] }),
        });
      }

      await recordAudit(env, session, request, 'USER_ROLE_CHANGED', `Super Admin changed user #${id} role to ${safeRole}`);

      return new Response(
        JSON.stringify({
          success: true,
          role: safeRole,
          message: `User role has been successfully changed to ${safeRole === 'admin' ? 'Administrator' : 'Standard User'}.`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // B) Change Password
    if (newPassword) {
      const passwordHash = await hashPassword(newPassword);

      if (env.DB) {
        await env.DB.prepare('UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 1) + 1, password_plain = NULL WHERE id = ?')
          .bind(passwordHash, id)
          .run();

        const targetUser = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(id).first().catch(() => null);
        if (targetUser?.email) {
          await env.DB.prepare('DELETE FROM login_attempts WHERE identifier = ?').bind(targetUser.email.toLowerCase()).run().catch(() => {});
        }
      } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
        const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sql: 'UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 1) + 1, password_plain = NULL WHERE id = ?',
            params: [passwordHash, id],
          }),
        });
      }

      await recordAudit(env, session, request, 'PASSWORD_CHANGED', `Changed password for user account #${id} (Session invalidated)`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Password successfully updated and all active user sessions have been terminated.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // C) Status Suspension with optional duration in days & custom suspension reason
    if (status) {
      const safeStatus = status === 'suspended' ? 'suspended' : 'active';
      const days = (durationDays && Number(durationDays) > 0) ? Number(durationDays) : 0;
      const suspendedUntil = safeStatus === 'suspended' && days > 0 ? (Date.now() + (days * 24 * 60 * 60 * 1000)) : null;
      const finalReason = safeStatus === 'suspended'
        ? (suspensionReason?.trim() || 'We suspected unusual activity on your account.')
        : null;

      if (env.DB) {
        try { await env.DB.prepare('ALTER TABLE users ADD COLUMN suspension_reason TEXT').run(); } catch (e) {}
        await env.DB.prepare('UPDATE users SET status = ?, suspended_until = ?, suspension_reason = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?')
          .bind(safeStatus, suspendedUntil, finalReason, id)
          .run();

        if (safeStatus === 'active') {
          const targetUser = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(id).first().catch(() => null);
          if (targetUser?.email) {
            await env.DB.prepare('DELETE FROM login_attempts WHERE identifier = ?').bind(targetUser.email.toLowerCase()).run().catch(() => {});
          }
        }
      } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
        const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sql: 'UPDATE users SET status = ?, suspended_until = ?, suspension_reason = ?, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?',
            params: [safeStatus, suspendedUntil, finalReason, id],
          }),
        });
      }

      const durationText = days > 0 ? ` for ${days} day${days > 1 ? 's' : ''}` : ' indefinitely';
      const reasonDetail = safeStatus === 'suspended' ? `. Reason: "${finalReason}"` : '';
      await recordAudit(
        env,
        session,
        request,
        safeStatus === 'suspended' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
        safeStatus === 'suspended'
          ? `Suspended user account #${id}${durationText}${reasonDetail}`
          : `Reactivated user account #${id}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          status: safeStatus,
          suspended_until: suspendedUntil,
          suspension_reason: finalReason,
          message: safeStatus === 'suspended'
            ? `User account has been temporarily suspended${durationText}. All sessions terminated.`
            : 'User account has been successfully reactivated.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // D) Allow VPN / Proxy Toggle
    if (allowVpn !== undefined) {
      const vpnVal = allowVpn ? 1 : 0;
      if (env.DB) {
        try {
          await env.DB.prepare('ALTER TABLE users ADD COLUMN allow_vpn INTEGER DEFAULT 0').run();
          await env.DB.prepare('ALTER TABLE users ADD COLUMN allow_foreign_access INTEGER DEFAULT 0').run();
        } catch (e) {}
        // Commercial VPNs route through foreign exit nodes (e.g., IL, US, SG).
        // Therefore, allowing VPN access automatically grants foreign access so users aren't blocked by Pakistan geo-fencing!
        if (vpnVal === 1) {
          await env.DB.prepare('UPDATE users SET allow_vpn = 1, allow_foreign_access = 1, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?').bind(id).run();
        } else {
          await env.DB.prepare('UPDATE users SET allow_vpn = 0, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?').bind(id).run();
        }
      } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
        const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
        const sql = vpnVal === 1
          ? 'UPDATE users SET allow_vpn = 1, allow_foreign_access = 1, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?'
          : 'UPDATE users SET allow_vpn = 0, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?';
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, params: [id] }),
        });
      }

      await recordAudit(env, session, request, 'USER_VPN_POLICY', `Admin changed user #${id} VPN permission to ${vpnVal ? 'ALLOWED' : 'BLOCKED'}`);

      return new Response(
        JSON.stringify({
          success: true,
          allow_vpn: vpnVal,
          allow_foreign_access: vpnVal === 1 ? 1 : undefined,
          message: `VPN/Proxy access for this user is now ${vpnVal ? 'ALLOWED (Foreign VPN routes authorized)' : 'BLOCKED'}.`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // E) Allow Foreign Access (Outside Pakistan) Toggle - Strictly Super Admin only
    if (allowForeignAccess !== undefined) {
      if (session.role !== 'super_admin') {
        return new Response(
          JSON.stringify({ error: 'Only Super Admin has authority to grant foreign access permissions.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const foreignVal = allowForeignAccess ? 1 : 0;
      if (env.DB) {
        try {
          await env.DB.prepare('ALTER TABLE users ADD COLUMN allow_foreign_access INTEGER DEFAULT 0').run();
          await env.DB.prepare('ALTER TABLE users ADD COLUMN allow_vpn INTEGER DEFAULT 0').run();
        } catch (e) {}
        if (foreignVal === 1) {
          await env.DB.prepare('UPDATE users SET allow_foreign_access = 1, allow_vpn = 1, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?').bind(id).run();
        } else {
          await env.DB.prepare('UPDATE users SET allow_foreign_access = 0, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?').bind(id).run();
        }
      } else if (env.CF_ACCOUNT_ID && env.CF_DATABASE_ID && env.CF_API_TOKEN) {
        const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;
        const sql = foreignVal === 1
          ? 'UPDATE users SET allow_foreign_access = 1, allow_vpn = 1, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?'
          : 'UPDATE users SET allow_foreign_access = 0, token_version = COALESCE(token_version, 1) + 1 WHERE id = ?';
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, params: [id] }),
        });
      }

      await recordAudit(env, session, request, 'USER_FOREIGN_POLICY', `Super Admin changed user #${id} foreign access permission to ${foreignVal ? 'ALLOWED' : 'BLOCKED'}`);

      return new Response(
        JSON.stringify({
          success: true,
          allow_foreign_access: foreignVal,
          allow_vpn: foreignVal === 1 ? 1 : undefined,
          message: `Foreign access (outside Pakistan) for this user is now ${foreignVal ? 'ALLOWED' : 'BLOCKED'} All active sessions invalidated`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ error: 'No valid action provided.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Admin change password error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
