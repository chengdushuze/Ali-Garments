import { verifySessionToken } from './_auth.js';

async function getAuthSession(request, env) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) return null;
  const secret = env.SESSION_SECRET || 'ali-garments-production-session-secret-2026';
  return await verifySessionToken(token, secret);
}

// GET /api/data - Get items owned strictly by the authenticated user
export async function onRequestGet(context) {
  const { request, env } = context;
  const session = await getAuthSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let items = [];
    if (env.DB) {
      // Scoped strictly to WHERE user_id = ?
      const res = await env.DB.prepare(
        'SELECT id, user_id, content, created_at FROM items WHERE user_id = ? ORDER BY created_at DESC'
      )
        .bind(session.userId)
        .all();
      items = res.results || [];
    }
    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Data GET error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /api/data - Create item owned by the authenticated user
export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await getAuthSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { content } = await request.json().catch(() => ({}));
    if (!content || !content.trim()) {
      return new Response(JSON.stringify({ error: 'Content is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (env.DB) {
      const result = await env.DB.prepare(
        'INSERT INTO items (user_id, content) VALUES (?, ?)'
      )
        .bind(session.userId, content.trim())
        .run();

      return new Response(
        JSON.stringify({
          success: true,
          item: {
            id: result.meta?.last_row_id,
            user_id: session.userId,
            content: content.trim(),
            created_at: new Date().toISOString(),
          },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Data POST error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// DELETE /api/data - Delete item owned by authenticated user
export async function onRequestDelete(context) {
  const { request, env } = context;
  const session = await getAuthSession(request, env);

  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Item ID is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (env.DB) {
      // Scoped strictly to WHERE id = ? AND user_id = ?
      await env.DB.prepare('DELETE FROM items WHERE id = ? AND user_id = ?')
        .bind(id, session.userId)
        .run();
    }

    return new Response(JSON.stringify({ success: true, message: 'Item deleted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Data DELETE error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
