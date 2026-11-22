// functions/api/app-version.js
import { verifySessionToken, getSessionTokenFromRequest, getSessionSecret, getCorsHeaders } from './_auth.js';

export async function onRequestOptions(context) {
  const corsHeaders = getCorsHeaders(context.request);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

const DEFAULT_UPDATE_URL = 'https://wa.me/8615840121968';

// GET /api/app-version - Retrieve allowed app versions and update URL
export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  try {
    let allowedVersions = '';
    let updateUrl = DEFAULT_UPDATE_URL;

    if (env.DB) {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `).run().catch(() => {});

      const rows = await env.DB.prepare(
        "SELECT key, value FROM settings WHERE key IN ('allowed_app_versions', 'app_update_url')"
      ).all().catch(() => ({ results: [] }));

      const list = rows.results || [];
      const versionsRow = list.find(r => r.key === 'allowed_app_versions');
      const urlRow = list.find(r => r.key === 'app_update_url');

      if (versionsRow && typeof versionsRow.value === 'string') {
        allowedVersions = versionsRow.value.trim();
      }
      if (urlRow && typeof urlRow.value === 'string' && urlRow.value.trim()) {
        updateUrl = urlRow.value.trim();
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        allowedVersions: allowedVersions,
        updateUrl: updateUrl,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: true,
        allowedVersions: '',
        updateUrl: DEFAULT_UPDATE_URL,
        error: err?.message || String(err),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// POST /api/app-version - Super Admin update allowed app versions and update redirect URL
export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = getCorsHeaders(request);

  // 1. Authenticate user
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized Please sign in' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secret = getSessionSecret(env);
  const session = await verifySessionToken(token, secret);
  if (!session || session.role !== 'super_admin') {
    return new Response(JSON.stringify({ error: 'Forbidden Only Super Admin can manage app versions' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawVersions = typeof body.allowedVersions === 'string' ? body.allowedVersions : '';
    const cleanVersions = rawVersions.trim();
    const rawUrl = typeof body.updateUrl === 'string' ? body.updateUrl.trim() : '';
    const cleanUrl = rawUrl || DEFAULT_UPDATE_URL;

    if (env.DB) {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `).run().catch(() => {});

      await env.DB.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('allowed_app_versions', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).bind(cleanVersions).run();

      await env.DB.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('app_update_url', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).bind(cleanUrl).run();

      // Log in audit trail
      const clientIp = request.headers.get('CF-Connecting-IP') || 'client';
      await env.DB.prepare(`
        INSERT INTO audit_logs (user_id, user_email, action, details, ip_address)
        VALUES (?, ?, 'UPDATE_APP_VERSIONS', ?, ?)
      `).bind(
        session.userId || 1,
        session.email || 'super_admin',
        `App versions: ${cleanVersions || 'All allowed'} | Update URL: ${cleanUrl}`,
        clientIp
      ).run().catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'App version settings updated successfully',
        allowedVersions: cleanVersions,
        updateUrl: cleanUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to update app versions',
        details: error?.message || String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
