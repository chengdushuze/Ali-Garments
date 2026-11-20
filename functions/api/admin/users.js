import { verifySessionToken, hashPassword } from '../_auth.js';

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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
