import { verifySessionToken, hashPassword, verifyPassword } from '../_auth.js';

async function getAdminSession(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) return null;
  const secret = env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
  const session = await verifySessionToken(token, secret);
  return session;
}

// GET /api/admin/users - List all users
export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden. Admin privileges required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let users = [];
    if (env.DB) {
      const res = await env.DB.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
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
          sql: 'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC',
        }),
      });
      const data = await res.json();
      users = data?.result?.[0]?.results || [];
    }

    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/admin/users - Create new user account
export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden. Only administrators can create new user accounts.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { name, email, password, role } = await request.json().catch(() => ({}));

    if (!name || !email || !password) {
      return new Response(JSON.stringify({ error: 'Name, email, and password are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userRole = role === 'admin' ? 'admin' : 'user';
    const passwordHash = await hashPassword(password);

    if (env.DB) {
      await env.DB.prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
      )
        .bind(name.trim(), cleanEmail, passwordHash, userRole)
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
          sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
          params: [name.trim(), cleanEmail, passwordHash, userRole],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || 'D1 insertion failed');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${cleanEmail} created successfully with role: ${userRole}`,
        user: { name: name.trim(), email: cleanEmail, role: userRole },
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// DELETE /api/admin/users?id=123 - Remove user account
export async function onRequestDelete(context) {
  const { request, env } = context;
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden. Admin privileges required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Safety guard: Admin cannot delete their own active account
    if (parseInt(session.userId, 10) === parseInt(id, 10)) {
      return new Response(JSON.stringify({ error: 'You cannot remove your own active administrator account.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User account removed successfully.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Admin delete user error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// PATCH /api/admin/users - Change user or admin password with admin consent verification
export async function onRequestPatch(context) {
  const { request, env } = context;
  const session = await getAdminSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (session.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden. Admin privileges required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { id, newPassword, adminPassword } = await request.json().catch(() => ({}));

    if (!id || !newPassword || !adminPassword) {
      return new Response(JSON.stringify({ error: 'User ID, new password, and current admin verification password are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'New password must be at least 6 characters long.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch current admin's stored password hash to verify consent
    let currentAdmin = null;
    if (env.DB) {
      currentAdmin = await env.DB.prepare('SELECT id, email, password_hash FROM users WHERE id = ?')
        .bind(session.userId)
        .first();
      // Fallback by email if id changed
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

    // 2. Cryptographically verify the admin's password before allowing ANY password change
    const isConsentValid = await verifyPassword(adminPassword, currentAdmin.password_hash);
    if (!isConsentValid) {
      // 500ms delay to thwart brute-force attempts
      await new Promise((r) => setTimeout(r, 500));
      return new Response(JSON.stringify({ error: 'Incorrect admin verification password. Action denied.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Hash new password and update the targeted user (user or admin)
    const passwordHash = await hashPassword(newPassword);

    if (env.DB) {
      await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .bind(passwordHash, id)
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
          sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
          params: [passwordHash, id],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0]?.message || 'D1 update failed');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password successfully updated after verified admin authorization.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
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
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
